-- =====================================================================
--  Migración 008 · Próximamente, preventa, alertas de estreno, Mis películas y latido
--  (email del 08/03)
--  Para bases que ya tienen la migración 007.
--  Uso: Supabase > SQL Editor > New query > pegar todo el archivo > Run
--  Se puede ejecutar más de una vez sin problemas.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Tablas y columnas nuevas
-- ---------------------------------------------------------------------
-- Sin fecha de estreno la película ya está en cartelera. Con fecha futura aparece en "Próximamente";
-- con precio de preventa la venta abre 7 días antes.
alter table public.peliculas add column if not exists fecha_estreno   date;
alter table public.peliculas add column if not exists precio_preventa numeric(10, 2) check (precio_preventa >= 0);
alter table public.peliculas drop constraint if exists peliculas_preventa_con_estreno;
alter table public.peliculas add constraint peliculas_preventa_con_estreno
  check (precio_preventa is null or fecha_estreno is not null);

alter table public.compras add column if not exists preventa boolean not null default false;

create table if not exists public.alertas_estreno (
  usuario_id  uuid   not null default auth.uid() references public.perfiles (id) on delete cascade,
  pelicula_id bigint not null references public.peliculas (id) on delete cascade,
  creado_en   timestamptz not null default now(),
  avisada_en  timestamptz,
  primary key (usuario_id, pelicula_id)
);

-- ---------------------------------------------------------------------
--  2. Funciones
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
--  3. Seguridad
-- ---------------------------------------------------------------------
alter table public.alertas_estreno enable row level security;

drop policy if exists "alertas_lectura" on public.alertas_estreno;
drop policy if exists "alertas_crear" on public.alertas_estreno;
drop policy if exists "alertas_eliminar" on public.alertas_estreno;

-- Cada usuario activa y desactiva sus alertas. Solo avisar_alertas() las marca como avisadas.
create policy "alertas_lectura" on public.alertas_estreno
  for select to authenticated using (usuario_id = auth.uid());
create policy "alertas_crear" on public.alertas_estreno
  for insert to authenticated with check (usuario_id = auth.uid());
create policy "alertas_eliminar" on public.alertas_estreno
  for delete to authenticated using (usuario_id = auth.uid());

grant select on public.alertas_estreno to anon, authenticated;
grant insert, update, delete on public.alertas_estreno to authenticated;
grant execute on function public.mis_peliculas() to authenticated;
grant execute on function public.avisar_alertas() to authenticated;

-- ---------------------------------------------------------------------
--  4. Mantenimiento: la tarea programada de GitHub Actions llama a latido() cada 2 días
--     para que Supabase no pause el proyecto por inactividad (actualiza una sola fecha).
-- ---------------------------------------------------------------------
create table if not exists public.latidos (
  id        int primary key default 1 check (id = 1),
  ultimo_en timestamptz not null default now()
);

insert into public.latidos default values on conflict (id) do nothing;

create or replace function public.latido()
returns timestamptz
language sql security definer set search_path = public
as $$
  update public.latidos set ultimo_en = now() where id = 1 returning ultimo_en;
$$;

alter table public.latidos enable row level security;  -- sin políticas: solo se toca con latido()
grant execute on function public.latido() to anon, authenticated;
