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
| Administrador | Personal del cine | Películas, funciones (alta, edición y baja), salas y géneros |
| Empleado | Personal de puerta y candy bar | Todavía no existe: llega con el email del 06/02 (validación de QR) |

## 3. Pantallas

| Pantalla | Qué ofrece | Quién entra |
|---|---|---|
| Cartelera | Las 3 películas más vendidas arriba y el listado completo, con buscador y filtro por género | Todos |
| Detalle de película | Sinopsis, duración, puntaje promedio, reseñas y funciones de los próximos días | Todos |
| Compra de entradas | Mapa de butacas de la sala, resumen con el cupón aplicado y datos de pago | Todos |
| Entrada | Código QR para ingresar y descarga del PDF | Quien tenga el código de compra |
| Ingreso y registro | Cuenta propia; después de ingresar vuelve a la pantalla donde estaba | Solo sin sesión iniciada |
| Mi perfil | Datos personales, cupón disponible y compras realizadas | Clientes registrados |
| Administración | Películas, funciones, salas y géneros | Administradores |

## 4. Flujo de compra

1. El cliente elige una función desde el detalle de la película.
2. Ve el mapa de la sala con las butacas ya vendidas y elige las suyas (hasta 10 por compra).
3. Si tiene la sesión iniciada y le corresponde el cupón, el descuento aparece en el resumen.
   Si compra sin cuenta, deja nombre y email.
4. Paga con tarjeta (simulado). El total lo calcula el sistema con el precio de la función, no el navegador.
5. Recibe la entrada con el código QR y puede descargar el PDF.

## 5. Reglas de negocio

- Entre dos funciones de la misma sala tienen que pasar al menos **30 minutos** desde que termina una hasta que empieza la otra.
- Una butaca no se puede vender dos veces para la misma función.
- Una función con entradas vendidas no cambia de horario, sala, película, formato ni idioma. Sí puede cambiar el precio, que rige para las ventas nuevas. Tampoco se puede eliminar.
- No se programan funciones en el pasado ni en salas desactivadas.
- El cupón de primera compra se aplica una sola vez y queda marcado como usado en la misma operación de compra.
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

- [ ] Porcentaje del cupón de primera compra configurable por el admin
- [ ] Cupones que solo aplican a usuarios de más de 50 años
- [ ] Productos del candy bar (pochoclos, bebidas, etc.) con categorías
- [ ] Comprar productos junto con la entrada
- [ ] Retirar los productos con el mismo QR
- Mapa del cine con la sala de la entrada: **sin aprobación del cliente, no se implementa**

### Email 5 · 06/02/2020 · Roles y validación de QR

- [ ] Administrador que controla salas, funciones, distribución de butacas, productos, etc. (ya existe el rol admin para películas, funciones, salas y géneros)
- [ ] Usuarios empleados que escanean los QR (cine y candy bar)
- [ ] Ingreso manual del código si falla el lector
- [ ] El QR deja de funcionar una vez validada la entrada o entregada la comida
- [ ] Asignación automática de sala
- [x] Nunca dos funciones en la misma sala al mismo tiempo (garantizado por la base desde el email 1)
- [ ] Programar una película varios días a la misma hora (ej.: lunes, martes y viernes a las 18 h)

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

Dudas ya detectadas para los próximos emails:

- Email 6: las filas J y K se reemplazan por **una** fila accesible o las dos quedan como accesibles.
- Email 6 y email 4: cómo validar la edad (restricción por película y cupón para mayores de 50) en compras anónimas, que no tienen fecha de nacimiento.
- Email 10: cómo dar crédito por cancelación en una compra anónima.
