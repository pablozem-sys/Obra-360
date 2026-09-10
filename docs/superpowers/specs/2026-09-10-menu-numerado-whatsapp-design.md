# Menú numerado + memoria de sesión en el asistente de WhatsApp

**Fecha:** 2026-09-10
**Estado:** Aprobado por Pedro, pendiente de implementar
**Contexto:** mejora sobre el piloto interno del agente de WhatsApp (ver
memoria `project_vaion_whatsapp`), que hoy funciona en staging pero es
completamente *stateless* — cada mensaje entra sin historial de conversación.

## Problema

Pedro pidió que el bot ofrezca un menú numerado de opciones de búsqueda
(ej. "1. Egresos, 2. Documentos...") y que el usuario pueda responder solo
con el número, en vez de tener que escribir en lenguaje natural cada vez.

Para que "responder con el número" funcione, el bot necesita recordar qué
menú le mostró en el mensaje anterior — hoy no tiene esa memoria:
`procesarMensaje` arma `messages = [{role: 'user', content: texto}]` desde
cero en cada invocación (`supabase/functions/whatsapp-agente/index.ts`).

## Decisiones (confirmadas con Pedro)

1. **Memoria de sesión en el proceso** (no tabla nueva en Supabase). Mismo
   patrón ya aceptado en este archivo para el dedup de reintentos de Meta
   (`MENSAJES_PROCESADOS`): un `Map` en memoria, con el trade-off conocido
   de que si la función se reinicia (cold start) se pierde el contexto —
   aceptable para un piloto interno de bajo volumen.
2. **El menú aparece siempre que empieza una conversación nueva** (primera
   interacción del día con ese número), pero no es obligatorio — si el
   primer mensaje del día ya es una pregunta clara, el bot la responde y
   agrega el menú al final.
3. **Después de elegir una opción, el bot pregunta el filtro** (obra, mes,
   proveedor, etc.) antes de buscar — no trae resultados genéricos de una.
4. **"Conversación nueva" = otro día** (hora de Chile). El menú se vuelve a
   mostrar recién al día siguiente, no por inactividad de minutos/horas
   dentro del mismo día.
5. **La interpretación de "el usuario eligió la opción 1" la hace el
   modelo**, no código rígido — como el historial de conversación queda
   disponible, el modelo ve su propio mensaje anterior con el menú y
   entiende la referencia. No hay una tabla de mapeo número→tool en JS.

## Diseño técnico

### 1. Sesión en memoria

```ts
type Sesion = {
  mensajes: Anthropic.MessageParam[]; // solo texto limpio, sin tool_use/tool_result
  fecha: string; // YYYY-MM-DD, hora de Chile
};
const SESIONES = new Map<string, Sesion>();
const MAX_SESIONES = 50; // mismo espíritu que MAX_DEDUP, evita crecimiento sin límite
const MAX_MENSAJES_SESION = 12; // últimos 6 intercambios usuario/bot
```

Eviction del `Map` por orden de inserción, igual patrón que
`MENSAJES_PROCESADOS` (borra la entrada más vieja cuando se pasa de
`MAX_SESIONES`).

**Por qué solo texto limpio, nunca bloques de tool_use/tool_result:** si se
guardara el detalle interno de las tools llamadas en turnos anteriores, y
después se recorta el historial para no crecer infinito, se podría cortar
a la mitad un par `tool_use`/`tool_result` — eso rompe la próxima llamada a
la API de Anthropic (un `tool_use` colgante sin su resultado). Guardando
solo el texto final de cada turno (lo que el usuario escribió + lo que el
bot respondió en texto plano), el recorte es siempre seguro.

### 2. Función de fecha en hora de Chile

```ts
function fechaChile(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(d);
}
```

Se reemplaza el cálculo actual de `hoy` (que usa `new Date().toISOString().split("T")[0]`,
en UTC) por `fechaChile()` — mismo tipo de corrección de huso horario ya
aplicada antes en Control de Asistencia. Se usa tanto para "Fecha de hoy"
en el system prompt como para decidir si es una sesión nueva.

### 3. Construcción del menú (determinístico, en código)

```ts
function construirMenu(rol: string): string {
  const opciones = [
    "1. Egresos",
    "2. Documentos",
    "3. Cuentas por pagar",
    "4. Cuentas por cobrar",
    "5. Ventas adicionales",
  ];
  if (rol === "dueno") {
    opciones.push("6. Resumen financiero (Venta, CDO, MOD, GAV, Margen, Utilidad)");
  }
  return opciones.join("\n");
}
```

### 4. Flujo en `procesarMensaje`

1. Calcular `fechaHoy = fechaChile()`.
2. Buscar sesión existente para `from` en `SESIONES`.
3. `esSesionNueva = !sesion || sesion.fecha !== fechaHoy`.
4. Si es nueva, `sesion = { mensajes: [], fecha: fechaHoy }`.
5. Construir el `system` prompt (ver punto 5) incluyendo `esSesionNueva` y,
   si aplica, el texto del menú (`construirMenu(acceso.rol)`).
6. Armar `messages` para la llamada a Anthropic como
   `[...sesion.mensajes, {role: 'user', content: texto}]` — el historial
   previo (limpio) más el mensaje nuevo.
7. Correr el loop de tool-use existente **sin cambios** (usa una copia
   local de `messages` que sí acumula tool_use/tool_result durante la
   ronda, igual que hoy).
8. Al terminar, con `respuestaTexto` ya resuelto: agregar a
   `sesion.mensajes` (no a la copia local con tools) el par
   `{role: 'user', content: texto}` + `{role: 'assistant', content: respuestaTexto}`,
   recortar a los últimos `MAX_MENSAJES_SESION`, y guardar
   `SESIONES.set(from, sesion)` (con eviction si corresponde).

### 5. Ajuste al system prompt

Se agrega a `systemPromptWhatsApp(hoy, rol, esSesionNueva, menuTexto)`:

```
${esSesionNueva ? `Es la primera vez que te escribe hoy. Saludalo brevemente y mostrale este menú de opciones:\n${menuTexto}\nSi su mensaje ya es una pregunta clara, respondela primero y agregá el menú al final.` : ""}
Si el usuario responde solo con un número, interpretalo como la opción de ese número del último menú que le mostraste en esta conversación. Antes de buscar, preguntale el filtro que corresponda (obra, mes, proveedor) salvo que ya lo haya dado.
Si en cualquier momento escribe "menu" o "ayuda", volvé a mostrarle el menú de opciones.
```

## Qué NO cambia

- El dedup de reintentos de Meta (`MENSAJES_PROCESADOS`) — estructura
  independiente, no se toca.
- `resolverAcceso` — se sigue resolviendo una vez por mensaje, sin cambios.
- Las tools y sus permisos por rol (`TOOLS_BUSQUEDA` / `TOOL_RESUMEN_FINANCIERO`).
- RLS y aislamiento por empresa — sin cambios, todo lo nuevo vive en memoria
  del proceso, no toca la base de datos.
- El resto de la app (asistente in-app, `asistente-tools.ts` compartido) —
  sin cambios, este trabajo es exclusivo de `whatsapp-agente/index.ts`.

## Fuera de alcance (explícito)

- Persistencia real de conversación (tabla en Supabase) — descartada para
  este piloto, ver decisión 1.
- Botones nativos de WhatsApp (listas interactivas / quick replies) — se
  mantiene todo en texto plano, consistente con el resto del bot.
- Cambios al asistente in-app (web) — esto es exclusivo del canal WhatsApp.
