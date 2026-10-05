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

-- Todas las salas tienen la misma distribución de butacas (ver butaca_valida() y src/app/core/utils/butacas.ts).
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
  -- Edad mínima para ver la película (email 12/02): 0 = ATP, 13 o 18.
  restriccion_edad int not null default 0 check (restriccion_edad in (0, 13, 18)),
  -- Estreno y preventa (email 08/03). Sin fecha de estreno la película ya está en cartelera.
  -- Con fecha futura aparece en "Próximamente"; con precio de preventa la venta abre 7 días antes.
  fecha_estreno   date,
  precio_preventa numeric(10, 2) check (precio_preventa >= 0),
  creado_en    timestamptz not null default now(),
  constraint peliculas_preventa_con_estreno check (precio_preventa is null or fecha_estreno is not null)
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

-- Programa de puntos (email 03/03): lo que se puede canjear y cuántos puntos cuesta.
-- Una fila para la entrada gratis y una por cada producto del candy bar que se puede canjear.
create table public.recompensas (
  id          bigint generated always as identity primary key,
  tipo        text not null check (tipo in ('entrada', 'producto')),
  producto_id bigint unique references public.productos (id) on delete cascade,
  puntos      int  not null check (puntos > 0),
  activa      boolean not null default true,
  check ((tipo = 'entrada') = (producto_id is null))
);

create unique index recompensas_una_entrada on public.recompensas (tipo) where tipo = 'entrada';

insert into public.recompensas (tipo, puntos) values ('entrada', 500);

-- Combos (email 03/03): una entrada más productos del candy bar a un precio fijo.
create table public.combos (
  id          bigint generated always as identity primary key,
  nombre      text not null unique,
  descripcion text not null default '',
  precio      numeric(10, 2) not null check (precio >= 0),
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

create table public.combo_productos (
  combo_id    bigint not null references public.combos (id) on delete cascade,
  producto_id bigint not null references public.productos (id) on delete restrict,
  cantidad    int not null check (cantidad between 1 and 10),
  primary key (combo_id, producto_id)
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
  subtotal         numeric(10, 2) not null,              -- entradas
  subtotal_productos numeric(10, 2) not null default 0,  -- candy bar (email 30/01)
  subtotal_combos  numeric(10, 2) not null default 0,     -- combos (email 03/03)
  descuento        numeric(10, 2) not null default 0,
  descuento_motivo text check (descuento_motivo in ('primera_compra', 'mayores')),
  total            numeric(10, 2) not null,
  cupon_id         bigint references public.cupones (id),
  -- Programa de puntos (email 03/03)
  entradas_canjeadas int not null default 0,  -- entradas pagadas con puntos
  puntos_usados    int not null default 0,
  puntos_ganados   int not null default 0,
  preventa         boolean not null default false,  -- entradas cobradas al precio de preventa (email 08/03)
  creado_en        timestamptz not null default now(),
  -- Validación del QR (email 06/02): una vez usado, el código deja de servir.
  validada_en      timestamptz,
  validada_por     uuid references public.perfiles (id) on delete set null,
  entregado_en     timestamptz,
  entregado_por    uuid references public.perfiles (id) on delete set null
);

create index compras_usuario_idx on public.compras (usuario_id);

-- Una fila por butaca vendida. El unique impide vender dos veces la misma butaca.
-- Las butacas nuevas se validan con butaca_valida() al comprar; acá se aceptan también las de la distribución anterior.
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
  canjeados       int  not null default 0 check (canjeados between 0 and cantidad),  -- unidades pagadas con puntos
  unique (compra_id, producto_id)
);

-- Combos comprados (email 03/03). El nombre, el contenido y el precio quedan congelados.
create table public.compra_combos (
  id              bigint generated always as identity primary key,
  compra_id       bigint not null references public.compras (id) on delete cascade,
  combo_id        bigint not null references public.combos (id) on delete restrict,
  nombre          text not null,
  contenido       text not null,  -- por ejemplo "1 entrada + 1 × Pochoclos medianos + 1 × Gaseosa grande"
  cantidad        int  not null check (cantidad between 1 and 10),
  precio_unitario numeric(10, 2) not null,
  unique (compra_id, combo_id)
);

-- Puntos (email 03/03): cada compra suma y cada canje resta. El saldo es la suma de los movimientos.
-- Solo los escribe comprar_entradas(): no hay forma de sumarse puntos ni de pasarlos a otro usuario.
create table public.movimientos_puntos (
  id         bigint generated always as identity primary key,
  usuario_id uuid   not null references public.perfiles (id) on delete cascade,
  compra_id  bigint not null references public.compras (id) on delete cascade,
  tipo       text   not null check (tipo in ('compra', 'canje')),
  puntos     int    not null check (puntos <> 0),
  detalle    text   not null,
  creado_en  timestamptz not null default now()
);

create index movimientos_puntos_usuario_idx on public.movimientos_puntos (usuario_id);

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

-- Alertas de estreno (email 08/03): el usuario pide que le avisen cuando se habilite la venta de una película.
create table public.alertas_estreno (
  usuario_id  uuid   not null default auth.uid() references public.perfiles (id) on delete cascade,
  pelicula_id bigint not null references public.peliculas (id) on delete cascade,
  creado_en   timestamptz not null default now(),
  avisada_en  timestamptz,  -- cuándo se le avisó que ya puede comprar
  primary key (usuario_id, pelicula_id)
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

-- Fecha de hoy en Argentina: las fechas de estreno y los reportes se cuentan con la hora del cine.
create or replace function public.hoy_argentina()
returns date
language sql stable
as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

-- Día en que se habilita la venta de una película (email 08/03): el del estreno o, si tiene preventa, 7 días antes.
-- Sin fecha de estreno devuelve null: la venta ya está habilitada.
create or replace function public.apertura_venta(p_estreno date, p_precio_preventa numeric)
returns date
language sql immutable
as $$
  select p_estreno - case when p_precio_preventa is null then 0 else 7 end;
$$;

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

-- Compra de entradas, combos y productos del candy bar. Valida la función, que la venta esté abierta, la edad,
-- las butacas, los productos, los combos y los puntos que se canjean; calcula el precio (el de preventa hasta
-- el estreno) y aplica el mejor descuento disponible.
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

  v_total := v_subtotal + v_productos + v_combos - v_descuento;

  -- Programa de puntos (email 03/03): 1 punto por cada peso pagado, solo para usuarios registrados.
  if v_usuario is not null then
    v_puntos_ganados := floor(v_total)::int;
  end if;

  insert into public.compras (
    usuario_id, email, nombre_comprador, funcion_id, cantidad,
    subtotal, subtotal_productos, subtotal_combos, descuento, descuento_motivo, total, cupon_id,
    entradas_canjeadas, puntos_usados, puntos_ganados, preventa
  )
  values (
    v_usuario, lower(trim(p_email)), trim(p_nombre), p_funcion_id, v_cantidad,
    v_subtotal, v_productos, v_combos, v_descuento,
    case when v_descuento > 0 then v_motivo end,
    v_total,
    case when v_descuento > 0 and v_motivo = 'primera_compra' then v_cupon.id end,
    v_canje_entradas, v_puntos_usados, v_puntos_ganados, v_preventa
  )
  returning id, codigo into v_compra_id, v_codigo;

  begin
    insert into public.entradas (compra_id, funcion_id, fila, numero, precio)
    select v_compra_id, p_funcion_id, left(b, 1), substring(b from 2)::int, v_precio
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
    'preventa',       c.preventa,
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
  where c.usuario_id = auth.uid() and f.fin < now()
  group by p.id
  order by max(f.inicio) desc;
$$;

-- Alertas de estreno (email 08/03) que ya se pueden avisar: la venta está abierta y hay funciones a la venta.
-- Las marca como avisadas y las devuelve, así cada alerta se avisa una sola vez.
create or replace function public.avisar_alertas()
returns table (pelicula_id bigint, titulo text, preventa boolean)
language sql security definer set search_path = public
as $$
  update public.alertas_estreno a
  set avisada_en = now()
  from public.peliculas p
  where a.usuario_id = auth.uid()
    and a.avisada_en is null
    and p.id = a.pelicula_id
    and p.en_cartelera
    and coalesce(public.apertura_venta(p.fecha_estreno, p.precio_preventa) <= public.hoy_argentina(), true)
    and exists (select 1 from public.funciones f where f.pelicula_id = p.id and f.inicio > now())
  returning p.id, p.titulo, p.precio_preventa is not null and public.hoy_argentina() < p.fecha_estreno;
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
                         and public.edad(pe.fecha_nacimiento) > r.edad_minima)
  );
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
--  REPORTES (email 28/02)
-- =====================================================================

-- Facturación y entradas vendidas por día, para el administrador. Incluye los días sin ventas.
-- Cada compra cuenta en el día (de Argentina) en que se hizo, no en el de la función.
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
    on (c.creado_en at time zone 'America/Argentina/Buenos_Aires')::date = d.dia
  group by d.dia
  order by d.dia;
end;
$$;

-- =====================================================================
--  MANTENIMIENTO
--  Supabase pausa los proyectos gratuitos que pasan 7 días sin actividad. La tarea programada
--  .github/workflows/mantener-supabase.yml llama a latido() cada 2 días: actualiza una sola fecha.
-- =====================================================================

create table public.latidos (
  id        int primary key default 1 check (id = 1),
  ultimo_en timestamptz not null default now()
);

insert into public.latidos default values;

create or replace function public.latido()
returns timestamptz
language sql security definer set search_path = public
as $$
  update public.latidos set ultimo_en = now() where id = 1 returning ultimo_en;
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
alter table public.recompensas      enable row level security;
alter table public.combos           enable row level security;
alter table public.combo_productos  enable row level security;
alter table public.compra_combos    enable row level security;
alter table public.movimientos_puntos enable row level security;
alter table public.alertas_estreno  enable row level security;
alter table public.latidos          enable row level security;  -- sin políticas: solo se toca con latido()

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

-- Puntos y combos (email 03/03). Recompensas y combos: lectura pública, escritura solo admin.
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

-- Cada usuario ve sus movimientos de puntos. No hay políticas de escritura: los crea solo
-- comprar_entradas(), así los puntos no se pueden cargar ni transferir entre usuarios.
create policy "movimientos_puntos_lectura" on public.movimientos_puntos
  for select to authenticated using (usuario_id = auth.uid());

-- Alertas de estreno (email 08/03): cada usuario activa y desactiva las suyas.
-- Solo avisar_alertas() las marca como avisadas.
create policy "alertas_lectura" on public.alertas_estreno
  for select to authenticated using (usuario_id = auth.uid());
create policy "alertas_crear" on public.alertas_estreno
  for insert to authenticated with check (usuario_id = auth.uid());
create policy "alertas_eliminar" on public.alertas_estreno
  for delete to authenticated using (usuario_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.comprar_entradas(bigint, text[], text, text, jsonb, date, jsonb, jsonb) to anon, authenticated;
grant execute on function public.obtener_compra(uuid) to anon, authenticated;
grant execute on function public.ranking_ventas() to anon, authenticated;
grant execute on function public.mis_compras() to authenticated;
grant execute on function public.mis_beneficios() to authenticated;
grant execute on function public.mis_puntos() to authenticated;
grant execute on function public.mis_peliculas() to authenticated;
grant execute on function public.avisar_alertas() to authenticated;
grant execute on function public.latido() to anon, authenticated;
grant execute on function public.compra_para_validar(uuid) to authenticated;
grant execute on function public.validar_entrada(uuid) to authenticated;
grant execute on function public.entregar_productos(uuid) to authenticated;
grant execute on function public.salas_libres(timestamptz, bigint, bigint) to authenticated;
grant execute on function public.programar_funciones(bigint, bigint, timestamptz[], text, text, numeric) to authenticated;
grant execute on function public.cambiar_rol(uuid, text) to authenticated;
grant execute on function public.reporte_ventas(date, date) to authenticated;

-- =====================================================================
--  TIEMPO REAL (email 12/02)
--  La pantalla de compra escucha las entradas nuevas de su función para marcar al instante
--  las butacas que compra otra persona. Solo se agrega si existe la publicación de Supabase.
-- =====================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'entradas') then
    alter publication supabase_realtime add table public.entradas;
  end if;
end $$;

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
