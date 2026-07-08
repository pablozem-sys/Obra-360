# INFRASTRUCTURE.md — VAION / Control Obras 360

## 1. Hosting

| Componente | Proveedor | Detalle |
|---|---|---|
| Frontend (build estático) | **Vercel** | Proyecto `pablozem-sys-projects/vaion`. Dominio custom: `https://vaion.app` (alias sobre el deployment de Vercel). |
| Backend / datos | **Supabase** | Proyecto único (Postgres + Auth + Storage), URL: `https://ffxexpasoneowquvtouz.supabase.co` |

No hay ambientes separados (no existe un proyecto de Supabase de staging/desarrollo distinto al de producción, ni un dominio de preview usado activamente para QA — se prueba localmente contra el mismo proyecto de Supabase de producción). **PENDIENTE DE CONFIRMAR:** si existe o se planea un ambiente de staging separado.

No hay CDN propio ni balanceador de carga configurado explícitamente — se depende de la infraestructura estándar de Vercel (edge network) y de Supabase.

## 2. Base de datos — Supabase

- **Proveedor:** Supabase (Postgres administrado + capa de servicios).
- **Proyecto:** `ffxexpasoneowquvtouz` (referenciado como constante fallback en `src/lib/supabase.js` y como variable de entorno).
- **Servicios de Supabase en uso:**
  - **Postgres** — todas las tablas de negocio, con Row Level Security (RLS) habilitado. Ver `DATABASE.md`.
  - **Auth** — email/password para usuarios admin/dueño. Método: `supabase.auth.signInWithPassword`. Sesión persistida en `localStorage` (claves `sb-*`), con `autoRefreshToken: true` y `persistSession: true` (ver `src/lib/supabase.js`).
  - **Storage** — un bucket llamado `documents` (público), usado para todo archivo subido desde la app (comprobantes de egresos, documentos de obra, ventas adicionales). Ver `DATABASE.md` y el hallazgo documentado sobre políticas RLS de Storage.
  - **RPC (funciones Postgres `SECURITY DEFINER`)** — para operaciones que requieren bypasear RLS de forma controlada (borrados en cascada, creación de usuarios, verificación de PIN de trabajador). Ver `API.md`.
- **Gestión de esquema:** no hay CLI de Supabase configurado en el repo (no hay `supabase/config.toml` ni carpeta `migrations/` con migraciones numeradas). Existen dos archivos SQL de referencia en `supabase/` (`schema.sql`, `rls_role_based.sql`) que documentan el estado en un punto del tiempo, pero **la base de datos real en producción ha divergido de esos archivos** (se agregaron tablas y columnas — multi-tenancy con `companies`/`user_companies`/`empresa_id`, `banos_quimicos`, `tasks`, `providers`, columna `pin` en `workers`, etc. — directamente vía Supabase Dashboard → SQL Editor, sin dejar el SQL correspondiente versionado en el repo). Ver detalle en `DATABASE.md`.

## 3. Variables de entorno

Definidas en `.env.local` (no versionado — existe `.env.local` en el directorio del proyecto, ignorado por git). **Solo se listan los nombres, no los valores:**

| Variable | Usada en | Propósito |
|---|---|---|
| `VITE_SUPABASE_URL` | `src/lib/supabase.js` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.js` | Clave pública (anon/publishable) del proyecto Supabase |

**Notas importantes:**
- Ambas variables tienen un **valor hardcodeado de fallback** en el código (`src/lib/supabase.js` línea 3-4): si las variables de entorno no están disponibles en build time, la app usa el proyecto de Supabase de producción igual. Esto fue una decisión deliberada documentada en el historial de commits (`"fix: hardcodear fallback Supabase URL+key — env vars no se incorporan en build Vercel"`), porque en algún momento las env vars no se propagaban correctamente al build de Vercel.
- La `ANON_KEY` es una clave **pública/publishable** por diseño de Supabase (se embebe en el bundle JS que llega al navegador) — no es un secreto en el sentido tradicional, pero de todas formas no se incluye su valor en esta documentación por instrucción explícita.
- No hay una `SERVICE_ROLE_KEY` configurada como variable de entorno en el proyecto — las operaciones privilegiadas se resuelven vía RPC `SECURITY DEFINER` en Postgres, no exponiendo una service key en el cliente. Cuando se necesitó una operación administrativa puntual (ej. reseteo de contraseña de emergencia) se usó la Admin API de Supabase manualmente vía `curl`, fuera del código de la app.
- Prefijo `VITE_`: requerido por Vite para que la variable esté disponible en `import.meta.env` en el bundle del cliente.

## 4. Proceso de build y deploy

```bash
# Build (genera dist/ con el bundle estático + service worker)
npx vercel build --prod

# Deploy del build ya generado
npx vercel deploy --prebuilt --prod
```

Ambos comandos se ejecutan desde la raíz del proyecto (`/Users/pedropablozemelman/control-obras-360` en la máquina de desarrollo actual).

**Por qué `--prebuilt` y no `vercel --prod` directo:** un deploy directo (`vercel --prod` sin build local previo) puede usar un caché de build incorrecto en Vercel. Usar `vercel build --prod` + `vercel deploy --prebuilt --prod` garantiza que el bundle subido es exactamente el que se generó localmente.

**Importante — alcance del build:** `vercel build` empaqueta el *working directory tal como está en el momento*, no solo lo commiteado a git. Cualquier cambio sin commitear en el directorio local se incluye en el deploy igual. Esto es una particularidad del flujo de trabajo actual, no un comportamiento estándar recomendado — implica que "lo que está commiteado" y "lo que está deployado" pueden no coincidir exactamente en un momento dado.

No hay pipeline de CI/CD configurado (no hay GitHub Actions, no hay integración automática de Vercel con push a `main` verificada — el deploy se dispara manualmente desde la máquina de desarrollo). **PENDIENTE DE CONFIRMAR:** si el repo de GitHub tiene la integración nativa de Vercel (deploy automático en push) habilitada o deshabilitada — el flujo observado en este proyecto es manual.

## 5. PWA / Service Worker

`vite-plugin-pwa` genera un manifest (`VAION — Control de Obras`, instalable, `display: standalone`) y un service worker (`sw.js`) con:

- **Precache** de todos los assets del build (JS, CSS, HTML, iconos, fuentes).
- **Runtime caching:**
  - Llamadas a `https://ffxexpasoneowquvtouz.supabase.co/*` → estrategia `NetworkFirst` (10s de timeout, cache de respaldo hasta 24h).
  - Google Fonts (stylesheets y archivos de fuente) → estrategia `CacheFirst`.
- `registerType: 'autoUpdate'` + `skipWaiting`/`clientsClaim` → el service worker se auto-actualiza, pero en la práctica los usuarios a veces necesitan un hard-refresh o desregistrar el SW manualmente para ver una versión nueva de inmediato (ver `RUNBOOK.md`).

## 6. Servicios externos e integraciones

| Servicio | Uso |
|---|---|
| **Supabase** | Auth, base de datos, Storage, RPC — es la única dependencia de backend real |
| **Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`) | Tipografías `Unbounded`, `Instrument Sans`, `DM Mono` |
| **Vercel** | Hosting, build, dominio |
| **Geolocalización del navegador** (`navigator.geolocation`) | Registro de ubicación al marcar asistencia y al subir egresos — no es un servicio externo de terceros, es una API del navegador |

No se detectaron integraciones con pasarelas de pago, servicios de email transaccional, SMS, analytics de terceros, ni APIs externas de negocio (ej. facturación electrónica, bancos). **PENDIENTE DE CONFIRMAR** si alguna de estas está planeada.
