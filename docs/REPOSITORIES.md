# REPOSITORIES.md — VAION / Control Obras 360

## 1. Repositorio

| | |
|---|---|
| **URL** | `https://github.com/pablozem-sys/Obra-360.git` |
| **Directorio local** | `/Users/pedropablozemelman/control-obras-360` |
| **Rama principal** | `main` (única rama existente — no se detectaron ramas de feature/develop activas al momento de este análisis) |
| **Remoto configurado** | `origin` |

### Estrategia de branching

**No hay una estrategia de branching formal en uso.** El historial muestra commits directos a `main` de principio a fin (~55 commits desde el MVP inicial hasta hoy), sin evidencia de pull requests, ramas de feature, ni tags de versión. El flujo observado es: desarrollar y probar localmente → commit a `main` → build y deploy manual a Vercel.

Esto es consistente con un proyecto de un solo desarrollador en etapa MVP/temprana, pero implica:
- No hay revisión de código formal (no PRs).
- No hay forma de revertir a una "última versión estable" salvo por hash de commit.
- El working directory local a menudo tiene cambios sin commitear al momento de deployar (ver `INFRASTRUCTURE.md`), por lo que `main` no siempre refleja exactamente lo que está en producción.

**PENDIENTE DE CONFIRMAR:** si existe algún otro repositorio relacionado (ej. uno para el "Portal Cimiento IA / Polpaico" u otros proyectos del mismo usuario) — este documento cubre exclusivamente el repositorio de VAION / Control Obras 360.

## 2. Dependencias críticas y su propósito

### Producción (`dependencies`)

| Paquete | Versión instalada | Por qué es crítico |
|---|---|---|
| `react` (18.3.1) / `react-dom` (18.3.1) | Motor de UI. Toda la app es componentes React funcionales con hooks. |
| `react-router-dom` (6.30.3) | Ruteo completo de la SPA — sin este paquete no hay navegación entre páginas ni guards de autenticación (`App.jsx` depende de `<Routes>`/`<Route>`/`useNavigate`). |
| `@supabase/supabase-js` (2.104.1) | **La dependencia más crítica del proyecto.** Es el único canal de comunicación con el backend (Auth, Postgres vía PostgREST, Storage, RPC). Si esta librería falla o cambia su API de forma incompatible, la app entera deja de funcionar — no hay capa de abstracción adicional entre `supabase-js` y `src/lib/supabase.js`. |
| `recharts` (2.15.4) | Renderiza los gráficos de `FlujoCaja.jsx` y `EstadoResultado.jsx`. Sin él, esas dos páginas (exclusivas de dueño) no podrían mostrar sus visualizaciones. |
| `date-fns` (3.6.0) | Utilidades de manejo de fechas. Uso relativamente acotado — la mayoría del formateo de fechas de la app está implementado a mano en `helpers.js` (`formatDate`, `formatDateShort`) sin depender de esta librería. |
| `lucide-react` (0.441.0) | Todo el set de íconos de la interfaz (botones, badges, navegación). Un cambio de versión mayor podría romper imports de íconos específicos si se renombran. |

### Desarrollo (`devDependencies`)

| Paquete | Versión instalada | Por qué es crítico |
|---|---|---|
| `vite` (5.4.21) | Bundler y dev server. Sin él no hay `npm run dev` ni `npm run build`. |
| `@vitejs/plugin-react` (4.7.0) | Habilita JSX y Fast Refresh dentro de Vite. |
| `vite-plugin-pwa` (1.2.0) | Genera el manifest PWA y el service worker — su configuración vive en `vite.config.js` (estrategias de cache, qué se precachea). Un cambio de versión mayor puede alterar el comportamiento de cache offline (relevante para el bug conocido de sesión/cache — ver `RUNBOOK.md`). |
| `tailwindcss` (3.4.19) / `autoprefixer` (10.5.0) / `postcss` (8.5.10) | Todo el sistema visual de la app usa clases de Tailwind + variables CSS propias (`src/index.css`). Sin estas tres, no se genera el CSS final. |

### Lo que NO está presente (y es relevante notarlo)

- **Ningún framework/librería de testing** (`jest`, `vitest`, `@testing-library/*`, `playwright`, `cypress`) — no hay tests automatizados en el proyecto.
- **Ningún linter/formateador configurado** (`eslint`, `prettier`) — no hay `.eslintrc*` ni `.prettierrc*` en el repo, ni scripts de `lint`/`format` en `package.json`.
- **Ningún ORM** (Prisma, Drizzle, etc.) — el acceso a datos es 100% vía el cliente JS de Supabase con queries encadenadas (`supabase.from(...).select(...)`).
- **TypeScript no está instalado** — el proyecto es JavaScript puro (`.jsx`).

## 3. Scripts disponibles (`package.json`)

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

| Script | Comando | Qué hace |
|---|---|---|
| `npm run dev` | `vite` | Levanta el servidor de desarrollo local con hot module replacement. Por defecto en `http://localhost:5173` (Vite intenta el siguiente puerto libre si ya está ocupado, ej. `5174`). |
| `npm run build` | `vite build` | Genera el build de producción en `dist/` — bundle JS/CSS optimizado + manifest y service worker de la PWA. Es el comando que corre `npx vercel build --prod` internamente. |
| `npm run preview` | `vite preview` | Sirve localmente el contenido ya buildeado de `dist/`, para verificar el build de producción antes de deployar. **No se observó evidencia de que este comando se use activamente en el flujo de trabajo actual** (el flujo real usa `vercel build` + `vercel deploy --prebuilt`, no `vite build` + `vite preview`). |

No existen scripts `test`, `lint`, `typecheck`, `format`, ni ningún script custom adicional.
