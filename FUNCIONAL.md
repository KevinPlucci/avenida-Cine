# Cine Avenida · Documento funcional

Qué hace la aplicación, para quién y con qué reglas.
La parte técnica (instalación, arquitectura y decisiones) está en [TECNICO.md](TECNICO.md).

## Índice

1. [Qué es Cine Avenida](#1-qué-es-cine-avenida)
2. [Roles](#2-roles)
3. [Pantallas](#3-pantallas)
4. [Flujo de compra](#4-flujo-de-compra)
5. [Reglas de negocio](#5-reglas-de-negocio)
6. [Requerimientos por email](#6-requerimientos-por-email)
7. [Criterios adoptados](#7-criterios-adoptados)

---

## 1. Qué es Cine Avenida

Una web para que el público de un cine vea la cartelera y saque sus entradas sin pasar por la boletería,
y para que el cine administre su programación desde el mismo lugar.

El cliente elige película, función y butacas, paga (pago simulado) y recibe una entrada con código QR
que puede descargar en PDF. Puede hacerlo con una cuenta o sin registrarse.

Del otro lado, el administrador carga películas, arma los horarios, administra las salas y los géneros,
y decide qué se muestra en la cartelera.

## 2. Roles

| Rol | Quién es | Qué puede hacer |
|---|---|---|
| Visitante | Entra sin cuenta | Ver la cartelera y el detalle de las películas, comprar entradas dejando nombre y email, ver la entrada con el código de compra |
| Cliente registrado | Se registró con sus datos | Todo lo anterior, más su perfil, su cupón de primera compra, el historial de compras y dejar reseñas |
| Empleado | Personal de puerta y candy bar | Validar los códigos QR del ingreso y entregar los productos del candy bar |
| Administrador | Personal del cine | Películas, funciones, salas, géneros, candy bar, descuentos y roles de los usuarios. También puede validar QR |

## 3. Pantallas

| Pantalla | Qué ofrece | Quién entra |
|---|---|---|
| Cartelera | Las 3 películas más vendidas arriba y el listado completo, con buscador y filtro por género | Todos |
| Detalle de película | Sinopsis, duración, puntaje promedio, reseñas y funciones de los próximos días | Todos |
| Compra de entradas | Mapa de butacas, productos del candy bar, resumen con el descuento aplicado y datos de pago | Todos |
| Entrada | Código QR para ingresar y retirar el candy bar, y descarga del PDF | Quien tenga el código de compra |
| Validar entradas | Lectura del QR con la cámara o a mano, con el estado del ingreso y del candy bar | Empleados y administradores |
| Ingreso y registro | Cuenta propia; después de ingresar vuelve a la pantalla donde estaba | Solo sin sesión iniciada |
| Mi perfil | Datos personales, cupón disponible y compras realizadas | Clientes registrados |
| Administración | Películas, funciones, salas, géneros, candy bar, descuentos y usuarios | Administradores |

## 4. Flujo de compra

1. El cliente elige una función desde el detalle de la película.
2. Ve el mapa de la sala con las butacas ya vendidas y elige las suyas (hasta 10 por compra).
3. Si quiere, suma productos del candy bar: pochoclos, bebidas, golosinas o combos.
4. Si tiene la sesión iniciada y le corresponde un descuento, aparece en el resumen.
   Si compra sin cuenta, deja nombre y email.
5. Paga con tarjeta (simulado). El total lo calcula el sistema con los precios de la base, no el navegador.
6. Recibe la entrada con el código QR y puede descargar el PDF.

En el cine, un empleado escanea ese QR en la puerta y, si la compra tenía productos, otra vez en el candy bar.
Cada código sirve una sola vez para cada cosa.

## 5. Reglas de negocio

- Entre dos funciones de la misma sala tienen que pasar al menos **30 minutos** desde que termina una hasta que empieza la otra.
- Una butaca no se puede vender dos veces para la misma función.
- Una función con entradas vendidas no cambia de horario, sala, película, formato ni idioma. Sí puede cambiar el precio, que rige para las ventas nuevas. Tampoco se puede eliminar.
- No se programan funciones en el pasado ni en salas desactivadas.
- El cupón de primera compra se aplica una sola vez y queda marcado como usado en la misma operación de compra.
- El descuento por edad se aplica en todas las compras del usuario que supera la edad configurada.
- Los dos descuentos no se acumulan: se aplica el más alto, y siempre sobre las entradas, no sobre el candy bar.
- El porcentaje de los dos descuentos y la edad mínima los configura el administrador.
- Un producto que se da de baja deja de venderse, pero las compras ya hechas conservan su nombre y su precio.
- El código QR sirve una sola vez para ingresar y una sola vez para retirar los productos.
- Solo el personal del cine puede validar entradas y entregar productos.
- Una entrada no se puede validar después de que la función terminó.
- El precio y el descuento se resuelven en el servidor: no se pueden alterar desde el navegador.
- La entrada de una compra sin cuenta se recupera con el código de compra, que no es adivinable.

## 6. Requerimientos por email

Referencias: `[x]` implementado · `[ ]` pendiente.

### Consigna

- [x] Crear un documento que resuma todos los requerimientos (este archivo)
- [ ] Crear la aplicación completa usando los temas vistos en clase (en curso)
- [ ] Defender oralmente las decisiones el día de la entrega
- [x] Aplicación desplegada con URL funcional (<https://avenida-cine.vercel.app>)
- [x] Código en GitHub
- [x] Documentación con arquitectura y decisiones técnicas ([TECNICO.md](TECNICO.md))

### A considerar

- [x] Estilo visual único y producido
- [ ] Aplicar los cambios que indiquen los profesores
- [ ] La aprobación y/o promoción depende de la defensa oral
- [x] Uso correcto de Angular, buenas prácticas y técnicas vistas en clase (signals, routing, guards, formularios reactivos, pipes, directivas, HttpClient e interceptores, animaciones)
- [x] Integración con Supabase (Auth, base de datos, RLS, RPC y Storage)
- [x] Integración de PWA
- [x] Lógica de negocio

### Email 1 · 01/01/2020 · Sistema base

- [x] Página propia para sacar entradas
- [x] Un edificio con varias salas (alta, baja y activación de salas)
- [x] Compra de entradas que genera un PDF con los datos de la entrada y un QR para ingresar
- [x] Salas de 20 filas identificadas con letras y 3 bloques de 4, 20 y 4 butacas
- [x] Elegir qué películas aparecen al entrar a la página (marca "en cartelera")
- [x] Definir los horarios de cada película (funciones: alta, edición y baja)
- [x] Formato de la función: 2D, 3D, 4D o 5D
- [x] Idioma de la función: castellano o subtitulada
- [x] Película con duración, imagen, nombre y sinopsis
- [x] No puede empezar una función antes de que pasen 30 minutos del final de la anterior en esa sala
- [x] Registro con mail, nombre, apellido, fecha de nacimiento, tipo de sangre, color de ojos y días de vacaciones por año
- [x] Cupón de 20% de descuento en la primera compra por registrarse
- [x] Compra sin registrarse

### Email 2 · 16/01/2020 · Reseñas, más vendidas y buscador

- [x] Reseñas: calificación con estrellas y comentario corto
- [x] Las reseñas se ven antes de sacar las entradas (detalle de la película)
- [x] Puntaje promedio de cada película
- [x] La página principal muestra primero las 3 películas más vendidas
- [x] Buscador en el listado de películas

### Email 3 · 16/01/2020 · Filtro por género

- [x] El buscador filtra por género
- [x] Cada película puede tener varios géneros

### Email 4 · 30/01/2020 · Cupones y candy bar

- [x] Porcentaje del cupón de primera compra configurable por el admin
- [x] Cupones que solo aplican a usuarios de más de 50 años (la edad también se configura)
- [x] Productos del candy bar (pochoclos, bebidas, etc.) con categorías
- [x] Comprar productos junto con la entrada
- [x] Retirar los productos con el mismo QR
- Mapa del cine con la sala de la entrada: **sin aprobación del cliente, no se implementa**

### Email 5 · 06/02/2020 · Roles y validación de QR

- [x] Administrador que controla salas, funciones, distribución de butacas, productos, etc.
- [x] Usuarios empleados que escanean los QR (cine y candy bar)
- [x] Ingreso manual del código si falla el lector
- [x] El QR deja de funcionar una vez validada la entrada o entregada la comida
- [x] Asignación automática de sala
- [x] Nunca dos funciones en la misma sala al mismo tiempo (garantizado por la base desde el email 1)
- [x] Programar una película varios días a la misma hora (ej.: lunes, martes y viernes a las 18 h)

### Email 6 · 12/02/2020 · Edad, accesibilidad y tiempo real

- [ ] Restricción de edad por película: ATP, +13 o +18
- [ ] Los menores de la edad indicada no pueden comprar
- [ ] Las entradas de esas películas aclaran que debe ir un adulto
- [ ] Filas J y K reemplazadas por butacas para personas con discapacidad (2, 10 y 2 por bloque)
- [ ] Butacas en tiempo real: ver las que ocupa otra compra en ese momento
- [ ] Butacas accesibles resaltadas visualmente

### Email 7 · 28/02/2020 · Usabilidad y reporte

- [ ] Interfaces fáciles de navegar para clientes y empleados
- [x] Ingreso de fechas y horas sin calendarios lentos (aplicado en registro y alta de funciones)
- [ ] Evitar el scroll excesivo
- [ ] Reporte de facturación por día y cantidad de entradas vendidas

### Email 8 · 03/03/2020 · Fidelización y combos

- [ ] 1 punto por cada peso gastado (usuarios registrados)
- [ ] Canje de puntos por entradas o productos del candy bar
- [ ] El admin configura cuántos puntos cuesta cada recompensa
- [ ] El perfil muestra los puntos acumulados y el historial de canjes
- [ ] Los puntos no se pueden transferir
- [ ] Combos (entrada + pochoclos + bebida) a precio fijo configurable
- [ ] Combos destacados en la página de compra

### Email 9 · 08/03/2020 · Próximamente, preventa y Mis películas

- [ ] Sección "Próximamente" con los estrenos de las próximas semanas
- [ ] Alerta para recibir una notificación cuando se habilita la venta
- [ ] Preventa desde 7 días antes del estreno con precio especial, configurable por película
- [ ] "Mis películas": historial visual con póster, fecha y calificación propia

### Email 10 · 10/03/2020 · Cancelaciones, VIP, reportes y log

- [ ] Cancelar una compra hasta 2 horas antes de la función
- [ ] Devolución como crédito en la cuenta, visible en el perfil y combinable con otros medios de pago
- [ ] Butacas VIP en las filas R, S y T con precio más alto
- [ ] Butacas VIP marcadas en el mapa y avisadas antes de pagar
- [ ] Exportar el reporte de facturación a PDF y Excel
- [ ] Gráfico de películas más vistas por semana y por mes
- [ ] Producto del candy bar más vendido
- [ ] Log de actividad: quién creó cada función, quién modificó un precio, quién validó un QR, con fecha y hora

---

## 7. Criterios adoptados

Puntos que los emails no definen y cómo se resolvieron:

| Tema | Criterio |
|---|---|
| Quién puede dejar reseñas | Solo usuarios registrados, una por película (se puede editar o borrar). No se exige haber visto la película. |
| Filtro con varios géneros | Se muestran las películas que tienen **todos** los géneros elegidos. |
| Las 3 más vendidas | Por cantidad de entradas vendidas de películas en cartelera. Si ninguna tiene ventas la sección no se muestra. |
| Cupón de primera compra | Se aplica solo en la primera compra del usuario registrado. No aplica a compras anónimas. |
| Precio de la entrada | Se define en cada función (los emails no indican cómo se calcula). |
| Editar una función | Sin entradas vendidas se puede cambiar todo. Con entradas vendidas solo el precio, que aplica a las ventas nuevas. Una función con ventas no se puede eliminar. |
| Butacas por compra | Máximo 10. |
| Datos en compras anónimas | Nombre y email. La entrada se consulta con el código de la compra. |
| Pago | Simulado. |
| Descuento por edad | Es un beneficio permanente, no un cupón de un solo uso: se aplica en todas las compras del usuario mientras la regla esté activa. |
| Descuentos juntos | No se acumulan. Si al usuario le corresponden los dos, se usa el más alto. |
| Alcance del descuento | Solo sobre las entradas. El candy bar se cobra siempre a precio de lista. |
| Cambiar el porcentaje del cupón | Afecta a los cupones nuevos. Los ya entregados mantienen el porcentaje con el que se emitieron. |
| Productos por compra | Hasta 20 unidades de cada producto. Son opcionales: se puede comprar solo la entrada. |
| Validar el QR | El empleado ve primero los datos de la entrada y después confirma, así no se quema un código por error. Se puede validar hasta que la función termina. |
| Lector de QR | Se usa el lector del navegador (sin librerías externas). Donde no está disponible queda el ingreso manual del código, que el email pide igual. |
| Asignación automática de sala | Toma la primera sala activa que esté libre en ese horario, en orden alfabético. |
| Programar varios días | Cada día se intenta por separado: los que se pueden crear se crean y la pantalla informa el motivo de los que no. |
| Distribución de butacas | Es la misma en todas las salas (20 filas, bloques de 4, 20 y 4). El panel la muestra pero no se edita: la fijan los emails. |

Dudas ya detectadas para los próximos emails:

- Email 6: las filas J y K se reemplazan por **una** fila accesible o las dos quedan como accesibles.
- Email 6: cómo validar la restricción de edad por película en compras anónimas, que no tienen fecha de nacimiento.
  Para el cupón por edad del email 4 ya se resolvió: solo aplica a usuarios registrados.
- Email 10: cómo dar crédito por cancelación en una compra anónima.
