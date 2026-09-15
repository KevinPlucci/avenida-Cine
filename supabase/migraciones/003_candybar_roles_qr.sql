-- =====================================================================
--  Migración 003 · Candy bar, cupones configurables, empleados y validación de QR
--  (emails del 30/01 y del 06/02)
--  Para bases creadas con una versión anterior de schema.sql.
--  Uso: Supabase > SQL Editor > New query > pegar todo el archivo > Run
--  Se puede ejecutar más de una vez sin problemas.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Rol de empleado
-- ---------------------------------------------------------------------
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check
  check (rol in ('cliente', 'empleado', 'admin'));

create or replace function public.es_empleado()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol in ('empleado', 'admin'));
$$;

create or replace function public.edad(p_fecha date)
returns int
language sql stable
as $$
  select case when p_fecha is null then null else extract(year from age(current_date, p_fecha))::int end;
$$;

-- ---------------------------------------------------------------------
--  2. Reglas de descuento configurables por el administrador
-- ---------------------------------------------------------------------
create table if not exists public.cupones_regla (
  tipo           text primary key check (tipo in ('primera_compra', 'mayores')),
  porcentaje     int  not null check (porcentaje between 1 and 100),
  edad_minima    int  check (edad_minima between 0 and 120),
  activo         boolean not null default true,
  actualizado_en timestamptz not null default now()
);

insert into public.cupones_regla (tipo, porcentaje, edad_minima)
values ('primera_compra', 20, null), ('mayores', 15, 50)
on conflict (tipo) do nothing;

-- El cupón de bienvenida se emite con el porcentaje vigente.
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

  select porcentaje into v_porcentaje
  from public.cupones_regla where tipo = 'primera_compra' and activo;

  if v_porcentaje is not null then
    insert into public.cupones (usuario_id, tipo, porcentaje)
    values (new.id, 'primera_compra', v_porcentaje);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
--  3. Candy bar
-- ---------------------------------------------------------------------
create table if not exists public.categorias_productos (
  id     bigint generated always as identity primary key,
  nombre text not null unique,
  orden  int  not null default 0
);

create table if not exists public.productos (
  id           bigint generated always as identity primary key,
  categoria_id bigint not null references public.categorias_productos (id) on delete restrict,
  nombre       text not null unique,
  descripcion  text not null default '',
  precio       numeric(10, 2) not null check (precio >= 0),
  disponible   boolean not null default true,
  creado_en    timestamptz not null default now()
);

create index if not exists productos_categoria_idx on public.productos (categoria_id);

alter table public.compras add column if not exists subtotal_productos numeric(10, 2) not null default 0;
alter table public.compras add column if not exists descuento_motivo   text;
alter table public.compras drop constraint if exists compras_descuento_motivo_check;
alter table public.compras add constraint compras_descuento_motivo_check
  check (descuento_motivo in ('primera_compra', 'mayores'));

-- Validación del QR (email 06/02).
alter table public.compras add column if not exists validada_en   timestamptz;
alter table public.compras add column if not exists validada_por  uuid references public.perfiles (id) on delete set null;
alter table public.compras add column if not exists entregado_en  timestamptz;
alter table public.compras add column if not exists entregado_por uuid references public.perfiles (id) on delete set null;

create table if not exists public.compra_productos (
  id              bigint generated always as identity primary key,
  compra_id       bigint not null references public.compras (id) on delete cascade,
  producto_id     bigint not null references public.productos (id) on delete restrict,
  nombre          text not null,
  cantidad        int  not null check (cantidad between 1 and 20),
  precio_unitario numeric(10, 2) not null,
  unique (compra_id, producto_id)
);

-- ---------------------------------------------------------------------
--  4. Compra con productos y descuento por edad
-- ---------------------------------------------------------------------
drop function if exists public.comprar_entradas(bigint, text[], text, text);

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

  if v_usuario is not null then
    select * into v_cupon
    from public.cupones
    where usuario_id = v_usuario and tipo = 'primera_compra' and not usado
    for update;
    if found then
      v_porcentaje := v_cupon.porcentaje;
      v_motivo     := 'primera_compra';
    end if;

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

-- Cambia el tipo devuelto, por eso hay que recrearla.
drop function if exists public.mis_compras();

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

-- ---------------------------------------------------------------------
--  5. Validación del QR
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
--  6. Programación de funciones y roles
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
--  7. Seguridad de las tablas nuevas
-- ---------------------------------------------------------------------
alter table public.cupones_regla        enable row level security;
alter table public.categorias_productos enable row level security;
alter table public.productos            enable row level security;
alter table public.compra_productos     enable row level security;

drop policy if exists "cupones_regla_lectura" on public.cupones_regla;
create policy "cupones_regla_lectura" on public.cupones_regla for select using (true);
drop policy if exists "cupones_regla_admin" on public.cupones_regla;
create policy "cupones_regla_admin" on public.cupones_regla
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "categorias_lectura" on public.categorias_productos;
create policy "categorias_lectura" on public.categorias_productos for select using (true);
drop policy if exists "categorias_admin" on public.categorias_productos;
create policy "categorias_admin" on public.categorias_productos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "productos_lectura" on public.productos;
create policy "productos_lectura" on public.productos
  for select using (disponible or public.es_admin());
drop policy if exists "productos_admin" on public.productos;
create policy "productos_admin" on public.productos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "compra_productos_lectura" on public.compra_productos;
create policy "compra_productos_lectura" on public.compra_productos
  for select to authenticated using (
    exists (select 1 from public.compras c
            where c.id = compra_id and (c.usuario_id = auth.uid() or public.es_admin()))
  );

grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.comprar_entradas(bigint, text[], text, text, jsonb) to anon, authenticated;
grant execute on function public.obtener_compra(uuid) to anon, authenticated;
grant execute on function public.mis_compras() to authenticated;
grant execute on function public.mis_beneficios() to authenticated;
grant execute on function public.compra_para_validar(uuid) to authenticated;
grant execute on function public.validar_entrada(uuid) to authenticated;
grant execute on function public.entregar_productos(uuid) to authenticated;
grant execute on function public.salas_libres(timestamptz, bigint, bigint) to authenticated;
grant execute on function public.programar_funciones(bigint, bigint, timestamptz[], text, text, numeric) to authenticated;
grant execute on function public.cambiar_rol(uuid, text) to authenticated;
