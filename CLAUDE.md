# VAION — Control Obras 360

App web de gestión de obras de construcción. El mismo código sirve a VAION, VRION y staging.

| Entorno | URL | Supabase ref | Cuenta Supabase |
|---|---|---|---|
| Producción | https://vaion.app | `ffxexpasoneowquvtouz` | gmail (Pro) |
| Staging | https://vaion-staging.vercel.app | `mcqeqwcqkcxehwjpggnr` | hotmail (free) |
| VRION | https://vrion.vercel.app | `sfemjichlximrhcfgwio` | hotmail (free) |

Antes de cualquier SQL o comando `supabase`, confirmar el ref contra esta tabla.

## Stack

- React 18 + Vite + React Router
- Tailwind + variables CSS de `src/index.css` (dark mode exclusivo; nunca colores Tailwind directos). Fuentes: `Unbounded` (`font-display`), `Instrument Sans`, `DM Mono` (`font-mono`); clases utilitarias (`btn-primary`, `card`, `input`…) también en `index.css`
- Supabase (auth + DB + RPC + edge functions)

## Dónde está cada cosa

- Rutas y guardas de rol: `src/App.jsx`
- Funciones de DB: `src/lib/supabase.js` · formatters/constantes: `src/lib/helpers.js`
- Sesión y rol: `src/context/AuthContext.jsx`
- Esquema: `supabase/migrations/` (procedimiento en `docs/MIGRATIONS.md`)

## Roles

- `dueno` — acceso total
- `administrativo` — sin CuentasCobrar, EstadoResultado, FlujoCaja ni Usuarios
- `trabajador` — solo AccesoTrabajador y Asistencia (sesión en localStorage como `vaion_worker_session`)
- `/monitoreo` — solo admins por email (`ADMIN_EMAILS`)

## Reglas

- Filtros financieros usan `project_id` (no `obraId`)
- Fecha de asistencia se guarda en hora local (no UTC)

## Deploy

- Producción: `npx vercel deploy --prod --yes` (build remoto: el build local falla por env vars Sensitive). Un push a `main` también despliega a producción.
- Staging: `npx vite build && npx vercel deploy ./dist --prod --project vaion-staging --yes`
- Todo cambio va a VAION **y** VRION.
