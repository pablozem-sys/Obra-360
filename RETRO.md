# Retro de sesiones — 2026-10-06

> **Aplicado 2026-10-06:** ítems 1, 2, 3, 6, 7 y 8. Pendientes de decidir: 4, 5, 9.

**Fuente:** las 15 sesiones más recientes de `~/.claude/projects/-Users-pedropablozemelman/` (sin contar la actual), más la sesión del worktree `whatsapp-agente`. Son 16 en total, entre el 07-sep y el 06-oct.
VAION no tiene carpeta de transcripts propia porque las sesiones se abren desde `~`. Por eso los hallazgos mezclan VAION, CCB y WhatsApp.
Cada propuesta pasó por un revisor adversarial. Solo quedan los patrones que aparecen en 2 o más sesiones.

## 1. Tabla

| # | Hallazgo | Evidencia (sesiones) | Acción | Dónde | Costo/beneficio |
|---|---|---|---|---|---|
| 1 | "traeme el proyecto X" relee `project_vaion.md` (800 líneas) y `project_ccb.md` (1144) a pedazos. El resumen "completo" es ruido cuando vienes a pegar una spec | a34b700d, f74c0b81, 09367e57, 59dd43fc, fe697f73, a4ad6550, 85f30abb, ef173843 (project_ccb ×10) | borrar línea + agregar línea (memoria) | `feedback_abrir_vaion.md`. Además, separar el histórico de `project_vaion.md` y `project_ccb.md` en `*_historia.md` | 0 tokens fijos. Ahorra varios miles de tokens por apertura |
| 2 | "guarda todo" se repite como cierre sin una definición de qué hacer | e95e9910 (×4), 0a4fce49, a4ad6550, ef173843, 51d81c37, 59dd43fc | agregar línea | `~/.claude/CLAUDE.md` | ~45 tok/sesión. Evita cierres incompletos (CAMBIOS.md, cosas sin push) |
| 3 | El clasificador bloquea push/deploy/lecturas a producción y Claude reintenta con variantes (hasta 14 veces). Después los comandos que te paso fallan por comillas, directorio equivocado o refs mezclados | 0a4fce49, a4ad6550, ef173843, 23f5accb, bfffe442, 51d81c37, fe697f73 ("dquote", "no such file"), 59dd43fc ("que corro primero y donde") | agregar línea | `~/.claude/CLAUDE.md` | ~40 tok/sesión. Evita entre 7 y 14 reintentos y rondas de copiar y pegar |
| 4 | Secretos pegados en el chat (`ghp_`, `github_pat_`, `sb_secret_`, token de Meta), a veces porque Claude los pidió | e95e9910, 45a18c23, a4ad6550, ef173843, 23f5accb, bfffe442, 59dd43fc | agregar línea + reescribir memoria | `~/.claude/CLAUDE.md` y `feedback_github_push_tokens.md`, que hoy *instruye* pegar el PAT | ~30 tok/sesión. Se descartó un hook porque solo avisaría después de que el secreto ya quedó en el transcript |
| 5 | El PAT de GitHub vence o se revoca y hay que pedir uno nuevo en cada push | 23f5accb, bfffe442, e95e9910, 45a18c23 | descartar (texto). Tarea única | Guardar un token una vez en el keychain (`osxkeychain`); `gh` no está instalado | 0 tokens. Elimina la causa de #4 en el caso de GitHub |
| 6 | `brainstorming` se activa solo, con HARD-GATE, para ajustes chicos o PRDs | 45a18c23, fe697f73 | editar skill (desactivar) | `~/.claude/settings.json` → `skillOverrides.brainstorming: "off"` | Ahorra tokens: saca el skill del listado de cada sesión. Puedes seguir usándolo con `/brainstorming` |
| 7 | El `CLAUDE.md` de VAION está desactualizado: dice URL `vaion-app.vercel.app`, un deploy `--prebuilt` que hoy falla y rutas, tablas y páginas incompletas. Contradice la memoria. Faltan los 3 entornos con ref y cuenta, y la confusión gmail/hotmail se repite | fe697f73, 59dd43fc, bfffe442, a4ad6550, sesión actual | borrar líneas + agregar líneas | `control-obras-360/CLAUDE.md` | El archivo **baja de 3769 a ~2050 bytes** e incorpora los datos correctos |
| 8 | [CCB] Bug de permisos resuelto 4 o 5 veces (mecanismos nuevos sin unificar). UI desplegada sin probar; tú encuentras los solapamientos | 23f5accb, a4ad6550, ef173843, e95e9910 | agregar línea | `panel-control-ccb-supabase/CLAUDE.md` | ~50 tok, solo en sesiones CCB. Se descartó el screenshot obligatorio por sobreingeniería |
| 9 | VRION queda sin deploy porque falta su `.env.local` | fe697f73, 59dd43fc, memoria | descartar (texto). Tarea única | Cargar las env vars en el proyecto Vercel `vrion` | 0 tokens. Ya está en memoria; lo que falta es hacerlo |
| 10 | Mezclar proyectos en una sesión y pedidos sin nombre de proyecto ("lo pendiente de whatsapp") | e95e9910, a4ad6550, bfffe442, 89086d44 | descartar (consejo para ti) | Sección 3 | — |

**Urgente, fuera de la tabla:** en los transcripts quedaron en texto plano tokens de GitHub (`ghp_…`, `github_pat_…`), la `sb_secret_…` de Supabase CCB y el access token de Meta de WhatsApp. **Conviene rotarlos todos.**

## 2. Diffs propuestos

### 2a. `~/.claude/CLAUDE.md` (ítems 2, 3, 4)
Sube de 382 a ~900 bytes. El límite de +10% se respeta en el CLAUDE.md del proyecto (ver 2b, que baja ~45%). En la suma de los dos archivos el resultado es una reducción neta de ~1,2 KB. Si prefieres no tocar el global, estas 3 líneas pueden ir al CLAUDE.md de VAION, pero entonces CCB no las tendría.

```diff
 ## Base de conocimiento (Cerebro)
 ...
 No leas esa carpeta si no te lo pido.
+
+## Cómo trabajar conmigo
+- "guarda todo" = actualizar la memoria del proyecto (estado actual + pendientes), append en CAMBIOS.md si es VAION, commit local, y decirme qué quedó sin pushear/deployar.
+- Si el clasificador bloquea algo contra producción, no reintentes con variantes: dame UN comando para correr con `!`. Todo comando para mí: un bloque copiable, con `cd` absoluto, sin placeholders.
+- Nunca me pidas pegar secretos en el chat: dame el comando para setearlo yo (`! supabase secrets set …`, `! vercel env add …`).
```

### 2b. `control-obras-360/CLAUDE.md` (ítem 7): reemplazo completo, 3769 → ~2050 bytes

```diff
 # VAION — Control Obras 360

-App web de gestión de obras de construcción, deployada en producción.
-
-**URL producción:** https://vaion-app.vercel.app
-**Proyecto Vercel:** pablozem-sys-projects/vaion (vinculado a este directorio)
-**Supabase:** ffxexpasoneowquvtouz.supabase.co
+App web de gestión de obras de construcción. El mismo código sirve a VAION, VRION y staging.
+
+| Entorno | URL | Supabase ref | Cuenta Supabase |
+|---|---|---|---|
+| Producción | https://vaion.app | `ffxexpasoneowquvtouz` | gmail (Pro) |
+| Staging | https://vaion-staging.vercel.app | `mcqeqwcqkcxehwjpggnr` | hotmail (free) |
+| VRION | https://vrion.vercel.app | `sfemjichlximrhcfgwio` | hotmail (free) |
+
+Antes de cualquier SQL o comando `supabase`, confirmar el ref contra esta tabla.

 ## Stack

 - React 18 + Vite + React Router
-- Tailwind CSS + variables CSS propias (dark mode exclusivo)
-- Supabase (auth + DB + RPC)
+- Tailwind + variables CSS de `src/index.css` (dark mode exclusivo; nunca colores Tailwind directos)
+- Supabase (auth + DB + RPC + edge functions)

-## Estructura
-(árbol de 30 líneas con páginas, incompleto)
+## Dónde está cada cosa
+- Rutas y guardas de rol: `src/App.jsx`
+- Funciones de DB: `src/lib/supabase.js` · formatters/constantes: `src/lib/helpers.js`
+- Sesión y rol: `src/context/AuthContext.jsx`
+- Esquema: `supabase/migrations/` (procedimiento en `docs/MIGRATIONS.md`)

 ## Roles

 - `dueno` — acceso total
-- `administrativo` — sin módulos financieros (CuentasCobrar, EstadoResultado, FlujoCaja)
+- `administrativo` — sin CuentasCobrar, EstadoResultado, FlujoCaja ni Usuarios
 - `trabajador` — solo AccesoTrabajador y Asistencia (sesión en localStorage como `vaion_worker_session`)
+- `/monitoreo` — solo admins por email (`ADMIN_EMAILS`)

-## Rutas (App.jsx)
-(tabla de 18 líneas, le faltan 6 rutas)
-
-## Tablas Supabase
-(lista parcial)
+## Reglas
 - Filtros financieros usan `project_id` (no `obraId`)
 - Fecha de asistencia se guarda en hora local (no UTC)
-
-## RPC
-(verify_worker_pin_only)
-
-## Design System
-(variables, fuentes, clases: ya están en index.css y en memoria)

 ## Deploy
-
-```bash
-npx vercel build --prod && npx vercel deploy --prebuilt --prod
-```
-
-Siempre ejecutar desde `/Users/pedropablozemelman/control-obras-360`.
+- Producción: `npx vercel deploy --prod --yes` (build remoto: el build local falla por env vars Sensitive). Un push a `main` también despliega a producción.
+- Staging: `npx vite build && npx vercel deploy ./dist --prod --project vaion-staging --yes`
+- Todo cambio va a VAION **y** VRION.
```

### 2c. `panel-control-ccb-supabase/CLAUDE.md` (ítem 8)

```diff
+## Reglas que ya costaron retrabajo
+- Permisos: usar siempre `es_aprobador_v2()` / `puede_acceder_admin()`. Nunca crear un mecanismo de permisos nuevo.
+- UI nueva o cambiada: probarla en local (desktop y mobile) antes de deployar.
```

### 2d. Memoria (ítems 1 y 4)
- `feedback_abrir_vaion.md`: reemplazar "mostrar el resumen completo" por "leer solo la sección *Estado actual* de `project_vaion.md` y dar ≤5 líneas (URLs, último cambio, pendientes); el detalle solo si lo pido".
- `project_vaion.md` y `project_ccb.md`: dejar arriba un *Estado actual* de ≤60 líneas y mover el histórico a `project_vaion_historia.md` / `project_ccb_historia.md`.
- `feedback_github_push_tokens.md`: quitar el paso "pega el token en el chat". Reemplazarlo por "guardar el token una vez en el keychain con `! git credential-osxkeychain store`".

### 2e. `~/.claude/settings.json` (ítem 6)
```diff
   "skillOverrides": {
+    "brainstorming": "off",
     "autoplan": "off",
```

## 3. Tres cosas que tú podrías cambiar al pedirme las cosas

1. **Una sesión por proyecto.** e95e9910 pasó por CCB, VAION lento y WhatsApp. a4ad6550 y bfffe442 terminaron desplegando VAION desde una sesión de CCB. Al mezclar, el contexto se contamina y se compacta antes.
2. **Nombra el proyecto y lo que esperas al retomar.** "Lo pendiente de whatsapp" (89086d44) tenía 3 candidatos. "VAION: sigamos con vincular cada número a su usuario" ahorra una ronda.
3. **Da los datos de negocio al inicio, no a mitad.** Por ejemplo: quién ve qué módulo en CCB, los 3 teléfonos de prueba para WhatsApp o qué módulos se ocultan "por ahora". Cuando llegan tarde, obligan a rehacer permisos y esquema (ef173843, 59dd43fc, a4ad6550).
