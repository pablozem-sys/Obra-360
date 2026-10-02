# Auditoría — Agente de WhatsApp VAION

Alcance: solo lectura de código fuente (`/Users/pedropablozemelman/control-obras-360`). No se tocó producción, no se ejecutó ninguna query de escritura contra Supabase, no se modificó ningún archivo del repo aparte de este reporte.

**Nota de terminología:** el prompt original habla de `company_id`. El código real usa `empresa_id` (`user_companies.empresa_id`, `projects.empresa_id`, `whatsapp_users.empresa_id`, `asistente_uso.empresa_id`) — `grep -rn "company_id" src/ supabase/` → 0 resultados. Este reporte usa `empresa_id`.

## 1. Arquitectura

**Edge Functions:** `asistente-busqueda` (137 líneas, chat in-app, JWT real del usuario, líneas 46-47/64-68 — RLS es la única defensa) y `whatsapp-agente` (663 líneas, webhook de Meta, **service_role** en línea 646 porque un mensaje de WhatsApp no trae JWT). `_shared/asistente-tools.ts` (502 líneas) comparte las 7 tools de búsqueda + `ejecutarTool()` entre ambos canales, con comportamiento distinto según si recibe `empresaId` explícito (líneas 1-12, 292-293).

**Despliegue:** manual, sin CI/CD (`.github/workflows/` solo tiene `keepalive.yml`, un ping a la REST API cada 5 días, no relacionado). `supabase functions deploy <nombre> --project-ref <ref>` corrido a mano. `supabase/config.toml:410-411` — `[functions.whatsapp-agente]` `verify_jwt = false` (única verificación real es la firma HMAC de Meta). **¿VRION?** No — `grep -rln "VRION\|vrion" supabase/functions/` → 0 resultados, consistente con `src/lib/helpers.js:29` (`ASISTENTE_HABILITADO = IS_VAION_BRAND`). NO DETERMINABLE con certeza 100% sin acceso directo — confirmar con `supabase functions list --project-ref sfemjichlximrhcfgwio`.

**Proveedor:** Meta Cloud API directo (Graph API v21.0), no un BSP — envío vía `fetch` a `graph.facebook.com` (`whatsapp-agente/index.ts:293`). **Firma del webhook:** `verificarFirmaMeta()` (líneas 240-253) — HMAC-SHA256 sobre el body crudo (`req.text()`, línea 606, nunca el JSON re-serializado) con `WHATSAPP_APP_SECRET`, comparación en tiempo constante (líneas 250-251). Firma inválida → 401 sin tocar ninguna tabla ni llamar a Anthropic (líneas 608-611). Handshake inicial: líneas 584-594, contra `WHATSAPP_VERIFY_TOKEN`.

**LLM:** `ANTHROPIC_MODEL` env var, default `"claude-opus-5"` (línea 32; el valor real en prod es Sonnet, seteado como secret, no inspeccionable desde el código). `ANTHROPIC_API_KEY` como secret de Supabase, nunca hardcodeada, compartida entre los dos canales.

## 2. Identidad y aislamiento (lo más importante)

**Teléfono → usuario → empresa_id:** resuelto una sola vez por mensaje en `resolverAcceso()` (`whatsapp-agente/index.ts:262-288`). Paso 1: `whatsapp_users` por `phone_e164` exacto — si no existe o `activo=false`, `return null` (línea 269). Paso 2: `user_companies` por `(user_id, empresa_id)` de esa fila — si no hay fila o `rol==='trabajador'`, `return null` (línea 278). El objeto `acceso` resultante queda fijo para toda la conversación (comentario líneas 2-7: "nunca se infieren del mensaje ni los decide el modelo").

**service_role vs JWT:** `whatsapp-agente` usa service_role (sortea RLS por completo) — la única protección es el filtro explícito `empresaId` en cada query. `asistente-busqueda` usa JWT real, RLS es la defensa ahí.

**Tabla de cada consulta** (`_shared/asistente-tools.ts`, `ejecutarTool()` línea 292+):

| Tool | Tabla | Filtro empresa | Línea |
|---|---|---|---|
| buscar_egresos | expenses | `.eq("empresa_id", empresaId)` | 315,318 |
| sumar_egresos | expenses | ídem | 328 |
| buscar_documentos | documents | ídem | 340 |
| buscar_cuentas_por_pagar | accounts_payable | ídem | 353 |
| buscar_cuentas_por_cobrar | accounts_receivable | ídem | 366 |
| buscar_ventas_adicionales | additional_sales | sin `empresa_id` propio → `.in("project_id", ids)` vía `proyectoIdsDeEmpresa()` (256-260) | 383-385 |
| buscar_asistencia_activa | attendance | mismo patrón | 401-403 |
| obtener_resumen_financiero | projects + RPCs | `.eq("empresa_id")` + `p_empresa_id` a ambas RPC; **lanza si falta empresaId** | 414,453,457,477,482 |
| buscar_tareas | tasks | `.eq("empresa_id", empresaId)` | 423 |
| resolverObraId (pre-procesamiento) | projects | `.eq("empresa_id")` si vino | 272-286 |

Caso vacío: si la empresa no tiene proyectos, `.in("project_id", ["00000000-...-000000000000"])` (líneas 385,403) — fuerza 0 filas en vez de traer todo.

**¿`empresa_id` desde texto/LLM?** No encontrado. Ningún `input_schema` de las 9 tools tiene parámetro `empresaId`/similar; `ejecutarTool()` lo recibe solo por `opts` (nunca por `input`); las 3 tools de tareas reciben `acceso.empresaId` como parámetro de función explícito. **Sin BLOQUEANTE acá.**

**Número no registrado:** `whatsapp-agente/index.ts:433-437` — responde *"No tenés acceso a este asistente..."* y corta, sin llamar a Anthropic ni tocar datos de negocio.

## 3. Herramientas del agente

Ninguna tool de lectura (`buscar_*`, `sumar_egresos`, `obtener_resumen_financiero`) escribe nada — `expenses`/`accounts_payable`/`accounts_receivable`/`additional_sales` son 100% lectura en todo `ejecutarTool()`. **Sin BLOQUEANTE por este criterio.**

Las 3 tools de tareas (`crear_tarea`, `cambiar_estado_tarea`, `eliminar_tarea`) **nunca mutan datos cuando el modelo las invoca** — están excluidas a propósito del `switch` de `ejecutarTool()` (si algo las llama por ahí, caen en `throw new Error("Tool desconocida")`, líneas 437-442). Flujo real: el modelo arma una propuesta (`whatsapp-agente/index.ts:128-179`), la guarda en `whatsapp_sesiones.contexto`, y solo el **código** (regex en líneas 451-452, nunca el LLM) decide ejecutar el INSERT/UPDATE/DELETE real tras una confirmación SÍ/NO, repitiendo `.eq("empresa_id", empresaId)` en cada mutación (líneas 203, 218).

`eliminar_tarea` es borrado definitivo sin papelera (`tasks.delete()`, 213-220) — marcado **IMPORTANTE** en riesgos (no BLOQUEANTE, `tasks` no es tabla de montos/pagos/EEPP).

## 4. Prompt y logs

System prompt fijo por canal (no por empresa): `systemPromptWhatsApp()` (`whatsapp-agente/index.ts:306-413`) y `systemPrompt()` (`asistente-busqueda/index.ts:24-40`) — mismo texto para todas las empresas, solo interpolan datos de la sesión actual (nombre, rol, empresa, tools según rol).

Conversaciones: tabla `whatsapp_sesiones` (solo WhatsApp — in-app no guarda historial, cada request es sin estado). Columnas: `phone_e164` (PK), `mensajes` (jsonb, **solo texto limpio**, nunca tool_use/tool_result), `ultima_actividad`, `estado`, `contexto`, `whatsapp_user_id`. RLS: **deny-all**, sin ninguna policy — solo la función con service_role la toca.

Costo/tokens: sí, instrumentado — tabla `asistente_uso` + RPC `log_asistente_uso` + vista `asistente_uso_resumen` (migración `20260922155739`), llamado una vez por respuesta final en ambos canales. RLS: sin policy de INSERT (solo vía RPC), SELECT por allowlist de email (`pablozem@gmail.com`).

## 5. Envíos iniciados por el negocio

**Hoy no se envía nada sin que el usuario escriba primero.** La única función de envío (`enviarWhatsApp`, líneas 291-304) solo se llama desde dentro del loop que procesa mensajes entrantes del webhook — ningún cron/trigger/endpoint adicional la llama. **Sin plantillas de Meta** (`grep -rn "template" supabase/` → 0 resultados de WhatsApp) — el body siempre es `type: "text"` (línea 296), nunca `type: "template"`. Esto importa: sin plantilla aprobada, Meta solo permite texto libre dentro de la ventana de 24h desde el último mensaje del usuario — bloquea cualquier futuro aviso proactivo fuera de esa ventana. **Sin pg_cron/scheduled functions** para el agente (único hit de "cron" es un comentario sin relación en `app_errors`, línea 125 de esa migración).

## 6. Esquema — deriva vs. migraciones

**Sin evidencia de deriva.** `supabase migration list --linked` contra producción (`ffxexpasoneowquvtouz`), corrido antes en esta misma sesión, mostró las 10 migraciones locales con `local`/`remote` coincidiendo exactamente, incluidas las 3 de WhatsApp y la de `asistente_uso`. Esto cubre el historial de versiones, no garantiza ausencia de un cambio suelto por SQL Editor — **NO DETERMINABLE al 100% desde el código**; confirmar con `supabase db diff --linked --schema public` (solo lectura).

## 7. Riesgos priorizados

**BLOQUEANTE:** ninguno encontrado.

**IMPORTANTE:**
1. `eliminar_tarea` es borrado definitivo sin papelera, gateado solo por confirmación SÍ/NO por WhatsApp (líneas 213-220, 170-179).
2. Dedup de reintentos de Meta es en memoria del proceso (`MENSAJES_PROCESADOS`, líneas 43-53) — se resetea en cada cold start; ya documentado como limitación aceptada en el propio código, pero relevante si un reintento coincide con una confirmación de tarea.
3. Sin plantillas de Meta aprobadas — bloquea cualquier mensaje proactivo futuro fuera de la ventana de 24h.
4. No determinable con certeza si está desplegado en VRION (alta confianza que no, sin verificación en vivo).

**MENOR:**
5. Prompt idéntico para todas las empresas, sin personalización de reglas de negocio por tenant.
6. Allowlist de email duplicada en 2 lugares (frontend + policy SQL) para `asistente_uso`/`app_errors` — gotcha ya conocido del proyecto.
