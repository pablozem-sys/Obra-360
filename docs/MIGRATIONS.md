# MIGRATIONS.md — Flujo de migraciones de base de datos (VAION)

## Regla número uno

**Ningún cambio de esquema (tabla, columna, función, policy RLS, índice, trigger) se aplica nunca más directo en el SQL Editor del Dashboard de Supabase.** Todo cambio pasa por una migración versionada en `supabase/migrations/`, commiteada a git. El Dashboard queda solo para lectura/consulta y para operaciones que no son DDL (ver "Excepciones" al final).

**Por qué:** la base real llevaba meses divergiendo de los `.sql` versionados en el repo porque los cambios se aplicaban a mano en el Dashboard (ver `docs/DATABASE.md`, sección "Nota metodológica"). El 2026-08-30 se cerró esa brecha con un baseline generado por `supabase db pull` (`supabase/migrations/20260830205325_baseline_produccion.sql`) — este documento existe para que no se vuelva a abrir.

## Setup (una sola vez por máquina)

- Docker Desktop instalado y corriendo (`supabase db pull`/`db diff`/`db push` lo necesitan para levantar una base "shadow" local).
- Supabase CLI instalado (`brew install supabase/tap/supabase` o el cask; en esta máquina: Homebrew).
- Repo ya vinculado al proyecto de producción (`supabase link --project-ref ffxexpasoneowquvtouz`) — solo hace falta una vez, el ref queda en `supabase/config.toml` (no es secreto). El password de la base **no** se guarda en el repo; se pide interactivamente o se pasa por variable de entorno en el momento.

## Crear una migración nueva

1. Escribir el cambio como SQL plano en un archivo nuevo:
   ```
   supabase migration new nombre_descriptivo_del_cambio
   ```
   Esto crea `supabase/migrations/<timestamp>_nombre_descriptivo_del_cambio.sql` vacío — escribir ahí el DDL (`CREATE TABLE`, `ALTER POLICY`, etc.).

   Alternativa para cambios más grandes o cuando ya se probó el cambio a mano en una base local: usar `supabase db diff --local -f nombre_del_cambio` (ver paso de prueba abajo) para que la migración se genere sola comparando contra la base local.

2. **No editar migraciones ya commiteadas y ya aplicadas a producción.** Si algo quedó mal, se corrige con una migración nueva que revierte o ajusta lo anterior — nunca reescribiendo el archivo viejo (rompe el historial de quien ya la corrió).

## Probar una migración antes de tocar producción

```
supabase db reset        # recrea la base LOCAL (Docker) desde cero aplicando todas las migraciones en orden
```
Correr la app apuntando a la base local (`supabase status` da la URL/anon key locales) y verificar que el cambio funciona como se espera — RLS incluido, probando con usuarios de distinto rol si aplica.

`supabase db reset` es 100% local — nunca toca producción, es seguro correrlo todas las veces que haga falta mientras se itera.

## Aplicar la migración a producción

Cuando ya se probó localmente y se está listo para producción:

```
supabase db push --linked
```

Esto aplica **solo** las migraciones nuevas (las que todavía no están en el historial remoto) contra la base de producción, en orden. Pide confirmación antes de ejecutar y muestra el SQL exacto que va a correr.

**Antes de correr `db push`:**
- Correr `supabase db diff --linked --schema public` primero y revisar que el diff mostrado sea *exactamente* el cambio esperado, nada más.
- Si el proyecto tiene un tenant gemelo (ver más abajo, VRION), decidir explícitamente si el cambio aplica ahí también.
- Avisar en el chat/commit qué se va a aplicar y confirmar antes de correr `db push` contra producción — es una escritura real, no hay vuelta atrás automática.

## VRION (proyecto gemelo, cuenta Supabase distinta)

Este repo hoy solo tiene vinculado (`supabase link`) el proyecto VAION (`ffxexpasoneowquvtouz`). VRION (`sfemjichlximrhcfgwio`) vive en una cuenta de Supabase distinta y **no tiene todavía su propio flujo de migraciones versionado** — sigue recibiendo cambios a mano en su Dashboard, igual que VAION antes de este trabajo.

**Pendiente (no incluido en este trabajo):** repetir el mismo proceso de baseline (`supabase db pull`) para VRION, probablemente en un `workdir`/checkout separado o alternando el link, ya que la CLI solo vincula un proyecto a la vez por `config.toml`. Hasta que eso se haga, cualquier migración nueva creada acá para VAION que también deba aplicarse en VRION se replica a mano (`supabase db push --db-url <connection-string-de-VRION>` es la forma de aplicarla sin cambiar el link activo).

## Excepciones — qué SÍ se puede seguir haciendo desde el Dashboard

- Consultas de solo lectura para debug/soporte.
- Operaciones de datos (`INSERT`/`UPDATE`/`DELETE` sobre filas puntuales, no sobre estructura) cuando son intervenciones manuales de soporte al cliente — no son "esquema".
- Cambios de configuración que no son SQL: Auth (Site URL, Redirect URLs, SMTP), Storage (crear un bucket nuevo desde la UI está bien, pero sus *policies* si son DDL y deberían migrarse igual que cualquier policy de tabla).

Ante la duda de si algo es "esquema" o no: si se puede escribir como una sentencia `CREATE`/`ALTER`/`DROP`, es esquema y va en una migración.

## Nota sobre el fix de seguridad pendiente (Fase 1, `security_fix_2026-08-28.sql`)

El script `supabase/security_fix_2026-08-28.sql` (auditoría RLS iniciada 2026-08-28, ver `docs/AUDITORIA.md`) todavía no se aplicó a producción. Cuando se aplique, **debe hacerse a través de este flujo de migraciones** (`supabase migration new fase1_rls_fix`, pegar el contenido, `db push --linked`) en vez de pegarlo en el SQL Editor del Dashboard — así queda versionado y el baseline no se vuelve a desincronizar el mismo día que se creó.
