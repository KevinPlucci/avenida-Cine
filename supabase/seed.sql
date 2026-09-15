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

-- Candy bar (email 30/01): categorías y productos de ejemplo.
insert into public.categorias_productos (nombre, orden)
values ('Pochoclos', 1), ('Bebidas', 2), ('Golosinas', 3), ('Combos', 4);

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
  ('Combos',    'Combo para uno',        'Pochoclos medianos y gaseosa grande.',         7200),
  ('Combos',    'Combo para dos',        'Pochoclos grandes y dos gaseosas grandes.',   10500)
) as v (categoria, nombre, descripcion, precio)
join public.categorias_productos c on c.nombre = v.categoria;
