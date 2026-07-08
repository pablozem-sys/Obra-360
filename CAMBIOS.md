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
