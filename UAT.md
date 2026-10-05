# Cine Avenida · Pruebas de aceptación (UAT)

Resultado de probar la aplicación publicada como la usarían el cliente, el empleado y el administrador,
contra los requerimientos de la consigna y de los 10 emails (del 01/01 al 10/03), y el control de acceso a cada pantalla (guards).
Qué pide cada email está en [FUNCIONAL.md](FUNCIONAL.md); cómo está hecho, en [TECNICO.md](TECNICO.md).

## Índice

1. [Resumen](#1-resumen)
2. [Entorno y datos de prueba](#2-entorno-y-datos-de-prueba)
3. [Casos](#3-casos)
4. [Hallazgos y correcciones](#4-hallazgos-y-correcciones)
5. [Cobertura de los guards](#5-cobertura-de-los-guards)
6. [Comentarios](#6-comentarios)
7. [Limpieza de los datos de prueba](#7-limpieza-de-los-datos-de-prueba)

---

## 1. Resumen

**Resultado: aprobado.** Se probó en dos rondas, siempre sobre la app publicada y la base real:

- **27/09/2026** (versión 0.6.2): la consigna, los emails del 01/01 al 03/03 y el control de acceso a cada pantalla.
  78 casos OK (82 comprobaciones, porque el registro se probó con 5 cuentas).
- **05/10/2026** (versión 0.8.0): los emails del 08/03 y del 10/03, con las cuentas demo. 43 casos OK.

En la primera ronda aparecieron tres errores de la aplicación y uno de la documentación, y en la segunda uno de diseño.
Se corrigieron, se publicaron y se volvieron a probar (ver [hallazgos](#4-hallazgos-y-correcciones)).

| Área | Requerimiento | Casos | OK |
|---|---|---|---|
| Registro | Emails 01/01 y 30/01 | 6 | 6 |
| Guards y navegación | Control de acceso de la consigna y emails 06/02 y 28/02 | 13 | 13 |
| Administración | Emails 01/01, 30/01, 06/02, 12/02 y 03/03 | 14 | 14 |
| Cartelera, detalle y reseñas | Emails 01/01, 16/01, 12/02 y 28/02 | 6 | 6 |
| Compra, candy bar y combos | Emails 01/01, 30/01, 16/01 y 03/03 | 6 | 6 |
| Programa de puntos | Email 03/03 | 5 | 5 |
| Butacas en tiempo real y descuentos | Emails 12/02 y 30/01 | 3 | 3 |
| Restricción de edad | Email 12/02 | 5 | 5 |
| Compra sin cuenta | Emails 01/01 y 03/03 | 2 | 2 |
| Validación de QR | Emails 06/02, 12/02 y 28/02 | 12 | 12 |
| Reporte y más vendidas | Emails 28/02 y 16/01 | 2 | 2 |
| PWA y celular | Consigna | 4 | 4 |
| Próximamente, preventa y alertas | Email 08/03 | 13 | 13 |
| Mis películas | Email 08/03 | 1 | 1 |
| Butacas VIP | Email 10/03 | 6 | 6 |
| Cancelación y crédito | Email 10/03 | 6 | 6 |
| Reportes, gráficos y registro de actividad | Emails 10/03 y 06/02 | 14 | 14 |
| Celular (segunda ronda) | Consigna | 3 | 3 |
| **Total** | | **121** | **121** |

## 2. Entorno y datos de prueba

| | |
|---|---|
| Fecha | 27/09/2026, de 14:38 a 14:57 (hora de Argentina); las repeticiones de los hallazgos, a continuación |
| Aplicación | <https://avenida-cine.vercel.app>, versión 0.6.2 (último commit probado: `b9a84f9`) |
| Base | Supabase real del proyecto (`tp1-cine`), con las migraciones hasta la `007` aplicadas |
| Navegador | Chrome 152 en Windows 11, automatizado con Puppeteer, en 1280 × 900 y en 390 × 844 (celular) |
| Cámara | Para el lector de QR se usó una cámara simulada que muestra el QR de una entrada real |

Cada caso se ejecutó en la aplicación publicada, con clics y datos reales. Cuando hacía falta, el resultado
de la pantalla se comparó con lo que guardó la base (por ejemplo, el total de una compra o el saldo de puntos).

**Cuentas de prueba** (creadas desde la pantalla de registro):

| Cuenta | Rol | Para qué |
|---|---|---|
| `uat-admin-2709@example.com` | Administrador (asignado por SQL, como indica TECNICO.md) | Panel, funciones, catálogo, reporte |
| `uat-empleado-2709@example.com` | Empleado (asignado por el admin desde Usuarios) | Validar entradas y entregar productos |
| `uat-cliente-2709@example.com` | Cliente, 33 años | Compras, cupón, puntos, canjes, reseña |
| `uat-mayor-2709@example.com` | Cliente, 66 años | Descuento para mayores de 50 y tiempo real |
| `uat-menor-2709@example.com` | Cliente, 16 años | Restricción de edad |
| `uat-anonimo-2709@example.com` | Sin cuenta (solo el email de la compra) | Compras sin registrarse |

**Datos que cargó el administrador durante la prueba** (quedan en la base porque le sirven a la app):
categorías Pochoclos y Bebidas; productos Pochoclos medianos, Pochoclos grandes y Gaseosa grande; productos de los
combos Combo clásico y Combo grande; 150 puntos para los pochoclos grandes; y 6 funciones entre el 27/09 y el 01/10.

**Segunda ronda (emails del 08/03 y del 10/03)**

| | |
|---|---|
| Fecha | 05/10/2026, de 12:15 a 12:19 (hora de Argentina) |
| Aplicación | <https://avenida-cine.vercel.app>, versión 0.8.0 (commit `c11e480`); la repetición del hallazgo 6, con `a15624c` |
| Base | Supabase real, con las migraciones hasta la `009` aplicadas |
| Navegador | Chrome en Windows 11, automatizado con Puppeteer, en 1280 × 900 y en 390 × 844 |
| Notificaciones | El navegador del cliente tenía el permiso concedido, como si hubiera aceptado el aviso |
| Tiempo real | Un segundo navegador, sin cuenta, con la misma función abierta |

Se usaron las cuentas demo de la defensa: `admin.demo@example.com` (Laura Gómez, administradora),
`empleado.demo@example.com` (Martín Díaz, empleado) y `cliente.demo@example.com` (Sofía Pereyra, cliente).

**Datos que quedan para la demostración:** las películas "Marea alta" (estreno 09/10, preventa a $ 4.000, con
funciones el 09/10 y el 10/10 a las 18) y "El jardín de invierno" (estreno 26/10, sin preventa); una función de
Pequeños gigantes el 05/10 a las 12:45; y del cliente demo, una compra VIP en preventa (R5 y R6 con candy bar), una
cancelada, una pagada con crédito y una validada en el día. El cliente demo queda con $ 1.500 de crédito y con la alerta
de "Marea alta" ya avisada.

## 3. Casos

Referencias: la columna **Email** indica el requerimiento que prueba cada caso.

### 3.1 Registro

| ID | Email | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|---|
| R-01 | 01/01 | Registro de las 5 cuentas con todos los datos: queda con la sesión iniciada en su perfil y con el cupón de bienvenida | Las 5 cuentas quedan en `/perfil` con "Tenés un cupón de 20% de descuento" | OK |
| R-02 | 01/01 | El registro rechaza contraseñas distintas | "Las contraseñas no coinciden." y no se envía | OK |
| R-03 | 01/01 | La fecha de nacimiento se elige con tres listas y rechaza un 31 de febrero ([captura](docs/uat/R-03-fecha-invalida.png)) | "Esa fecha no existe." | OK |
| R-04 | 01/01, 30/01 | La base crea el cupón con el porcentaje configurado | Cupón de 20%, sin usar | OK |
| R-05 | 30/01 | Un usuario de 66 años tiene además el descuento para mayores de 50 | Descuento de 15% para mayores de 50 | OK |
| R-06 | 30/01 | Un usuario de 16 años no tiene descuento por edad | Solo el cupón | OK |

### 3.2 Guards y navegación

| ID | Guard | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|---|
| G-01 | canActivate `authGuard` | `/perfil` sin sesión | Va a `/login?volver=%2Fperfil` | OK |
| G-02 | canMatch `adminGuard` | `/admin/funciones` sin sesión | Va a `/login?volver=%2Fadmin%2Ffunciones` | OK |
| G-03 | canMatch `empleadoGuard` | `/validar` sin sesión | Va a `/login?volver=%2Fvalidar` | OK |
| G-04 | Ruta `**` | Una dirección que no existe | Página 404 | OK |
| G-05 | `ActivatedRoute` + login | Después de ingresar vuelve a donde quería ir | Queda en `/perfil` | OK |
| G-06 | canActivate `invitadoGuard` | `/login` con la sesión iniciada | Vuelve a la cartelera | OK |
| G-07 | canMatch `adminGuard` | Un cliente escribe `/admin` ([captura](docs/uat/G-07-admin-como-cliente.png)) | La ruta no coincide y Angular sigue hasta `**`: ve la 404 | OK |
| G-08 | canMatch `empleadoGuard` | Un cliente escribe `/validar` | 404 | OK |
| G-09 | `*appSiRol` | El menú del cliente | Cartelera, Mi perfil y Salir (sin Administración ni Validar QR) | OK |
| G-10 | canDeactivate `cambiosSinGuardarGuard` | Salir del formulario de película con cambios sin guardar | Pide confirmación; si se cancela queda en el formulario, si se acepta sale | OK |
| G-11 | canDeactivate | Salir sin guardar no modifica la película | El título sigue siendo "El último faro" | OK |
| G-12 | canActivateChild `rolAdminVigenteGuard` | A un admin le quitan el rol mientras navega el panel | Al cambiar de pestaña vuelve a la cartelera | OK |
| G-13 | canMatch `adminGuard` | Un empleado escribe `/admin` | 404 | OK |

### 3.3 Administración

| ID | Email | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|---|
| A-01 | 06/02 | El menú del administrador | Incluye Administración y Validar QR | OK |
| A-02 | 12/02 | La pestaña Salas informa la distribución | "19 filas (A a T, sin la K) … salvo la fila J, accesible" | OK |
| A-03 | 12/02 | El listado de películas muestra la restricción de edad | ATP, +13 (Operación Medianoche) y +18 (La casa del fondo) | OK |
| A-04 | 30/01 | Crear categorías del candy bar (formulario template-driven) | Pochoclos y Bebidas creadas | OK |
| A-05 | 30/01 | Crear productos con categoría y precio (formulario reactivo) | 3 productos guardados con su precio | OK |
| A-06 | 03/03 | Completar los combos con sus productos ([captura](docs/uat/A-06-combos.png)) | "1 entrada + 1 × Gaseosa grande + 1 × Pochoclos medianos" y el combo grande | OK |
| A-07 | 03/03 | Fijar cuántos puntos cuesta una recompensa ([captura](docs/uat/A-07-puntos.png)) | Pochoclos grandes: 150 puntos; entrada gratis: 500 | OK |
| A-08 | 30/01 | Descuentos configurados | Cupón 20%, mayores de 50: 15% | OK |
| A-09 | 06/02 | Asignar el rol de empleado desde Usuarios | "uat-empleado-2709@example.com ahora es empleado." | OK |
| A-10 | 01/01, 06/02 | Programar una función con asignación automática de sala | "creada en Sala 1" | OK |
| A-11 | 06/02 | Programar la misma película 3 días a la misma hora ([captura](docs/uat/A-11-varios-dias.png)) | Las 3 funciones creadas, con sala asignada por el sistema | OK |
| A-12 | 12/02 | Programar una película +18 y una +13 | Las dos creadas | OK |
| A-13 | 01/01 | Nunca empieza una función antes de 30 minutos del final de la anterior en la sala ([captura](docs/uat/A-13-choque.png)) | No se crea: "La sala ya tiene otra función en ese horario" (ver [comentarios](#6-comentarios)) | OK |
| A-14 | 01/01 | Las funciones quedan en la base | 6 funciones futuras | OK |

### 3.4 Cartelera, detalle y reseñas

| ID | Email | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|---|
| C-01 | 01/01, 12/02 | La cartelera muestra las películas con duración, géneros, puntaje y restricción de edad | Tarjetas con ATP, +13 y +18 | OK |
| C-02 | 16/01 | Buscador por nombre | "faro" deja solo "El último faro" | OK |
| C-03 | 16/01 | Filtro por varios géneros | Suspenso + Drama deja "El último faro" | OK |
| C-04 | 28/02 | Funciones de a un día, elegido con botones, sin calendario | 4 botones de día; el primero muestra la función de las 15:45 | OK |
| C-05 | 12/02 | El detalle de una película +18 lo avisa | "Solo para mayores de 18 años. Las entradas indican que debe ir un adulto." | OK |
| C-06 | 16/01 | Dejar una reseña con estrellas y comentario; se ve con el puntaje promedio antes de comprar | La reseña de "Carla C." y el promedio actualizado | OK |

### 3.5 Compra, candy bar y combos

| ID | Email | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|---|
| C-07 | 01/01, 30/01, 03/03 | Primera compra: 3 butacas (una accesible), un combo y pochoclos ([captura](docs/uat/C-07-compra-cliente.png)) | 2 entradas $ 10.000 + combo $ 11.500 + pochoclos $ 5.800 − cupón 20% de las entradas $ 2.000 = **$ 25.300**; "sumás 25.300 puntos" | OK |
| C-08 | 12/02 | Elegir una butaca de la fila accesible | "Elegiste butacas de la fila J, pensadas para personas con discapacidad." | OK |
| C-09 | 01/01 | La base cobró lo mismo que mostró la pantalla | Total 25.300, motivo "primera_compra", 25.300 puntos, butacas F10, F11, J5 | OK |
| C-10 | 01/01, 03/03 | La entrada muestra QR, butacas, combo y puntos ([captura](docs/uat/C-10-entrada.png)) | Todo presente | OK |
| C-11 | 01/01 | Descargar el PDF de la entrada | Se descargó `entrada-3d55cf73.pdf` (277 KB) | OK |
| C-27 | 16/01 | Cantidad de entradas vendidas en las más vendidas | "1 entrada vendida" / "9 entradas vendidas" (ver hallazgo 3) | OK |

### 3.6 Programa de puntos

| ID | Email | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|---|
| C-12 | 03/03 | El perfil muestra los puntos, el cupón usado y las compras ([captura](docs/uat/C-12-perfil-puntos.png)) | "25.300 puntos", "Ya usaste tu cupón" y la compra en el historial | OK |
| C-13 | 03/03 | Canjear una entrada (500) y unos pochoclos (150) en una compra de 2 butacas ([captura](docs/uat/C-13-canje.png)) | Se paga solo 1 entrada: $ 6.500; "usás 650" | OK |
| C-14 | 03/03 | El saldo después del canje | 25.300 − 650 + 6.500 = **31.150** y 2 canjes en el historial | OK |
| C-15 | 03/03 | El perfil muestra el historial de canjes | 2 canjes con fecha, detalle, película y puntos | OK |
| C-26 | 03/03 | El canje se ofrece solo si alcanzan los puntos | Con 0 puntos no aparece; con 31.150 sí (ver hallazgo 2) | OK |

Que los puntos no se pueden transferir no se prueba desde la pantalla porque la app no ofrece esa opción:
lo verifica `npm run test:db`, donde un usuario con el rol `authenticated` no puede insertar ni modificar movimientos de puntos.

### 3.7 Butacas en tiempo real y descuentos

| ID | Email | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|---|
| C-16 | 12/02 | Una persona elige la H5 y otra la compra desde otro navegador ([captura](docs/uat/C-16-tiempo-real.png)) | La H5 pasa a ocupada y se quita de la selección **1,1 s** después del pago, sin recargar; aviso "La butaca H5 la acaba de comprar otra persona" | OK |
| C-17 | 30/01 | Con cupón (20%) y descuento por edad (15%) se usa el más alto | Cupón de 20%: − $ 1.300 | OK |
| C-18 | 30/01 | En la compra siguiente el mayor de 50 tiene su 15% | − $ 975 sobre $ 6.500 | OK |

### 3.8 Restricción de edad

| ID | Email | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|---|
| C-19 | 12/02 | Un usuario de 16 años entra a comprar una +18 ([captura](docs/uat/C-19-menor-18.png)) | "…no podés comprar entradas para esta función" y no se muestra el mapa | OK |
| C-20 | 12/02 | El mismo usuario compra una +13 | Compra hecha; la entrada dice "Debe ir un adulto" | OK |
| C-21 | 12/02 | Sin cuenta, una +18 pide la fecha de nacimiento y rechaza a un menor | "Esta película es solo para mayores de 18 años." | OK |
| C-22 | 12/02 | Con fecha de adulto la compra sin cuenta se hace ([captura](docs/uat/C-22-entrada-18.png)) | "Película para mayores de 18 años. Debe ir un adulto." | OK |
| C-23 | 12/02 | El PDF de la entrada +18 | Se descargó | OK |

### 3.9 Compra sin cuenta

| ID | Email | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|---|
| C-24 | 03/03 | Sin cuenta no se ofrece canjear puntos | No aparece el canje y se invita a registrarse "para sumar puntos" | OK |
| C-25 | 01/01 | Comprar sin registrarse (nombre y email) y volver a ver la entrada con el código | La entrada de "El último faro" con la gaseosa | OK |

### 3.10 Validación de QR (empleado)

| ID | Email | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|---|
| E-01 | 28/02 | El empleado entra directo a Validar QR | Queda en `/validar`; menú sin Administración | OK |
| E-02 | 06/02 | Código con formato inválido | "Ese código no tiene el formato de una entrada." | OK |
| E-03 | 06/02 | Código que no existe | "No existe ninguna compra con ese código" | OK |
| E-04 | 06/02 | Ingreso manual del código: ver los datos antes de validar | Película, butacas F10, F11, J5, combo y "Ingreso: sin usar" | OK |
| E-05 | 06/02 | Validar el ingreso | "Entrada validada. Puede pasar a la sala."; al volver a leerla: "Entrada ya validada" (ver hallazgo 5) | OK |
| E-06 | 06/02 | Entregar los productos con el mismo QR ([captura](docs/uat/E-06-validada-y-entregada.png)) | "Productos entregados." | OK |
| E-07 | 06/02 | El QR deja de funcionar | Segundo ingreso: "Esta entrada ya fue validada el 27/09/2026 14:52"; segunda entrega: "ya se entregaron" | OK |
| E-08 | 06/02 | Validar una entrada de otro día | "La entrada se puede validar desde una hora antes" | OK |
| E-09 | 12/02 | Entrada +18 en la puerta | "Película para mayores de 18 años: debe ir un adulto." | OK |
| E-10 | 06/02 | Lector de QR con la cámara ([captura](docs/uat/E-10-camara.png)) | Leyó el QR (con jsQR, porque Chrome en Windows no trae lector propio) y mostró la compra | OK |
| E-11 | 06/02 | El cliente ve su entrada ya usada ([captura](docs/uat/E-11-entrada-usada.png)) | QR atenuado, "Ingreso validado el 27/09/2026 14:52" y productos retirados | OK |
| E-12 | 06/02 | El perfil marca la compra como usada | "Usada el 27/09 14:52" | OK |

### 3.11 Reporte y más vendidas

| ID | Email | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|---|
| A-15 | 28/02 | La fila de hoy del reporte coincide con la base ([captura](docs/uat/A-15-reporte.png)) | 8 compras, 11 entradas, $ 67.125: igual en pantalla y en la base | OK |
| A-16 | 16/01 | La película con más entradas vendidas encabeza la cartelera | "El último faro" #1 | OK |

### 3.12 PWA y celular

| ID | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|
| P-01 | Manifest | Nombre "Cine Avenida", `standalone`, 8 íconos | OK |
| P-02 | Service worker | Activo y controlando la página | OK |
| P-03 | Sin conexión ([captura](docs/uat/P-03-sin-conexion.png)) | La app abre, avisa "Sin conexión a internet" y muestra la última cartelera guardada | OK |
| U-01 | Celular de 390 px ([captura](docs/uat/U-01-celular-compra.png)) | Cartelera, detalle y compra sin desborde lateral; el mapa se desplaza dentro de su tarjeta (ver hallazgo 1) | OK |

### 3.13 Próximamente, preventa y alertas (segunda ronda)

| ID | Email | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|---|
| N-01 | 08/03 | El admin carga una película con fecha de estreno (en 11 días) y preventa | "Marea alta", estreno 16/10/2026, "Preventa $ 4.000,00" en el listado | OK |
| N-02 | 08/03 | Y otra con estreno en tres semanas, sin preventa | "El jardín de invierno", estreno 26/10/2026 | OK |
| N-03 | 08/03 | La cartelera tiene "Próximamente", ordenada por estreno, con la preventa ([captura](docs/uat/N-03-proximamente.png)) | Marea alta: "Preventa desde el 9/10 a $ 4.000,00"; El jardín de invierno: "Avisarme cuando salga a la venta" | OK |
| N-04 | 08/03 | Las películas que no se estrenaron no se mezclan con "En cartelera" | "6 de 6 películas", sin los estrenos | OK |
| N-05 | 08/03 | El cliente activa la alerta de Marea alta | "Alerta activada" y la alerta guardada en la base, sin avisar | OK |
| N-06 | 08/03 | El admin adelanta el estreno al 09/10: la preventa (7 días antes) queda abierta | Fecha guardada: 2026-10-09 | OK |
| N-07 | 08/03, 06/02 | Programa Marea alta el 09/10 y el 10/10 a las 18, con sala automática | Las dos creadas en Sala 4 | OK |
| N-08 | 08/03 | Al volver a la pestaña, el cliente ve el aviso de la venta ([captura](docs/uat/N-08-aviso-preventa.png)) | "Empezó la preventa de Marea alta." | OK |
| N-09 | 08/03 | Y la notificación del sistema, mostrada por el service worker | "Marea alta: ya podés comprar tus entradas · Empezó la preventa en Cine Avenida." | OK |
| N-10 | 08/03 | La alerta queda marcada como avisada, así no se repite | `avisada_en` con la fecha del aviso | OK |
| N-11 | 08/03 | El detalle avisa la preventa y las funciones muestran ese precio ([captura](docs/uat/N-11-detalle-preventa.png)) | "cada entrada cuesta $ 4.000,00"; funciones a $ 4.000 aunque su precio es $ 5.500 | OK |
| N-12 | 08/03 | La base cobra el precio de preventa | Compra marcada como preventa, $ 8.000 por 2 entradas | OK |
| N-13 | 08/03 | Una película sin preventa no se vende antes del estreno y ofrece la alerta | "Las entradas salen a la venta el lunes 26 de octubre." | OK |

### 3.14 Mis películas (segunda ronda)

| ID | Email | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|---|
| M-01 | 08/03 | Historial visual con póster, fecha y calificación propia ([captura](docs/uat/M-01-mis-peliculas.png)) | "La casa del fondo, la viste el 28/09/2026" y "Pequeños gigantes, la viste el 27/09/2026", con su póster y "Calificar" (no tiene reseñas de esas películas) | OK |

### 3.15 Butacas VIP (segunda ronda)

| ID | Email | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|---|
| V-01 | 10/03 | El admin ve y cambia el recargo VIP en Salas | $ 2.000 → $ 2.500 → $ 2.000 | OK |
| V-02 | 10/03 | La compra marca las butacas VIP y lo avisa antes de pagar ([captura](docs/uat/V-02-compra-vip-preventa.png)) | Butacas doradas; "Recargo VIP (R5, R6)" en el resumen y "Butacas VIP: R5, R6. Cada una tiene un recargo de $ 2.000,00" | OK |
| V-03 | 10/03 | La base suma el recargo sin descuento | Entradas $ 8.000 + recargo $ 4.000 + candy $ 13.000 = $ 25.000 | OK |
| V-04 | 10/03, 08/03 | La entrada indica preventa y butacas VIP ([captura](docs/uat/V-04-entrada-vip.png)) | "Entradas (preventa)", "VIP: R5, R6" y "Recargo VIP" | OK |
| V-05 | 10/03 | PDF de la entrada VIP | Se descargó `entrada-d6a33c0e.pdf` (271 KB) | OK |
| V-06 | 10/03 | El empleado ve qué butacas son VIP | "R5, R6 (2) · VIP: R5, R6" | OK |

### 3.16 Cancelación y crédito (segunda ronda)

| ID | Email | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|---|
| K-01 | 10/03 | El cliente cancela desde su perfil, con más de 2 horas de anticipación ([captura](docs/uat/K-01-perfil-cancelada.png)) | Pide confirmación y avisa "Compra cancelada. Se acreditaron $ 6.500,00 en tu cuenta." | OK |
| K-02 | 10/03, 12/02 | Otra persona ve la butaca liberada | La butaca G10 quedó libre en su pantalla 0,4 segundos después | OK |
| K-03 | 10/03 | El crédito aparece en el perfil | $ 6.500 con su movimiento | OK |
| K-04 | 10/03 | La entrada cancelada lo avisa y no muestra el QR ([captura](docs/uat/K-04-entrada-cancelada.png)) | "Esta compra se canceló el 05/10/2026 12:16: la entrada ya no sirve." | OK |
| K-05 | 10/03 | El crédito se usa en otra compra ([captura](docs/uat/K-05-compra-con-credito.png)) | Cubrió la entrada de $ 5.000: el botón dice "Confirmar compra" (sin tarjeta) y quedan $ 1.500 | OK |
| K-06 | 10/03 | El empleado no puede validar una compra cancelada ([captura](docs/uat/K-06-validar-cancelada.png)) | "Compra cancelada el 05/10/2026 12:16: la entrada no sirve." y el botón deshabilitado | OK |

### 3.17 Reportes, gráficos y registro de actividad (segunda ronda)

| ID | Email | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|---|
| I-01 | 06/02 | El admin programa una función para hoy, con sala automática | Pequeños gigantes, 05/10 a las 12:45, en Sala 1 | OK |
| I-02 | 10/03 | El admin cambia el precio de una función | $ 5.500 → $ 6.000 | OK |
| I-03 | 06/02 | El empleado valida el ingreso y entrega los productos de esa función | "validado el 05/10/2026 12:16" y "entregado el 05/10/2026 12:16" | OK |
| I-04 | 10/03, 28/02 | El reporte no cuenta la compra cancelada | Facturado hoy $ 38.600: las 3 compras válidas de 4 | OK |
| I-05 | 10/03 | Exportar el reporte a PDF | `facturacion-2026-09-29-a-2026-10-05.pdf` | OK |
| I-06 | 10/03 | Exportar el reporte a Excel | `facturacion-2026-09-29-a-2026-10-05.xlsx`, con los días, las compras, las entradas y el facturado | OK |
| I-07 | 10/03 | Gráfico de películas más vistas de esta semana ([captura](docs/uat/I-07-reportes.png)) | Marea alta 2, Luna de papel 1, Pequeños gigantes 1 (la cancelada no cuenta) | OK |
| I-08 | 10/03 | Producto del candy bar más vendido | "Gaseosa grande · 3 unidades", después Pochoclos grandes 1 | OK |
| I-09 | 10/03 | Los gráficos cambian a "Mes pasado" | Pequeños gigantes 3, La casa del fondo 2 | OK |
| I-10 | 10/03 | El registro dice quién creó cada función, con fecha y hora ([captura](docs/uat/I-10-actividad.png)) | "05/10/2026 12:16:04 · Laura Gómez (admin.demo@example.com) · Creó la función de Marea alta del 09/10/2026 18:00 en Sala 4 (2D, castellano, $ 5.500)" | OK |
| I-11 | 10/03 | Quién modificó un precio | "Cambió el precio de la función de Marea alta del 10/10/2026 18:00 en Sala 4: de $ 5.500 a $ 6.000" y los dos cambios del recargo VIP | OK |
| I-12 | 10/03 | Quién validó un QR y entregó productos | "Martín Díaz (empleado.demo@example.com) · Validó el ingreso de la compra ecbf5eb2 (Sofía Pereyra, Pequeños gigantes …)" | OK |
| I-13 | 10/03 | El registro se filtra por tipo | "Validación de QR" deja solo las 2 líneas del empleado | OK |
| I-14 | 10/03 | Repetición del hallazgo 6: los importes no se cortan en dos renglones | Ningún renglón termina en "$" | OK |

### 3.18 Celular (segunda ronda)

| ID | Qué se prueba | Resultado obtenido | Estado |
|---|---|---|---|
| U-02 | Cartelera con Próximamente en 390 px | Sin desborde lateral | OK |
| U-03 | Mis películas en 390 px ([captura](docs/uat/U-03-celular.png)) | Sin desborde lateral | OK |
| U-04 | Perfil con crédito y cancelación en 390 px | Sin desborde lateral | OK |

## 4. Hallazgos y correcciones

| # | Caso | Qué pasó | Corrección | Commit |
|---|---|---|---|---|
| 1 | U-01 | En el celular, la pantalla de compra se desbordaba 354 px a lo ancho: la columna del mapa y el candy bar crecía hasta el ancho del mapa. Venía de la versión 0.3.0. | La columna usa `grid-template-columns: minmax(0, 1fr)` y el mapa se desplaza dentro de su tarjeta. | `488fe1a` |
| 2 | C-16 | A un cliente con 0 puntos se le mostraba el recuadro "Canjear puntos" vacío, que solo ocupaba lugar. | El canje aparece solo si el saldo alcanza para alguna recompensa (caso C-26). | `b9a84f9` |
| 3 | A-16 | La tarjeta de las más vendidas decía "1 entradas vendidas". | Singular y plural según la cantidad (caso C-27). | `b9a84f9` |
| 4 | A-13 | TECNICO.md decía que al **crear** una función la pantalla lista las funciones que chocan. Eso pasa solo al **editar**; al crear, la base informa el motivo por cada día. | Se corrigió el documento. | Documentación de la versión 0.6.2 |
| 5 | E-05 | La primera corrida marcó falla por un error del script de prueba (miraba el botón de la cámara en vez del de la entrada). La aplicación funcionaba bien. | Se corrigió el script y se repitió el caso. | — |
| 6 | I-10 | En el registro de actividad, un importe podía quedar cortado entre dos renglones: "$" al final de uno y el número en el siguiente. Además, la descripción quedaba pegada a los filtros. | Al mostrar el detalle se usa un espacio duro entre "$" y el número, y se separó la descripción de los filtros (caso I-14). | `a15624c` |

**Repetición después de la versión 0.6.3.** Esa versión cambió cómo se dibujan la grilla de la cartelera,
las butacas, el fondo de la ficha y los contadores de la compra (ver TECNICO.md). En producción, sin cuenta, se
repitieron C-01, A-16, C-04 y C-07 hasta el resumen de pago: todos OK. El canje de puntos (C-13) y el armado de
combos (A-06) se repitieron con Supabase simulado, porque las cuentas del UAT ya se habían borrado: también OK.

**Versión 0.6.4.** Cambió el formato de porcentajes, nombres y botones de día, y el aviso de nueva versión.
Se repitió en producción la compra sin cuenta hasta el resumen, más el detalle de la película, y se probó el aviso
de nueva versión con el build de producción servido en local: el service worker detectó la versión nueva, mostró
"Hay una nueva versión de la aplicación" a los 5 segundos y "Actualizar" cargó la nueva. Todo OK.

Antes del UAT se ajustaron también los guards `canMatch`: con sesión pero sin el rol ahora devuelven `false`,
así la ruta no coincide y Angular sigue buscando en el arreglo de rutas hasta la 404 (commit `1b2a473`).

## 5. Cobertura de los guards

| Para qué se usa un guard | Dónde está en el proyecto | Caso |
|---|---|---|
| Evitar que un usuario no autenticado entre a ciertas rutas | `authGuard` (canActivate) en `/perfil`; `adminGuard` y `empleadoGuard` mandan al login | G-01, G-02, G-03 |
| Permitir el acceso solo a ciertos roles | `adminGuard` (canMatch) en `/admin` y `empleadoGuard` (canMatch) en `/validar` | G-07, G-08, G-13 |
| Proteger todas las rutas hijas de una sección | `rolAdminVigenteGuard` (canActivateChild) en las pestañas del panel | G-12 |
| Evitar salir de una pantalla con cambios sin guardar | `cambiosSinGuardarGuard` (canDeactivate) en el formulario de película | G-10, G-11 |
| Decidir qué ruta usar según una condición: si canMatch devuelve `false`, Angular sigue buscando en el arreglo de rutas | Con sesión pero sin el rol, `adminGuard` y `empleadoGuard` devuelven `false` y la navegación termina en la ruta `**` (404). Como la ruta no coincide, el código lazy del panel no se descarga | G-07, G-08, G-13 |
| canActivate vs canMatch | canActivate actúa con la ruta ya encontrada (`authGuard`, `invitadoGuard`, `rolEmpleadoVigenteGuard`); canMatch mientras se busca la ruta (`adminGuard`, `empleadoGuard`) | G-01, G-06, G-07 |

Todos los guards son funciones (`CanActivateFn`, `CanMatchFn`, `CanActivateChildFn`, `CanDeactivateFn`) en
`src/app/core/auth/auth.guards.ts`. No se usan otros tipos de guard.

## 6. Comentarios

- **Tiempo real**: es lo único que antes solo se había probado con una conexión simulada. Contra Supabase real,
  la otra persona vio la butaca ocupada 1,1 segundos después del pago.
- **Choque de horarios al crear una función (A-13)**: la regla de los 30 minutos se cumple siempre porque la aplica
  la base. Al crear, la pantalla da el motivo por cada día ("La sala ya tiene otra función en ese horario"), pero
  no dice con qué función choca. Esa lista solo aparece al editar. Queda como mejora posible, no como falla.
- **Asignación automática**: como no había otras funciones, el sistema eligió siempre la Sala 1, que es la primera
  libre en orden alfabético. Es el criterio documentado en FUNCIONAL.md.
- **Lector de QR**: se probó con una cámara simulada en Chrome de Windows, donde el navegador no trae lector propio y
  entra jsQR. Conviene probarlo también una vez con la cámara de un celular.
- **Descuentos**: el cupón y el descuento por edad no se acumulan (C-17) y se aplican solo a las entradas que se
  pagan aparte, no al combo ni al candy bar (C-07).
- **Datos reales**: las compras de prueba aparecen en el reporte de hoy y en las más vendidas hasta que se borren
  (ver punto 7).
- **Alertas de estreno (segunda ronda)**: la notificación llegó al volver a la pestaña, con el permiso concedido y el
  service worker activo. Con la app cerrada no llega, porque no hay un servidor de notificaciones push; está
  explicado en FUNCIONAL.md.
- **Tiempo real con cancelaciones**: Realtime no permite filtrar los borrados por función, así que cada pantalla de
  compra vuelve a leer sus butacas cuando se borra una entrada. La butaca liberada apareció libre en 0,4 segundos.
- **Cancelar con menos de 2 horas**: no se probó en producción porque hay que esperar a que se acerque una función;
  lo cubren las pruebas de la base (`npm run test:db`), junto con el cupón que vuelve y el bloqueo si ya se gastaron
  los puntos de la compra.
- **Recargo VIP**: se cambió a $ 2.500 y se volvió a $ 2.000 para dejar el valor documentado; los dos cambios quedaron
  en el registro de actividad, que en producción empezó vacío porque solo anota lo que se hace después de la migración `009`.

## 7. Limpieza de los datos de prueba

Los datos de la segunda ronda quedan en la base a propósito, para mostrarlos en la defensa (ver la sección 2).

De la primera ronda, el catálogo del candy bar, los combos, los puntos de las recompensas y las funciones que cargó
el administrador quedan porque la app los necesita. Las cuentas y las compras de prueba se borraron el 27/09/2026 con
este SQL en **Supabase > SQL Editor**:

```sql
-- Compras del UAT, con y sin cuenta (borra también sus entradas, productos, combos y movimientos de puntos).
delete from public.compras where email like 'uat-%-2709@example.com';
-- Cuentas del UAT (borra también sus perfiles, cupones, reseñas y puntos).
delete from auth.users where email like 'uat-%-2709@example.com';
```
