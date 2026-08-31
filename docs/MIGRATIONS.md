# MIGRATIONS.md — Flujo de migraciones de base de datos (VAION)

## Regla número uno

**Ningún cambio de esquema (tabla, columna, función, policy RLS, índice, trigger) se aplica nunca más directo en el SQL Editor del Dashboard de Supabase.** Todo cambio pasa por una migración versionada en `supabase/migrations/`, commiteada a git. El Dashboard queda solo para lectura/consulta y para operaciones que no son DDL (ver "Excepciones" al final).

**Por qué:** la base real llevaba meses divergiendo de los `.sql` versionados en el repo porque los cambios se aplicaban a mano en el Dashboard (ver `docs/DATABASE.md`, sección "Nota metodológica"). El 2026-08-30 se cerró esa brecha con un baseline generado por `supabase db pull` (`supabase/migrations/20260830205325_baseline_produccion.sql`) — este documento existe para que no se vuelva a abrir.

## Setup (una sola vez por máquina)

- Docker Desktop instalado y corriendo (`supabase db pull`/`db diff`/`db push`/`db reset` lo necesitan para levantar una base "shadow" local).
- Supabase CLI instalado (`brew install supabase/tap/supabase` o el cask; en esta máquina: Homebrew).
- El repo se vincula (`supabase link --project-ref <ref>`) a **un solo proyecto a la vez** — el ref activo queda en `supabase/.temp/project-ref` (no versionado). Por defecto, el día a día de desarrollo se hace con **staging** linkeado, no producción (ver sección siguiente). El password de la base **no** se guarda en el repo; se pide interactivamente o se pasa por variable de entorno en el momento.

## Ambientes: producción vs staging

Hay dos proyectos Supabase (detalle completo en `docs/INFRASTRUCTURE.md` sección 2.1):

| | Ref | Uso |
|---|---|---|
| **Producción (VAION)** | `ffxexpasoneowquvtouz` | Datos reales de un cliente pagado. Solo se linkea **momentáneamente** para el paso final de aplicar una migración ya probada. |
| **Staging (`vaion-staging`)** | *(ver `.env.local`/Pedro)* | Datos 100% ficticios (`supabase/seed.sql`). Acá se prueba todo — se puede resetear las veces que haga falta. |

**Regla de oro:** antes de correr cualquier comando de escritura (`db push`, `db reset` contra `--linked`, `db query` con `-f`), verificar con `cat supabase/.temp/project-ref` (o `supabase migration list --linked`, que también lo muestra) **a qué proyecto está linkeado el CLI en este momento**. Si hay cualquier duda, preguntar antes de ejecutar — no asumir.

**Cambiar el proyecto linkeado:**
```
supabase link --project-ref <ref-de-staging-o-produccion>
```

## Crear una migración nueva

1. Escribir el cambio como SQL plano en un archivo nuevo:
   ```
   supabase migration new nombre_descriptivo_del_cambio
   ```
   Esto crea `supabase/migrations/<timestamp>_nombre_descriptivo_del_cambio.sql` vacío — escribir ahí el DDL (`CREATE TABLE`, `ALTER POLICY`, etc.).

   Alternativa para cambios más grandes o cuando ya se probó el cambio a mano en una base local: usar `supabase db diff --local -f nombre_del_cambio` (ver paso de prueba abajo) para que la migración se genere sola comparando contra la base local.

2. **No editar migraciones ya commiteadas y ya aplicadas a producción.** Si algo quedó mal, se corrige con una migración nueva que revierte o ajusta lo anterior — nunca reescribiendo el archivo viejo (rompe el historial de quien ya la corrió).

## Flujo completo: cambio → migración → staging → probar → producción

**1. Cambio local (Docker), iteración rápida:**
```
supabase db reset        # recrea la base LOCAL (Docker) desde cero: migraciones + supabase/seed.sql
```
Correr la app apuntando a la base local (`supabase status` da la URL/anon key locales) y verificar que el cambio funciona como se espera — RLS incluido, probando con usuarios de distinto rol si aplica. `db reset` es 100% local — nunca toca ninguna base remota, es seguro correrlo todas las veces que haga falta mientras se itera.

**2. Aplicar a staging (primera base remota real):**
```
supabase link --project-ref <ref-de-staging>
supabase db push --linked
```
Esto aplica **solo** las migraciones nuevas contra `vaion-staging`. Pide confirmación y muestra el SQL exacto antes de ejecutar.

**3. Probar contra staging de verdad:** apuntar `.env.local` a staging (ver `docs/INFRASTRUCTURE.md` 2.1) y probar la app real (no solo Docker local) — sobre todo si el cambio toca algo que Docker no replica 100% igual (Storage, Auth, extensiones). Si el cambio requiere datos nuevos de prueba, ver la sección de `seed.sql` abajo.

**4. Recién ahí, aplicar a producción:**
```
supabase link --project-ref ffxexpasoneowquvtouz
supabase db diff --linked --schema public    # revisar que el diff sea EXACTAMENTE lo esperado, nada más
supabase db push --linked
```
- Confirmar con Pedro antes de este paso — es una escritura real e irreversible, no hay vuelta atrás automática.
- Si el proyecto tiene un tenant gemelo (ver VRION más abajo), decidir explícitamente si el cambio aplica ahí también.
- Después de aplicar, volver a linkear staging (`supabase link --project-ref <ref-de-staging>`) para que el próximo trabajo de desarrollo no quede apuntando a producción por descuido.

## `supabase/seed.sql` — datos ficticios, SOLO staging

Contiene una constructora inventada completa (empresa, usuarios demo, obras, trabajadores con PIN, ~30 días de asistencia, egresos, ingresos, cuentas por pagar/cobrar) — ver el comentario al inicio del archivo para las credenciales de demo. **Nunca contiene, ni debe contener, datos reales de VA Constructora ni VR Asociados.**

- **Local (Docker):** se aplica solo con `db reset` (automático, como cualquier otro `db reset`).
- **Staging remoto:** no hay un "reset remoto" seguro sin querer — para sembrar `vaion-staging` desde cero, la vía es recrear el proyecto o vaciar las tablas manualmente antes de re-correr el seed. Para una carga inicial (proyecto recién creado, vacío): con staging linkeado, `supabase db query --project-ref <ref-de-staging> -f supabase/seed.sql`.
- **Producción:** JAMÁS. El archivo no tiene ninguna protección técnica que lo impida (correr `-f supabase/seed.sql` contra cualquier proyecto linkeado simplemente lo hace) — la única protección es no correrlo ahí nunca, verificando primero a qué proyecto se está apuntando (ver "Regla de oro" arriba).

## VRION (proyecto gemelo, cuenta Supabase distinta)

Este repo hoy solo tiene vinculado (`supabase link`) el proyecto VAION (`ffxexpasoneowquvtouz`). VRION (`sfemjichlximrhcfgwio`) vive en una cuenta de Supabase distinta y **no tiene todavía su propio flujo de migraciones versionado** — sigue recibiendo cambios a mano en su Dashboard, igual que VAION antes de este trabajo.

**Pendiente (no incluido en este trabajo):** repetir el mismo proceso de baseline (`supabase db pull`) para VRION, probablemente en un `workdir`/checkout separado o alternando el link, ya que la CLI solo vincula un proyecto a la vez por `config.toml`. Hasta que eso se haga, cualquier migración nueva creada acá para VAION que también deba aplicarse en VRION se replica a mano (`supabase db push --db-url <connection-string-de-VRION>` es la forma de aplicarla sin cambiar el link activo).

## Excepciones — qué SÍ se puede seguir haciendo desde el Dashboard

- Consultas de solo lectura para debug/soporte.
- Operaciones de datos (`INSERT`/`UPDATE`/`DELETE` sobre filas puntuales, no sobre estructura) cuando son intervenciones manuales de soporte al cliente — no son "esquema".
- Cambios de configuración que no son SQL: Auth (Site URL, Redirect URLs, SMTP), Storage (crear un bucket nuevo desde la UI está bien, pero sus *policies* si son DDL y deberían migrarse igual que cualquier policy de tabla).

Ante la duda de si algo es "esquema" o no: si se puede escribir como una sentencia `CREATE`/`ALTER`/`DROP`, es esquema y va en una migración.

## Ejemplo real: Fase 1 del fix de seguridad (`security_fix_2026-08-28.sql`)

El script del hallazgo de la auditoría RLS (`docs/AUDITORIA.md`) se convirtió en la migración `supabase/migrations/20260830224155_fase1_rls_fix.sql` y se aplicó a producción (VAION) el 2026-08-30 siguiendo este mismo flujo — es el primer caso real de uso de este proceso. Sirve como referencia de cómo se ve un cambio de RLS completo, de punta a punta, versionado. VRION todavía no lo recibió (ver sección VRION).
