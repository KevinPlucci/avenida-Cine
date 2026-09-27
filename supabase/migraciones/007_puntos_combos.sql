-- =====================================================================
--  Migración 007 · Programa de puntos y combos
--  (email del 03/03)
--  Para bases que ya tienen la migración 006.
--  Uso: Supabase > SQL Editor > New query > pegar todo el archivo > Run
--  Se puede ejecutar más de una vez sin problemas.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Tablas y columnas nuevas
-- ---------------------------------------------------------------------
create table if not exists public.recompensas (
  id          bigint generated always as identity primary key,
  tipo        text not null check (tipo in ('entrada', 'producto')),
  producto_id bigint unique references public.productos (id) on delete cascade,
  puntos      int  not null check (puntos > 0),
  activa      boolean not null default true,
  check ((tipo = 'entrada') = (producto_id is null))
);

create unique index if not exists recompensas_una_entrada on public.recompensas (tipo) where tipo = 'entrada';

create table if not exists public.combos (
  id          bigint generated always as identity primary key,
  nombre      text not null unique,
  descripcion text not null default '',
  precio      numeric(10, 2) not null check (precio >= 0),
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

create table if not exists public.combo_productos (
  combo_id    bigint not null references public.combos (id) on delete cascade,
  producto_id bigint not null references public.productos (id) on delete restrict,
  cantidad    int not null check (cantidad between 1 and 10),
  primary key (combo_id, producto_id)
);

alter table public.compras add column if not exists subtotal_combos    numeric(10, 2) not null default 0;
alter table public.compras add column if not exists entradas_canjeadas int not null default 0;
alter table public.compras add column if not exists puntos_usados      int not null default 0;
alter table public.compras add column if not exists puntos_ganados     int not null default 0;

alter table public.compra_productos add column if not exists canjeados int not null default 0;
alter table public.compra_productos drop constraint if exists compra_productos_canjeados_check;
alter table public.compra_productos add constraint compra_productos_canjeados_check
  check (canjeados between 0 and cantidad);

create table if not exists public.compra_combos (
  id              bigint generated always as identity primary key,
  compra_id       bigint not null references public.compras (id) on delete cascade,
  combo_id        bigint not null references public.combos (id) on delete restrict,
  nombre          text not null,
  contenido       text not null,
  cantidad        int  not null check (cantidad between 1 and 10),
  precio_unitario numeric(10, 2) not null,
  unique (compra_id, combo_id)
);

create table if not exists public.movimientos_puntos (
  id         bigint generated always as identity primary key,
  usuario_id uuid   not null references public.perfiles (id) on delete cascade,
  compra_id  bigint not null references public.compras (id) on delete cascade,
  tipo       text   not null check (tipo in ('compra', 'canje')),
  puntos     int    not null check (puntos <> 0),
  detalle    text   not null,
  creado_en  timestamptz not null default now()
);

create index if not exists movimientos_puntos_usuario_idx on public.movimientos_puntos (usuario_id);

-- ---------------------------------------------------------------------
--  2. Datos iniciales: la entrada gratis cuesta 500 puntos.
--     Si todavía no hay combos y están los productos de seed.sql, se crean los combos de ejemplo.
-- ---------------------------------------------------------------------
insert into public.recompensas (tipo, puntos)
select 'entrada', 500
where not exists (select 1 from public.recompensas where tipo = 'entrada');

insert into public.recompensas (tipo, producto_id, puntos)
select 'producto', p.id, v.puntos
from (values ('Pochoclos grandes', 150), ('Gaseosa grande', 100), ('Chocolate', 80)) as v (nombre, puntos)
join public.productos p on p.nombre = v.nombre
where not exists (select 1 from public.recompensas where tipo = 'producto');

do $$
begin
  if not exists (select 1 from public.combos)
     and (select count(*) from public.productos
          where nombre in ('Pochoclos medianos', 'Pochoclos grandes', 'Gaseosa grande', 'Chocolate')) = 4 then
    insert into public.combos (nombre, descripcion, precio)
    values
      ('Combo clásico', 'Tu entrada con pochoclos medianos y gaseosa grande.', 11500),
      ('Combo grande',  'Tu entrada con pochoclos grandes, gaseosa grande y un chocolate.', 14500);

    insert into public.combo_productos (combo_id, producto_id, cantidad)
    select c.id, p.id, 1
    from (values
      ('Combo clásico', 'Pochoclos medianos'), ('Combo clásico', 'Gaseosa grande'),
      ('Combo grande', 'Pochoclos grandes'), ('Combo grande', 'Gaseosa grande'), ('Combo grande', 'Chocolate')
    ) as v (combo, producto)
    join public.combos c on c.nombre = v.combo
    join public.productos p on p.nombre = v.producto;
  end if;
end $$;

-- ---------------------------------------------------------------------
--  3. Funciones
-- ---------------------------------------------------------------------
-- Saldo de puntos de un usuario (email 03/03). Respeta RLS: cada uno solo puede sumar los suyos.
create or replace function public.saldo_puntos(p_usuario uuid)
returns int
language sql stable
as $$
  select coalesce(sum(puntos), 0)::int from public.movimientos_puntos where usuario_id = p_usuario;
$$;

-- Un combo se vende si está activo, tiene productos y todos están disponibles.
create or replace function public.combo_disponible(p_combo_id bigint)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.combos where id = p_combo_id and activo)
     and exists (select 1 from public.combo_productos where combo_id = p_combo_id)
     and not exists (select 1 from public.combo_productos cp
                     join public.productos pr on pr.id = cp.producto_id
                     where cp.combo_id = p_combo_id and not pr.disponible);
$$;

-- Texto con lo que trae un combo: "1 entrada + 1 × Pochoclos medianos + 1 × Gaseosa grande".
create or replace function public.contenido_combo(p_combo_id bigint)
returns text
language sql stable security definer set search_path = public
as $$
  select '1 entrada' || coalesce((
    select string_agg(' + ' || cp.cantidad || ' × ' || pr.nombre, '' order by pr.nombre)
    from public.combo_productos cp
    join public.productos pr on pr.id = cp.producto_id
    where cp.combo_id = p_combo_id
  ), '');
$$;

-- La compra suma combos y canjes: se borra la versión anterior porque cambia la lista de parámetros.
drop function if exists public.comprar_entradas(bigint, text[], text, text, jsonb, date);

-- Compra de entradas, combos y productos del candy bar. Valida la función, la edad, las butacas, los productos,
-- los combos y los puntos que se canjean; calcula el precio y aplica el mejor descuento disponible.
-- Al usuario registrado le suma 1 punto por cada peso pagado. Devuelve el código de la compra (QR).
-- Ni los precios, ni el descuento, ni los puntos vienen del cliente.
create or replace function public.comprar_entradas(
  p_funcion_id       bigint,
  p_butacas          text[],
  p_email            text default null,
  p_nombre           text default null,
  p_productos        jsonb default '[]'::jsonb,
  p_fecha_nacimiento date default null,
  p_combos           jsonb default '[]'::jsonb,
  p_canje            jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_usuario         uuid := auth.uid();
  v_funcion         public.funciones%rowtype;
  v_pelicula        public.peliculas%rowtype;
  v_perfil          public.perfiles%rowtype;
  v_nacimiento      date;
  v_cupon           public.cupones%rowtype;
  v_regla           public.cupones_regla%rowtype;
  v_cantidad        int;
  v_subtotal        numeric(10, 2);
  v_productos       numeric(10, 2) := 0;
  v_combos          numeric(10, 2) := 0;
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
  v_subtotal := v_funcion.precio * (v_cantidad - v_cant_combos - v_canje_entradas);

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

  v_total := v_subtotal + v_productos + v_combos - v_descuento;

  -- Programa de puntos (email 03/03): 1 punto por cada peso pagado, solo para usuarios registrados.
  if v_usuario is not null then
    v_puntos_ganados := floor(v_total)::int;
  end if;

  insert into public.compras (
    usuario_id, email, nombre_comprador, funcion_id, cantidad,
    subtotal, subtotal_productos, subtotal_combos, descuento, descuento_motivo, total, cupon_id,
    entradas_canjeadas, puntos_usados, puntos_ganados
  )
  values (
    v_usuario, lower(trim(p_email)), trim(p_nombre), p_funcion_id, v_cantidad,
    v_subtotal, v_productos, v_combos, v_descuento,
    case when v_descuento > 0 then v_motivo end,
    v_total,
    case when v_descuento > 0 and v_motivo = 'primera_compra' then v_cupon.id end,
    v_canje_entradas, v_puntos_usados, v_puntos_ganados
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

  return v_codigo;
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
    'entradas_canjeadas', c.entradas_canjeadas,
    'puntos_usados',  c.puntos_usados,
    'puntos_ganados', c.puntos_ganados,
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

-- Puntos del usuario logueado (email 03/03): el saldo y el historial de canjes para el perfil.
create or replace function public.mis_puntos()
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'saldo',  public.saldo_puntos(auth.uid()),
    'canjes', coalesce((
      select json_agg(json_build_object(
               'fecha', m.creado_en, 'detalle', m.detalle, 'puntos', -m.puntos,
               'codigo', c.codigo, 'pelicula', p.titulo) order by m.creado_en desc, m.id desc)
      from public.movimientos_puntos m
      join public.compras c   on c.id = m.compra_id
      join public.funciones f on f.id = c.funcion_id
      join public.peliculas p on p.id = f.pelicula_id
      where m.usuario_id = auth.uid() and m.tipo = 'canje'
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

-- ---------------------------------------------------------------------
--  4. Seguridad
-- ---------------------------------------------------------------------
alter table public.recompensas        enable row level security;
alter table public.combos             enable row level security;
alter table public.combo_productos    enable row level security;
alter table public.compra_combos      enable row level security;
alter table public.movimientos_puntos enable row level security;

drop policy if exists "recompensas_lectura" on public.recompensas;
drop policy if exists "recompensas_admin" on public.recompensas;
drop policy if exists "combos_lectura" on public.combos;
drop policy if exists "combos_admin" on public.combos;
drop policy if exists "combo_productos_lectura" on public.combo_productos;
drop policy if exists "combo_productos_admin" on public.combo_productos;
drop policy if exists "compra_combos_lectura" on public.compra_combos;
drop policy if exists "movimientos_puntos_lectura" on public.movimientos_puntos;

create policy "recompensas_lectura" on public.recompensas for select using (true);
create policy "recompensas_admin" on public.recompensas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

create policy "combos_lectura" on public.combos for select using (activo or public.es_admin());
create policy "combos_admin" on public.combos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

create policy "combo_productos_lectura" on public.combo_productos for select using (true);
create policy "combo_productos_admin" on public.combo_productos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

create policy "compra_combos_lectura" on public.compra_combos
  for select to authenticated using (
    exists (select 1 from public.compras c
            where c.id = compra_id and (c.usuario_id = auth.uid() or public.es_admin()))
  );

-- Sin políticas de escritura: los movimientos los crea solo comprar_entradas(),
-- así los puntos no se pueden cargar ni transferir entre usuarios.
create policy "movimientos_puntos_lectura" on public.movimientos_puntos
  for select to authenticated using (usuario_id = auth.uid());

grant select on public.recompensas, public.combos, public.combo_productos, public.compra_combos,
  public.movimientos_puntos to anon, authenticated;
grant insert, update, delete on public.recompensas, public.combos, public.combo_productos, public.compra_combos,
  public.movimientos_puntos to authenticated;
grant execute on function public.comprar_entradas(bigint, text[], text, text, jsonb, date, jsonb, jsonb) to anon, authenticated;
grant execute on function public.mis_puntos() to authenticated;
