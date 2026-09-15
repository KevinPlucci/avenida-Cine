-- =====================================================================
--  Cine Avenida · Esquema de base de datos (Supabase / PostgreSQL)
--  Uso: Supabase > SQL Editor > New query > pegar todo el archivo > Run
-- =====================================================================

create extension if not exists btree_gist;

-- =====================================================================
--  TABLAS
-- =====================================================================

-- Datos de los usuarios registrados (email 01/01). El id es el de auth.users.
create table public.perfiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text not null,
  nombre           text not null,
  apellido         text not null,
  fecha_nacimiento date not null,
  tipo_sangre      text not null check (tipo_sangre in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-')),
  color_ojos       text not null,
  dias_vacaciones  int  not null check (dias_vacaciones between 0 and 365),
  rol              text not null default 'cliente' check (rol in ('cliente', 'empleado', 'admin')),  -- empleado: valida QR (email 06/02)
  creado_en        timestamptz not null default now()
);

-- Todas las salas tienen la misma distribución de butacas (ver src/app/core/utils/butacas.ts).
create table public.salas (
  id        bigint generated always as identity primary key,
  nombre    text not null unique,
  activa    boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.generos (
  id     bigint generated always as identity primary key,
  nombre text not null unique
);

create table public.peliculas (
  id           bigint generated always as identity primary key,
  titulo       text not null,
  sinopsis     text not null,
  duracion_min int  not null check (duracion_min between 1 and 600),
  imagen_url   text not null,
  en_cartelera boolean not null default true,  -- el admin elige qué películas se muestran
  creado_en    timestamptz not null default now()
);

-- Una película puede tener varios géneros (email 16/01).
create table public.pelicula_generos (
  pelicula_id bigint not null references public.peliculas (id) on delete cascade,
  genero_id   bigint not null references public.generos (id) on delete cascade,
  primary key (pelicula_id, genero_id)
);

create table public.funciones (
  id              bigint generated always as identity primary key,
  pelicula_id     bigint not null references public.peliculas (id) on delete restrict,
  sala_id         bigint not null references public.salas (id) on delete restrict,
  inicio          timestamptz not null,
  fin             timestamptz not null,  -- inicio + duración (lo calcula un trigger)
  bloqueada_hasta timestamptz not null,  -- fin + 30 minutos (lo calcula un trigger)
  formato         text not null check (formato in ('2D', '3D', '4D', '5D')),
  idioma          text not null check (idioma in ('castellano', 'subtitulada')),
  precio          numeric(10, 2) not null check (precio >= 0),
  creado_en       timestamptz not null default now(),
  -- Regla de negocio: en una misma sala no puede empezar una función
  -- hasta que pasen 30 minutos del final de la anterior.
  constraint funciones_sin_superposicion
    exclude using gist (sala_id with =, tstzrange(inicio, bloqueada_hasta) with &&)
);

create index funciones_pelicula_inicio_idx on public.funciones (pelicula_id, inicio);

-- Reglas de descuento que configura el administrador (email 30/01).
--  · primera_compra: porcentaje del cupón que recibe cada usuario al registrarse.
--  · mayores: descuento permanente para los usuarios que superan la edad indicada.
create table public.cupones_regla (
  tipo           text primary key check (tipo in ('primera_compra', 'mayores')),
  porcentaje     int  not null check (porcentaje between 1 and 100),
  edad_minima    int  check (edad_minima between 0 and 120),
  activo         boolean not null default true,
  actualizado_en timestamptz not null default now()
);

insert into public.cupones_regla (tipo, porcentaje, edad_minima)
values ('primera_compra', 20, null), ('mayores', 15, 50);

-- Cupón de bienvenida: se emite al registrarse con el porcentaje vigente (email 01/01).
create table public.cupones (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  tipo       text not null default 'primera_compra' check (tipo in ('primera_compra')),
  porcentaje int  not null check (porcentaje between 1 and 100),
  usado      boolean not null default false,
  creado_en  timestamptz not null default now(),
  unique (usuario_id, tipo)
);

-- Candy bar (email 30/01): productos agrupados en categorías.
create table public.categorias_productos (
  id     bigint generated always as identity primary key,
  nombre text not null unique,
  orden  int  not null default 0
);

create table public.productos (
  id           bigint generated always as identity primary key,
  categoria_id bigint not null references public.categorias_productos (id) on delete restrict,
  nombre       text not null unique,
  descripcion  text not null default '',
  precio       numeric(10, 2) not null check (precio >= 0),
  disponible   boolean not null default true,
  creado_en    timestamptz not null default now()
);

create index productos_categoria_idx on public.productos (categoria_id);

-- Una compra puede ser de un usuario registrado o anónima (usuario_id null).
create table public.compras (
  id               bigint generated always as identity primary key,
  codigo           uuid not null unique default gen_random_uuid(),  -- contenido del QR
  usuario_id       uuid references public.perfiles (id) on delete set null,
  email            text not null,
  nombre_comprador text not null,
  funcion_id       bigint not null references public.funciones (id) on delete restrict,
  cantidad         int not null check (cantidad > 0),
  subtotal         numeric(10, 2) not null,              -- entradas
  subtotal_productos numeric(10, 2) not null default 0,  -- candy bar (email 30/01)
  descuento        numeric(10, 2) not null default 0,
  descuento_motivo text check (descuento_motivo in ('primera_compra', 'mayores')),
  total            numeric(10, 2) not null,
  cupon_id         bigint references public.cupones (id),
  creado_en        timestamptz not null default now(),
  -- Validación del QR (email 06/02): una vez usado, el código deja de servir.
  validada_en      timestamptz,
  validada_por     uuid references public.perfiles (id) on delete set null,
  entregado_en     timestamptz,
  entregado_por    uuid references public.perfiles (id) on delete set null
);

create index compras_usuario_idx on public.compras (usuario_id);

-- Una fila por butaca vendida. El unique impide vender dos veces la misma butaca.
create table public.entradas (
  id         bigint generated always as identity primary key,
  compra_id  bigint not null references public.compras (id) on delete cascade,
  funcion_id bigint not null references public.funciones (id) on delete restrict,
  fila       text not null check (fila ~ '^[A-T]$'),
  numero     int  not null check (numero between 1 and 28),
  precio     numeric(10, 2) not null,
  unique (funcion_id, fila, numero)
);

-- Productos del candy bar comprados junto con las entradas (email 30/01).
-- El nombre y el precio quedan congelados: si después cambian, la compra no se altera.
create table public.compra_productos (
  id              bigint generated always as identity primary key,
  compra_id       bigint not null references public.compras (id) on delete cascade,
  producto_id     bigint not null references public.productos (id) on delete restrict,
  nombre          text not null,
  cantidad        int  not null check (cantidad between 1 and 20),
  precio_unitario numeric(10, 2) not null,
  unique (compra_id, producto_id)
);

-- Reseñas (email 16/01): una por usuario y película.
create table public.resenias (
  id          bigint generated always as identity primary key,
  pelicula_id bigint not null references public.peliculas (id) on delete cascade,
  usuario_id  uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  autor       text not null,  -- "Nombre A." (lo completa un trigger)
  estrellas   int  not null check (estrellas between 1 and 5),
  comentario  text not null check (char_length(comentario) between 1 and 280),
  creado_en   timestamptz not null default now(),
  unique (pelicula_id, usuario_id)
);

-- Puntaje promedio por película. security_invoker: respeta las políticas RLS de quien consulta.
create view public.puntajes_peliculas with (security_invoker = true) as
select pelicula_id,
       round(avg(estrellas), 1) as promedio,
       count(*)::int            as cantidad
from public.resenias
group by pelicula_id;

-- =====================================================================
--  FUNCIONES AUXILIARES Y TRIGGERS
-- =====================================================================

create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin');
$$;

-- Personal del cine: valida entradas y entrega productos del candy bar (email 06/02).
create or replace function public.es_empleado()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol in ('empleado', 'admin'));
$$;

-- Años cumplidos (para el descuento por edad del email 30/01).
create or replace function public.edad(p_fecha date)
returns int
language sql stable
as $$
  select case when p_fecha is null then null else extract(year from age(current_date, p_fecha))::int end;
$$;

-- Al registrarse un usuario se crea su perfil (con los datos enviados en el signUp) y su cupón.
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_porcentaje int;
begin
  insert into public.perfiles (id, email, nombre, apellido, fecha_nacimiento, tipo_sangre, color_ojos, dias_vacaciones)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'nombre',
    new.raw_user_meta_data ->> 'apellido',
    (new.raw_user_meta_data ->> 'fecha_nacimiento')::date,
    new.raw_user_meta_data ->> 'tipo_sangre',
    new.raw_user_meta_data ->> 'color_ojos',
    (new.raw_user_meta_data ->> 'dias_vacaciones')::int
  );

  -- El porcentaje lo configura el administrador (tabla cupones_regla, email 30/01).
  select porcentaje into v_porcentaje
  from public.cupones_regla where tipo = 'primera_compra' and activo;

  if v_porcentaje is not null then
    insert into public.cupones (usuario_id, tipo, porcentaje)
    values (new.id, 'primera_compra', v_porcentaje);
  end if;

  return new;
end;
$$;

create trigger trg_auth_usuario_nuevo
  after insert on auth.users
  for each row execute function public.crear_perfil_usuario();

-- Calcula el fin de la función según la duración de la película y el bloqueo de 30 minutos.
-- También valida que el horario nuevo no esté en el pasado y que la sala esté activa.
create or replace function public.calcular_horario_funcion()
returns trigger
language plpgsql
as $$
declare
  v_duracion int;
begin
  select duracion_min into v_duracion from public.peliculas where id = new.pelicula_id;
  if v_duracion is null then
    raise exception 'La película no existe';
  end if;

  if tg_op = 'INSERT' or new.inicio is distinct from old.inicio then
    if new.inicio <= now() then
      raise exception 'No se pueden programar funciones en el pasado';
    end if;
  end if;

  if tg_op = 'INSERT' or new.sala_id is distinct from old.sala_id then
    if not exists (select 1 from public.salas where id = new.sala_id and activa) then
      raise exception 'La sala no está activa';
    end if;
  end if;

  new.fin := new.inicio + make_interval(mins => v_duracion);
  new.bloqueada_hasta := new.fin + interval '30 minutes';
  return new;
end;
$$;

create trigger trg_funciones_horario
  before insert or update of inicio, pelicula_id, sala_id on public.funciones
  for each row execute function public.calcular_horario_funcion();

-- Una función con entradas vendidas no puede cambiar de horario, sala, película, formato ni idioma:
-- los compradores ya tienen su entrada. El precio sí se puede cambiar (solo afecta a las ventas nuevas).
create or replace function public.proteger_funcion_con_ventas()
returns trigger
language plpgsql
as $$
begin
  if (new.inicio, new.sala_id, new.pelicula_id, new.formato, new.idioma)
       is distinct from (old.inicio, old.sala_id, old.pelicula_id, old.formato, old.idioma)
     and exists (select 1 from public.entradas where funcion_id = old.id) then
    raise exception 'La función ya tiene entradas vendidas: solo se puede cambiar el precio';
  end if;
  return new;
end;
$$;

create trigger trg_funciones_con_ventas
  before update on public.funciones
  for each row execute function public.proteger_funcion_con_ventas();

-- Si cambia la duración de una película se recalculan sus funciones.
-- Si alguna pasa a superponerse, la restricción de la tabla rechaza el cambio.
create or replace function public.recalcular_funciones_pelicula()
returns trigger
language plpgsql
as $$
begin
  update public.funciones set inicio = inicio where pelicula_id = new.id;
  return new;
end;
$$;

create trigger trg_peliculas_duracion
  after update of duracion_min on public.peliculas
  for each row
  when (old.duracion_min is distinct from new.duracion_min)
  execute function public.recalcular_funciones_pelicula();

-- Completa el autor de la reseña con el perfil del usuario logueado.
create or replace function public.completar_resenia()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.usuario_id := auth.uid();
  end if;

  select nombre || ' ' || left(apellido, 1) || '.' into new.autor
  from public.perfiles where id = new.usuario_id;

  if new.autor is null then
    raise exception 'Tenés que iniciar sesión para dejar una reseña';
  end if;
  return new;
end;
$$;

create trigger trg_resenias_autor
  before insert or update on public.resenias
  for each row execute function public.completar_resenia();

-- =====================================================================
--  RPC (lógica de negocio del lado del servidor)
-- =====================================================================

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

    -- Descuento por edad (email 30/01): no se consume, aplica en cada compra.
    select * into v_regla from public.cupones_regla where tipo = 'mayores' and activo;
    if found and v_regla.edad_minima is not null
       and public.edad(v_perfil.fecha_nacimiento) >= v_regla.edad_minima
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

-- Compras del usuario logueado.
create or replace function public.mis_compras()
returns table (
  codigo       uuid,
  fecha_compra timestamptz,
  pelicula     text,
  imagen_url   text,
  sala         text,
  inicio       timestamptz,
  cantidad     int,
  total        numeric,
  validada_en  timestamptz
)
language sql stable security definer set search_path = public
as $$
  select c.codigo, c.creado_en, p.titulo, p.imagen_url, s.nombre, f.inicio, c.cantidad, c.total, c.validada_en
  from public.compras c
  join public.funciones f on f.id = c.funcion_id
  join public.peliculas p on p.id = f.pelicula_id
  join public.salas s     on s.id = f.sala_id
  where c.usuario_id = auth.uid()
  order by c.creado_en desc;
$$;

-- Entradas vendidas por película (de mayor a menor). La home muestra las 3 primeras (email 16/01).
create or replace function public.ranking_ventas()
returns table (pelicula_id bigint, entradas_vendidas int)
language sql stable security definer set search_path = public
as $$
  select f.pelicula_id, count(e.id)::int
  from public.entradas e
  join public.funciones f on f.id = e.funcion_id
  join public.peliculas p on p.id = f.pelicula_id
  where p.en_cartelera
  group by f.pelicula_id
  order by count(e.id) desc;
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
                         and public.edad(pe.fecha_nacimiento) >= r.edad_minima)
  );
$$;

-- =====================================================================
--  VALIDACIÓN DEL QR (email 06/02)
--  Solo el personal del cine. El código deja de servir una vez usado.
-- =====================================================================

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
      to_char(v_compra.validada_en, 'DD/MM/YYYY HH24:MI');
  end if;

  select * into v_funcion from public.funciones where id = v_compra.funcion_id;
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
  v_compra public.compras%rowtype;
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
      to_char(v_compra.entregado_en, 'DD/MM/YYYY HH24:MI');
  end if;

  update public.compras
  set entregado_en = now(), entregado_por = auth.uid()
  where id = v_compra.id;

  return public.compra_para_validar(p_codigo);
end;
$$;

-- =====================================================================
--  PROGRAMACIÓN DE FUNCIONES (email 06/02)
-- =====================================================================

-- Salas activas que quedan libres para ese horario (incluye los 30 minutos de bloqueo).
create or replace function public.salas_libres(
  p_inicio          timestamptz,
  p_pelicula_id     bigint,
  p_excluir_funcion bigint default null
)
returns table (id bigint, nombre text)
language sql stable security definer set search_path = public
as $$
  select s.id, s.nombre
  from public.salas s
  cross join public.peliculas p
  where p.id = p_pelicula_id
    and s.activa
    and not exists (
      select 1 from public.funciones f
      where f.sala_id = s.id
        and (p_excluir_funcion is null or f.id <> p_excluir_funcion)
        and tstzrange(f.inicio, f.bloqueada_hasta) && tstzrange(
              p_inicio,
              p_inicio + make_interval(mins => p.duracion_min) + interval '30 minutes')
    )
  order by s.nombre;
$$;

-- Programa la misma película en varios días y horarios de una sola vez.
-- Con p_sala_id en null asigna automáticamente la primera sala libre de cada horario.
-- Devuelve un detalle por horario: cada uno se intenta por separado, un error no cancela el resto.
create or replace function public.programar_funciones(
  p_pelicula_id bigint,
  p_sala_id     bigint,
  p_inicios     timestamptz[],
  p_formato     text,
  p_idioma      text,
  p_precio      numeric
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_inicio    timestamptz;
  v_sala      bigint;
  v_nombre    text;
  v_resultado jsonb := '[]'::jsonb;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede programar funciones';
  end if;
  if coalesce(array_length(p_inicios, 1), 0) = 0 then
    raise exception 'Elegí al menos un día';
  end if;
  if array_length(p_inicios, 1) > 31 then
    raise exception 'Se pueden programar hasta 31 funciones por vez';
  end if;

  foreach v_inicio in array p_inicios loop
    begin
      v_sala := p_sala_id;
      if v_sala is null then
        select sl.id into v_sala from public.salas_libres(v_inicio, p_pelicula_id) sl limit 1;
        if v_sala is null then
          raise exception 'No hay ninguna sala libre en ese horario';
        end if;
      end if;

      insert into public.funciones (pelicula_id, sala_id, inicio, formato, idioma, precio)
      values (p_pelicula_id, v_sala, v_inicio, p_formato, p_idioma, p_precio);

      select nombre into v_nombre from public.salas where id = v_sala;
      v_resultado := v_resultado || jsonb_build_object('inicio', v_inicio, 'creada', true, 'sala', v_nombre);
    exception
      when exclusion_violation then
        v_resultado := v_resultado || jsonb_build_object(
          'inicio', v_inicio, 'creada', false,
          'motivo', 'La sala ya tiene otra función en ese horario');
      when others then
        v_resultado := v_resultado || jsonb_build_object('inicio', v_inicio, 'creada', false, 'motivo', sqlerrm);
    end;
  end loop;

  return v_resultado::json;
end;
$$;

-- Cambia el rol de un usuario (email 06/02: empleados que validan los QR).
create or replace function public.cambiar_rol(p_usuario uuid, p_rol text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede cambiar roles';
  end if;
  if p_rol not in ('cliente', 'empleado', 'admin') then
    raise exception 'Rol inválido';
  end if;
  if p_usuario = auth.uid() and p_rol <> 'admin' then
    raise exception 'No podés quitarte a vos mismo el rol de administrador';
  end if;

  update public.perfiles set rol = p_rol where id = p_usuario;
  if not found then
    raise exception 'El usuario no existe';
  end if;
end;
$$;

-- =====================================================================
--  SEGURIDAD (Row Level Security)
-- =====================================================================

alter table public.perfiles         enable row level security;
alter table public.salas            enable row level security;
alter table public.generos          enable row level security;
alter table public.peliculas        enable row level security;
alter table public.pelicula_generos enable row level security;
alter table public.funciones        enable row level security;
alter table public.cupones          enable row level security;
alter table public.compras          enable row level security;
alter table public.entradas         enable row level security;
alter table public.resenias         enable row level security;
alter table public.cupones_regla    enable row level security;
alter table public.categorias_productos enable row level security;
alter table public.productos        enable row level security;
alter table public.compra_productos enable row level security;

-- Perfiles: cada usuario ve el suyo; el admin ve todos.
create policy "perfiles_lectura" on public.perfiles
  for select to authenticated using (id = auth.uid() or public.es_admin());

-- Catálogo: lectura pública, escritura solo admin.
create policy "salas_lectura" on public.salas for select using (true);
create policy "salas_admin" on public.salas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

create policy "generos_lectura" on public.generos for select using (true);
create policy "generos_admin" on public.generos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

create policy "peliculas_lectura" on public.peliculas
  for select using (en_cartelera or public.es_admin());
create policy "peliculas_admin" on public.peliculas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

create policy "pelicula_generos_lectura" on public.pelicula_generos for select using (true);
create policy "pelicula_generos_admin" on public.pelicula_generos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

create policy "funciones_lectura" on public.funciones for select using (true);
create policy "funciones_admin" on public.funciones
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Cupones y compras: cada usuario ve los suyos. Las compras se crean solo con comprar_entradas().
create policy "cupones_lectura" on public.cupones
  for select to authenticated using (usuario_id = auth.uid());

create policy "compras_lectura" on public.compras
  for select to authenticated using (usuario_id = auth.uid() or public.es_admin());

-- Entradas: lectura pública (solo tiene función, fila, número y precio) para armar el mapa de butacas.
create policy "entradas_lectura" on public.entradas for select using (true);

-- Reseñas: todos las leen; cada usuario gestiona la suya; el admin puede borrar.
create policy "resenias_lectura" on public.resenias for select using (true);
create policy "resenias_insertar" on public.resenias
  for insert to authenticated with check (usuario_id = auth.uid());
create policy "resenias_modificar" on public.resenias
  for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "resenias_eliminar" on public.resenias
  for delete to authenticated using (usuario_id = auth.uid() or public.es_admin());

-- Reglas de descuento: lectura pública (la app muestra el porcentaje), escritura solo admin.
create policy "cupones_regla_lectura" on public.cupones_regla for select using (true);
create policy "cupones_regla_admin" on public.cupones_regla
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Candy bar: el público ve los productos disponibles, el admin los gestiona.
create policy "categorias_lectura" on public.categorias_productos for select using (true);
create policy "categorias_admin" on public.categorias_productos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

create policy "productos_lectura" on public.productos
  for select using (disponible or public.es_admin());
create policy "productos_admin" on public.productos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Los productos de una compra los ve quien la hizo (o el admin). El personal los consulta
-- con compra_para_validar(), que valida el rol.
create policy "compra_productos_lectura" on public.compra_productos
  for select to authenticated using (
    exists (select 1 from public.compras c
            where c.id = compra_id and (c.usuario_id = auth.uid() or public.es_admin()))
  );

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.comprar_entradas(bigint, text[], text, text, jsonb) to anon, authenticated;
grant execute on function public.obtener_compra(uuid) to anon, authenticated;
grant execute on function public.ranking_ventas() to anon, authenticated;
grant execute on function public.mis_compras() to authenticated;
grant execute on function public.mis_beneficios() to authenticated;
grant execute on function public.compra_para_validar(uuid) to authenticated;
grant execute on function public.validar_entrada(uuid) to authenticated;
grant execute on function public.entregar_productos(uuid) to authenticated;
grant execute on function public.salas_libres(timestamptz, bigint, bigint) to authenticated;
grant execute on function public.programar_funciones(bigint, bigint, timestamptz[], text, text, numeric) to authenticated;
grant execute on function public.cambiar_rol(uuid, text) to authenticated;

-- =====================================================================
--  STORAGE: pósters de películas
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('posters', 'posters', true)
on conflict (id) do nothing;

create policy "posters_lectura" on storage.objects
  for select using (bucket_id = 'posters');
create policy "posters_admin_subir" on storage.objects
  for insert to authenticated with check (bucket_id = 'posters' and public.es_admin());
create policy "posters_admin_modificar" on storage.objects
  for update to authenticated using (bucket_id = 'posters' and public.es_admin());
create policy "posters_admin_eliminar" on storage.objects
  for delete to authenticated using (bucket_id = 'posters' and public.es_admin());
