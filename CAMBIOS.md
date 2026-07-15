# VAION — Cambios recientes

## Dashboard principal

- **Fila 1:** Venta · Egresos · Utilidad · % Utilidad (4 cards)
- **Fila 2:** Abonos · Costo Directo (CDO) · Mano de Obra (MOD) · Gastos Empresa (GAV)
- **Selector de mes** — filtra todas las métricas por período
- Se eliminaron el gráfico Flujo de Caja y Egresos por Categoría del dashboard (siguen disponibles en sus páginas propias)

---

## Detalle de cada obra

- "Total Gastos" renombrado a **"Costo Total Obra"**
- Se agregaron 2 cards nuevas: **Costo Directo** y **Mano de Obra**
- El grid pasó de 3 a 5 cards: Costo Total · CDO · MOD · Margen · % Margen

---

## Módulo Egresos

- Card principal muestra **Total Egresos** con desglose en 3 columnas: Costo Directo · Mano de Obra · Gastos Empresa (GAV)
- Sección "Total por obra" renombrada a **"Costo Total por Obra"** con subtítulo: *Costo directo de materiales + mano de obra directa (excluye GAV)*
- Cada obra muestra su total + desglose CDO y MOD por separado

---

## Estado de Resultados

- **Venta** → azul
- **CDO** → rojo
- **MOD** → naranja
- **Margen / % Margen** → verde (rojo si negativo)
- Colores aplicados en KPI cards, tabla P&L, gráfico y tabla por obra

---

## Subir Egreso (NuevoGasto) — 2026-05-28

- Medios de pago: eliminado **Cheque**, quedan solo **Al Contado** y **Crédito**
- **3 tipos de egreso** en Step 1 (antes eran 2):
  - **Costo Directo** → materiales, equipos, áridos, retiro escombros, baño químico, flete, otros
  - **Mano de Obra y Subcontratos** → mano de obra, subcontratos (requiere obra)
  - **Gasto General** → GAV sin obra asignada
- Mano de obra y subcontratos se guardan con `grupo = 'Costo Directo de la Obra'` en DB — los cálculos financieros (CDO, Margen, Utilidad) no cambian
- Estado interno cambiado de `isGAV` (boolean) a `tipoEgreso` (`'cdo'` | `'mod'` | `'gav'`)
- Cuando el medio de pago es **Crédito**, aparecen botones de plazo: **1m · 2m · 3m · 6m · 12m** — se guarda en campo `plazo_credito` que CuentasPagar ya usaba para calcular vencimientos

---

## Técnico

- PWA configurada con `skipWaiting` + `clientsClaim` — los nuevos deploys se aplican automáticamente sin necesidad de limpiar caché

## 2026-06-10 — Control y Gestión
- Nueva página `/gestion` accesible para dueno + administrativo
- Tabla de tareas con columnas: Creada / Completada / Obra / Tarea / Estado
- Orden: pendientes más viejos arriba; finalizados más recientes arriba
- Filtros: Todos / Pendiente / Finalizado con contadores
- Acciones: Finalizar / Reabrir / Eliminar (con confirmación inline)
- Modal nueva tarea: texto libre + obra opcional
- Tabla Supabase: `tasks` (id, empresa_id, tarea, obra_id, status, created_at, completed_at)
- Nuevas funciones en supabase.js: getTareas, createTarea, updateTarea, deleteTarea

---

## 2026-07-02 — Rediseño módulo Control de Asistencia

### Fórmula de costo
- Jornada completa cambia de 9h → **8h**
- `costo_total = horas >= 8 ? valor_hora : round((horas / 8) × valor_hora)`
- Tope máximo: 1 día completo aunque se trabajen más de 8h
- Filas con `horas_trabajadas < 8` se marcan en **rojo** (`var(--red-dim)`) en toda la app

### GPS opcional en kiosco trabajador (Asistencia.jsx)
- GPS ya no bloquea el registro — timeout de 5 segundos
- Si no hay ubicación disponible, registra entrada/salida igual sin coordenadas
- Eliminado mensaje de error GPS y el indicador "Ubicación GPS activa" del footer

### Tab "Quincena" → "Por Fecha" (ControlAsistencia.jsx)
- Nueva vista agrupada: **fecha → obra → trabajadores**
- Columnas: Trabajador · Entrada · Salida · Horas · Valor Día · Costo
- Selector de modo: **Por mes** (mes + año) o **Rango** (fecha desde / hasta)
- Filtro adicional por obra
- **Resumen del período** al final: tabla por trabajador con días, horas, total a pagar + total general

### Actualizaciones generales
- Card "Total días" → **"Total horas"** (muestra horas con 1 decimal)
- Columna "Días" en tabla registros → **"Horas"** (ej: `7.5h`)
- Label "Valor día ($)" en formulario nuevo trabajador
- Costo estimado en formulario manual usa nueva fórmula + alerta rojo si < 8h
- Nueva función `getAttendanceRange({ desde, hasta, projectId })` en supabase.js

---

## Asignación de obras a trabajadores (2026-07-06)

### Problema resuelto
- El dropdown de obras en ControlAsistencia → Trabajadores aparecía vacío porque el usuario admin no tenía entrada en `user_companies`, lo que bloqueaba el RLS de Supabase al leer `projects`
- **Fix de datos:** insertar al usuario admin en `user_companies` con ambos empresa_ids (VA y VR)

### Panel OBRAS en tab Trabajadores (ControlAsistencia.jsx)
- Botón **"Obras asignadas"** aparece como fila secundaria debajo de cada trabajador (antes estaba en la fila principal y quedaba cortado en pantallas pequeñas)
- Al hacer click se expande un panel que carga obras **frescas en el momento** (no depende del estado global `obrasActivas`)
- Obras ya asignadas se muestran como **chips con X** para quitar
- Obras disponibles aparecen en un **dropdown** con botón "Agregar"
- Eliminada la lógica de clave por obra (era confusa — el trabajador entra con su PIN personal, no por clave de obra)

### Aislamiento multi-empresa
- `getObrasActivas()` filtra por `empresa_id = currentEmpresaId` — cada usuario ve solo las obras de su empresa
- Andres (empresa VA) solo ve obras VA al asignar; no ve obras VR
- Aislamiento en dos capas: filtro JS + RLS de Supabase

### Kiosco trabajador (Asistencia.jsx)
- `getWorkerObras()` retorna solo las obras asignadas al trabajador vía `worker_projects`
- El trabajador ve únicamente las obras que el admin le asignó

---

## Más datos en las cards de Obras (2026-07-08)

Pedido del cliente: ver más información por obra sin entrar al detalle.

- **Venta** ahora se muestra destacada en cada card (incluye ventas adicionales, no solo el presupuesto aprobado)
- Nueva card **Saldo Pendiente** al lado de Venta (Venta − abonos recibidos), en verde si está cobrado, ámbar si falta cobrar
- Nueva fila con **Fecha Inicio**, **Fecha Término** y **N° de Días** en la obra:
  - Obras en ejecución o pausadas: días transcurridos desde el inicio (sigue contando)
  - Obras finalizadas: días totales que duró la obra (fecha término − fecha inicio, ya no cambia)
  - Obras cotizadas o sin fecha de inicio: muestra "—"
- El % Margen de cada card ahora se calcula sobre la Venta total (con adicionales), igual que en el detalle de la obra — antes solo consideraba el presupuesto aprobado

---

## Layout de Obras "a lo largo" (2026-07-08)

- Las obras ahora se muestran una fila debajo de la otra (no en grid de columnas), aprovechando todo el ancho de la pantalla
- Cada fila: nombre/cliente/dirección a la izquierda, todas las métricas (Venta, Saldo Pendiente, CDO, M.O., % Margen, Inicio, Término, N° Días) en el centro, acciones a la derecha
- En mobile se acomoda en 2 columnas de datos, sin perder información

## Trabajadores numerados (2026-07-08)

- En Control de Asistencia → pestaña Trabajadores, cada trabajador ahora tiene un número (1, 2, 3...) para poder contar la nómina de un vistazo

## Fix: subida de documentos (2026-07-08)

- **Causa raíz encontrada:** el bucket de Storage `documents` no tenía política de seguridad (RLS) que permitiera subir archivos a usuarios logueados — por eso toda subida fallaba, en cualquier obra
- Se agregó la política en Supabase (INSERT/SELECT/DELETE para usuarios autenticados)
- Además, en "Subir Egreso" y en "Venta Adicional" (dentro de una obra): si el documento no se puede adjuntar, ahora se muestra una advertencia clara — antes el egreso/venta se guardaba igual pero sin avisar que el archivo se había perdido

## Fix: documentos de Egresos y Venta Adicional no aparecían en Biblioteca (2026-07-08)

- **Causa raíz:** "Subir Egreso" y "Venta Adicional" guardaban el archivo solo en su propio registro, pero nunca lo agregaban a Biblioteca — solo el botón "Subir documento" de la card de Obras lo hacía
- Ahora los 3 lugares donde se puede subir un documento (Obras, Subir Egreso, Venta Adicional) lo dejan visible en Biblioteca
- El documento que ya habías subido hoy ("Programa POLPAICO 2026.jpg") ya aparece en Biblioteca — se corrigió a mano

## Eliminar documentos desde Biblioteca (2026-07-08)

- Cada documento en Biblioteca ahora tiene un botón de eliminar (ícono de basurero al pasar el mouse), con confirmación antes de borrar
- Borra tanto el archivo en Storage como el registro, para no dejar basura

## Nueva categoría "Retiros" en Gastos Generales (2026-07-08)

- Al subir un egreso tipo "Gasto General" (GAV), ahora se puede elegir la categoría "Retiros"

## Aviso de asistencias sin cerrar + fix de sesión (2026-07-08)

- Si un trabajador marca "Llegué" y se olvida de marcar "Me voy", antes ese registro quedaba invisible para el administrador. Ahora Control de Asistencia muestra un aviso permanente con la cantidad de registros pendientes de días anteriores, con un botón para verlos y cerrarlos a mano
- Se corrigió un bug de fondo que a veces cerraba la sesión del usuario sin motivo al recargar la página completa

## Horarios en formato 24h (2026-07-08)

- El registro manual de asistencia y la edición de hora de salida ya no usan AM/PM — ahora es formato 24 horas (ej. "17:30" en vez de "05:30 p. m.")
- Los horarios mostrados en las tablas de asistencia también se actualizaron al mismo formato

## Buscador y edición de nombre en Trabajadores (2026-07-08)

- Se agregó un buscador para encontrar trabajadores por nombre
- Ahora se puede editar el nombre de un trabajador (antes solo el Valor Día y el PIN eran editables) — el avatar con las iniciales se actualiza solo

## Alerta de PIN duplicado en Trabajadores (2026-07-09)

- Si dos trabajadores activos quedan con el mismo PIN, ahora aparece un aviso en Control de Asistencia → Trabajadores indicando cuáles son y por qué cambiarlo (riesgo de que uno marque asistencia a nombre del otro)
- Cada trabajador afectado muestra además una etiqueta "DUPLICADO" junto a su PIN
- Esto se suma a la validación que ya existía al crear o cambiar un PIN (que impide guardar uno repetido) — ahora también se detectan duplicados que ya estaban en la base de datos

## N° de Días de obra: de corridos a hábiles (2026-07-09)

- El "N° de Días" que se muestra en cada card de Obras ahora cuenta solo días hábiles (lunes a viernes) — antes contaba días corridos, incluyendo sábados y domingos
- Aplica tanto a obras en ejecución/pausadas (días transcurridos desde el inicio) como a obras finalizadas (días totales que duró la obra)

## Colores de números unificados en todos los módulos (2026-07-09)

Antes cada pantalla (Dashboard, Obras, Detalle de Obra, Estado de Resultados) coloreaba las mismas cifras de manera distinta y sin criterio común. Se definió un estándar único y se aplicó en las 4 pantallas:

- **Venta** → azul
- **Costo Directo (CDO)** → rojo
- **Mano de Obra (MOD)** → amarillo/ámbar
- **Gastos Generales (GAV)** → violeta (color nuevo)
- **Abonos / plata cobrada** → verde
- **Egresos totales y Costo Total Obra** (sumas que mezclan CDO+MOD+GAV) → rojo fijo
- **Margen / Utilidad / % Margen / % Utilidad** → semáforo: verde si ≥20%, ámbar si está entre 0-20%, rojo si es negativo (mismo corte en las 4 pantallas — antes Dashboard usaba 15% y el resto 20%; Estado de Resultados no tenía ámbar, solo verde/rojo)
- De paso se corrigieron 3 colores que estaban hardcodeados en vez de usar el sistema de diseño (afectaba modo claro/oscuro): el azul y el naranja de Estado de Resultados, y el naranja de "Próximo a vencer" en Cuentas por Pagar

## Fix: no se podían cargar gastos a una obra recién creada (2026-07-09)

**Causa raíz:** toda obra nueva se creaba con estado "Cotizada" por defecto, y la pantalla de "Subir Egreso" excluye a propósito las obras en ese estado (para no cargar gastos reales a una obra que todavía es solo una cotización sin confirmar). Como nunca se cambiaba el estado al crearla, la obra nueva quedaba invisible en el selector de "Subir Egreso".
**Fix:** el estado inicial de una obra nueva ahora es "En ejecución" por defecto — se puede cargar gastos apenas se crea. Si de verdad es solo una cotización sin trabajo real todavía, se puede elegir "Cotizada" manualmente en el mismo formulario de creación.

## Fix: la app no se actualizaba sola tras cada deploy (2026-07-09)

**Causa raíz:** el service worker (lo que permite instalar VAION como app y usarla offline) se actualizaba en segundo plano en cada deploy, pero nunca le avisaba a la pestaña/app ya abierta que había una versión nueva — se quedaba corriendo la versión vieja en memoria indefinidamente. "Limpiar cache" del navegador no soluciona esto porque no fuerza a una app ya abierta a recargarse, solo cerrarla del todo y reabrirla.
**Fix:** ahora la app detecta cuando hay una versión nueva disponible y se recarga sola automáticamente, sin que el usuario tenga que hacer nada. Aplica desde este deploy en adelante — por esta única vez, quien tenga la app ya abierta necesita cerrarla del todo y reabrirla una vez más para recibir este mismo arreglo.

## VR Asociados separado en su propia plataforma: VRION (2026-07-10)

Pedido del cliente: separar VR Asociados de VAION en una plataforma totalmente aparte (login, base de datos y todo independiente de VAION).

- **VRION ya está en producción:** https://vrion.vercel.app
- Es exactamente la misma app que VAION (mismo diseño, mismas funciones) — solo cambia el nombre de marca y que ahora tiene su propia base de datos, separada al 100% de VAION
- Se migró todo lo que ya existía de VR: las 9 obras, los 9 trabajadores, los 77 egresos, asistencia, baños químicos y los 87 proveedores — nada se perdió
- Los 4 usuarios de VR (Felipe Vazquez, Pedro Torres, Pablo Zemelman, Constanza Balbi) tienen cuenta nueva en VRION con contraseña temporal — deben cambiarla la primera vez que entren
- VAION sigue funcionando exactamente igual que antes, sin ningún cambio para sus usuarios
- Pendiente: dominio propio para VRION (por ahora usa uno provisorio gratis de Vercel)

## VAION ya no tiene selector de empresa (2026-07-10)

Pedido del cliente: que en VAION solo se pueda ver y trabajar con VA, sin ninguna posibilidad de cambiarse a otra empresa desde adentro de la app (aunque los datos viejos de VR sigan guardados como respaldo en la base de datos).

- Se eliminó por completo el selector de empresa ("Tus empresas") de la barra lateral — ahora solo se muestra el nombre de la empresa activa, sin botón para cambiar
- Se eliminó la pantalla "Selecciona tu empresa" que aparecía después del login cuando una cuenta tenía acceso a más de una empresa
- Cada plataforma (VAION y VRION) ahora queda fija a su propia empresa por diseño — VAION siempre carga VA Constructora, VRION siempre carga VR Asociados, sin importar qué otras membresías tenga la cuenta en la base de datos
- Los datos de VR siguen guardados en la base de VAION como respaldo (no se borraron), pero ya no son accesibles desde ningún lado de la app

## Editar/eliminar turno y bono por día en Control de Asistencia (2026-07-09)

En la tabla "Registros" de Control de Asistencia, cada turno ahora permite:

- **Editar entrada y salida**: antes solo se podía corregir la hora de salida de un turno abierto; ahora se pueden corregir ambas horas de cualquier turno, esté abierto o cerrado
- **Eliminar el turno**: nuevo botón con confirmación (igual que en Trabajadores/Obras)
- **Agregar un bono**: monto extra opcional en $ que se suma al costo calculado por horas de ese turno específico — aparece como "+ $X bono" debajo del costo en la tabla
- El bono queda incluido automáticamente en todos los totales de Mano de Obra (Dashboard, Estado de Resultados, Egresos) sin necesidad de tocar nada más
- Disponible en ambas plataformas (VAION y VRION)

## Fix: trabajadores de VR aparecían en el kiosco de VAION (2026-07-12)

**Causa raíz:** el kiosco donde el trabajador ingresa su PIN buscaba el PIN en toda la base de datos sin distinguir empresa. Como los datos viejos de VR seguían guardados de respaldo en la base de VAION (ver entrada del 2026-07-10), si el PIN de un trabajador de VA coincidía con el de un trabajador de VR ya inactivo, el kiosco podía mostrar el nombre equivocado.
**Fix:**
- Se borraron de la base de VAION los 9 trabajadores de VR que quedaban de respaldo (ya estaban migrados y a salvo en la base propia de VRION)
- El kiosco ahora valida el PIN solo dentro de la empresa de esa plataforma — VAION nunca puede devolver un trabajador de VR, ni de ninguna otra empresa que se agregue en el futuro
- Aplicado y verificado en ambas plataformas (VAION y VRION)

## Nuevas vistas en Control de Asistencia: Por Obra, Hora Entrada y Hora Salida (2026-07-12)

Pedido del cliente: poder ver la asistencia agrupada por obra y ordenada por hora, para detectar atrasos/salidas tempranas y ver de un vistazo cuánta gente hay en cada obra.

- **Por Obra**: una sección por cada obra activa (incluso las que no tuvieron nadie ese día) con resumen de trabajadores/horas/costo y el detalle de cada turno
- **Hora Entrada**: todos los turnos del día ordenados de más temprano a más tarde
- **Hora Salida**: igual, ordenado por hora de salida — los turnos que todavía no marcaron salida aparecen al final
- Las 3 pestañas comparten un mismo selector de día (por defecto hoy) y permiten editar/eliminar un turno igual que en "Registros"
- Disponible en ambas plataformas (VAION y VRION)

## Reasignar la obra de un turno ya marcado (2026-07-13)

Pedido del cliente: si un trabajador es derivado a una obra distinta a las que tiene asignadas, el trabajador marca su entrada normal en el kiosco (con sus obras de siempre) y el administrador corrige la obra del turno después, desde el panel de edición.

- En Control de Asistencia → cualquier vista (Registros, Por Obra, Hora Entrada, Hora Salida), el panel de editar turno ahora incluye un selector de **Obra**, con todas las obras activas de la empresa — no solo las asignadas formalmente al trabajador
- La hora de entrada, salida y el bono del turno no se ven afectados por este cambio
- El costo de mano de obra (MOD) se mueve automáticamente a la obra nueva en todos los reportes (Dashboard, Estado de Resultados, Costo por Obra)
- No modifica las obras asignadas del trabajador — la derivación es puntual para ese turno; si se vuelve algo permanente, se debe agregar la obra al trabajador aparte
- Disponible para dueño y administrativo (antes un administrativo solo podía tocar turnos de sus propias obras; ahora puede reasignar hacia cualquier obra activa)
- Disponible en ambas plataformas (VAION y VRION)

## Filtrar por obra con un click en Control de Asistencia → Registros (2026-07-13)
- En la tabla "Registros", el nombre de la obra de cualquier fila ahora es clickeable (cambia a color ámbar al pasar el mouse)
- Un click filtra al instante toda la tabla a esa obra, mostrando solo los trabajadores que estuvieron ahí — mismo filtro que el selector "Todas las obras" de arriba, que queda sincronizado
- Para volver a ver todas las obras, se usa ese mismo selector
- Disponible en ambas plataformas (VAION y VRION)

## Subir documentos generales desde Biblioteca, sin asociarlos a una obra (2026-07-13)
- Nuevo botón "Subir documento" en Biblioteca — antes la única forma de agregar un documento era desde Egresos o Venta Adicional, siempre ligado a una obra
- El formulario pide nombre, tipo (Factura, Contrato, Permiso, etc.), fecha y archivo — la Obra es opcional, con "Sin obra" por defecto para documentos generales de la empresa (ej. un contrato marco, un seguro)
- Estos documentos quedan visibles para dueño y administrativo, no solo para quien los subió
- Disponible en ambas plataformas (VAION y VRION)

## Desglose por categoría desplegable y filtro en Egresos (2026-07-14)
- "Desglose por categoría" en Egresos ahora es un menú desplegable (colapsado por defecto) en vez de ocupar siempre toda la pantalla
- Al abrirlo, cada categoría es clickeable: un click filtra la tabla "Registros" de abajo a esa categoría (como el filtro por obra de Control de Asistencia); un chip permite quitar el filtro
- "Costo Total por Obra" ya no muestra obras finalizadas — solo obras activas, para no acumular obras viejas en la lista

## Jornada especial de sábado en Control de Asistencia (2026-07-15)
- El sábado ahora tiene jornada base de 6.5h (08:30 a 15:00) en vez de las 8h de lunes a viernes
- Un turno de sábado que cumple las 6.5h completas ya **no se marca en rojo** como "incompleto" — antes cualquier sábado se veía en rojo porque siempre son menos de 8h
- El pago también se corrigió: antes un sábado completo pagaba solo ~81% del valor día (prorrateado sobre 8h); ahora un sábado de 6.5h paga el valor día completo. Si se trabajan menos de 6.5h un sábado, se sigue prorrateando, pero sobre la base de 6.5h
- Aplica en las 3 vistas de Control de Asistencia (Registros, Por Obra, formulario de registro manual) y en el kiosco de trabajador (marcar salida)
- Disponible en ambas plataformas (VAION y VRION)

## Bug: login se quedaba pegado en "AUTENTICANDO..." (2026-07-15)
- Root cause: la función `loadEmpresa()` (agregada el 2026-07-14 junto con la separación VAION/VRION) hacía 2 consultas a Supabase sin ningún timeout. Si esa consulta se colgaba por red lenta o inestable, el login nunca terminaba ni mostraba error — el botón quedaba pegado para siempre
- Fix: se agregó un timeout de 8s a `loadEmpresa()` (mismo patrón ya usado en `fetchUserProfile()`) — si la consulta no responde a tiempo, el login falla de forma visible en vez de colgarse
- Disponible en ambas plataformas (VAION y VRION)

## Bug: "Sin acceso" apareciendo en medio de una sesión válida (2026-07-15)
- Reportado después del fix anterior: el login funcionaba, pero "después de un rato" (sesión ya activa) aparecía "Sin acceso — Tu cuenta no tiene acceso a esta empresa" sin haber cerrado sesión ni cambiado nada
- Se descartó paso a paso con datos reales: la empresa existe, la membresía en `user_companies` es correcta (rol dueno), las políticas RLS están bien configuradas, y el `auth.uid()` coincide exactamente con el `user_id` guardado — el problema no estaba en los datos
- Root cause real: el cliente de Supabase renueva el token de sesión automáticamente cada cierto tiempo (evento `TOKEN_REFRESHED`) mientras la sesión sigue activa. Ese evento volvía a llamar `loadEmpresa()`, y si esa consulta fallaba por algo transitorio (red, timeout), el código pisaba la empresa ya cargada con `null` — expulsando al usuario a "Sin acceso" en medio de una sesión perfectamente válida
- Fix: en `AuthContext.jsx`, tanto la carga inicial como el listener de `TOKEN_REFRESHED`/`SIGNED_IN` ahora solo actualizan la empresa cuando `loadEmpresa()` devuelve un resultado real — nunca pisan un estado ya cargado con `null` por una falla transitoria
- Disponible en ambas plataformas (VAION y VRION)
