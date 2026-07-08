# Arquitectura — VAION / Control Obras 360

App de gestión de obras de construcción (multi-empresa), en producción en **https://vaion.app**.

## Stack

- **Frontend:** React 18 + Vite + React Router v6
- **Estilos:** Tailwind CSS + variables CSS propias (design system dark-mode-first, ver más abajo)
- **Backend:** Supabase (Postgres + Auth + Storage + RLS), sin backend propio — todo el acceso a datos vive en `src/lib/supabase.js`
- **PWA:** `vite-plugin-pwa` (service worker con precache — ver "Problemas conocidos")
- **Gráficos:** Recharts
- **Deploy:** Vercel (proyecto `pablozem-sys-projects/vaion`)

## Estructura de carpetas

```
src/
  App.jsx                    — rutas, guardas de auth/rol, redirect de recovery de contraseña
  main.jsx
  index.css                  — variables CSS del design system
  context/
    AuthContext.jsx          — sesión Supabase, perfil de usuario, empresa activa, permisos por rol
    ThemeContext.jsx         — dark/light mode
  lib/
    supabase.js              — TODAS las funciones de acceso a datos (CRUD + RPC). Único punto de contacto con Supabase.
    helpers.js               — formatters (formatCLP, formatDate) y constantes (CATEGORIAS_GASTO, TIPOS_OBRA, ESTADOS_OBRA, TIPOS_DOC, etc.)
  components/
    layout/                  — AppLayout, Sidebar, BottomNav (nav mobile)
    ui/                      — Badge, Modal, StatCard (componentes genéricos reutilizados en todas las páginas)
  pages/                     — una página por ruta (ver tabla de rutas abajo)
```

No hay backend propio: cada página de `pages/` llama directo a funciones de `lib/supabase.js`, que a su vez llaman a Supabase (Postgres via PostgREST, o Storage API). No hay capa de API intermedia.

## Multi-tenant (empresas)

La app soporta múltiples empresas por usuario (ej: un dueño con "VA CONSTRUCTORA" y "VR ASOCIADOS").

- Tabla `companies`: registro de cada empresa.
- Tabla `user_companies`: relación usuario↔empresa, con su **rol dentro de esa empresa** (puede diferir del rol "global" en `users.rol`).
- Flujo post-login: si el usuario tiene 1 sola empresa, entra directo; si tiene más de una, pasa por `/select-workspace` (`SelectWorkspace.jsx`) para elegir.
- `setEmpresaId(id)` en `supabase.js` guarda un `let currentEmpresaId` a nivel de módulo (variable JS en memoria, no Postgres) que se usa como filtro (`.eq('empresa_id', currentEmpresaId)`) en casi todas las queries y se inyecta en los inserts.
- **Importante:** este filtro client-side es solo de conveniencia/UX. La seguridad real la hace RLS en Postgres, verificando `auth.uid()` contra `user_companies` — nunca confiar en el filtro de JS como mecanismo de seguridad.
- `localStorage.vaion_empresa_id` persiste la empresa elegida entre sesiones.
- Al cambiar de empresa, `AppLayoutKeyed` fuerza un remount completo de la app (`key={empresa_id}`) para evitar estado obsoleto de la empresa anterior.

## Roles y permisos

Definidos en `AuthContext.jsx` (`PERMISOS`):

| Rol | Acceso |
|---|---|
| `dueno` | Total — incluye EERR, Flujo de Caja, Cuentas por Cobrar, Usuarios |
| `administrativo` | Todo excepto módulos financieros de dueño (ver tabla de rutas) |
| `trabajador` | Solo kiosco de asistencia (`/trabajador`, `/trabajador/asistencia`), sesión separada en `localStorage` (`vaion_worker_session`), login por PIN vía RPC `verify_worker_pin_only` |

El rol efectivo de un usuario es **por empresa** (`user_companies.rol`), no global. Ver "Bug resuelto: is_dueno()" en memoria del proyecto para el histórico de un bug relacionado.

`DuenoRoute` en `App.jsx` bloquea con un mensaje in-page (no redirect) a quien no sea `dueno` intentando ver una ruta exclusiva.

## Rutas (`App.jsx`)

| Ruta | Página | Acceso |
|---|---|---|
| `/` | Landing | público |
| `/login` | Login | público |
| `/reset-password` | ResetPassword | público (via link de recovery) |
| `/trabajador` | AccesoTrabajador | público (PIN) |
| `/trabajador/asistencia` | Asistencia | público (requiere sesión worker en localStorage) |
| `/select-workspace` | SelectWorkspace | autenticado, sin empresa aún elegida |
| `/dashboard` | Dashboard | autenticado + empresa |
| `/obras` | Obras | autenticado + empresa |
| `/obras/:id` | DetalleObra | autenticado + empresa |
| `/gastos/nuevo` | NuevoGasto ("Subir Egreso") | autenticado + empresa |
| `/gastos` | Gastos | autenticado + empresa |
| `/cuentas-pagar` | CuentasPagar | autenticado + empresa |
| `/asistencia-control` | ControlAsistencia | autenticado + empresa |
| `/documentos` | Biblioteca | autenticado + empresa |
| `/banos-quimicos` | BanosQuimicos | autenticado + empresa |
| `/gestion` | Gestion | autenticado + empresa |
| `/cuentas-cobrar` | CuentasCobrar | **solo dueño** |
| `/eerr` | EstadoResultado | **solo dueño** |
| `/flujo-caja` | FlujoCaja | **solo dueño** |
| `/usuarios` | Usuarios | **solo dueño** |

Nota: las etiquetas del Sidebar no siempre calzan 1:1 con el nombre de archivo o la ruta (ej. "Asistencia" en el sidebar → `/asistencia-control` → `ControlAsistencia.jsx`; el kiosco público es una ruta aparte). Ver memoria del proyecto para la tabla de mapeo completa verificada contra producción.

## Modelo de datos (Supabase)

Tablas principales (todas con RLS habilitado):

- `companies`, `user_companies` — multi-tenant
- `users` — perfil, `rol` global (legacy, ver nota de roles arriba)
- `projects` (= "obras") — `estado` (cotizada/en_ejecucion/pausada/finalizada), `presupuesto`, `fecha_inicio`, `fecha_termino`
- `clients`
- `expenses` (= "egresos") — `categoria` (ver `CATEGORIAS_GASTO` en helpers.js), `documento_url` propio
- `income` (= "abonos" de clientes)
- `additional_sales` — ventas adicionales / alcance no ejecutado por obra, `documento_url` propio
- `accounts_payable`, `accounts_receivable`
- `documents` — **fuente única para Biblioteca y la sección "Documentos" de DetalleObra**. Ver nota abajo.
- `workers`, `worker_projects`, `attendance` — trabajadores, asignación a obras, registro de asistencia
- `banos_quimicos`, `banos_quimicos_pagos`
- `providers`, `tasks`, `geolocation_logs`

### Documentos — un patrón a respetar

Hay **tres lugares** donde se puede subir un archivo (modal en Obras, "Subir Egreso", "Venta Adicional"), pero **un solo lugar** desde donde se listan (Biblioteca + sección Documentos de DetalleObra), que lee exclusivamente de la tabla `documents`.

`expenses.documento_url` y `additional_sales.documento_url` siguen existiendo (los usa `CuentasPagar.jsx` directo), pero **no alimentan Biblioteca por sí solos**. Cualquier flujo nuevo que suba un archivo debe:
1. Subir a Storage con `uploadDocumento(carpeta, file)`
2. Guardar la URL donde corresponda (su propio registro, si aplica)
3. **Además** llamar `createDocumento({ project_id, tipo, nombre, archivo_url, fecha })` para que aparezca en Biblioteca

(Bug real resuelto el 2026-07-08 — ver memoria del proyecto para el detalle completo.)

## Fórmulas financieras canónicas

| Métrica | Nivel | Fórmula |
|---|---|---|
| Venta Total | empresa/obra | `presupuesto + Σ(additional_sales.monto donde tipo≠descuento) − Σ(monto donde tipo=descuento)` |
| Abonos | empresa | `Σ(income.monto)` |
| CDO (Costo Directo Obra) | obra | `Σ(expenses.monto)` donde `categoria.grupo = 'Costo Directo de la Obra'` |
| MOD (Mano de Obra) | empresa | `Σ(attendance.costo_total)` |
| GAV (Gastos Generales) | empresa | `Σ(expenses.monto)` donde `categoria.grupo = 'Gastos Generales'` |
| Egresos | empresa | `CDO + MOD + GAV` |
| **Margen** | obra | `Venta obra − CDO obra − MOD obra` (GAV no aplica a nivel obra) |
| **Utilidad** | empresa | `Venta total − Egresos` |

`CATEGORIAS_GASTO` en `helpers.js` es la fuente única de verdad para categorías de egreso y su `grupo` (CDO / Gastos Generales) — todo el resto del código deriva de ahí dinámicamente, no hay listas duplicadas por página.

## Design system

Dark mode exclusivo (con toggle a claro). Nunca usar colores Tailwind directos — todo pasa por variables CSS (`src/index.css`):

- Fondos: `--bg-base`, `--bg-card`, `--bg-elevated`, `--bg-surface`
- Texto: `--text`, `--muted`, `--subtle`
- Acento: `--amber`, `--amber-glow`, `--amber-dim`
- Estados: `--green`, `--green-dim`, `--red`, `--red-dim`
- Bordes: `--border`, `--border-light`

Fuentes: `Unbounded` (headings/labels uppercase), `Instrument Sans` (body/botones), `DM Mono` (números — clase `.num`).

Clases utilitarias propias: `btn-primary`, `btn-secondary`, `btn-ghost`, `card`, `card-hover`, `input`, `select`, `label`, `section-title`, `table-row`.

## Deploy

```bash
npx vercel build --prod
npx vercel deploy --prebuilt --prod
```

Siempre desde `/Users/pedropablozemelman/control-obras-360`. **Importante:** el build usa el working directory tal cual está — incluye cualquier cambio sin commitear, no solo lo commiteado. No usar `vercel --prod` directo (cachés incorrectos).

## Problemas conocidos (sin resolver)

- **Pérdida de sesión en recarga completa:** navegar con `goto`/reload de navegador (no un link SPA) a veces bota al usuario a la Landing aunque tenga sesión válida. Reproducido repetidamente en local y producción. Sospecha: `AuthContext.jsx` no restaura la sesión de forma confiable en algunos casos del mount inicial. Navegar por los links del sidebar (SPA) siempre funciona.
