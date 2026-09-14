// Pruebas de la base de datos: ejecuta schema.sql y seed.sql en un PostgreSQL en memoria (PGlite)
// y verifica las reglas de negocio. Uso: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import fs from 'node:fs';

const leer = (archivo) => fs.readFileSync(new URL(archivo, import.meta.url), 'utf8');
const db = new PGlite({ extensions: { btree_gist } });

// Lo mínimo de Supabase que usa el esquema: roles, auth.users, auth.uid() y storage.
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
`);

let fallos = 0;
const ok = (condicion, mensaje) => {
  console.log(condicion ? 'OK   ' : 'FALLO', mensaje);
  if (!condicion) fallos++;
};
const q = async (sql, params) => (await db.query(sql, params)).rows;
const comoUsuario = (id) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id ?? '']);
async function esperarError(sql, params, texto, mensaje) {
  try {
    await db.query(sql, params);
    ok(false, `${mensaje} (no dio error)`);
  } catch (e) {
    ok(e.message.includes(texto), `${mensaje} -> ${e.message}`);
  }
}

await db.exec(leer('./schema.sql'));
ok(true, 'schema.sql ejecutado');
await db.exec(leer('./seed.sql'));
ok(true, 'seed.sql ejecutado');

// ---------- Seed ----------
const [conteo] = await q(`select (select count(*) from salas)::int salas, (select count(*) from peliculas)::int peliculas,
  (select count(*) from pelicula_generos)::int generos, (select count(*) from funciones)::int funciones`);
ok(conteo.salas === 4 && conteo.peliculas === 6 && conteo.generos === 15 && conteo.funciones > 0, 'datos de ejemplo cargados');
const [solapadas] = await q(`select count(*)::int n from funciones a join funciones b
  on a.sala_id = b.sala_id and a.id < b.id and tstzrange(a.inicio, a.bloqueada_hasta) && tstzrange(b.inicio, b.bloqueada_hasta)`);
ok(solapadas.n === 0, 'las funciones de ejemplo no se superponen');

// ---------- Registro ----------
const uid = '11111111-1111-1111-1111-111111111111';
await q(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'juan@test.com', $2)`, [
  uid,
  { nombre: 'Juan', apellido: 'Pérez', fecha_nacimiento: '1990-05-20', tipo_sangre: 'A+', color_ojos: 'Marrón', dias_vacaciones: 14 },
]);
const [perfil] = await q(`select * from perfiles where id = $1`, [uid]);
ok(perfil?.nombre === 'Juan' && perfil.rol === 'cliente', 'al registrarse se crea el perfil');
const [cupon] = await q(`select * from cupones where usuario_id = $1`, [uid]);
ok(cupon?.porcentaje === 20 && !cupon.usado, 'al registrarse se crea el cupón de 20%');

// ---------- Compras ----------
const [funcion] = await q(`select id, precio::float precio from funciones where inicio > now() + interval '1 hour' order by inicio limit 1`);

await comoUsuario(null);
const [anonima] = await q(`select comprar_entradas($1, array['A1','A2'], 'Ana@Test.com', 'Ana') codigo`, [funcion.id]);
const [compraAnonima] = await q(`select total::float, descuento::float, usuario_id from compras where codigo = $1`, [anonima.codigo]);
ok(compraAnonima.total === funcion.precio * 2 && compraAnonima.descuento === 0 && compraAnonima.usuario_id === null, 'compra anónima sin descuento');
await esperarError(`select comprar_entradas($1, array['A2','A3'], 'x@test.com', 'X')`, [funcion.id], 'ya fue vendida', 'no se vende dos veces la misma butaca');
ok((await q(`select count(*)::int n from compras`))[0].n === 1, 'una compra rechazada no deja registros');
await esperarError(`select comprar_entradas($1, array['A5'], 'mal-email', 'X')`, [funcion.id], 'email válido', 'email inválido');
await esperarError(`select comprar_entradas($1, array['K29'], 'x@test.com', 'X')`, [funcion.id], 'Butaca inválida', 'butaca inexistente');
await esperarError(`select comprar_entradas($1, array['B1','B1'], 'x@test.com', 'X')`, [funcion.id], 'repetidas', 'butacas repetidas');

await comoUsuario(uid);
const [primera] = await q(`select comprar_entradas($1, array['C5','C6']) codigo`, [funcion.id]);
const [compraPrimera] = await q(`select total::float, descuento::float from compras where codigo = $1`, [primera.codigo]);
ok(compraPrimera.descuento === funcion.precio * 2 * 0.2 && compraPrimera.total === funcion.precio * 2 * 0.8, 'la primera compra tiene 20% de descuento');
const [segunda] = await q(`select comprar_entradas($1, array['C7']) codigo`, [funcion.id]);
ok((await q(`select descuento::float d from compras where codigo = $1`, [segunda.codigo]))[0].d === 0, 'la segunda compra no tiene descuento');

const [detalle] = await q(`select obtener_compra($1) j`, [primera.codigo]);
ok(JSON.stringify(detalle.j.butacas) === '["C5","C6"]', 'obtener_compra devuelve el detalle');
ok((await q(`select * from mis_compras()`)).length === 2, 'mis_compras devuelve las compras del usuario');
ok((await q(`select * from ranking_ventas()`))[0]?.entradas_vendidas === 5, 'ranking de ventas');

// ---------- Reseñas ----------
const [resenia] = await q(`insert into resenias (pelicula_id, estrellas, comentario) values (1, 4, 'Muy buena') returning autor`);
ok(resenia.autor === 'Juan P.', 'la reseña toma el autor del perfil');
const [puntaje] = await q(`select promedio::float from puntajes_peliculas where pelicula_id = 1`);
ok(puntaje.promedio === 4, 'puntaje promedio');
await esperarError(`insert into resenias (pelicula_id, estrellas, comentario) values (1, 5, 'Otra')`, [], 'duplicate key', 'una reseña por usuario y película');

// ---------- Funciones: 30 minutos entre funciones ----------
await comoUsuario(null);
const [sala] = await q(`insert into salas (nombre) values ('Sala de prueba') returning id`);
const base = `date_trunc('day', now()) + interval '2 days 10 hours'`;
const insertar = (peliculaId, desfase) =>
  `insert into funciones (pelicula_id, sala_id, inicio, formato, idioma, precio) values (${peliculaId}, $1, ${base} + interval '${desfase} minutes', '2D', 'castellano', 100)`;
await q(insertar(3, 0), [sala.id]); // película de 95 minutos
await esperarError(insertar(1, 124), [sala.id], 'funciones_sin_superposicion', 'función 29 minutos después del final');
await q(insertar(1, 125), [sala.id]);
ok(true, 'función 30 minutos después del final');
await esperarError(
  `insert into funciones (pelicula_id, sala_id, inicio, formato, idioma, precio) values (1, $1, now() - interval '1 hour', '2D', 'castellano', 100)`,
  [sala.id], 'pasado', 'función en el pasado',
);
await esperarError(`update peliculas set duracion_min = 300 where id = 3`, [], 'funciones_sin_superposicion', 'alargar una película que genera superposición');
await esperarError(`delete from peliculas where id = 1`, [], 'foreign key', 'no se borra una película con funciones');

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
process.exit(fallos ? 1 : 0);
