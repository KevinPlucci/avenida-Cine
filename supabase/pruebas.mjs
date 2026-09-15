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

// ---------- Candy bar (email 30/01) ----------
const [candy] = await q(`select (select count(*) from categorias_productos)::int categorias,
  (select count(*) from productos)::int productos`);
ok(candy.categorias === 4 && candy.productos === 10, 'candy bar de ejemplo cargado');

const [pochoclos] = await q(`select id, precio::float precio from productos where nombre = 'Pochoclos medianos'`);
const [gaseosa] = await q(`select id, precio::float precio from productos where nombre = 'Gaseosa grande'`);
const carrito = JSON.stringify([
  { producto_id: pochoclos.id, cantidad: 2 },
  { producto_id: gaseosa.id, cantidad: 1 },
]);
const costoCandy = pochoclos.precio * 2 + gaseosa.precio;

await comoUsuario(null);
const [conCandy] = await q(`select comprar_entradas($1, array['D1'], 'ana@test.com', 'Ana', $2::jsonb) codigo`, [funcion.id, carrito]);
const [compraCandy] = await q(
  `select subtotal::float, subtotal_productos::float, total::float from compras where codigo = $1`, [conCandy.codigo]);
ok(
  compraCandy.subtotal_productos === costoCandy && compraCandy.total === funcion.precio + costoCandy,
  'la compra suma los productos del candy bar',
);
ok(
  (await q(`select count(*)::int n from compra_productos cp join compras c on c.id = cp.compra_id where c.codigo = $1`, [conCandy.codigo]))[0].n === 2,
  'se guarda el detalle de los productos comprados',
);
ok(
  (await q(`select obtener_compra($1) j`, [conCandy.codigo]))[0].j.productos.length === 2,
  'obtener_compra devuelve los productos',
);

await esperarError(
  `select comprar_entradas($1, array['D2'], 'ana@test.com', 'Ana', $2::jsonb)`,
  [funcion.id, JSON.stringify([{ producto_id: pochoclos.id, cantidad: 1 }, { producto_id: pochoclos.id, cantidad: 2 }])],
  'productos repetidos', 'productos repetidos en la misma compra',
);
await esperarError(
  `select comprar_entradas($1, array['D2'], 'ana@test.com', 'Ana', $2::jsonb)`,
  [funcion.id, JSON.stringify([{ producto_id: pochoclos.id, cantidad: 0 }])],
  'Cantidad inválida', 'cantidad inválida de productos',
);
await q(`update productos set disponible = false where id = $1`, [gaseosa.id]);
await esperarError(
  `select comprar_entradas($1, array['D2'], 'ana@test.com', 'Ana', $2::jsonb)`,
  [funcion.id, JSON.stringify([{ producto_id: gaseosa.id, cantidad: 1 }])],
  'no está disponible', 'producto no disponible',
);
await q(`update productos set disponible = true where id = $1`, [gaseosa.id]);

// ---------- Cupones configurables y descuento por edad (email 30/01) ----------
await q(`update cupones_regla set porcentaje = 30 where tipo = 'primera_compra'`);
const idNuevo = '55555555-5555-5555-5555-555555555555';
await q(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'nuevo@test.com', $2)`, [
  idNuevo,
  { nombre: 'Nuevo', apellido: 'Cliente', fecha_nacimiento: '1995-03-10', tipo_sangre: 'B+', color_ojos: 'Verde', dias_vacaciones: 10 },
]);
ok((await q(`select porcentaje from cupones where usuario_id = $1`, [idNuevo]))[0].porcentaje === 30,
  'el cupón de bienvenida usa el porcentaje configurado');
await q(`update cupones_regla set porcentaje = 20 where tipo = 'primera_compra'`);

const idMayor = '44444444-4444-4444-4444-444444444444';
await q(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'elsa@test.com', $2)`, [
  idMayor,
  { nombre: 'Elsa', apellido: 'Gómez', fecha_nacimiento: '1960-04-02', tipo_sangre: '0+', color_ojos: 'Azul', dias_vacaciones: 21 },
]);
await comoUsuario(idMayor);
const [beneficios] = await q(`select mis_beneficios() j`);
ok(beneficios.j.mayores?.porcentaje === 15 && beneficios.j.mayores?.edad_minima === 50,
  'mis_beneficios informa el descuento por edad');

const [mayorPrimera] = await q(`select comprar_entradas($1, array['E1']) codigo`, [funcion.id]);
ok(
  (await q(`select descuento_motivo from compras where codigo = $1`, [mayorPrimera.codigo]))[0].descuento_motivo === 'primera_compra',
  'con los dos descuentos disponibles se aplica el mayor',
);
const [mayorSegunda] = await q(`select comprar_entradas($1, array['E2']) codigo`, [funcion.id]);
const [compraMayor] = await q(`select descuento::float, descuento_motivo from compras where codigo = $1`, [mayorSegunda.codigo]);
ok(
  compraMayor.descuento_motivo === 'mayores' && compraMayor.descuento === funcion.precio * 0.15,
  'el descuento por edad se aplica en todas las compras',
);
await comoUsuario(uid);
ok((await q(`select mis_beneficios() j`))[0].j.mayores === null, 'un usuario menor de 50 no tiene ese descuento');

// ---------- Roles y validación del QR (email 06/02) ----------
const idAdmin = '33333333-3333-3333-3333-333333333333';
const idEmpleado = '22222222-2222-2222-2222-222222222222';
for (const [id, email, nombre] of [[idAdmin, 'admin@test.com', 'Ada'], [idEmpleado, 'empleado@test.com', 'Beto']]) {
  await q(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id, email,
    { nombre, apellido: 'López', fecha_nacimiento: '1992-07-15', tipo_sangre: 'A-', color_ojos: 'Marrón', dias_vacaciones: 12 },
  ]);
}
await q(`update perfiles set rol = 'admin' where id = $1`, [idAdmin]);

await comoUsuario(uid);
await esperarError(`select cambiar_rol($1, 'empleado')`, [idEmpleado], 'Solo un administrador', 'un cliente no cambia roles');
await comoUsuario(idAdmin);
await q(`select cambiar_rol($1, 'empleado')`, [idEmpleado]);
ok((await q(`select rol from perfiles where id = $1`, [idEmpleado]))[0].rol === 'empleado', 'el admin asigna el rol de empleado');
await esperarError(`select cambiar_rol($1, 'cliente')`, [idAdmin], 'a vos mismo', 'el admin no se quita su propio rol');
await esperarError(`select cambiar_rol($1, 'jefe')`, [idEmpleado], 'Rol inválido', 'rol inexistente');

await comoUsuario(uid);
await esperarError(`select validar_entrada($1)`, [conCandy.codigo], 'Solo el personal', 'un cliente no valida entradas');

await comoUsuario(idEmpleado);
const [validada] = await q(`select validar_entrada($1) j`, [conCandy.codigo]);
ok(validada.j.validada_en !== null, 'el empleado valida la entrada');
await esperarError(`select validar_entrada($1)`, [conCandy.codigo], 'ya fue validada', 'el QR no sirve dos veces');
await esperarError(`select validar_entrada($1)`, ['00000000-0000-0000-0000-000000000000'], 'No existe ninguna compra', 'código inexistente');

const [entregada] = await q(`select entregar_productos($1) j`, [conCandy.codigo]);
ok(entregada.j.entregado_en !== null, 'el empleado entrega los productos con el mismo QR');
await esperarError(`select entregar_productos($1)`, [conCandy.codigo], 'ya se entregaron', 'los productos se entregan una sola vez');
await esperarError(`select entregar_productos($1)`, [anonima.codigo], 'no incluye productos', 'compra sin productos del candy bar');
await comoUsuario(null);

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

// ---------- Edición de funciones ----------
const [editable] = await q(
  `insert into funciones (pelicula_id, sala_id, inicio, formato, idioma, precio) values (3, $1, ${base} + interval '1 day', '2D', 'castellano', 100) returning id`,
  [sala.id],
);
await q(`update funciones set inicio = inicio + interval '1 hour', formato = '3D', precio = 150 where id = $1`, [editable.id]);
ok(true, 'se edita una función sin entradas vendidas');
await esperarError(`update funciones set inicio = now() - interval '1 hour' where id = $1`, [editable.id], 'pasado', 'no se mueve una función al pasado');
const [cerrada] = await q(`insert into salas (nombre, activa) values ('Sala cerrada', false) returning id`);
await esperarError(`update funciones set sala_id = $2 where id = $1`, [editable.id, cerrada.id], 'no está activa', 'no se mueve una función a una sala inactiva');
await esperarError(`update funciones set inicio = inicio + interval '1 hour' where id = $1`, [funcion.id], 'entradas vendidas', 'no se cambia el horario de una función con ventas');
await esperarError(
  `update funciones set idioma = case when idioma = 'castellano' then 'subtitulada' else 'castellano' end where id = $1`,
  [funcion.id], 'entradas vendidas', 'no se cambia el idioma de una función con ventas',
);
await q(`update funciones set precio = 7777 where id = $1`, [funcion.id]);
ok((await q(`select precio::float p from funciones where id = $1`, [funcion.id]))[0].p === 7777, 'sí se cambia el precio de una función con ventas');
ok((await q(`select total::float t from compras where codigo = $1`, [anonima.codigo]))[0].t === funcion.precio * 2, 'cambiar el precio no modifica las compras hechas');

// ---------- Programación de funciones (email 06/02) ----------
await comoUsuario(idAdmin);
const horario = (dias) => `date_trunc('day', now()) + interval '${dias} days 9 hours'`;
const [programadas] = await q(`select programar_funciones(3, null,
  array[${horario(5)}, ${horario(6)}, ${horario(7)}], '2D', 'castellano', 5000) r`);
ok(
  programadas.r.length === 3 && programadas.r.every((f) => f.creada),
  'programa la misma película varios días a la misma hora con sala automática',
);

const [salaAsignada] = await q(`select id from salas where nombre = $1`, [programadas.r[0].sala]);
const libres = await q(`select * from salas_libres(${horario(5)}, 3)`);
ok(!libres.some((s) => s.id === salaAsignada.id), 'salas_libres deja afuera la sala que quedó ocupada');

const [choque] = await q(`select programar_funciones(3, $1, array[${horario(5)}], '2D', 'castellano', 5000) r`, [salaAsignada.id]);
ok(!choque.r[0].creada && choque.r[0].motivo.includes('otra función'), 'informa el horario que no se pudo programar');

await comoUsuario(uid);
await esperarError(`select programar_funciones(3, null, array[${horario(8)}], '2D', 'castellano', 5000)`, [],
  'Solo un administrador', 'un cliente no programa funciones');
await comoUsuario(null);

await db.exec(leer('./migraciones/002_editar_funciones.sql'));
ok(true, 'la migración 002 se aplica sobre una base existente');
await esperarError(`update funciones set inicio = inicio + interval '2 hours' where id = $1`, [funcion.id], 'entradas vendidas', 'después de la migración se mantiene la regla');

await db.exec(leer('./migraciones/003_candybar_roles_qr.sql'));
ok(true, 'la migración 003 se aplica sobre una base existente');
await comoUsuario(idEmpleado);
await esperarError(`select validar_entrada($1)`, [conCandy.codigo], 'ya fue validada', 'después de la migración 003 el QR usado sigue rechazado');
await comoUsuario(null);
ok(
  (await q(`select count(*)::int n from compra_productos`))[0].n > 0,
  'la migración 003 conserva los productos ya comprados',
);

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
process.exit(fallos ? 1 : 0);
