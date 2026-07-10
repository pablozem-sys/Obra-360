# Editar turno completo, eliminar turno y bono por día — Control de Asistencia

**Fecha:** 2026-07-09
**Módulo:** Control de Asistencia (`src/pages/ControlAsistencia.jsx`, tab "Registros")
**Aplica a:** VAION y VRION (mismo código, dos despliegues — ver `feedback_deploy_ambas_plataformas` en memoria)

## Contexto

Hoy, en la tabla "Registros" de Control de Asistencia, cada fila de un turno (registro de asistencia) solo permite:
- Editar la hora de **salida**, y solo si el turno todavía no la tiene (turno abierto).
- No existe forma de editar la hora de **entrada** una vez creado el registro.
- No existe forma de **eliminar** un turno.
- No existe forma de agregar un **monto extra ("bono")** al costo de un turno específico.

El cliente pidió las tres cosas. Se resuelven juntas porque comparten la misma superficie de UI (la fila de un turno) y el mismo flujo de guardado.

## Alcance

- Editar entrada y salida de **cualquier** turno (abierto o cerrado).
- Eliminar un turno, con confirmación — **solo** desde la tabla "Registros" (no desde la vista "Por Fecha").
- Agregar un bono opcional (monto en CLP) por turno, que se suma al costo calculado por horas.
- El bono es un monto que se ingresa manualmente **por turno**, no un valor recurrente configurado por trabajador.

Fuera de alcance (explícitamente descartado en la conversación de diseño):
- Editar/eliminar turnos desde la vista "Por Fecha".
- Bono automático/recurrente por trabajador.
- Bonos negativos (descuentos) — el campo es solo para montos positivos.

## Modelo de datos

Nueva columna en `attendance` (ambas bases: VAION `ffxexpasoneowquvtouz` y VRION `sfemjichlximrhcfgwio`):

```sql
ALTER TABLE public.attendance ADD COLUMN bono numeric DEFAULT 0;
```

Se aplica vía la Management API de Supabase (mismo mecanismo usado para migrar el esquema de VRION — no requiere Docker/pg_dump, solo el Personal Access Token de cada cuenta).

## Cambios en `src/lib/supabase.js`

1. **`getAttendance`**: agregar `bono` al `select`.

2. **Nueva función `actualizarTurno(attendanceId, { horaEntrada, fecha, horaSalida, valorHora, bono })`** — reemplaza a `actualizarSalidaManual`. Reconstruye `entrada` y `salida` como ISO con el offset local (mismo patrón que ya usa `registrarAsistenciaManual`), recalcula:
   ```js
   horasTrabajadas = round((salida - entrada) / 3600000, 2)
   costoHoras = horasTrabajadas >= 8 ? valorHora : round((horasTrabajadas / 8) * valorHora)
   costoTotal = costoHoras + (bono || 0)
   ```
   Si `horaSalida` es null (turno se deja abierto), `horas_trabajadas`/`costo_total` quedan `null` como hoy — el bono no se aplica hasta que el turno tenga salida (evita un costo parcial confuso mientras el trabajador sigue en obra).

3. **Nueva función `deleteAttendance(attendanceId)`** — `DELETE FROM attendance WHERE id = attendanceId` vía el cliente Supabase, sin RPC (no tiene tablas dependientes, a diferencia de `delete_obra`/`delete_worker`).

4. **`registrarAsistenciaManual`**: agregar parámetro opcional `bono`, sumado a `costoTotal` con la misma fórmula, para poder ingresar el bono también al crear el turno manualmente (no solo al editarlo después). El formulario "Registrar manual" (Registros → botón "Registrar manual") agrega un input opcional de Bono junto a los campos existentes, para que esta función no quede con un parámetro sin forma de completarlo desde la UI.

`actualizarSalidaManual` se elimina del código — `actualizarTurno` la reemplaza por completo y es el único call site existente (`handleGuardarSalida` en `ControlAsistencia.jsx`).

## Cambios en `src/pages/ControlAsistencia.jsx` (tab Registros)

**Panel de edición (reemplaza el actual "editar salida"):**
Al hacer click en el lápiz de una fila, se expande un panel debajo con:
- `TimePicker` para **Entrada** (ya existe el componente, se reutiliza)
- `TimePicker` para **Salida** (opcional — si se deja vacío, el turno queda abierto)
- Input numérico **Bono ($)**, opcional, mínimo 0
- Botón **Guardar** → llama a `actualizarTurno`
- Botón cancelar (X), igual que hoy

Se inicializa el panel con los valores actuales del registro (no vacío como hoy), para que editar sea una corrección puntual y no un re-ingreso completo.

**Eliminar turno:**
En la columna de acciones de cada fila, junto al lápiz, un ícono de basurero. Al click, la misma fila muestra un confirm inline ("¿Eliminar? Sí / X") — mismo patrón visual que ya usa `confirmDeleteWorkerId` en la tab Trabajadores. Confirmar llama a `deleteAttendance` y quita la fila del estado local sin recargar toda la tabla.

**Mostrar el bono en la columna Costo:**
Cuando `bono > 0`, debajo del monto de Costo se agrega una línea chica: `+ $X bono` (mismo estilo que los subtextos ya usados en DetalleObra, ej. "Base $X + $Y adicional"). No se agrega una columna nueva a la tabla — evita romper el layout en pantallas angostas (la tabla ya tiene `overflow-x-auto` y varias columnas).

**Validación:**
- Salida debe ser estrictamente posterior a la entrada (mismo chequeo que ya existe en el formulario de registro manual: `manualSalida <= manualEntrada`).
- Bono debe ser `>= 0` si se ingresa (input numérico, sin validación adicional de tope).

## Propagación a cálculos existentes

Ningún otro archivo necesita cambios. Dashboard, EstadoResultado, Egresos y DetalleObra ya calculan Mano de Obra (MOD) sumando `attendance.costo_total` — como el bono queda incluido ahí desde el cálculo en `supabase.js`, se refleja automáticamente en todos los totales existentes sin tocarlos.

## Testing / verificación

El proyecto no tiene suite de tests automatizados (confirmado en tareas previas). Verificación manual post-implementación:
1. Editar un turno cerrado: cambiar entrada, salida y agregar bono → confirmar que Horas y Costo se recalculan bien, y que el subtexto de bono aparece.
2. Editar un turno abierto (sin salida): solo cambiar la entrada → confirmar que sigue mostrando "EN OBRA" y no se le asigna costo.
3. Eliminar un turno → confirmar que desaparece de la tabla y que los totales de Dashboard/Egresos bajan en consecuencia.
4. Repetir los 3 pasos anteriores en VRION (base y frontend separados) para confirmar que el mismo código funciona igual en ambas plataformas.

## Deploy

Igual que toda tarea de código en este proyecto: aplicar el `ALTER TABLE` en ambas bases (VAION y VRION), y hacer build + deploy en ambas plataformas (ver `feedback_deploy_ambas_plataformas` en memoria para el patrón exacto de deploy de VRION).
