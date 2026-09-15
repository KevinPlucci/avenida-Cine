-- =====================================================================
--  Migración 004 · Descuento por edad y horario de validación del QR
--  (correcciones de los emails del 30/01 y del 06/02)
--  Para bases que ya tienen la migración 003.
--  Uso: Supabase > SQL Editor > New query > pegar todo el archivo > Run
--  Se puede ejecutar más de una vez sin problemas.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Descuento por edad: el email pide "más de 50 años".
--     Con la edad configurada en 50, aplica desde los 51 años cumplidos.
-- ---------------------------------------------------------------------

-- Compra de entradas y productos del candy bar. Valida la función, las butacas y los productos,
-- calcula el precio y aplica el mejor descuento disponible. Devuelve el código de la compra (QR).
-- Ni el precio ni el descuento vienen del cliente.
create or replace function public.comprar_entradas(
  p_funcion_id bigint,
  p_butacas    text[],
  p_email      text default null,
  p_nombre     text default null,
  p_productos  jsonb default '[]'::jsonb
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_usuario     uuid := auth.uid();
  v_funcion     public.funciones%rowtype;
  v_perfil      public.perfiles%rowtype;
  v_cupon       public.cupones%rowtype;
  v_regla       public.cupones_regla%rowtype;
  v_cantidad    int;
  v_subtotal    numeric(10, 2);
  v_productos   numeric(10, 2) := 0;
  v_descuento   numeric(10, 2) := 0;
  v_porcentaje  int  := 0;
  v_motivo      text;
  v_items       int  := 0;
  v_compra_id   bigint;
  v_codigo      uuid;
  v_butaca      text;
begin
  select * into v_funcion from public.funciones where id = p_funcion_id;
  if not found then
    raise exception 'La función no existe';
  end if;
  if v_funcion.inicio <= now() then
    raise exception 'La función ya comenzó, no se pueden comprar entradas';
  end if;
  if not exists (select 1 from public.peliculas where id = v_funcion.pelicula_id and en_cartelera) then
    raise exception 'La película no está en cartelera';
  end if;

  v_cantidad := coalesce(array_length(p_butacas, 1), 0);
  if v_cantidad = 0 then
    raise exception 'Elegí al menos una butaca';
  end if;
  if v_cantidad > 10 then
    raise exception 'Se pueden comprar hasta 10 butacas por compra';
  end if;
  if (select count(distinct b) from unnest(p_butacas) as b) <> v_cantidad then
    raise exception 'Hay butacas repetidas';
  end if;

  foreach v_butaca in array p_butacas loop
    if v_butaca !~ '^[A-T]([1-9]|1[0-9]|2[0-8])$' then
      raise exception 'Butaca inválida: %', v_butaca;
    end if;
  end loop;

  -- Productos del candy bar (email 30/01). El precio sale de la base, no del cliente.
  if p_productos is null or jsonb_typeof(p_productos) <> 'array' then
    p_productos := '[]'::jsonb;
  end if;
  v_items := jsonb_array_length(p_productos);

  if v_items > 0 then
    if exists (
      select 1 from jsonb_to_recordset(p_productos) as x(producto_id bigint, cantidad int)
      where x.producto_id is null or x.cantidad is null or x.cantidad not between 1 and 20
    ) then
      raise exception 'Cantidad inválida en los productos del candy bar';
    end if;

    if (select count(distinct x.producto_id)
        from jsonb_to_recordset(p_productos) as x(producto_id bigint, cantidad int)) <> v_items then
      raise exception 'Hay productos repetidos';
    end if;

    if exists (
      select 1 from jsonb_to_recordset(p_productos) as x(producto_id bigint, cantidad int)
      where not exists (select 1 from public.productos pr where pr.id = x.producto_id and pr.disponible)
    ) then
      raise exception 'Alguno de los productos elegidos ya no está disponible';
    end if;

    select coalesce(sum(pr.precio * x.cantidad), 0) into v_productos
    from jsonb_to_recordset(p_productos) as x(producto_id bigint, cantidad int)
    join public.productos pr on pr.id = x.producto_id;
  end if;

  -- Datos del comprador: si está logueado se toman de su perfil.
  if v_usuario is not null then
    select * into v_perfil from public.perfiles where id = v_usuario;
    p_email  := v_perfil.email;
    p_nombre := v_perfil.nombre || ' ' || v_perfil.apellido;
  else
    if coalesce(trim(p_nombre), '') = '' then
      raise exception 'Ingresá tu nombre';
    end if;
    if coalesce(trim(p_email), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Ingresá un email válido';
    end if;
  end if;

  v_subtotal := v_funcion.precio * v_cantidad;

  -- Descuentos (solo usuarios registrados y solo sobre las entradas).
  -- Si aplican los dos se usa el mayor: no se acumulan.
  if v_usuario is not null then
    -- "for update" evita que el cupón de primera compra se use dos veces en paralelo.
    select * into v_cupon
    from public.cupones
    where usuario_id = v_usuario and tipo = 'primera_compra' and not usado
    for update;
    if found then
      v_porcentaje := v_cupon.porcentaje;
      v_motivo     := 'primera_compra';
    end if;

    -- Descuento por edad (email 30/01): para quienes tienen más años que la edad configurada.
    -- No se consume, aplica en cada compra.
    select * into v_regla from public.cupones_regla where tipo = 'mayores' and activo;
    if found and v_regla.edad_minima is not null
       and public.edad(v_perfil.fecha_nacimiento) > v_regla.edad_minima
       and v_regla.porcentaje > v_porcentaje then
      v_porcentaje := v_regla.porcentaje;
      v_motivo     := 'mayores';
    end if;

    v_descuento := round(v_subtotal * v_porcentaje / 100.0, 2);
    if v_motivo = 'primera_compra' then
      update public.cupones set usado = true where id = v_cupon.id;
    end if;
  end if;

  insert into public.compras (
    usuario_id, email, nombre_comprador, funcion_id, cantidad,
    subtotal, subtotal_productos, descuento, descuento_motivo, total, cupon_id
  )
  values (
    v_usuario, lower(trim(p_email)), trim(p_nombre), p_funcion_id, v_cantidad,
    v_subtotal, v_productos, v_descuento,
    case when v_descuento > 0 then v_motivo end,
    v_subtotal + v_productos - v_descuento,
    case when v_descuento > 0 and v_motivo = 'primera_compra' then v_cupon.id end
  )
  returning id, codigo into v_compra_id, v_codigo;

  begin
    insert into public.entradas (compra_id, funcion_id, fila, numero, precio)
    select v_compra_id, p_funcion_id, left(b, 1), substring(b from 2)::int, v_funcion.precio
    from unnest(p_butacas) as b;
  exception
    when unique_violation then
      raise exception 'Alguna de las butacas elegidas ya fue vendida. Elegí otras.';
  end;

  if v_items > 0 then
    insert into public.compra_productos (compra_id, producto_id, nombre, cantidad, precio_unitario)
    select v_compra_id, pr.id, pr.nombre, x.cantidad, pr.precio
    from jsonb_to_recordset(p_productos) as x(producto_id bigint, cantidad int)
    join public.productos pr on pr.id = x.producto_id;
  end if;

  return v_codigo;
end;
$$;

-- Descuentos disponibles para el usuario logueado (los muestra el perfil y la compra).
create or replace function public.mis_beneficios()
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'primera_compra', (select json_build_object('porcentaje', c.porcentaje, 'usado', c.usado)
                       from public.cupones c
                       where c.usuario_id = auth.uid() and c.tipo = 'primera_compra'),
    'mayores',        (select json_build_object('porcentaje', r.porcentaje, 'edad_minima', r.edad_minima)
                       from public.cupones_regla r
                       join public.perfiles pe on pe.id = auth.uid()
                       where r.tipo = 'mayores' and r.activo and r.edad_minima is not null
                         and public.edad(pe.fecha_nacimiento) > r.edad_minima)
  );
$$;

-- ---------------------------------------------------------------------
--  2. Validación del QR: desde una hora antes del inicio hasta que termina la función.
--     Las fechas de los mensajes se muestran en hora de Argentina.
-- ---------------------------------------------------------------------

-- Marca la entrada como usada. A partir de ahí el QR ya no sirve para ingresar.
create or replace function public.validar_entrada(p_codigo uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_compra  public.compras%rowtype;
  v_funcion public.funciones%rowtype;
begin
  if not public.es_empleado() then
    raise exception 'Solo el personal del cine puede validar entradas';
  end if;

  select * into v_compra from public.compras where codigo = p_codigo for update;
  if not found then
    raise exception 'No existe ninguna compra con ese código';
  end if;
  if v_compra.validada_en is not null then
    raise exception 'Esta entrada ya fue validada el %',
      to_char(v_compra.validada_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI');
  end if;

  select * into v_funcion from public.funciones where id = v_compra.funcion_id;
  if now() < v_funcion.inicio - interval '1 hour' then
    raise exception 'La función empieza el % h. La entrada se puede validar desde una hora antes',
      to_char(v_funcion.inicio at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI');
  end if;
  if now() > v_funcion.fin then
    raise exception 'La función ya terminó';
  end if;

  update public.compras
  set validada_en = now(), validada_por = auth.uid()
  where id = v_compra.id;

  return public.compra_para_validar(p_codigo);
end;
$$;

-- Marca los productos del candy bar como entregados. El mismo QR sirve para retirarlos.
create or replace function public.entregar_productos(p_codigo uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_compra  public.compras%rowtype;
  v_funcion public.funciones%rowtype;
begin
  if not public.es_empleado() then
    raise exception 'Solo el personal del cine puede entregar productos';
  end if;

  select * into v_compra from public.compras where codigo = p_codigo for update;
  if not found then
    raise exception 'No existe ninguna compra con ese código';
  end if;
  if not exists (select 1 from public.compra_productos where compra_id = v_compra.id) then
    raise exception 'Esta compra no incluye productos del candy bar';
  end if;
  if v_compra.entregado_en is not null then
    raise exception 'Los productos de esta compra ya se entregaron el %',
      to_char(v_compra.entregado_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI');
  end if;

  select * into v_funcion from public.funciones where id = v_compra.funcion_id;
  if now() < v_funcion.inicio - interval '1 hour' then
    raise exception 'La función empieza el % h. Los productos se entregan desde una hora antes',
      to_char(v_funcion.inicio at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI');
  end if;
  if now() > v_funcion.fin then
    raise exception 'La función ya terminó';
  end if;

  update public.compras
  set entregado_en = now(), entregado_por = auth.uid()
  where id = v_compra.id;

  return public.compra_para_validar(p_codigo);
end;
$$;
