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
  rol              text not null default 'cliente' check (rol in ('cliente', 'admin')),
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

-- Cupón de bienvenida: 20% en la primera compra (email 01/01).
create table public.cupones (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  tipo       text not null default 'primera_compra' check (tipo in ('primera_compra')),
  porcentaje int  not null check (porcentaje between 1 and 100),
  usado      boolean not null default false,
  creado_en  timestamptz not null default now(),
  unique (usuario_id, tipo)
);

-- Una compra puede ser de un usuario registrado o anónima (usuario_id null).
create table public.compras (
  id               bigint generated always as identity primary key,
  codigo           uuid not null unique default gen_random_uuid(),  -- contenido del QR
  usuario_id       uuid references public.perfiles (id) on delete set null,
  email            text not null,
  nombre_comprador text not null,
  funcion_id       bigint not null references public.funciones (id) on delete restrict,
  cantidad         int not null check (cantidad > 0),
  subtotal         numeric(10, 2) not null,
  descuento        numeric(10, 2) not null default 0,
  total            numeric(10, 2) not null,
  cupon_id         bigint references public.cupones (id),
  creado_en        timestamptz not null default now()
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

-- Al registrarse un usuario se crea su perfil (con los datos enviados en el signUp) y su cupón.
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql security definer set search_path = public
as $$
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

  insert into public.cupones (usuario_id, tipo, porcentaje)
  values (new.id, 'primera_compra', 20);

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

-- Compra de entradas. Valida la función y las butacas, calcula el precio
-- y aplica el cupón de primera compra. Devuelve el código de la compra (QR).
-- El precio nunca viene del cliente.
create or replace function public.comprar_entradas(
  p_funcion_id bigint,
  p_butacas    text[],
  p_email      text default null,
  p_nombre     text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_usuario   uuid := auth.uid();
  v_funcion   public.funciones%rowtype;
  v_perfil    public.perfiles%rowtype;
  v_cupon     public.cupones%rowtype;
  v_cantidad  int;
  v_subtotal  numeric(10, 2);
  v_descuento numeric(10, 2) := 0;
  v_compra_id bigint;
  v_codigo    uuid;
  v_butaca    text;
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

  -- Cupón de primera compra (solo usuarios registrados). "for update" evita usarlo dos veces en paralelo.
  if v_usuario is not null then
    select * into v_cupon
    from public.cupones
    where usuario_id = v_usuario and tipo = 'primera_compra' and not usado
    for update;

    if found then
      v_descuento := round(v_subtotal * v_cupon.porcentaje / 100.0, 2);
      update public.cupones set usado = true where id = v_cupon.id;
    end if;
  end if;

  insert into public.compras (usuario_id, email, nombre_comprador, funcion_id, cantidad, subtotal, descuento, total, cupon_id)
  values (
    v_usuario, lower(trim(p_email)), trim(p_nombre), p_funcion_id, v_cantidad,
    v_subtotal, v_descuento, v_subtotal - v_descuento,
    case when v_descuento > 0 then v_cupon.id end
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

  return v_codigo;
end;
$$;

-- Detalle de una compra a partir de su código (sirve también para compras anónimas).
create or replace function public.obtener_compra(p_codigo uuid)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'codigo',       c.codigo,
    'fecha_compra', c.creado_en,
    'nombre',       c.nombre_comprador,
    'email',        c.email,
    'cantidad',     c.cantidad,
    'subtotal',     c.subtotal,
    'descuento',    c.descuento,
    'total',        c.total,
    'pelicula',     p.titulo,
    'imagen_url',   p.imagen_url,
    'duracion_min', p.duracion_min,
    'sala',         s.nombre,
    'inicio',       f.inicio,
    'formato',      f.formato,
    'idioma',       f.idioma,
    'butacas',      (select json_agg(e.fila || e.numero order by e.fila, e.numero)
                     from public.entradas e where e.compra_id = c.id)
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
  total        numeric
)
language sql stable security definer set search_path = public
as $$
  select c.codigo, c.creado_en, p.titulo, p.imagen_url, s.nombre, f.inicio, c.cantidad, c.total
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

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.comprar_entradas(bigint, text[], text, text) to anon, authenticated;
grant execute on function public.obtener_compra(uuid) to anon, authenticated;
grant execute on function public.ranking_ventas() to anon, authenticated;
grant execute on function public.mis_compras() to authenticated;

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
