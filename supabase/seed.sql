-- =====================================================================
--  Cine Avenida · Datos de ejemplo
--  Ejecutar DESPUÉS de schema.sql (Supabase > SQL Editor)
-- =====================================================================

insert into public.salas (nombre)
values ('Sala 1'), ('Sala 2'), ('Sala 3'), ('Sala 4');

insert into public.generos (nombre)
values ('Acción'), ('Animación'), ('Aventura'), ('Ciencia ficción'), ('Comedia'), ('Drama'),
       ('Familiar'), ('Fantasía'), ('Romance'), ('Suspenso'), ('Terror');

insert into public.peliculas (titulo, sinopsis, duracion_min, imagen_url)
values
  ('El último faro',
   'Un farero solitario descubre que las luces que ve cada noche en el horizonte no pertenecen a ningún barco.',
   112, 'https://picsum.photos/seed/ultimo-faro/400/600'),
  ('Operación Medianoche',
   'Un equipo de especialistas tiene una sola noche para recuperar un disco robado antes de que salga del país.',
   128, 'https://picsum.photos/seed/medianoche/400/600'),
  ('Pequeños gigantes',
   'Tres hermanos construyen un robot con piezas del taller de su abuelo y lo anotan en un torneo escolar.',
   95, 'https://picsum.photos/seed/pequenos-gigantes/400/600'),
  ('Luna de papel',
   'Dos músicos que se conocen en un tren nocturno deciden viajar juntos hasta el final del recorrido.',
   104, 'https://picsum.photos/seed/luna-de-papel/400/600'),
  ('La casa del fondo',
   'Una familia se muda a una casa antigua y empieza a escuchar pasos en el cuarto que siempre está cerrado.',
   99, 'https://picsum.photos/seed/casa-del-fondo/400/600'),
  ('Horizonte rojo',
   'La tripulación de la primera base en Marte pierde contacto con la Tierra y tiene que decidir si volver o quedarse.',
   125, 'https://picsum.photos/seed/horizonte-rojo/400/600');

-- Restricción de edad (email 12/02). El resto son aptas para todo público.
update public.peliculas set restriccion_edad = 18 where titulo = 'La casa del fondo';
update public.peliculas set restriccion_edad = 13 where titulo = 'Operación Medianoche';

insert into public.pelicula_generos (pelicula_id, genero_id)
select p.id, g.id
from (values
  ('El último faro', 'Drama'), ('El último faro', 'Suspenso'),
  ('Operación Medianoche', 'Acción'), ('Operación Medianoche', 'Suspenso'),
  ('Pequeños gigantes', 'Animación'), ('Pequeños gigantes', 'Comedia'), ('Pequeños gigantes', 'Familiar'),
  ('Luna de papel', 'Romance'), ('Luna de papel', 'Drama'), ('Luna de papel', 'Comedia'),
  ('La casa del fondo', 'Terror'), ('La casa del fondo', 'Suspenso'),
  ('Horizonte rojo', 'Ciencia ficción'), ('Horizonte rojo', 'Aventura'), ('Horizonte rojo', 'Drama')
) as v (titulo, genero)
join public.peliculas p on p.titulo = v.titulo
join public.generos g on g.nombre = v.genero;

-- Funciones para los próximos 7 días: 4 horarios por sala, separados por 3 horas
-- (la película más larga dura 128 min + 30 min de bloqueo, así que no se superponen).
do $$
declare
  v_peliculas bigint[]  := array(select id from public.peliculas order by id);
  v_salas     bigint[]  := array(select id from public.salas order by id);
  v_horarios  time[]    := array['14:00', '17:00', '20:00', '23:00']::time[];
  v_formatos  text[]    := array['2D', '3D', '2D', '4D', '2D', '5D'];
  v_precios   numeric[] := array[5000, 6500, 5000, 8000, 5000, 9500];
  v_inicio    timestamptz;
  v_opcion    int;
begin
  for d in 0..6 loop
    for s in 1..array_length(v_salas, 1) loop
      for h in 1..array_length(v_horarios, 1) loop
        v_inicio := (current_date + d + v_horarios[h]) at time zone 'America/Argentina/Buenos_Aires';
        continue when v_inicio <= now();

        v_opcion := (s + h) % 6 + 1;
        insert into public.funciones (pelicula_id, sala_id, inicio, formato, idioma, precio)
        values (
          v_peliculas[(d + s + h) % array_length(v_peliculas, 1) + 1],
          v_salas[s],
          v_inicio,
          v_formatos[v_opcion],
          case when (d + h) % 2 = 0 then 'castellano' else 'subtitulada' end,
          v_precios[v_opcion]
        );
      end loop;
    end loop;
  end loop;
end $$;

-- Próximos estrenos (email 08/03): uno con la preventa ya abierta y otro que se estrena en tres semanas.
-- Se cargan después de las funciones de arriba, que son solo para las películas que ya se estrenaron.
insert into public.peliculas (titulo, sinopsis, duracion_min, imagen_url, fecha_estreno, precio_preventa)
values
  ('Marea alta',
   'La guardavidas de un pueblo de la costa queda a cargo de la playa la noche de la peor tormenta del siglo.',
   108, 'https://picsum.photos/seed/marea-alta/400/600', current_date + 4, 4000),
  ('El jardín de invierno',
   'Una botánica jubilada y su nieto intentan que florezca una planta que nadie vio florecer en cien años.',
   97, 'https://picsum.photos/seed/jardin-de-invierno/400/600', current_date + 21, null);

insert into public.pelicula_generos (pelicula_id, genero_id)
select p.id, g.id
from (values
  ('Marea alta', 'Drama'), ('Marea alta', 'Suspenso'),
  ('El jardín de invierno', 'Drama'), ('El jardín de invierno', 'Familiar')
) as v (titulo, genero)
join public.peliculas p on p.titulo = v.titulo
join public.generos g on g.nombre = v.genero;

-- Funciones de "Marea alta" desde el día del estreno, a las 11 (antes del primer horario de la sala).
insert into public.funciones (pelicula_id, sala_id, inicio, formato, idioma, precio)
select p.id, s.id, (current_date + d + time '11:00') at time zone 'America/Argentina/Buenos_Aires', '2D', 'castellano', 5500
from public.peliculas p
cross join public.salas s
cross join generate_series(4, 6) as d
where p.titulo = 'Marea alta' and s.nombre = 'Sala 1';

-- Candy bar (email 30/01): categorías y productos de ejemplo.
insert into public.categorias_productos (nombre, orden)
values ('Pochoclos', 1), ('Bebidas', 2), ('Golosinas', 3), ('Promociones', 4);

insert into public.productos (categoria_id, nombre, descripcion, precio)
select c.id, v.nombre, v.descripcion, v.precio
from (values
  ('Pochoclos', 'Pochoclos chicos',      'Balde de 45 gramos, dulces o salados.',        3500),
  ('Pochoclos', 'Pochoclos medianos',    'Balde de 70 gramos, dulces o salados.',        4500),
  ('Pochoclos', 'Pochoclos grandes',     'Balde de 120 gramos para compartir.',          5800),
  ('Bebidas',   'Gaseosa chica',         'Vaso de 500 ml con hielo.',                    2800),
  ('Bebidas',   'Gaseosa grande',        'Vaso de 750 ml con hielo.',                    3600),
  ('Bebidas',   'Agua mineral',          'Botella de 500 ml.',                           2200),
  ('Golosinas', 'Chocolate',             'Tableta de 100 gramos.',                       2500),
  ('Golosinas', 'Nachos con queso',      'Porción de nachos con salsa de queso.',        5200),
  ('Promociones', 'Promo individual',    'Pochoclos medianos y gaseosa grande.',         7200),
  ('Promociones', 'Promo para dos',      'Pochoclos grandes y dos gaseosas grandes.',   10500)
) as v (categoria, nombre, descripcion, precio)
join public.categorias_productos c on c.nombre = v.categoria;

-- Programa de puntos (email 03/03): productos que se canjean con puntos.
-- La entrada gratis (500 puntos) ya la crea schema.sql.
insert into public.recompensas (tipo, producto_id, puntos)
select 'producto', p.id, v.puntos
from (values ('Pochoclos grandes', 150), ('Gaseosa grande', 100), ('Chocolate', 80)) as v (nombre, puntos)
join public.productos p on p.nombre = v.nombre;

-- Combos (email 03/03): entrada + pochoclos + bebida a un precio fijo.
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
