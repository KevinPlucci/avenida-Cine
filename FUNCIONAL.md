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
que puede descargar en PDF. Puede hacerlo con una cuenta o sin registrarse. Con cuenta, además, suma
puntos en cada compra y los canjea por entradas o productos del candy bar.

Del otro lado, el administrador carga películas, arma los horarios, administra las salas y los géneros,
y decide qué se muestra en la cartelera.

## 2. Roles

| Rol | Quién es | Qué puede hacer |
|---|---|---|
| Visitante | Entra sin cuenta | Ver la cartelera y el detalle de las películas, comprar entradas dejando nombre y email, ver la entrada con el código de compra |
| Cliente registrado | Se registró con sus datos | Todo lo anterior, más su perfil, su cupón de primera compra, sus puntos y canjes, el historial de compras y dejar reseñas |
| Empleado | Personal de puerta y candy bar | Validar los códigos QR del ingreso y entregar los productos del candy bar |
| Administrador | Personal del cine | Películas, funciones, salas, géneros, candy bar, combos, descuentos, puntos, roles de los usuarios y reporte de ventas. También puede validar QR |

## 3. Pantallas

| Pantalla | Qué ofrece | Quién entra |
|---|---|---|
| Cartelera | Las 3 películas más vendidas arriba y el listado completo, con buscador y filtro por género | Todos |
| Detalle de película | Sinopsis, duración, restricción de edad, puntaje promedio, reseñas y funciones de los próximos días | Todos |
| Compra de entradas | Mapa de butacas en tiempo real con la fila accesible, combos destacados, productos del candy bar, canje de puntos, resumen con el descuento aplicado y datos de pago | Todos |
| Entrada | Código QR para ingresar y retirar el candy bar, y descarga del PDF | Quien tenga el código de compra |
| Validar entradas | Lectura del QR con la cámara o a mano, con el estado del ingreso y del candy bar | Empleados y administradores |
| Ingreso y registro | Cuenta propia; después de ingresar vuelve a la pantalla donde estaba | Solo sin sesión iniciada |
| Mi perfil | Datos personales, cupón disponible, puntos acumulados con lo que se puede canjear, historial de canjes y compras realizadas | Clientes registrados |
| Administración | Películas, funciones, salas, géneros, candy bar, combos, descuentos, puntos de cada recompensa, usuarios y reporte de ventas por día | Administradores |

## 4. Flujo de compra

1. El cliente elige una función desde el detalle de la película.
2. Ve el mapa de la sala con las butacas ya vendidas y elige las suyas (hasta 10 por compra).
   Si otra persona compra una butaca mientras tanto, el mapa la marca como ocupada al instante.
   Si la película tiene restricción de edad y el cliente no llega a la edad, no puede comprar.
3. Si quiere, suma un combo (una entrada con pochoclos y bebida a precio fijo) o productos sueltos del candy bar.
4. Si tiene la sesión iniciada y le corresponde un descuento, aparece en el resumen. También puede canjear puntos
   por entradas gratis o por productos que eligió. Si compra sin cuenta, deja nombre y email.
5. Paga con tarjeta (simulado). El total lo calcula el sistema con los precios de la base, no el navegador.
6. Recibe la entrada con el código QR y puede descargar el PDF. Si tiene cuenta, suma 1 punto por cada peso pagado.

En el cine, un empleado escanea ese QR en la puerta y, si la compra tenía productos, otra vez en el candy bar.
Cada código sirve una sola vez para cada cosa.

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
- La fila K ya no existe: su lugar lo ocupa la fila J, accesible para personas con discapacidad, con 2, 10 y 2 butacas.
- Los usuarios registrados suman 1 punto por cada peso que pagan (con el descuento ya restado). Lo canjeado con puntos no suma puntos.
- Los puntos se canjean al comprar, por entradas gratis o por productos del candy bar de esa compra, al costo que fija el administrador. Solo se puede usar el saldo disponible.
- Los puntos no se pueden transferir: solo el sistema los suma o descuenta, siempre en una compra del mismo usuario.
- Un combo trae una entrada y ciertos productos a un precio fijo. Cada combo usa una de las butacas elegidas y los descuentos no se le aplican.
- Un combo inactivo, o con algún producto sin stock, no se vende.
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
| Descuento por edad | Es un beneficio permanente, no un cupón de un solo uso: se aplica en todas las compras del usuario mientras la regla esté activa. "Más de 50 años" se cuenta en años cumplidos: con la edad configurada en 50, aplica desde los 51. |
| Descuentos juntos | No se acumulan. Si al usuario le corresponden los dos, se usa el más alto. |
| Alcance del descuento | Solo sobre las entradas. El candy bar se cobra siempre a precio de lista. |
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
| Cuándo se canjean | En la pantalla de compra, antes de pagar: entradas gratis (cualquier butaca de esa función) y unidades de los productos que se están comprando. Lo que se paga con puntos no suma puntos. |
| Qué se puede canjear | La entrada gratis (500 puntos, configurable) y los productos del candy bar a los que el admin les pone un costo en puntos. Los combos no se canjean con puntos. |
| Combos | Traen siempre una entrada, sirven para cualquier función y su precio es fijo aunque la entrada cueste más o menos. Los descuentos de cupón y edad no se aplican al combo, solo a las entradas que se pagan aparte. |
| Borrar un combo o un producto | Un combo que ya se vendió no se borra: se desactiva. Un producto que está en un combo tampoco se borra mientras siga en el combo. |
| "Debe ir un adulto" | Se imprime en toda entrada de una película +13 o +18, como pide el email, y el empleado lo ve al validar. |
| Tiempo real | El mapa marca al instante las butacas de las compras confirmadas por otras personas. Si una de ellas estaba elegida, se quita de la selección y se avisa. Las butacas que otra persona está eligiendo sin pagar no se bloquean. |

Dudas ya detectadas para los próximos emails:

- Email 10: cómo dar crédito por cancelación en una compra anónima.
