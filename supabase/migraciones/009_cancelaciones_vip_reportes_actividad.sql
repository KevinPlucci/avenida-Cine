-- =====================================================================
--  Migración 009 · Cancelaciones con crédito, butacas VIP, gráficos y registro de actividad
--  (email del 10/03)
--  Para bases que ya tienen la migración 008.
--  Uso: Supabase > SQL Editor > New query > pegar todo el archivo > Run
--  Se puede ejecutar más de una vez sin problemas.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Tablas y columnas nuevas
-- ---------------------------------------------------------------------
-- Configuración general del cine: el recargo de las butacas VIP, que cambia el admin.
create table if not exists public.configuracion (
  id          int primary key default 1 check (id = 1),
  recargo_vip numeric(10, 2) not null default 2000 check (recargo_vip >= 0)
);

insert into public.configuracion default values on conflict (id) do nothing;

alter table public.compras add column if not exists subtotal_vip       numeric(10, 2) not null default 0;
alter table public.compras add column if not exists credito_usado      numeric(10, 2) not null default 0;
alter table public.compras add column if not exists cancelada_en       timestamptz;
alter table public.compras add column if not exists credito_generado   numeric(10, 2);
alter table public.compras add column if not exists butacas_canceladas text[];

alter table public.movimientos_puntos drop constraint if exists movimientos_puntos_tipo_check;
alter table public.movimientos_puntos add constraint movimientos_puntos_tipo_check
  check (tipo in ('compra', 'canje', 'cancelacion'));

-- Crédito en la cuenta: cada cancelación suma el total de la compra y cada compra que lo usa resta.
create table if not exists public.movimientos_credito (
  id         bigint generated always as identity primary key,
  usuario_id uuid   not null references public.perfiles (id) on delete cascade,
  compra_id  bigint not null references public.compras (id) on delete cascade,
  tipo       text   not null check (tipo in ('cancelacion', 'compra')),
  monto      numeric(10, 2) not null check (monto <> 0),
  detalle    text   not null,
  creado_en  timestamptz not null default now()
);

create index if not exists movimientos_credito_usuario_idx on public.movimientos_credito (usuario_id);

-- Registro de actividad: lo completan triggers con el usuario logueado.
create table if not exists public.actividad (
  id         bigint generated always as identity primary key,
  creado_en  timestamptz not null default now(),
  usuario_id uuid references public.perfiles (id) on delete set null,
  usuario    text not null,
  tipo       text not null check (tipo in ('funcion', 'precio', 'validacion')),
  detalle    text not null
);

create index if not exists actividad_creado_en_idx on public.actividad (creado_en desc);

-- ---------------------------------------------------------------------
--  2. Funciones
-- ---------------------------------------------------------------------
-- Butacas VIP (email 10/03): las de las últimas 3 filas de cada sala (R, S y T), con un recargo.
create or replace function public.butaca_vip(p_butaca text)
returns boolean
language sql immutable
as $$
  select left(p_butaca, 1) in ('R', 'S', 'T');
$$;

-- Saldo de crédito de un usuario (email 10/03). Respeta RLS: cada uno solo puede sumar el suyo.
create or replace function public.saldo_credito(p_usuario uuid)
returns numeric
language sql stable
as $$
  select coalesce(sum(monto), 0) from public.movimientos_credito where usuario_id = p_usuario;
$$;

-- La compra suma el crédito de la cuenta: se borra la versión anterior porque cambia la lista de parámetros.
drop function if exists public.comprar_entradas(bigint, text[], text, text, jsonb, date, jsonb, jsonb);

-- Compra de entradas, combos y productos del candy bar. Valida la función, que la venta esté abierta, la edad,
-- las butacas, los productos, los combos y los puntos que se canjean; calcula el precio (el de preventa hasta
-- el estreno, más el recargo de las butacas VIP) y aplica el mejor descuento disponible.
-- Al usuario registrado le suma 1 punto por cada peso pagado y, si lo pide, usa el crédito de su cuenta.
-- Devuelve el código de la compra (QR). Ni los precios, ni el descuento, ni los puntos vienen del cliente.
create or replace function public.comprar_entradas(
  p_funcion_id       bigint,
  p_butacas          text[],
  p_email            text default null,
  p_nombre           text default null,
  p_productos        jsonb default '[]'::jsonb,
  p_fecha_nacimiento date default null,
  p_combos           jsonb default '[]'::jsonb,
  p_canje            jsonb default '{}'::jsonb,
  p_usar_credito     boolean default false
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_usuario         uuid := auth.uid();
  v_funcion         public.funciones%rowtype;
  v_pelicula        public.peliculas%rowtype;
  v_precio          numeric(10, 2);
  v_preventa        boolean := false;
  v_apertura        date;
  v_perfil          public.perfiles%rowtype;
  v_nacimiento      date;
  v_cupon           public.cupones%rowtype;
  v_regla           public.cupones_regla%rowtype;
  v_cantidad        int;
  v_subtotal        numeric(10, 2);
  v_productos       numeric(10, 2) := 0;
  v_combos          numeric(10, 2) := 0;
  v_recargo_vip     numeric(10, 2) := 0;
  v_vip             numeric(10, 2) := 0;
  v_credito         numeric(10, 2) := 0;
  v_descuento       numeric(10, 2) := 0;
  v_total           numeric(10, 2);
  v_porcentaje      int  := 0;
  v_motivo          text;
  v_items           int  := 0;
  v_cant_combos     int  := 0;
  v_canje_entradas  int  := 0;
  v_canje_productos jsonb;
  v_puntos_entrada  int;
  v_puntos_usados   int  := 0;
  v_puntos_ganados  int  := 0;
  v_saldo           int;
  v_compra_id       bigint;
  v_codigo          uuid;
  v_butaca          text;
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

  -- Estreno y preventa (email 08/03): la venta abre el día del estreno o, con preventa, 7 días antes.
  -- Hasta el estreno se cobra el precio de preventa; desde ese día, el de la función.
  v_precio   := v_funcion.precio;
  v_apertura := public.apertura_venta(v_pelicula.fecha_estreno, v_pelicula.precio_preventa);
  if v_apertura is not null and public.hoy_argentina() < v_apertura then
    raise exception 'La venta de entradas para esta película abre el %', to_char(v_apertura, 'DD/MM/YYYY');
  end if;
  if v_pelicula.precio_preventa is not null and public.hoy_argentina() < v_pelicula.fecha_estreno then
    v_precio   := v_pelicula.precio_preventa;
    v_preventa := true;
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

  -- Butacas VIP (email 10/03): cada una suma el recargo, también si va en un combo o se canjea con puntos.
  -- El recargo no tiene descuento.
  if exists (select 1 from unnest(p_butacas) as b where public.butaca_vip(b)) then
    select recargo_vip into v_recargo_vip from public.configuracion where id = 1;
    v_vip := v_recargo_vip * (select count(*) from unnest(p_butacas) as b where public.butaca_vip(b));
  end if;

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
  end if;

  -- Combos (email 03/03): cada uno trae una de las entradas elegidas y sus productos, a un precio fijo.
  if p_combos is null or jsonb_typeof(p_combos) <> 'array' then
    p_combos := '[]'::jsonb;
  end if;

  if jsonb_array_length(p_combos) > 0 then
    if exists (
      select 1 from jsonb_to_recordset(p_combos) as x(combo_id bigint, cantidad int)
      where x.combo_id is null or x.cantidad is null or x.cantidad not between 1 and 10
    ) then
      raise exception 'Cantidad inválida en los combos';
    end if;

    if (select count(distinct x.combo_id)
        from jsonb_to_recordset(p_combos) as x(combo_id bigint, cantidad int)) <> jsonb_array_length(p_combos) then
      raise exception 'Hay combos repetidos';
    end if;

    if exists (
      select 1 from jsonb_to_recordset(p_combos) as x(combo_id bigint, cantidad int)
      where not public.combo_disponible(x.combo_id)
    ) then
      raise exception 'Alguno de los combos elegidos ya no está disponible';
    end if;

    select coalesce(sum(x.cantidad), 0), coalesce(sum(co.precio * x.cantidad), 0)
    into v_cant_combos, v_combos
    from jsonb_to_recordset(p_combos) as x(combo_id bigint, cantidad int)
    join public.combos co on co.id = x.combo_id;
  end if;

  -- Canje de puntos (email 03/03): entradas gratis y productos del candy bar de esta misma compra.
  if p_canje is null or jsonb_typeof(p_canje) <> 'object' then
    p_canje := '{}'::jsonb;
  end if;
  v_canje_entradas  := coalesce((p_canje ->> 'entradas')::int, 0);
  v_canje_productos := coalesce(p_canje -> 'productos', '[]'::jsonb);
  if v_canje_entradas < 0 or jsonb_typeof(v_canje_productos) <> 'array' then
    raise exception 'El canje de puntos no es válido';
  end if;

  if v_canje_entradas > 0 or jsonb_array_length(v_canje_productos) > 0 then
    if v_usuario is null then
      raise exception 'Tenés que iniciar sesión para canjear puntos';
    end if;

    if v_canje_entradas > 0 then
      select puntos into v_puntos_entrada from public.recompensas where tipo = 'entrada' and activa;
      if v_puntos_entrada is null then
        raise exception 'Por ahora no se pueden canjear entradas con puntos';
      end if;
      v_puntos_usados := v_canje_entradas * v_puntos_entrada;
    end if;

    if exists (
      select 1 from jsonb_to_recordset(v_canje_productos) as c(producto_id bigint, cantidad int)
      where c.producto_id is null or c.cantidad is null or c.cantidad < 1
         or c.cantidad > coalesce((select x.cantidad
                                   from jsonb_to_recordset(p_productos) as x(producto_id bigint, cantidad int)
                                   where x.producto_id = c.producto_id), 0)
    ) then
      raise exception 'Solo se pueden canjear productos que estén en la compra';
    end if;

    if (select count(distinct c.producto_id)
        from jsonb_to_recordset(v_canje_productos) as c(producto_id bigint, cantidad int))
       <> jsonb_array_length(v_canje_productos) then
      raise exception 'Hay productos repetidos en el canje';
    end if;

    if exists (
      select 1 from jsonb_to_recordset(v_canje_productos) as c(producto_id bigint, cantidad int)
      where not exists (select 1 from public.recompensas r where r.producto_id = c.producto_id and r.activa)
    ) then
      raise exception 'Alguno de los productos no se puede canjear por puntos';
    end if;

    v_puntos_usados := v_puntos_usados + coalesce((
      select sum(r.puntos * c.cantidad)
      from jsonb_to_recordset(v_canje_productos) as c(producto_id bigint, cantidad int)
      join public.recompensas r on r.producto_id = c.producto_id
    ), 0);

    -- Se bloquea el perfil: dos compras en paralelo no pueden gastar los mismos puntos.
    perform 1 from public.perfiles where id = v_usuario for update;
    v_saldo := public.saldo_puntos(v_usuario);
    if v_saldo < v_puntos_usados then
      raise exception 'No tenés puntos suficientes: tenés % y el canje cuesta %', v_saldo, v_puntos_usados;
    end if;
  end if;

  if v_cant_combos + v_canje_entradas > v_cantidad then
    raise exception 'Hay más combos y entradas canjeadas que butacas elegidas';
  end if;

  -- Se pagan las entradas que no van en un combo ni se canjean con puntos.
  v_subtotal := v_precio * (v_cantidad - v_cant_combos - v_canje_entradas);

  -- Productos a precio de la base, sin las unidades canjeadas con puntos.
  if v_items > 0 then
    select coalesce(sum(pr.precio * (x.cantidad - coalesce(c.cantidad, 0))), 0) into v_productos
    from jsonb_to_recordset(p_productos) as x(producto_id bigint, cantidad int)
    join public.productos pr on pr.id = x.producto_id
    left join jsonb_to_recordset(v_canje_productos) as c(producto_id bigint, cantidad int)
      on c.producto_id = x.producto_id;
  end if;

  -- Descuentos (solo usuarios registrados y solo sobre las entradas que se pagan).
  -- Si aplican los dos se usa el mayor: no se acumulan.
  if v_usuario is not null and v_subtotal > 0 then
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

  v_total := v_subtotal + v_productos + v_combos + v_vip - v_descuento;

  -- Crédito de la cuenta (email 10/03): paga lo que alcance del total y el resto se paga con la tarjeta.
  if p_usar_credito then
    if v_usuario is null then
      raise exception 'Tenés que iniciar sesión para usar el crédito de tu cuenta';
    end if;
    -- Se bloquea el perfil: dos compras en paralelo no pueden gastar el mismo crédito.
    perform 1 from public.perfiles where id = v_usuario for update;
    v_credito := least(public.saldo_credito(v_usuario), v_total);
  end if;

  -- Programa de puntos (email 03/03): 1 punto por cada peso pagado, solo para usuarios registrados.
  if v_usuario is not null then
    v_puntos_ganados := floor(v_total)::int;
  end if;

  insert into public.compras (
    usuario_id, email, nombre_comprador, funcion_id, cantidad,
    subtotal, subtotal_productos, subtotal_combos, subtotal_vip, descuento, descuento_motivo, total, cupon_id,
    entradas_canjeadas, puntos_usados, puntos_ganados, preventa, credito_usado
  )
  values (
    v_usuario, lower(trim(p_email)), trim(p_nombre), p_funcion_id, v_cantidad,
    v_subtotal, v_productos, v_combos, v_vip, v_descuento,
    case when v_descuento > 0 then v_motivo end,
    v_total,
    case when v_descuento > 0 and v_motivo = 'primera_compra' then v_cupon.id end,
    v_canje_entradas, v_puntos_usados, v_puntos_ganados, v_preventa, v_credito
  )
  returning id, codigo into v_compra_id, v_codigo;

  begin
    insert into public.entradas (compra_id, funcion_id, fila, numero, precio)
    select v_compra_id, p_funcion_id, left(b, 1), substring(b from 2)::int,
           v_precio + case when public.butaca_vip(b) then v_recargo_vip else 0 end
    from unnest(p_butacas) as b;
  exception
    when unique_violation then
      raise exception 'Alguna de las butacas elegidas ya fue vendida. Elegí otras.';
  end;

  if v_items > 0 then
    insert into public.compra_productos (compra_id, producto_id, nombre, cantidad, precio_unitario, canjeados)
    select v_compra_id, pr.id, pr.nombre, x.cantidad, pr.precio, coalesce(c.cantidad, 0)
    from jsonb_to_recordset(p_productos) as x(producto_id bigint, cantidad int)
    join public.productos pr on pr.id = x.producto_id
    left join jsonb_to_recordset(v_canje_productos) as c(producto_id bigint, cantidad int)
      on c.producto_id = x.producto_id;
  end if;

  if v_cant_combos > 0 then
    insert into public.compra_combos (compra_id, combo_id, nombre, contenido, cantidad, precio_unitario)
    select v_compra_id, co.id, co.nombre, public.contenido_combo(co.id), x.cantidad, co.precio
    from jsonb_to_recordset(p_combos) as x(combo_id bigint, cantidad int)
    join public.combos co on co.id = x.combo_id;
  end if;

  -- Movimientos de puntos: primero lo canjeado y después lo ganado con esta compra.
  if v_canje_entradas > 0 then
    insert into public.movimientos_puntos (usuario_id, compra_id, tipo, puntos, detalle)
    values (v_usuario, v_compra_id, 'canje', -(v_canje_entradas * v_puntos_entrada),
            v_canje_entradas || case when v_canje_entradas = 1 then ' entrada gratis' else ' entradas gratis' end);
  end if;

  insert into public.movimientos_puntos (usuario_id, compra_id, tipo, puntos, detalle)
  select v_usuario, v_compra_id, 'canje', -(r.puntos * c.cantidad), c.cantidad || ' × ' || pr.nombre
  from jsonb_to_recordset(v_canje_productos) as c(producto_id bigint, cantidad int)
  join public.recompensas r on r.producto_id = c.producto_id
  join public.productos pr on pr.id = c.producto_id;

  if v_puntos_ganados > 0 then
    insert into public.movimientos_puntos (usuario_id, compra_id, tipo, puntos, detalle)
    values (v_usuario, v_compra_id, 'compra', v_puntos_ganados, 'Compra para ' || v_pelicula.titulo);
  end if;

  if v_credito > 0 then
    insert into public.movimientos_credito (usuario_id, compra_id, tipo, monto, detalle)
    values (v_usuario, v_compra_id, 'compra', -v_credito, 'Compra para ' || v_pelicula.titulo);
  end if;

  return v_codigo;
end;
$$;

-- Cancela una compra del usuario logueado hasta 2 horas antes de la función (email 10/03).
-- No devuelve dinero: el total vuelve como crédito en la cuenta. Libera las butacas, devuelve los puntos
-- canjeados, descuenta los que sumó la compra y, si usó el cupón de primera compra, lo deja disponible otra vez.
-- Devuelve el crédito acreditado.
create or replace function public.cancelar_compra(p_codigo uuid)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_compra  public.compras%rowtype;
  v_funcion public.funciones%rowtype;
  v_titulo  text;
  v_puntos  int;
begin
  if v_usuario is null then
    raise exception 'Tenés que iniciar sesión para cancelar una compra';
  end if;

  select * into v_compra from public.compras where codigo = p_codigo and usuario_id = v_usuario for update;
  if not found then
    raise exception 'No existe ninguna compra tuya con ese código';
  end if;
  if v_compra.cancelada_en is not null then
    raise exception 'Esta compra ya se canceló';
  end if;

  select * into v_funcion from public.funciones where id = v_compra.funcion_id;
  if now() > v_funcion.inicio - interval '2 hours' then
    raise exception 'Las compras se pueden cancelar hasta 2 horas antes de la función';
  end if;

  -- Puntos: vuelven los canjeados y se descuentan los que sumó esta compra. El saldo no puede quedar negativo.
  v_puntos := v_compra.puntos_usados - v_compra.puntos_ganados;
  perform 1 from public.perfiles where id = v_usuario for update;
  if public.saldo_puntos(v_usuario) + v_puntos < 0 then
    raise exception 'No se puede cancelar: ya canjeaste los puntos que sumaste con esta compra';
  end if;

  select titulo into v_titulo from public.peliculas where id = v_funcion.pelicula_id;

  update public.compras
  set cancelada_en       = now(),
      credito_generado   = v_compra.total,
      butacas_canceladas = (select array_agg(e.fila || e.numero order by e.fila, e.numero)
                            from public.entradas e where e.compra_id = v_compra.id)
  where id = v_compra.id;

  -- Las butacas quedan libres para otra compra.
  delete from public.entradas where compra_id = v_compra.id;

  if v_compra.total > 0 then
    insert into public.movimientos_credito (usuario_id, compra_id, tipo, monto, detalle)
    values (v_usuario, v_compra.id, 'cancelacion', v_compra.total, 'Cancelación de la compra para ' || v_titulo);
  end if;

  if v_puntos <> 0 then
    insert into public.movimientos_puntos (usuario_id, compra_id, tipo, puntos, detalle)
    values (v_usuario, v_compra.id, 'cancelacion', v_puntos, 'Cancelación de la compra para ' || v_titulo);
  end if;

  if v_compra.cupon_id is not null then
    update public.cupones set usado = false where id = v_compra.cupon_id;
  end if;

  return v_compra.total;
end;
$$;

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
    'subtotal_combos', c.subtotal_combos,
    'subtotal_vip',   c.subtotal_vip,
    'entradas_canjeadas', c.entradas_canjeadas,
    'puntos_usados',  c.puntos_usados,
    'puntos_ganados', c.puntos_ganados,
    'preventa',       c.preventa,
    'descuento',      c.descuento,
    'descuento_motivo', c.descuento_motivo,
    'total',          c.total,
    'credito_usado',  c.credito_usado,
    'cancelada_en',   c.cancelada_en,
    'credito_generado', c.credito_generado,
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
    -- Las butacas de una compra cancelada ya se liberaron: se muestran las que tenía.
    'butacas',        coalesce((select json_agg(e.fila || e.numero order by e.fila, e.numero)
                                from public.entradas e where e.compra_id = c.id),
                               to_json(c.butacas_canceladas), '[]'::json),
    'productos',      coalesce((select json_agg(json_build_object(
                                  'nombre', cp.nombre, 'cantidad', cp.cantidad,
                                  'precio_unitario', cp.precio_unitario, 'canjeados', cp.canjeados) order by cp.nombre)
                                from public.compra_productos cp where cp.compra_id = c.id), '[]'::json),
    'combos',         coalesce((select json_agg(json_build_object(
                                  'nombre', cc.nombre, 'contenido', cc.contenido, 'cantidad', cc.cantidad,
                                  'precio_unitario', cc.precio_unitario) order by cc.nombre)
                                from public.compra_combos cc where cc.compra_id = c.id), '[]'::json)
  )
  from public.compras c
  join public.funciones f on f.id = c.funcion_id
  join public.peliculas p on p.id = f.pelicula_id
  join public.salas s     on s.id = f.sala_id
  where c.codigo = p_codigo;
$$;

-- mis_compras() devuelve columnas nuevas: se borra la versión anterior.
drop function if exists public.mis_compras();

-- Compras del usuario logueado, con su cancelación (email 10/03): si se canceló y si todavía se puede cancelar.
create or replace function public.mis_compras()
returns table (
  codigo           uuid,
  fecha_compra     timestamptz,
  pelicula         text,
  imagen_url       text,
  sala             text,
  inicio           timestamptz,
  cantidad         int,
  total            numeric,
  validada_en      timestamptz,
  cancelada_en     timestamptz,
  credito_generado numeric,
  puntos_usados    int,
  puntos_ganados   int,
  puede_cancelar   boolean
)
language sql stable security definer set search_path = public
as $$
  select c.codigo, c.creado_en, p.titulo, p.imagen_url, s.nombre, f.inicio, c.cantidad, c.total, c.validada_en,
         c.cancelada_en, c.credito_generado, c.puntos_usados, c.puntos_ganados,
         c.cancelada_en is null and now() <= f.inicio - interval '2 hours'
  from public.compras c
  join public.funciones f on f.id = c.funcion_id
  join public.peliculas p on p.id = f.pelicula_id
  join public.salas s     on s.id = f.sala_id
  where c.usuario_id = auth.uid()
  order by c.creado_en desc;
$$;

-- Películas que vio el usuario logueado (email 08/03): las de sus compras cuya función ya terminó,
-- con las fechas en que las vio y la calificación de su reseña (null si todavía no la calificó).
create or replace function public.mis_peliculas()
returns table (pelicula_id bigint, titulo text, imagen_url text, fechas timestamptz[], estrellas int)
language sql stable security definer set search_path = public
as $$
  select p.id, p.titulo, p.imagen_url,
         array_agg(distinct f.inicio order by f.inicio desc),
         (select r.estrellas from public.resenias r where r.pelicula_id = p.id and r.usuario_id = auth.uid())
  from public.compras c
  join public.funciones f on f.id = c.funcion_id
  join public.peliculas p on p.id = f.pelicula_id
  where c.usuario_id = auth.uid() and c.cancelada_en is null and f.fin < now()
  group by p.id
  order by max(f.inicio) desc;
$$;

-- Crédito del usuario logueado (email 10/03): el saldo y sus movimientos para el perfil.
create or replace function public.mi_credito()
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'saldo',       public.saldo_credito(auth.uid()),
    'movimientos', coalesce((
      select json_agg(json_build_object(
               'fecha', m.creado_en, 'detalle', m.detalle, 'monto', m.monto, 'codigo', c.codigo)
             order by m.creado_en desc, m.id desc)
      from public.movimientos_credito m
      join public.compras c on c.id = m.compra_id
      where m.usuario_id = auth.uid()
    ), '[]'::json)
  );
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
                              from public.entradas e where e.compra_id = c.id),
                             to_json(c.butacas_canceladas), '[]'::json),
    'pelicula',     p.titulo,
    'restriccion_edad', p.restriccion_edad,
    'sala',         s.nombre,
    'inicio',       f.inicio,
    'fin',          f.fin,
    'formato',      f.formato,
    'idioma',       f.idioma,
    'validada_en',  c.validada_en,
    'entregado_en', c.entregado_en,
    'cancelada_en', c.cancelada_en,
    'productos',    coalesce((select json_agg(json_build_object('nombre', cp.nombre, 'cantidad', cp.cantidad)
                                              order by cp.nombre)
                              from public.compra_productos cp where cp.compra_id = c.id), '[]'::json),
    'combos',       coalesce((select json_agg(json_build_object('nombre', cc.nombre, 'contenido', cc.contenido,
                                                                'cantidad', cc.cantidad) order by cc.nombre)
                              from public.compra_combos cc where cc.compra_id = c.id), '[]'::json)
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
  if v_compra.cancelada_en is not null then
    raise exception 'Esta compra se canceló el %: la entrada no sirve',
      to_char(v_compra.cancelada_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI');
  end if;
  if v_compra.validada_en is not null then
    raise exception 'Esta entrada ya fue validada el %',
      to_char(v_compra.validada_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI');
  end if;

  -- Se valida desde una hora antes del inicio hasta que termina la función.
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
  if v_compra.cancelada_en is not null then
    raise exception 'Esta compra se canceló el %: los productos no se entregan',
      to_char(v_compra.cancelada_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI');
  end if;
  if not exists (select 1 from public.compra_productos where compra_id = v_compra.id)
     and not exists (select 1 from public.compra_combos where compra_id = v_compra.id) then
    raise exception 'Esta compra no incluye productos del candy bar';
  end if;
  if v_compra.entregado_en is not null then
    raise exception 'Los productos de esta compra ya se entregaron el %',
      to_char(v_compra.entregado_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI');
  end if;

  -- Mismo horario que el ingreso: desde una hora antes del inicio hasta que termina la función.
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

-- Facturación y entradas vendidas por día, para el administrador. Incluye los días sin ventas.
-- Cada compra cuenta en el día (de Argentina) en que se hizo, no en el de la función. Las canceladas no cuentan.
create or replace function public.reporte_ventas(p_desde date, p_hasta date)
returns table (dia date, cantidad_compras int, entradas_vendidas int, facturado numeric)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede ver los reportes';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'El período no es válido';
  end if;
  if p_hasta - p_desde > 366 then
    raise exception 'El período puede ser de hasta un año';
  end if;

  return query
  select d.dia,
         count(c.id)::int,
         coalesce(sum(c.cantidad), 0)::int,
         coalesce(sum(c.total), 0)
  from generate_series(p_desde, p_hasta, interval '1 day') as g (fecha)
  cross join lateral (select g.fecha::date as dia) d
  left join public.compras c
    on (c.creado_en at time zone 'America/Argentina/Buenos_Aires')::date = d.dia and c.cancelada_en is null
  group by d.dia
  order by d.dia;
end;
$$;

-- Películas más vistas (email 10/03): entradas vendidas de cada película en las funciones del período
-- (días de Argentina). Las compras canceladas no cuentan porque sus entradas se borran.
create or replace function public.ranking_peliculas(p_desde date, p_hasta date)
returns table (pelicula text, entradas_vendidas int)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede ver los reportes';
  end if;

  return query
  select p.titulo, count(e.id)::int
  from public.entradas e
  join public.funciones f on f.id = e.funcion_id
  join public.peliculas p on p.id = f.pelicula_id
  where (f.inicio at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
  group by p.id, p.titulo
  order by 2 desc, 1;
end;
$$;

-- Productos del candy bar más vendidos (email 10/03): unidades de cada producto en las funciones del período,
-- sueltas y dentro de los combos (según lo que trae cada combo hoy). Las compras canceladas no cuentan.
create or replace function public.ranking_productos(p_desde date, p_hasta date)
returns table (producto text, unidades int)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede ver los reportes';
  end if;

  return query
  select pr.nombre, sum(v.cantidad)::int
  from (
    select cp.producto_id, cp.cantidad, cp.compra_id
    from public.compra_productos cp
    union all
    select cop.producto_id, cc.cantidad * cop.cantidad, cc.compra_id
    from public.compra_combos cc
    join public.combo_productos cop on cop.combo_id = cc.combo_id
  ) v
  join public.productos pr on pr.id = v.producto_id
  join public.compras c    on c.id = v.compra_id
  join public.funciones f  on f.id = c.funcion_id
  where c.cancelada_en is null
    and (f.inicio at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
  group by pr.id, pr.nombre
  order by 2 desc, 1;
end;
$$;

-- ---------------------------------------------------------------------
--  3. Registro de actividad: quién creó o cambió funciones, quién cambió precios y quién validó un QR.
--     Se registra lo que se hace desde la app, con un usuario logueado.
-- ---------------------------------------------------------------------
-- Importe con formato argentino para los textos del registro: $ 5.000 o $ 5.000,50.
create or replace function public.pesos(p_importe numeric)
returns text
language sql immutable
as $$
  select '$ ' || regexp_replace(translate(to_char(p_importe, 'FM999,999,990.00'), ',.', '.,'), ',00$', '');
$$;

-- "El último faro del 10/10/2026 21:00 en Sala 1", para los textos del registro.
create or replace function public.describir_funcion(p_pelicula_id bigint, p_sala_id bigint, p_inicio timestamptz)
returns text
language sql stable security definer set search_path = public
as $$
  select (select titulo from public.peliculas where id = p_pelicula_id)
      || ' del ' || to_char(p_inicio at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI')
      || ' en ' || (select nombre from public.salas where id = p_sala_id);
$$;

-- Agrega una línea con el usuario logueado. No se puede llamar desde la API (ver los permisos al final).
create or replace function public.registrar_actividad(p_tipo text, p_detalle text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_usuario text;
begin
  if auth.uid() is null then
    return;
  end if;
  select nombre || ' ' || apellido || ' (' || email || ')' into v_usuario from public.perfiles where id = auth.uid();
  insert into public.actividad (usuario_id, usuario, tipo, detalle)
  values (auth.uid(), coalesce(v_usuario, 'Usuario sin perfil'), p_tipo, p_detalle);
end;
$$;

-- Funciones: alta, cambio de precio, otros cambios y baja.
create or replace function public.actividad_funciones()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.registrar_actividad('funcion',
      'Creó la función de ' || public.describir_funcion(new.pelicula_id, new.sala_id, new.inicio)
      || ' (' || new.formato || ', ' || new.idioma || ', ' || public.pesos(new.precio) || ')');
  elsif tg_op = 'DELETE' then
    perform public.registrar_actividad('funcion',
      'Eliminó la función de ' || public.describir_funcion(old.pelicula_id, old.sala_id, old.inicio));
  else
    if new.precio is distinct from old.precio then
      perform public.registrar_actividad('precio',
        'Cambió el precio de la función de ' || public.describir_funcion(new.pelicula_id, new.sala_id, new.inicio)
        || ': de ' || public.pesos(old.precio) || ' a ' || public.pesos(new.precio));
    end if;
    if (new.inicio, new.sala_id, new.pelicula_id, new.formato, new.idioma)
       is distinct from (old.inicio, old.sala_id, old.pelicula_id, old.formato, old.idioma) then
      perform public.registrar_actividad('funcion',
        'Modificó la función de ' || public.describir_funcion(old.pelicula_id, old.sala_id, old.inicio)
        || ': ahora es ' || public.describir_funcion(new.pelicula_id, new.sala_id, new.inicio)
        || ' (' || new.formato || ', ' || new.idioma || ')');
    end if;
  end if;
  return null;
end;
$$;

-- Precios del candy bar, de los combos, de la preventa y recargo de las butacas VIP.
create or replace function public.actividad_precios()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_table_name = 'productos' then
    if new.precio is distinct from old.precio then
      perform public.registrar_actividad('precio', 'Cambió el precio de ' || new.nombre || ': de '
        || public.pesos(old.precio) || ' a ' || public.pesos(new.precio));
    end if;
  elsif tg_table_name = 'combos' then
    if new.precio is distinct from old.precio then
      perform public.registrar_actividad('precio', 'Cambió el precio del combo ' || new.nombre || ': de '
        || public.pesos(old.precio) || ' a ' || public.pesos(new.precio));
    end if;
  elsif tg_table_name = 'peliculas' then
    if new.precio_preventa is distinct from old.precio_preventa then
      perform public.registrar_actividad('precio', 'Cambió el precio de preventa de ' || new.titulo || ': de '
        || coalesce(public.pesos(old.precio_preventa), 'sin preventa') || ' a '
        || coalesce(public.pesos(new.precio_preventa), 'sin preventa'));
    end if;
  elsif tg_table_name = 'configuracion' then
    if new.recargo_vip is distinct from old.recargo_vip then
      perform public.registrar_actividad('precio', 'Cambió el recargo de las butacas VIP: de '
        || public.pesos(old.recargo_vip) || ' a ' || public.pesos(new.recargo_vip));
    end if;
  end if;
  return null;
end;
$$;

-- Validación del QR: ingreso a la sala y entrega del candy bar.
create or replace function public.actividad_validaciones()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_compra text;
begin
  select ' de la compra ' || left(new.codigo::text, 8) || ' (' || new.nombre_comprador || ', '
         || public.describir_funcion(f.pelicula_id, f.sala_id, f.inicio) || ')'
  into v_compra
  from public.funciones f where f.id = new.funcion_id;

  if old.validada_en is null and new.validada_en is not null then
    perform public.registrar_actividad('validacion', 'Validó el ingreso' || v_compra);
  end if;
  if old.entregado_en is null and new.entregado_en is not null then
    perform public.registrar_actividad('validacion', 'Entregó los productos del candy bar' || v_compra);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_funciones_actividad on public.funciones;
drop trigger if exists trg_productos_actividad on public.productos;
drop trigger if exists trg_combos_actividad on public.combos;
drop trigger if exists trg_peliculas_actividad on public.peliculas;
drop trigger if exists trg_configuracion_actividad on public.configuracion;
drop trigger if exists trg_compras_actividad on public.compras;

create trigger trg_funciones_actividad
  after insert or update or delete on public.funciones
  for each row execute function public.actividad_funciones();
create trigger trg_productos_actividad
  after update of precio on public.productos
  for each row execute function public.actividad_precios();
create trigger trg_combos_actividad
  after update of precio on public.combos
  for each row execute function public.actividad_precios();
create trigger trg_peliculas_actividad
  after update of precio_preventa on public.peliculas
  for each row execute function public.actividad_precios();
create trigger trg_configuracion_actividad
  after update of recargo_vip on public.configuracion
  for each row execute function public.actividad_precios();
create trigger trg_compras_actividad
  after update of validada_en, entregado_en on public.compras
  for each row execute function public.actividad_validaciones();

-- ---------------------------------------------------------------------
--  4. Seguridad
-- ---------------------------------------------------------------------
alter table public.configuracion       enable row level security;
alter table public.movimientos_credito enable row level security;
alter table public.actividad           enable row level security;

drop policy if exists "configuracion_lectura" on public.configuracion;
drop policy if exists "configuracion_admin" on public.configuracion;
drop policy if exists "movimientos_credito_lectura" on public.movimientos_credito;
drop policy if exists "actividad_lectura" on public.actividad;

-- Configuración: lectura pública (la compra muestra el recargo VIP), solo el admin la cambia.
create policy "configuracion_lectura" on public.configuracion for select using (true);
create policy "configuracion_admin" on public.configuracion
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- Crédito: cada usuario ve sus movimientos. Sin políticas de escritura: los crean solo
-- cancelar_compra() y comprar_entradas().
create policy "movimientos_credito_lectura" on public.movimientos_credito
  for select to authenticated using (usuario_id = auth.uid());

-- Registro de actividad: solo lo lee el admin. Lo escriben únicamente los triggers.
create policy "actividad_lectura" on public.actividad
  for select to authenticated using (public.es_admin());

grant select on public.configuracion, public.movimientos_credito, public.actividad to anon, authenticated;
grant insert, update, delete on public.configuracion, public.movimientos_credito, public.actividad to authenticated;
grant execute on function public.comprar_entradas(bigint, text[], text, text, jsonb, date, jsonb, jsonb, boolean) to anon, authenticated;
grant execute on function public.cancelar_compra(uuid) to authenticated;
grant execute on function public.mis_compras() to authenticated;
grant execute on function public.mi_credito() to authenticated;
grant execute on function public.ranking_peliculas(date, date) to authenticated;
grant execute on function public.ranking_productos(date, date) to authenticated;
-- El registro de actividad solo lo escriben los triggers: nadie puede agregar líneas desde la API.
revoke execute on function public.registrar_actividad(text, text) from public, anon, authenticated;
