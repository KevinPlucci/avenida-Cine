# Cine Avenida · TP 1 Programación IV

Aplicación web para un cine: cartelera, compra de entradas con PDF y código QR, reseñas y panel de administración.
Hecha con **Angular 21** y **Supabase**, instalable como **PWA**.

| | |
|---|---|
| **Deploy** | <https://avenida-cine.vercel.app> |
| **Repositorio** | <https://github.com/KevinPlucci/Avenida-Cine> |
| **Estado** | Consigna y los 10 emails implementados (del 01/01 al 03/03 probados en producción: [UAT](UAT.md)) |

## Documentación

| Documento | Qué contiene |
|---|---|
| [FUNCIONAL.md](FUNCIONAL.md) | Qué hace la app: roles, pantallas, flujo de compra, requerimientos por email y criterios adoptados |
| [TECNICO.md](TECNICO.md) | Cómo está hecha: instalación, arquitectura, modelo de datos, decisiones técnicas, pruebas e historial de versiones |
| [UAT.md](UAT.md) | Pruebas de aceptación sobre la app publicada: casos, resultados, hallazgos y capturas |

## Qué hace

- Cartelera con las 3 películas más vendidas, buscador y filtro por género.
- Detalle de película con sinopsis, puntaje promedio, reseñas y funciones.
- Compra de entradas con mapa de butacas en tiempo real (con butacas VIP), combos, candy bar y descuentos, con cuenta o sin registrarse.
- Cancelación hasta 2 horas antes de la función, con el total como crédito para la próxima compra.
- Programa de puntos: 1 punto por peso pagado, canjeable por entradas o productos.
- Próximos estrenos con preventa a precio especial y alerta para cuando salen a la venta.
- Mis películas: el historial de lo que vio cada usuario, con su calificación.
- Entrada con código QR y descarga en PDF. El pago es simulado.
- Validación del QR en la puerta y en el candy bar, para el personal del cine.
- Panel de administración de películas, funciones, salas, géneros, candy bar, combos, descuentos, puntos y usuarios, con reporte de ventas exportable a PDF y Excel, gráficos de lo más visto y vendido, y registro de actividad.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Angular 21 (standalone, signals, sin zone.js) |
| Backend | Supabase (PostgreSQL, Auth, Storage, RLS y RPC) |
| PWA | `@angular/service-worker` |
| Hosting | Vercel |

## Arranque rápido

```bash
npm install
npm start      # http://localhost:4200
```

Antes hay que crear un proyecto en Supabase, ejecutar `supabase/schema.sql` y `supabase/seed.sql`,
y cargar la *Project URL* y la *publishable key* en `src/environments/environment.ts`.
Los pasos completos, el alta del administrador y el deploy están en [TECNICO.md](TECNICO.md#1-cómo-levantar-el-proyecto).

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo en el puerto 4200 |
| `npm run build` | Build de producción en `dist/tp1-cine/browser` |
| `npm run test:db` | Prueba el esquema y las reglas de negocio en un PostgreSQL en memoria |
