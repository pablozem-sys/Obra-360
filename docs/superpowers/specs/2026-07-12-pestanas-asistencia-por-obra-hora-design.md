# Pestañas Por Obra / Hora Entrada / Hora Salida — Control de Asistencia

**Fecha:** 2026-07-12
**Módulo:** Control de Asistencia (`src/pages/ControlAsistencia.jsx`)
**Aplica a:** VAION y VRION (mismo código, dos despliegues — ver `feedback_deploy_ambas_plataformas` en memoria)

## Contexto

Hoy Control de Asistencia tiene 3 pestañas: **Registros** (tabla plana con filtro de obra y fecha, editar/eliminar turno), **Por Fecha** (rango de fechas, solo lectura) y **Trabajadores** (gestión de trabajadores y asignación a obras).

El cliente pidió poder ver la asistencia organizada de otras formas: agrupada por obra, y ordenada por hora de entrada o de salida. El objetivo es doble: detectar rápido atrasos o salidas tempranas (ordenando por hora), y ver de un vistazo cuánta gente hay en cada obra (agrupando por obra).

## Alcance

Se agregan 3 pestañas nuevas al mismo nivel que las existentes: **Por Obra**, **Hora Entrada**, **Hora Salida**. Quedan 6 pestañas en total: Registros, Por Fecha, Por Obra, Hora Entrada, Hora Salida, Trabajadores.

Las 3 pestañas nuevas:
- Muestran un **solo día** (no un rango), con un selector de fecha **compartido entre las 3** (cambiar el día en una se refleja en las otras al cambiar de pestaña). Default: hoy.
- Permiten **editar y eliminar** un turno directamente, igual que hoy permite "Registros".
- Son independientes del filtro de obra/fecha que el usuario haya dejado configurado en "Registros" — no lo leen ni lo modifican.

Fuera de alcance:
- Rango de fechas en las pestañas nuevas (eso ya lo cubre "Por Fecha").
- Cambios a la pestaña "Por Fecha" existente.
- Cambios al filtro de obra/fecha de "Registros".

## Datos y fetch

Nuevo estado en `ControlAsistencia.jsx`:
- `vistaFecha` (string `YYYY-MM-DD`, default: `HOY`) — fecha compartida por las 3 pestañas nuevas.
- `registrosVista` (array) — resultado de `getAttendance({ fecha: vistaFecha })` (sin `projectId`, trae todas las obras).

Efecto: al montar el componente, o cuando `vistaFecha` cambia, o la primera vez que el usuario entra a cualquiera de las 3 pestañas nuevas, se llama `getAttendance({ fecha: vistaFecha })` y se guarda en `registrosVista`. Las 3 pestañas leen del mismo array y solo cambian cómo lo agrupan/ordenan en el cliente — no hay 3 fetches distintos.

Edición/eliminación desde cualquiera de las 3 pestañas actualiza `registrosVista` en memoria de la misma forma en que "Registros" ya actualiza su propio estado (`setRegistros(prev => prev.map(...))` / `.filter(...)`), sin recargar todo desde el servidor.

## Refactor compartido: `TurnoRow`

La fila de un turno (entrada/salida, botones editar/eliminar, panel de edición inline con entrada/salida/bono) hoy está escrita en línea dentro de la pestaña "Registros" en `ControlAsistencia.jsx`. Como las 3 pestañas nuevas necesitan el mismo comportamiento exacto, se extrae a un componente `TurnoRow` (mismo archivo, sección de subcomponentes al final, siguiendo el patrón ya usado en el archivo — no hace falta un archivo nuevo).

`TurnoRow` recibe: el registro, y callbacks `onGuardar(id, cambios)` / `onEliminar(id)`. No sabe de qué pestaña vino ni en qué estado (`registros` o `registrosVista`) se debe reflejar el cambio — eso lo resuelve quien lo use, pasando el callback correcto.

"Registros" pasa a usar `TurnoRow` en vez de su JSX inline actual (mismo comportamiento visual, sin cambios para el usuario en esa pestaña). Esto evita que un fix futuro en la fila de un turno (como ya pasó con el bono) haya que aplicarlo en 4 lugares distintos.

## Contenido de cada pestaña nueva

### Por Obra

- Una sección por obra, **todas las obras activas de la empresa**, incluidas las que no tuvieron ningún registro ese día (se muestran en 0).
- Orden de las obras: alfabético (mismo criterio que Obras.jsx).
- Encabezado de cada sección: nombre de la obra + resumen del día (N° de trabajadores, horas totales, costo de mano de obra) — se calcula igual que el `costoPorObra` que ya existe en el archivo, pero acotado a `registrosVista` (el día seleccionado) en vez del rango de "Registros".
- Debajo del resumen: lista de `TurnoRow` con los trabajadores de esa obra ese día.

### Hora Entrada

- Lista plana de todos los registros de `registrosVista`, ordenados ascendente por hora de entrada.
- Cada fila (`TurnoRow`) muestra también el nombre de la obra (dato que en "Registros" no hace falta mostrar porque ya está filtrado, pero acá se mezclan varias obras).

### Hora Salida

- Igual que Hora Entrada, ordenado ascendente por hora de salida.
- Los turnos sin salida marcada (turno abierto) van **al final de la lista**, con el mismo indicador "EN OBRA" que ya usa "Registros" en vez de una hora.

## Casos borde

- **Carga:** mientras se pide `getAttendance` para `vistaFecha`, mismo estado de carga (spinner/skeleton) que ya usa "Registros".
- **Día sin ningún registro:** Por Obra muestra todas las obras en 0 (según lo acordado); Hora Entrada/Hora Salida muestran el mismo mensaje de "sin registros" que ya usa "Registros" cuando la lista está vacía.
- **Cambio de fecha en una pestaña nueva:** dispara un solo re-fetch de `registrosVista`, y las otras 2 pestañas nuevas ya quedan actualizadas al cambiar a ellas (mismo estado compartido).

## Testing / verificación

El proyecto no tiene suite de tests automatizados. Verificación manual post-implementación:
1. Con datos de un día con turnos en 2+ obras: confirmar que "Por Obra" agrupa correctamente y el resumen por obra coincide con la suma manual de sus turnos.
2. Confirmar que "Hora Entrada" y "Hora Salida" ordenan correctamente, y que un turno abierto aparece al final en "Hora Salida".
3. Editar y eliminar un turno desde cada una de las 3 pestañas nuevas → confirmar que el cambio se refleja ahí y, al volver a "Registros" (que recarga su propio estado), también aparece correcto.
4. Cambiar `vistaFecha` en una pestaña y confirmar que las otras 2 reflejan el nuevo día al entrar a ellas.
5. Repetir los pasos anteriores en VRION (base y frontend separados) para confirmar que el mismo código funciona igual en ambas plataformas.

## Deploy

Build + deploy en ambas plataformas (VAION y VRION), sin cambios de esquema de base de datos — esta funcionalidad es 100% de frontend, reutiliza `getAttendance`/`actualizarTurno`/`deleteAttendance` ya existentes.
