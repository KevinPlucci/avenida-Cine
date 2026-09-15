# Cine Avenida · TP 1 Programación IV

Aplicación web para un cine: cartelera, compra de entradas con PDF y código QR, reseñas y panel de administración.
Hecha con **Angular 21** y **Supabase**, instalable como **PWA**.

| | |
|---|---|
| **Deploy** | <https://avenida-cine.vercel.app> |
| **Repositorio** | <https://github.com/KevinPlucci/Avenida-Cine> |
| **Estado** | Consigna + emails del 01/01 y 16/01 implementados, con edición de funciones |

## Documentación

| Documento | Qué contiene |
|---|---|
| [FUNCIONAL.md](FUNCIONAL.md) | Qué hace la app: roles, pantallas, flujo de compra, requerimientos por email y criterios adoptados |
| [TECNICO.md](TECNICO.md) | Cómo está hecha: instalación, arquitectura, modelo de datos, decisiones técnicas e historial de versiones |

## Qué hace

- Cartelera con las 3 películas más vendidas, buscador y filtro por género.
- Detalle de película con sinopsis, puntaje promedio, reseñas y funciones.
- Compra de entradas con mapa de butacas y cupón de descuento, con cuenta o sin registrarse.
- Entrada con código QR y descarga en PDF. El pago es simulado.
- Panel de administración de películas, funciones, salas y géneros.

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
