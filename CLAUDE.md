# VAION — Control Obras 360

App web de gestión de obras de construcción, deployada en producción.

**URL producción:** https://vaion-app.vercel.app
**Proyecto Vercel:** pablozem-sys-projects/vaion (vinculado a este directorio)
**Supabase:** ffxexpasoneowquvtouz.supabase.co

## Stack

- React 18 + Vite + React Router
- Tailwind CSS + variables CSS propias (dark mode exclusivo)
- Supabase (auth + DB + RPC)

## Estructura

```
src/
  App.jsx                  — rutas y guardas de rol
  main.jsx
  index.css                — variables CSS globales del design system
  context/
    AuthContext.jsx        — sesión Supabase, rol del usuario
    ThemeContext.jsx
  lib/
    supabase.js            — todas las funciones de DB
    helpers.js             — formatters, constantes (CATEGORIAS_GASTO, TIPOS_OBRA, etc.)
  pages/
    Landing.jsx            — pública
    Login.jsx              — auth Supabase
    AccesoTrabajador.jsx   — login por PIN → RPC verify_worker_pin_only
    Asistencia.jsx         — LLEGUÉ / ME VOY, solo obras asignadas
    Dashboard.jsx
    Obras.jsx
    DetalleObra.jsx        — detalle + edición inline de obra
    NuevoGasto.jsx
    Gastos.jsx             — desglose por categoría
    CuentasPagar.jsx
    CuentasCobrar.jsx      — solo dueño
    EstadoResultado.jsx    — solo dueño
    FlujoCaja.jsx          — solo dueño
    ControlAsistencia.jsx  — registro manual + edición inline de salida
    Biblioteca.jsx
```

## Roles

- `dueno` — acceso total
- `administrativo` — sin módulos financieros (CuentasCobrar, EstadoResultado, FlujoCaja)
- `trabajador` — solo AccesoTrabajador y Asistencia (sesión en localStorage como `vaion_worker_session`)

## Rutas (App.jsx)

| Ruta | Página | Acceso |
|------|--------|--------|
| `/` | Landing | público |
| `/login` | Login | público |
| `/trabajador` | AccesoTrabajador | público |
| `/trabajador/asistencia` | Asistencia | público (requiere sesión worker) |
| `/dashboard` | Dashboard | auth |
| `/obras` | Obras | auth |
| `/obras/:id` | DetalleObra | auth |
| `/gastos/nuevo` | NuevoGasto | auth |
| `/gastos` | Gastos | auth |
| `/cuentas-pagar` | CuentasPagar | auth |
| `/asistencia-control` | ControlAsistencia | auth |
| `/documentos` | Biblioteca | auth |
| `/cuentas-cobrar` | CuentasCobrar | solo dueño |
| `/eerr` | EstadoResultado | solo dueño |
| `/flujo-caja` | FlujoCaja | solo dueño |

## Tablas Supabase

`projects` · `workers` · `attendance` · `expenses` · `income` · `accounts_payable` · `accounts_receivable` · `documents` · `clients` · `users` · `worker_projects`

- Filtros financieros usan `project_id` (no `obraId`)
- Fecha de asistencia se guarda en hora local (no UTC)

## RPC

```sql
-- Login trabajador por PIN
verify_worker_pin_only(p_pin text)
  RETURNS TABLE(id uuid, nombre text, avatar text, valor_hora numeric)
```

## Design System

Dark mode exclusivo. No usar colores Tailwind directamente — siempre usar las variables CSS.

**Variables CSS principales:**
- Fondos: `--bg-base`, `--bg-card`, `--bg-elevated`, `--bg-surface`
- Texto: `--text`, `--muted`, `--subtle`
- Acento: `--amber`, `--amber-glow`, `--amber-dim`
- Estados: `--green`, `--green-dim`, `--red`, `--red-dim`
- Bordes: `--border`, `--border-light`

**Fuentes:**
- `Unbounded` — headings, labels uppercase, badges (`font-display`)
- `Instrument Sans` — body, botones
- `DM Mono` — números, monospace (`font-mono`)

**Clases utilitarias:** `btn-primary`, `btn-secondary`, `btn-ghost`, `card`, `input`, `select`, `label`, `section-title`, `table-row`, `num`

## Deploy

```bash
npx vercel build --prod && npx vercel deploy --prebuilt --prod
```

Siempre ejecutar desde `/Users/pedropablozemelman/control-obras-360`.
