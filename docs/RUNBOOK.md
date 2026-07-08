# RUNBOOK.md — VAION / Control Obras 360

## 1. Levantar el proyecto en local

### Requisitos previos

- Node.js instalado (versión no fijada explícitamente en `package.json` — no hay campo `engines`. **PENDIENTE DE CONFIRMAR** versión mínima recomendada; usar una LTS reciente compatible con Vite 5, ej. Node 18+).
- Acceso al proyecto de Supabase (`ffxexpasoneowquvtouz`) — no hace falta cuenta propia de Supabase para correr localmente, solo la URL y la anon key (ver paso 3). No existe un proyecto de Supabase separado para desarrollo — local y producción apuntan **al mismo backend**.

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/pablozem-sys/Obra-360.git
cd Obra-360   # o el nombre de carpeta que corresponda

# 2. Instalar dependencias
npm install

# 3. Crear el archivo de variables de entorno
# (no versionado — crear manualmente en la raíz del proyecto)
touch .env.local
```

Contenido de `.env.local` (nombres exactos, obtener los valores desde el Dashboard de Supabase → Settings → API, o pedírselos a quien administre el proyecto):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

> Si se omite este archivo, la app igualmente arrancará apuntando al proyecto de producción, porque `src/lib/supabase.js` tiene un fallback hardcodeado a la misma URL/key (ver `INFRASTRUCTURE.md`). **Esto significa que correr en local sin querer puede escribir datos reales de producción** — tener cuidado al probar creación/borrado de datos localmente.

```bash
# 4. Levantar el servidor de desarrollo
npm run dev
```

Por defecto Vite sirve en `http://localhost:5173`. Si el puerto está ocupado (ej. por otra instancia ya corriendo), Vite salta automáticamente al siguiente puerto libre (`5174`, `5175`, ...) — revisar el output de la terminal para confirmar el puerto real.

### Login para probar

- **Admin/dueño:** usar un email/contraseña real ya existente en el proyecto de Supabase (no hay modo "usuario de prueba" ni seed de datos local).
- **Kiosco de trabajador:** ir a `/trabajador` e ingresar el PIN de 4 dígitos de un trabajador activo existente.

## 2. Cómo correr los tests

**No hay tests automatizados en este proyecto.** No existe ningún framework de testing instalado (`jest`, `vitest`, `@testing-library/*`, `playwright`, `cypress`), no hay archivos `*.test.*`/`*.spec.*`, y no hay script `test` en `package.json`.

La verificación de cambios en este proyecto se ha hecho históricamente de forma manual: correr `npm run dev`, navegar la app, y para QA más riguroso, automatización de navegador ad hoc (Playwright vía herramientas externas al repo) durante sesiones de desarrollo — no como una suite de tests versionada.

**Si se quiere agregar testing:** dado que es un proyecto Vite + React sin TypeScript, la ruta de menor fricción sería `vitest` (integra nativamente con la config de Vite) + `@testing-library/react` para componentes, y quizás Playwright para flujos E2E críticos (login, subir egreso, marcar asistencia).

## 3. Build y verificación local del build de producción

```bash
npm run build      # genera dist/
npm run preview    # sirve dist/ localmente para revisar antes de deployar
```

(Nota: el flujo real de deploy usa `npx vercel build --prod` + `npx vercel deploy --prebuilt --prod`, no `npm run build` + `npm run preview` — ver `INFRASTRUCTURE.md`. `npm run preview` sirve como verificación rápida pero no es el paso que efectivamente se usa antes de cada deploy.)

## 4. Problemas comunes y soluciones

### 4.1 "No veo mis cambios" después de deployar (PWA / Service Worker)

**Síntoma:** se deployó un cambio, pero el usuario sigue viendo la versión vieja de la app.

**Causa:** la app es una PWA con service worker (`vite-plugin-pwa`) que precachea todos los assets. Aunque `registerType: 'autoUpdate'` está configurado, el navegador puede tardar en detectar y aplicar la actualización.

**Solución:**
- **Desktop:** hard refresh (`Cmd+Shift+R` en Mac). Si persiste: DevTools → Application → Service Workers → "Unregister" → recargar.
- **Mobile / PWA instalada:** cerrar completamente la app (no solo minimizar) y reabrir. Si persiste: borrar datos de sitio/caché para `vaion.app`, o desinstalar y reinstalar el acceso directo.

### 4.2 Pérdida de sesión al navegar con recarga completa — **RESUELTO (2026-07-08)**

**Síntoma:** el usuario tenía una sesión válida, pero al hacer una recarga completa de página (no un link interno de la app) terminaba en la Landing como si no estuviera logueado. Reproducido repetidamente tanto en local como en producción.

**Causa raíz que tenía el código** (`src/context/AuthContext.jsx`):

```js
const timeout = setTimeout(() => setLoading(false), 5000)
const sessionPromise = supabase.auth.getSession()
const fallback = new Promise(r => setTimeout(() => r({ data: { session: null } }), 4000))

Promise.race([sessionPromise, fallback]).then(async ({ data: { session: s } }) => {
  ...
})
```

Si `supabase.auth.getSession()` tardaba **más de 4 segundos** en resolver (red lenta, cold start, lo que sea), la carrera (`Promise.race`) la ganaba el `fallback`, que resolvía con `session: null` — y la app trataba al usuario como si no tuviera sesión, aunque sí la tenga. Era una condición de carrera, no una expiración de sesión real.

**Fix aplicado:** se eliminó el `fallback` que asumía "sin sesión". Ahora se espera la respuesta real de `getSession()` sin límite artificial; un timeout de seguridad (15s) solo apaga el spinner en el caso extremo de que la promesa nunca resuelva, sin asumir "sin sesión" en ningún caso. Verificado con 3 recargas completas consecutivas a rutas distintas manteniendo sesión activa (antes fallaba de forma consistente).

### 4.3 Subida de documentos falla con "new row violates row-level security policy"

**Síntoma:** al subir cualquier archivo (Obras, Subir Egreso, Venta Adicional), falla.

**Causa:** el bucket de Storage `documents` no tenía política RLS de `INSERT` para usuarios autenticados (bug histórico, resuelto el 2026-07-08).

**Solución ya aplicada** (ver `DATABASE.md` para el SQL exacto) — si vuelve a ocurrir, revisar primero **Supabase Dashboard → Storage → Policies** para el bucket en cuestión antes de asumir que es un bug de código.

### 4.4 Un documento subido no aparece en Biblioteca

**Síntoma:** el archivo se subió (no hay error visible), pero no aparece en `/documentos`.

**Causa:** Biblioteca lee exclusivamente de la tabla `documents`. Solo el flujo de "Subir documento" en `Obras.jsx` insertaba ahí automáticamente; "Subir Egreso" y "Venta Adicional" guardaban el archivo en su propio registro (`expenses.documento_url` / `additional_sales.documento_url`) pero no creaban la fila espejo en `documents` (bug histórico, resuelto el 2026-07-08 — ver `DATABASE.md`, sección "Documentos").

**Si aparece de nuevo con un flujo nuevo:** cualquier código nuevo que llame a `uploadDocumento()` debe llamar también a `createDocumento()` inmediatamente después.

### 4.5 Un usuario nuevo no ve ningún dato a pesar de tener acceso

**Síntoma:** usuario recién agregado a una empresa no ve obras/egresos/etc., aunque figura en `user_companies`.

**Causa histórica:** la función RLS `is_dueno()` solo revisaba `users.rol`, no `user_companies.rol` (rol específico por empresa). Ver `DATABASE.md` para el fix aplicado.

**Cómo diagnosticar:** comparar `users.rol` (global) vs `user_companies.rol` (por empresa) para ese usuario — si difieren y el usuario debería tener acceso de dueño en esa empresa específica, confirmar que la versión parcheada de `is_dueno()` (la que revisa ambas tablas) sigue siendo la que corre en Supabase.

### 4.6 El deploy no refleja lo último commiteado (o refleja cambios sin commitear)

**Causa:** `vercel build` empaqueta el working directory tal cual está en el momento del build, no `git HEAD`. Ver `INFRASTRUCTURE.md`.

**Antes de deployar:** correr `git status` para saber exactamente qué se va a incluir, sobre todo si hay trabajo en curso sin terminar en otros archivos del repo.

### 4.7 Variables de entorno no disponibles en el build de Vercel

**Historial:** en algún punto las variables `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` no se propagaban correctamente al build en Vercel, lo que llevó a hardcodear un fallback en el código (`src/lib/supabase.js`). Si se necesita cambiar de proyecto de Supabase en el futuro, **hay que actualizar tanto las variables de entorno en Vercel como el fallback hardcodeado en el código** — actualizar solo uno de los dos deja el sistema en un estado inconsistente entre local y producción, o entre distintos deploys.
