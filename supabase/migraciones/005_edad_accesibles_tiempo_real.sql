-- =====================================================================
--  Migración 005 · Restricción de edad, fila accesible y butacas en tiempo real
--  (email del 12/02)
--  Para bases que ya tienen la migración 004.
--  Uso: Supabase > SQL Editor > New query > pegar todo el archivo > Run
--  Se puede ejecutar más de una vez sin problemas.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Restricción de edad por película: 0 = ATP, 13 o 18
-- ---------------------------------------------------------------------
alter table public.peliculas
  add column if not exists restriccion_edad int not null default 0;
alter table public.peliculas drop constraint if exists peliculas_restriccion_edad_check;
alter table public.peliculas add constraint peliculas_restriccion_edad_check
  check (restriccion_edad in (0, 13, 18));

-- Las películas de ejemplo toman la misma restricción que en seed.sql (solo si todavía no se configuró).
update public.peliculas set restriccion_edad = 18 where titulo = 'La casa del fondo' and restriccion_edad = 0;
update public.peliculas set restriccion_edad = 13 where titulo = 'Operación Medianoche' and restriccion_edad = 0;

-- ---------------------------------------------------------------------
--  2. Nueva distribución de butacas: la fila J es accesible y la K ya no existe
-- ---------------------------------------------------------------------
-- Distribución de las salas (emails 01/01 y 12/02): filas A a T con bloques de 4, 20 y 4 butacas (1 a 28).
-- Las filas J y K se reemplazaron por una sola fila accesible, la J, con bloques de 2, 10 y 2 butacas (1 a 14).
create or replace function public.butaca_valida(p_butaca text)
returns boolean
language sql immutable
as $$
  select case
    when p_butaca is null or p_butaca !~ '^[A-T][0-9]{1,2}$' then false
    when left(p_butaca, 1) = 'K' then false
    when left(p_butaca, 1) = 'J' then substring(p_butaca from 2)::int between 1 and 14
    else substring(p_butaca from 2)::int between 1 and 28
  end;
$$;

-- ---------------------------------------------------------------------
--  3. Compra: valida la edad y la nueva distribución.
--     Se borra la versión anterior porque cambia la lista de parámetros.
-- ---------------------------------------------------------------------
drop function if exists public.comprar_entradas(bigint, text[], text, text, jsonb);

-- Compra de entradas y productos del candy bar. Valida la función, la edad, las butacas y los productos,
-- calcula el precio y aplica el mejor descuento disponible. Devuelve el código de la compra (QR).
-- Ni el precio ni el descuento vienen del cliente.
create or replace function public.comprar_entradas(
  p_funcion_id       bigint,
  p_butacas          text[],
  p_email            text default null,
  p_nombre           text default null,
  p_productos        jsonb default '[]'::jsonb,
  p_fecha_nacimiento date default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_usuario     uuid := auth.uid();
  v_funcion     public.funciones%rowtype;
  v_pelicula    public.peliculas%rowtype;
  v_perfil      public.perfiles%rowtype;
  v_nacimiento  date;
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
  select * into v_pelicula from public.peliculas where id = v_funcion.pelicula_id and en_cartelera;
  if not found then
    raise exception 'La película no está en cartelera';
  end if;

  -- Datos del comprador: si está logueado se toman de su perfil.
  if v_usuario is not null then
    select * into v_perfil from public.perfiles where id = v_usuario;
    p_email      := v_perfil.email;
    p_nombre     := v_perfil.nombre || ' ' || v_perfil.apellido;
    v_nacimiento := v_perfil.fecha_nacimiento;
  else
    if coalesce(trim(p_nombre), '') = '' then
      raise exception 'Ingresá tu nombre';
    end if;
    if coalesce(trim(p_email), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Ingresá un email válido';
    end if;
    v_nacimiento := p_fecha_nacimiento;
  end if;

  -- Restricción de edad (email 12/02). En una compra sin cuenta la fecha la declara el comprador.
  if v_pelicula.restriccion_edad > 0 then
    if v_nacimiento is null then
      raise exception 'Esta película es para mayores de % años: ingresá tu fecha de nacimiento',
        v_pelicula.restriccion_edad;
    end if;
    if public.edad(v_nacimiento) < v_pelicula.restriccion_edad then
      raise exception 'Esta película es solo para mayores de % años', v_pelicula.restriccion_edad;
    end if;
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
    if not public.butaca_valida(v_butaca) then
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

grant execute on function public.comprar_entradas(bigint, text[], text, text, jsonb, date) to anon, authenticated;

-- ---------------------------------------------------------------------
--  4. La entrada y la pantalla de validación informan la restricción de edad
-- ---------------------------------------------------------------------
-- Detalle de una compra a partir de su código (sirve también para compras anónimas).
create or replace function public.obtener_compra(p_codigo uuid)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'codigo',         c.codigo,
    'fecha_compra',   c.creado_en,
    'nombre',         c.nombre_comprador,
    'email',          c.email,
    'cantidad',       c.cantidad,
    'subtotal',       c.subtotal,
    'subtotal_productos', c.subtotal_productos,
    'descuento',      c.descuento,
    'descuento_motivo', c.descuento_motivo,
    'total',          c.total,
    'pelicula',       p.titulo,
    'restriccion_edad', p.restriccion_edad,
    'imagen_url',     p.imagen_url,
    'duracion_min',   p.duracion_min,
    'sala',           s.nombre,
    'inicio',         f.inicio,
    'formato',        f.formato,
    'idioma',         f.idioma,
    'validada_en',    c.validada_en,
    'entregado_en',   c.entregado_en,
    'butacas',        coalesce((select json_agg(e.fila || e.numero order by e.fila, e.numero)
                                from public.entradas e where e.compra_id = c.id), '[]'::json),
    'productos',      coalesce((select json_agg(json_build_object(
                                  'nombre', cp.nombre, 'cantidad', cp.cantidad,
                                  'precio_unitario', cp.precio_unitario) order by cp.nombre)
                                from public.compra_productos cp where cp.compra_id = c.id), '[]'::json)
  )
  from public.compras c
  join public.funciones f on f.id = c.funcion_id
  join public.peliculas p on p.id = f.pelicula_id
  join public.salas s     on s.id = f.sala_id
  where c.codigo = p_codigo;
$$;

-- Datos de una compra para la pantalla del empleado.
create or replace function public.compra_para_validar(p_codigo uuid)
returns json
language plpgsql stable security definer set search_path = public
as $$
declare
  v_detalle json;
begin
  if not public.es_empleado() then
    raise exception 'Solo el personal del cine puede validar entradas';
  end if;

  select json_build_object(
    'codigo',       c.codigo,
    'nombre',       c.nombre_comprador,
    'cantidad',     c.cantidad,
    'butacas',      coalesce((select json_agg(e.fila || e.numero order by e.fila, e.numero)
                              from public.entradas e where e.compra_id = c.id), '[]'::json),
    'pelicula',     p.titulo,
    'restriccion_edad', p.restriccion_edad,
    'sala',         s.nombre,
    'inicio',       f.inicio,
    'fin',          f.fin,
    'formato',      f.formato,
    'idioma',       f.idioma,
    'validada_en',  c.validada_en,
    'entregado_en', c.entregado_en,
    'productos',    coalesce((select json_agg(json_build_object('nombre', cp.nombre, 'cantidad', cp.cantidad)
                                              order by cp.nombre)
                              from public.compra_productos cp where cp.compra_id = c.id), '[]'::json)
  ) into v_detalle
  from public.compras c
  join public.funciones f on f.id = c.funcion_id
  join public.peliculas p on p.id = f.pelicula_id
  join public.salas s     on s.id = f.sala_id
  where c.codigo = p_codigo;

  if v_detalle is null then
    raise exception 'No existe ninguna compra con ese código';
  end if;
  return v_detalle;
end;
$$;

-- ---------------------------------------------------------------------
--  5. Tiempo real: la pantalla de compra escucha las entradas nuevas
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'entradas') then
    alter publication supabase_realtime add table public.entradas;
  end if;
end $$;
