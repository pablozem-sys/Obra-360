# INFRASTRUCTURE.md — VAION / Control Obras 360

## 1. Hosting

| Componente | Proveedor | Detalle |
|---|---|---|
| Frontend (build estático) | **Vercel** | Proyecto `pablozem-sys-projects/vaion`. Dominio custom: `https://vaion.app` (alias sobre el deployment de Vercel). |
| Backend / datos | **Supabase** | Proyecto único (Postgres + Auth + Storage), URL: `https://ffxexpasoneowquvtouz.supabase.co` |

**Actualizado 2026-08-30:** ya existe un segundo proyecto Supabase de staging (`vaion-staging`) — ver sección 2.1. Antes de esto, el desarrollo local se conectaba directo al proyecto de producción; eso ya no debería hacerse.

No hay CDN propio ni balanceador de carga configurado explícitamente — se depende de la infraestructura estándar de Vercel (edge network) y de Supabase.

## 2. Base de datos — Supabase

- **Proveedor:** Supabase (Postgres administrado + capa de servicios).
- **Proyecto:** `ffxexpasoneowquvtouz` (referenciado como constante fallback en `src/lib/supabase.js` y como variable de entorno).
- **Servicios de Supabase en uso:**
  - **Postgres** — todas las tablas de negocio, con Row Level Security (RLS) habilitado. Ver `DATABASE.md`.
  - **Auth** — email/password para usuarios admin/dueño. Método: `supabase.auth.signInWithPassword`. Sesión persistida en `localStorage` (claves `sb-*`), con `autoRefreshToken: true` y `persistSession: true` (ver `src/lib/supabase.js`).
  - **Storage** — un bucket llamado `documents` (público), usado para todo archivo subido desde la app (comprobantes de egresos, documentos de obra, ventas adicionales). Ver `DATABASE.md` y el hallazgo documentado sobre políticas RLS de Storage.
  - **RPC (funciones Postgres `SECURITY DEFINER`)** — para operaciones que requieren bypasear RLS de forma controlada (borrados en cascada, creación de usuarios, verificación de PIN de trabajador). Ver `API.md`.
- **Gestión de esquema:** desde 2026-08-30, versionado con Supabase CLI (`supabase/config.toml` + `supabase/migrations/`). Ver `docs/MIGRATIONS.md` para el procedimiento completo. Los archivos `supabase/legacy/schema.sql` y `supabase/legacy/rls_role_based.sql` son históricos, no la fuente de verdad — ver `DATABASE.md`.

### 2.1 Dos proyectos Supabase — producción y staging

| Proyecto | Ref | Para qué sirve |
|---|---|---|
| **VAION (producción)** | `ffxexpasoneowquvtouz` | Datos reales de VA Constructora, cliente pagado. **Nunca** correr `db push`/`db reset`/seeds de prueba acá. |
| **Vaion Staging** | `mcqeqwcqkcxehwjpggnr` (URL: `https://mcqeqwcqkcxehwjpggnr.supabase.co`) | Datos 100% ficticios (`supabase/seed.sql`, constructora inventada "Rukan SpA") para desarrollo local y demos comerciales. Acá sí se prueba libremente — se puede resetear sin miedo. Cuenta Supabase separada (`pablozem@hotmail.com`, misma cuenta que aloja VRION) — el CLI necesita `SUPABASE_ACCESS_TOKEN` de esa cuenta para operar sobre este proyecto (no comparte sesión con la cuenta de producción). |

**Cómo apuntar el local a uno u otro:** el proyecto se elige por las variables de `.env.local` — no hay switch en la app, es 100% configuración de entorno.

1. Copiar `.env.example` a `.env.local` si no existe.
2. Completar `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` con las credenciales del proyecto que corresponda (producción o staging — pedirlas si no las tenés).
3. `VITE_ENV=staging` (o `local` si querés seguir apuntando a producción para debug puntual — no recomendado; dejar `VITE_ENV=staging` cuando `.env.local` apunte a `vaion-staging`) — cualquier valor distinto de `production` muestra el banner de "ambiente de pruebas" en toda la app, así nunca hay dudas de en qué base estás parado mirando la pantalla.
4. Reiniciar el dev server (`npm run dev`) — Vite solo lee `.env.local` al arrancar.

**Ya no hay fallback hardcodeado:** si `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` faltan, la app tira un error claro al arrancar y no renderiza nada — antes (antes de 2026-08-30) caía silenciosamente a producción, lo cual ahora está prohibido explícitamente. Ver `src/lib/supabase.js`.

## 3. Variables de entorno

Definidas en `.env.local` (no versionado, ignorado por git). Nombres documentados también en `.env.example` (versionado, sin valores). **Acá solo se listan los nombres, no los valores:**

| Variable | Usada en | Propósito |
|---|---|---|
| `VITE_SUPABASE_URL` | `src/lib/supabase.js` | URL del proyecto Supabase (producción o staging, según a cuál se quiera apuntar) |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.js` | Clave pública (anon/publishable) del proyecto Supabase correspondiente |
| `VITE_ENV` | `src/lib/supabase.js` (`VITE_ENV`, `IS_PRODUCTION`) | `production` \| `staging` \| `local` — controla el banner de "ambiente de pruebas" (ver 2.1) |
| `VITE_BRAND_NAME` | `src/lib/helpers.js` | Nombre de marca mostrado en la UI (`VAION`/`VRION`) |
| `VITE_COMPANY_SLUG` | `src/lib/helpers.js` | Empresa a la que se fija este despliegue (`va-constructora`/`vr-asociados`) |

**Notas importantes:**
- **Ya NO hay fallback hardcodeado** (cambiado 2026-08-30 — antes existía un valor de producción hardcodeado en `src/lib/supabase.js` como red de seguridad ante un problema histórico de env vars en el build de Vercel). Ahora, si `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` faltan, la app tira un error explícito al arrancar y no renderiza nada — **nunca vuelve a caer en producción silenciosamente**.
- **Consecuencia directa — verificar Vercel antes de deployar:** como ya no hay red de seguridad, si las env vars de producción llegaran a faltar o borrarse en el proyecto de Vercel, el build seguiría compilando (Vite no ejecuta el código en build time) pero **la app quedaría completamente rota en el navegador de los usuarios** (pantalla en blanco). Antes de cualquier deploy a producción: `vercel env ls` (o el dashboard de Vercel → Settings → Environment Variables) y confirmar que `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y **`VITE_ENV=production`** están cargadas en el entorno Production. Si `VITE_ENV` faltara ahí, la app en producción mostraría el banner de "ambiente de pruebas" a los clientes reales — igual de grave visualmente aunque no rompa la conexión a datos.
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
