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
8. [Pruebas de aceptación](#8-pruebas-de-aceptación)

---

## 1. Qué es Cine Avenida

Una web para que el público de un cine vea la cartelera y saque sus entradas sin pasar por la boletería,
y para que el cine administre su programación desde el mismo lugar.

El cliente elige película, función y butacas, paga (pago simulado) y recibe una entrada con código QR
que puede descargar en PDF. Puede hacerlo con una cuenta o sin registrarse. Con cuenta, además, suma
puntos en cada compra y los canjea por entradas o productos del candy bar. En la cartelera también ve los próximos
estrenos, que pueden tener preventa a precio especial; con cuenta puede pedir que le avisen cuando salen a la venta,
tiene el historial de las películas que vio y puede cancelar una compra hasta 2 horas antes de la función: el total
vuelve como crédito para la próxima compra. Las últimas filas de cada sala son VIP, con un recargo.

Del otro lado, el administrador carga películas con su estreno y su preventa, arma los horarios, administra las salas y los géneros,
decide qué se muestra en la cartelera, arma el candy bar y los combos, configura los descuentos y los puntos,
asigna los roles del personal, consulta las ventas (y las exporta a PDF o Excel), ve qué películas y productos
se venden más y revisa el registro de actividad. Los empleados validan los QR en la puerta y en el candy bar.

## 2. Roles

| Rol | Quién es | Qué puede hacer |
|---|---|---|
| Visitante | Entra sin cuenta | Ver la cartelera, los próximos estrenos y el detalle de las películas, comprar entradas dejando nombre y email, ver la entrada con el código de compra |
| Cliente registrado | Se registró con sus datos | Todo lo anterior, más su perfil, su cupón de primera compra, sus puntos y canjes, el historial de compras, las alertas de estreno, Mis películas, dejar reseñas y cancelar compras a cambio de crédito |
| Empleado | Personal de puerta y candy bar | Validar los códigos QR del ingreso y entregar los productos del candy bar |
| Administrador | Personal del cine | Películas (con su estreno y su preventa), funciones, salas y recargo VIP, géneros, candy bar, combos, descuentos, puntos, roles de los usuarios, reporte de ventas exportable, gráficos y registro de actividad. También puede validar QR |

## 3. Pantallas

| Pantalla | Qué ofrece | Quién entra |
|---|---|---|
| Cartelera | Las 3 películas más vendidas arriba, el listado completo con buscador y filtro por género, y "Próximamente" con los estrenos, su preventa y la alerta | Todos |
| Detalle de película | Sinopsis, duración, restricción de edad, estreno y preventa, puntaje promedio, reseñas y funciones de los próximos días (sin enlace hasta que abre la venta) | Todos |
| Compra de entradas | Mapa de butacas en tiempo real con la fila accesible y las VIP, combos destacados, productos del candy bar, canje de puntos, crédito de la cuenta, resumen con el descuento y el recargo VIP, y datos de pago | Todos |
| Entrada | Código QR para ingresar y retirar el candy bar, y descarga del PDF. Si la compra se canceló, lo avisa y no muestra el QR | Quien tenga el código de compra |
| Validar entradas | Lectura del QR con la cámara o a mano, con el estado del ingreso y del candy bar. El empleado entra directo acá al ingresar | Empleados y administradores |
| Ingreso y registro | Cuenta propia; después de ingresar vuelve a la pantalla donde estaba | Solo sin sesión iniciada |
| Mis películas | Historial visual de lo que vio: póster, fechas de las funciones y su calificación | Clientes registrados |
| Mi perfil | Datos personales, cupón disponible, crédito con sus movimientos, puntos acumulados con lo que se puede canjear, historial de canjes y compras realizadas, con la opción de cancelarlas | Clientes registrados |
| Administración | Películas (con estreno y preventa), funciones, salas y recargo VIP, géneros, candy bar, combos, descuentos, puntos de cada recompensa, usuarios, reporte de ventas por día (exportable a PDF y Excel), gráficos de películas más vistas y productos más vendidos, y registro de actividad | Administradores |

## 4. Flujo de compra

1. El cliente elige una función desde el detalle de la película. Si la película todavía no se estrenó, puede comprar
   recién cuando abre la venta: el día del estreno o, si tiene preventa, 7 días antes y a su precio especial.
2. Ve el mapa de la sala con las butacas ya vendidas y elige las suyas (hasta 10 por compra). Las de las filas R, S y T
   son VIP y tienen un recargo: el mapa las marca en dorado y el resumen lo avisa antes de pagar.
   Si otra persona compra una butaca mientras tanto, el mapa la marca como ocupada al instante.
   Si la película tiene restricción de edad y el cliente no llega a la edad, no puede comprar.
3. Si quiere, suma un combo (una entrada con pochoclos y bebida a precio fijo) o productos sueltos del candy bar.
4. Si tiene la sesión iniciada y le corresponde un descuento, aparece en el resumen. También puede canjear puntos
   por entradas gratis o por productos que eligió. Si compra sin cuenta, deja nombre y email.
5. Paga con tarjeta (simulado). Si tiene crédito en su cuenta, puede usarlo y paga el resto con la tarjeta; si el crédito
   alcanza, no hace falta la tarjeta. El total lo calcula el sistema con los precios de la base, no el navegador.
6. Recibe la entrada con el código QR y puede descargar el PDF. Si tiene cuenta, suma 1 punto por cada peso pagado.

En el cine, un empleado escanea ese QR en la puerta y, si la compra tenía productos, otra vez en el candy bar.
Cada código sirve una sola vez para cada cosa.

Hasta 2 horas antes de la función, el cliente puede cancelar la compra desde su perfil: las butacas quedan libres,
el código deja de servir y el total vuelve como crédito en su cuenta.

## 5. Reglas de negocio

- Entre dos funciones de la misma sala tienen que pasar al menos **30 minutos** desde que termina una hasta que empieza la otra.
- Una butaca no se puede vender dos veces para la misma función.
- Una función con entradas vendidas no cambia de horario, sala, película, formato ni idioma. Sí puede cambiar el precio, que rige para las ventas nuevas. Tampoco se puede eliminar.
- No se programan funciones en el pasado ni en salas desactivadas.
- El cupón de primera compra se aplica una sola vez y queda marcado como usado en la misma operación de compra.
- El descuento por edad se aplica en todas las compras del usuario que tiene más años que la edad configurada (con 50, desde los 51 cumplidos).
- Los dos descuentos no se acumulan: se aplica el más alto, y siempre sobre las entradas, no sobre el candy bar.
- El porcentaje de los dos descuentos y la edad los configura el administrador.
- Un producto que se da de baja deja de venderse, pero las compras ya hechas conservan su nombre y su precio.
- El código QR sirve una sola vez para ingresar y una sola vez para retirar los productos.
- Solo el personal del cine puede validar entradas y entregar productos.
- La entrada y los productos se validan desde una hora antes del inicio de la función hasta que termina.
- Las películas son ATP, +13 o +18. Quien no tiene la edad no puede comprar entradas: si está registrado se usa la fecha de nacimiento de su perfil y, si compra sin cuenta, tiene que declararla.
- Toda entrada de una película +13 o +18 aclara que debe ir un adulto (en pantalla, en el PDF y en la validación del empleado).
- Una película con fecha de estreno futura aparece en "Próximamente". Su venta abre el día del estreno o, si tiene preventa, 7 días antes; antes de esa fecha no se pueden comprar entradas.
- Durante la preventa todas las entradas de la película se cobran al precio de preventa, en cualquier función y formato. Desde el día del estreno se cobra el precio de cada función. Las fechas se cuentan con la hora de Argentina.
- Las alertas de estreno son de usuarios registrados. Cada alerta se avisa una sola vez, cuando la venta ya abrió y hay funciones para comprar.
- "Mis películas" muestra las películas de las compras del usuario cuya función ya terminó.
- Las filas R, S y T son VIP: cada butaca suma un recargo fijo que configura el administrador, también si la entrada va en un combo o se canjea con puntos. El recargo no tiene descuento.
- Un usuario registrado puede cancelar una compra hasta 2 horas antes de la función. No se devuelve dinero: el total vuelve como crédito en su cuenta, las butacas quedan libres, los puntos canjeados vuelven, se descuentan los que sumó la compra y, si usó el cupón de primera compra, el cupón vuelve a estar disponible. Si ya canjeó los puntos que le dio esa compra, no se puede cancelar.
- El crédito se usa al comprar, junto con la tarjeta: paga lo que alcance y el resto va con la tarjeta. Solo el sistema lo suma (al cancelar) y lo descuenta (al comprar): no se carga ni se transfiere.
- Una compra cancelada no se valida en la puerta ni entrega productos, y no cuenta en el reporte de facturación ni en los gráficos.
- El registro de actividad anota con fecha y hora quién creó, cambió o eliminó funciones, quién cambió un precio (de una función, un producto, un combo, la preventa o el recargo VIP) y quién validó una entrada o entregó productos. Solo lo ve el administrador y nadie lo puede modificar.
- La fila K ya no existe: su lugar lo ocupa la fila J, accesible para personas con discapacidad, con 2, 10 y 2 butacas.
- Los usuarios registrados suman 1 punto por cada peso que pagan (con el descuento ya restado). Lo canjeado con puntos no suma puntos.
- Los puntos se canjean al comprar, por entradas gratis o por productos del candy bar de esa compra, al costo que fija el administrador. Solo se puede usar el saldo disponible.
- Los puntos no se pueden transferir: solo el sistema los suma o descuenta, siempre en una compra del mismo usuario.
- Un combo trae una entrada y ciertos productos a un precio fijo. Cada combo usa una de las butacas elegidas y los descuentos no se le aplican.
- Un combo inactivo, o con algún producto sin stock, no se vende.
- El precio y el descuento se resuelven en el servidor: no se pueden alterar desde el navegador.
- La entrada de una compra sin cuenta se recupera con el código de compra, que no es adivinable.
- Las pantallas de administración y de validación solo existen para quien tiene el rol: sin sesión llevan al ingreso y, con otra cuenta, muestran la página no encontrada.

## 6. Requerimientos por email

Referencias: `[x]` implementado · `[ ]` pendiente.

### Consigna

- [x] Crear un documento que resuma todos los requerimientos (este archivo)
- [x] Crear la aplicación completa usando los temas vistos en clase
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
- [x] Salas de 20 filas identificadas con letras y 3 bloques de 4, 20 y 4 butacas (el email del 12/02 cambia las filas J y K)
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

- [x] Administrador que controla salas, funciones, distribución de butacas, productos, etc. (la distribución de butacas es fija y no se edita: ver criterios adoptados)
- [x] Usuarios empleados que escanean los QR (cine y candy bar)
- [x] Ingreso manual del código si falla el lector
- [x] El QR deja de funcionar una vez validada la entrada o entregada la comida
- [x] Asignación automática de sala
- [x] Nunca dos funciones en la misma sala al mismo tiempo (garantizado por la base desde el email 1)
- [x] Programar una película varios días a la misma hora (ej.: lunes, martes y viernes a las 18 h)

### Email 6 · 12/02/2020 · Edad, accesibilidad y tiempo real

- [x] Restricción de edad por película: ATP, +13 o +18 (se elige en el formulario de la película)
- [x] Los menores de la edad indicada no pueden comprar
- [x] Las entradas de esas películas aclaran que debe ir un adulto (pantalla, PDF y validación)
- [x] Filas J y K reemplazadas por butacas para personas con discapacidad (2, 10 y 2 por bloque)
- [x] Butacas en tiempo real: ver las que ocupa otra compra en ese momento
- [x] Butacas accesibles resaltadas visualmente

### Email 7 · 28/02/2020 · Usabilidad y reporte

- [x] Interfaces fáciles de navegar para clientes y empleados (menú según el rol, compra en pasos numerados, el empleado entra directo a validar)
- [x] Ingreso de fechas y horas sin calendarios lentos (registro, compra sin cuenta, alta de funciones y período del reporte)
- [x] Evitar el scroll excesivo (funciones de a un día, reseñas de a tres, candy bar por categoría y reporte sin días vacíos)
- [x] Reporte de facturación por día y cantidad de entradas vendidas

### Email 8 · 03/03/2020 · Fidelización y combos

- [x] 1 punto por cada peso gastado (usuarios registrados)
- [x] Canje de puntos por entradas o productos del candy bar
- [x] El admin configura cuántos puntos cuesta cada recompensa (pestaña Puntos)
- [x] El perfil muestra los puntos acumulados y el historial de canjes
- [x] Los puntos no se pueden transferir
- [x] Combos (entrada + pochoclos + bebida) a precio fijo configurable (pestaña Combos)
- [x] Combos destacados en la página de compra

### Email 9 · 08/03/2020 · Próximamente, preventa y Mis películas

- [x] Sección "Próximamente" con los estrenos de las próximas semanas (en la cartelera, con la fecha de estreno)
- [x] Alerta para recibir una notificación cuando se habilita la venta (aviso en la página y notificación del sistema)
- [x] Preventa desde 7 días antes del estreno con precio especial, configurable por película (fecha de estreno y precio de preventa en el formulario de la película)
- [x] "Mis películas": historial visual con póster, fecha y calificación propia

### Email 10 · 10/03/2020 · Cancelaciones, VIP, reportes y log

- [x] Cancelar una compra hasta 2 horas antes de la función (desde Mi perfil)
- [x] Devolución como crédito en la cuenta, visible en el perfil y combinable con otros medios de pago
- [x] Butacas VIP en las filas R, S y T con precio más alto (recargo configurable en Salas)
- [x] Butacas VIP marcadas en el mapa y avisadas antes de pagar
- [x] Exportar el reporte de facturación a PDF y Excel
- [x] Gráfico de películas más vistas por semana y por mes
- [x] Producto del candy bar más vendido
- [x] Log de actividad: quién creó cada función, quién modificó un precio, quién validó un QR, con fecha y hora (pestaña Actividad)

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
| Descuento por edad | Es un beneficio permanente, no un cupón de un solo uso: se aplica en todas las compras del usuario mientras la regla esté activa. "Más de 50 años" se cuenta en años cumplidos: con la edad configurada en 50, aplica desde los 51. |
| Descuentos juntos | No se acumulan. Si al usuario le corresponden los dos, se usa el más alto. |
| Alcance del descuento | Solo sobre las entradas que se pagan aparte. El candy bar y los combos se cobran siempre a su precio. |
| Cambiar el porcentaje del cupón | Afecta a los cupones nuevos. Los ya entregados mantienen el porcentaje con el que se emitieron. |
| Productos por compra | Hasta 20 unidades de cada producto. Son opcionales: se puede comprar solo la entrada. |
| Validar el QR | El empleado ve primero los datos de la entrada y después confirma, así no se quema un código por error. Se puede validar desde una hora antes del inicio hasta que la función termina, y los productos del candy bar se retiran en el mismo horario. |
| Lector de QR | Se usa el lector que trae el navegador y, donde no existe (Chrome en Windows, Safari, Firefox), la librería jsQR. El ingreso manual del código queda siempre disponible, como pide el email. |
| Asignación automática de sala | Toma la primera sala activa que esté libre en ese horario, en orden alfabético. |
| Programar varios días | Cada día se intenta por separado: los que se pueden crear se crean y la pantalla informa el motivo de los que no. |
| Distribución de butacas | Es la misma en todas las salas (bloques de 4, 20 y 4, salvo la fila accesible). El panel la muestra pero no se edita: la fijan los emails. |
| Filas J y K | El email dice que se quitaron "para dar espacio a **una** fila" y que "en cada columna quedaron 2, 10 y 2 butacas". Se toma como una sola fila accesible, la J, que ocupa el lugar de las dos: la K ya no existe y el resto de las letras no cambia. Cada butaca accesible ocupa el ancho de dos comunes. |
| Quién compra butacas accesibles | Cualquiera: el email no pide validar la discapacidad. El mapa y el resumen avisan para quién son. |
| Edad en compras sin cuenta | Se pide la fecha de nacimiento solo si la película es +13 o +18, con las mismas tres listas del registro. Es una declaración del comprador, igual que en el registro. |
| Reporte de ventas | Cada compra cuenta en el día (de Argentina) en que se hizo, no en el de la función. "Facturado" es lo que pagó el cliente: entradas y candy bar, con el descuento ya restado. El período se elige con botones (7 días, 30 días, este mes, mes anterior). |
| Menos scroll | El detalle muestra las funciones de un día por vez, con botones para cambiar de día; las reseñas, de a tres; el candy bar, una categoría por vez; y el reporte oculta los días sin ventas salvo que se pidan. |
| Pantalla inicial del empleado | Al ingresar, un empleado va directo a validar entradas, que es lo que usa. Los demás vuelven a la cartelera o a la pantalla donde estaban. |
| Cómo se suman los puntos | 1 punto por cada peso que se pagó, con el descuento ya restado, incluidos combos y candy bar. Se acreditan en el momento de la compra. Las compras sin cuenta no suman. |
| Cuándo se canjean | En la pantalla de compra, antes de pagar: entradas gratis (cualquier butaca de esa función) y unidades de los productos que se están comprando. Lo que se paga con puntos no suma puntos. La opción de canje aparece solo si el saldo alcanza para alguna recompensa. |
| Qué se puede canjear | La entrada gratis (500 puntos, configurable) y los productos del candy bar a los que el admin les pone un costo en puntos. Los combos no se canjean con puntos. |
| Combos | Traen siempre una entrada, sirven para cualquier función y su precio es fijo aunque la entrada cueste más o menos. Los descuentos de cupón y edad no se aplican al combo, solo a las entradas que se pagan aparte. |
| Borrar un combo o un producto | Un combo que ya se vendió no se borra: se desactiva. Un producto que está en un combo tampoco se borra mientras siga en el combo. |
| "Debe ir un adulto" | Se imprime en toda entrada de una película +13 o +18, como pide el email, y el empleado lo ve al validar. |
| Tiempo real | El mapa marca al instante las butacas de las compras confirmadas por otras personas. Si una de ellas estaba elegida, se quita de la selección y se avisa. Las butacas que otra persona está eligiendo sin pagar no se bloquean. |
| Pantallas sin permiso | Si un cliente o un empleado escribe la dirección del panel, ve la página no encontrada: para ellos esa pantalla no existe. Sin sesión, se pide ingresar y después se vuelve a esa pantalla. |
| Próximamente | Muestra todas las películas visibles con fecha de estreno futura, ordenadas por fecha. El admin decide cuáles se ven con la misma marca de cartelera. El día del estreno pasan solas a "En cartelera". |
| Precio de preventa | Un precio fijo por película, que el admin carga en el formulario, igual para todas sus funciones y formatos. Rige para las compras hechas antes del día del estreno, desde 7 días antes. Sin preventa, la venta abre el día del estreno. |
| Alerta de estreno | Necesita una cuenta, para saber a quién avisar. El aviso aparece dentro de la página y como notificación del sistema si el usuario la permite, cuando abre la app o vuelve a ella. Avisar con la app cerrada necesitaría un servidor de notificaciones push, que el proyecto no tiene. |
| Qué cuenta como "visto" | Toda función de una compra del usuario que ya terminó. Si vio la película más de una vez, aparece una sola vez con todas las fechas. La calificación es la de su reseña; si no tiene, se ofrece calificarla. |
| Cancelar una compra sin cuenta | No se puede desde la web: el email pide dar crédito en la cuenta, y una compra sin cuenta no tiene dónde acreditarlo. |
| Qué se cancela | La compra completa: todas sus butacas, combos y productos. El crédito es el total que se pagó, con el descuento ya restado e incluida la parte pagada con crédito. |
| Puntos al cancelar | Vuelven los canjeados y se descuentan los que sumó la compra. Si ya se gastaron, la compra no se cancela, para que el saldo no quede negativo. La compra que se paga con crédito suma puntos por el total, porque los de la compra cancelada ya se descontaron. |
| Recargo VIP | Un importe fijo por butaca, igual en todas las salas y funciones (empieza en $ 2.000 y lo cambia el admin en Salas). Se suma también en la preventa, en los combos y en las entradas canjeadas con puntos, y los descuentos no lo alcanzan. |
| Cómo se avisa que es VIP | Butacas doradas en el mapa con su referencia y el recargo, una línea en el resumen y un aviso antes de pagar. La entrada, el PDF y la pantalla del empleado también indican las butacas VIP. |
| Más vistas por semana y por mes | Entradas vendidas de cada película en las funciones del período, no en el día de la compra. La semana va de lunes a domingo; se elige esta semana, la pasada, este mes o el pasado. |
| Producto más vendido | Unidades vendidas en las funciones del período, sueltas y dentro de los combos (según lo que trae cada combo hoy), incluidas las canjeadas con puntos. |
| Exportar el reporte | El PDF y el Excel traen todos los días del período elegido, también los que no tuvieron ventas, con los totales. |
| Registro de actividad | Anota lo que se hace desde la app con un usuario. Lo que se carga directo en la base (datos de ejemplo, migraciones) no tiene usuario y no se registra. La pantalla muestra los últimos 200 movimientos y se filtra por funciones, precios o validación de QR. |

## 8. Pruebas de aceptación

El 27/09/2026 se probó la aplicación publicada con cuentas de cliente, empleado y administrador, contra la
consigna y los emails del 01/01 al 03/03, y el control de acceso a cada pantalla: 78 casos, todos OK. El 05/10/2026
se probaron los emails del 08/03 y del 10/03 con las cuentas demo: 43 casos, todos OK. Los errores que aparecieron se
corrigieron y se volvieron a probar. El detalle de cada caso, las capturas y los datos de prueba están en [UAT.md](UAT.md).
