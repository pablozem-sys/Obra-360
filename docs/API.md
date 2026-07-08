# API.md — VAION / Control Obras 360

## 0. Aclaración sobre qué es "la API" en este proyecto

VAION **no tiene un backend propio con endpoints REST/GraphQL custom**. La "API" real del sistema es:

1. **PostgREST autogenerado por Supabase** — cada tabla queda expuesta automáticamente como recurso REST (`/rest/v1/<tabla>`), consumido exclusivamente a través del SDK `@supabase/supabase-js` desde `src/lib/supabase.js`. No hay endpoints HTTP custom escritos a mano.
2. **Funciones RPC de Postgres** (`SECURITY DEFINER`) para operaciones privilegiadas — la app las llama vía `supabase.rpc('nombre_funcion', params)`.
3. **Rutas de React Router** — no son endpoints de servidor, pero son la "superficie pública" de la aplicación cliente y se documentan igual porque cumplen el rol de "qué se puede pedir/ver" desde el punto de vista del usuario.

Este documento cubre las tres capas.

## 1. Rutas de la aplicación (React Router — `src/App.jsx`)

| Ruta | Página | Guard de acceso | Rol requerido |
|---|---|---|---|
| `/` | `Landing.jsx` | público | — |
| `/login` | `Login.jsx` | público | — |
| `/reset-password` | `ResetPassword.jsx` | público (requiere link de recovery de Supabase Auth) | — |
| `/trabajador` | `AccesoTrabajador.jsx` | público | — (login por PIN, sin cuenta Auth) |
| `/trabajador/asistencia` | `Asistencia.jsx` | público, requiere sesión de trabajador en `localStorage` | `trabajador` |
| `/select-workspace` | `SelectWorkspace.jsx` | autenticado, sin empresa aún elegida (`SelectWorkspaceRoute`) | cualquiera con sesión Auth |
| `/dashboard` | `Dashboard.jsx` | autenticado + empresa seleccionada (`ProtectedRoute`) | `dueno`, `administrativo` |
| `/obras` | `Obras.jsx` | ídem | `dueno`, `administrativo` |
| `/obras/:id` | `DetalleObra.jsx` | ídem | `dueno`, `administrativo` |
| `/gastos/nuevo` | `NuevoGasto.jsx` ("Subir Egreso") | ídem | `dueno`, `administrativo` |
| `/gastos` | `Gastos.jsx` | ídem | `dueno`, `administrativo` |
| `/cuentas-pagar` | `CuentasPagar.jsx` | ídem | `dueno`, `administrativo` |
| `/asistencia-control` | `ControlAsistencia.jsx` | ídem | `dueno`, `administrativo` |
| `/documentos` | `Biblioteca.jsx` | ídem | `dueno`, `administrativo` |
| `/banos-quimicos` | `BanosQuimicos.jsx` | ídem | `dueno`, `administrativo` |
| `/gestion` | `Gestion.jsx` | ídem | `dueno`, `administrativo` |
| `/cuentas-cobrar` | `CuentasCobrar.jsx` | `ProtectedRoute` + `DuenoRoute` | **solo `dueno`** |
| `/eerr` | `EstadoResultado.jsx` | ídem | **solo `dueno`** |
| `/flujo-caja` | `FlujoCaja.jsx` | ídem | **solo `dueno`** |
| `/usuarios` | `Usuarios.jsx` | ídem | **solo `dueno`** |
| `*` (dentro del layout autenticado) | redirect a `/dashboard` | | |
| `*` (fuera, sin sesión) | redirect a `/` | | |

`DuenoRoute` no redirige: si el rol activo no es `dueno`, renderiza un mensaje de "Acceso restringido" in-page en vez de sacar al usuario de la ruta.

## 2. Funciones RPC (Postgres, `SECURITY DEFINER`)

Estas son las únicas operaciones donde el cliente le pide a Postgres que ejecute lógica con privilegios elevados (bypaseando RLS de forma controlada). Ninguna tiene su definición SQL versionada en el repo (excepto `verify_worker_pin_only`, comentada como referencia en `src/lib/supabase.js`) — el cuerpo real de cada función vive únicamente en Supabase.

| Función RPC | Rol que la llama | Parámetros | Retorna | Propósito |
|---|---|---|---|---|
| `delete_obra` | autenticado (dueño/admin) | `p_project_id uuid` | — | Borra una obra y (se infiere) sus registros dependientes en cascada (`accounts_receivable`, `accounts_payable`, `worker_projects`, `attendance`) — ver `project_vaion.md` en memoria del proyecto para el detalle documentado en sesiones previas |
| `delete_worker` | autenticado (dueño/admin) | `p_worker_id uuid` | — | Borra un trabajador y sus dependencias (`worker_projects`, `attendance`) |
| `create_user_profile` | autenticado (dueño, tras `signUp`) | `user_id, user_email, user_nombre, user_rol, user_avatar` | — | Inserta el perfil en `public.users` evitando problemas de timing de RLS/FK justo después de crear la cuenta en `auth.users` |
| `delete_user` | autenticado (dueño) | `user_id uuid` | — | Borra un usuario |
| `verify_worker_pin` | autenticado — **no se llama desde ninguna página actualmente (código muerto)** | `p_worker_id uuid, p_pin text` | fila del trabajador si el PIN es correcto | Variante donde primero se elige el trabajador de una lista y luego se valida el PIN. Reemplazada por `verify_worker_pin_only`. |
| `verify_worker_pin_only` | **rol `anon`** (sin login) | `p_pin text` | `{ id, nombre, avatar, valor_hora }` o vacío | La función real usada por el kiosco (`/trabajador`) — busca el trabajador solo por PIN, sin selección previa. SQL de referencia disponible como comentario en `supabase.js`. |
| `get_public_workers` | rol `anon` — **no se llama desde ninguna página actualmente (código muerto)** | — | lista de trabajadores (sin `valor_hora` ni PIN) | Aparenta ser un remanente de un flujo anterior de "elegir tu nombre de una lista" en el kiosco. |
| `is_dueno()` | usada **dentro de políticas RLS**, no se llama directo desde el cliente | — | boolean | Ver `DATABASE.md` — determina si el usuario autenticado tiene rol `dueno` (global o por empresa). |

## 3. Capa de acceso a datos — `src/lib/supabase.js`

Agrupado por dominio de negocio. Todas son funciones `async` que devuelven datos o lanzan (`throw`) el error de Supabase tal cual.

### Multi-tenancy / sesión

| Función | Parámetros | Propósito |
|---|---|---|
| `setEmpresaId(id)` | `id` | Fija la empresa activa en memoria (`currentEmpresaId`), usada como filtro implícito en casi todo el resto de funciones |
| `getUserCompanies(userId)` | `userId` | Lista las empresas (`companies` + rol en `user_companies`) a las que pertenece un usuario |

### Obras (`projects`)

| Función | Parámetros | Retorna |
|---|---|---|
| `getObras()` | — | Todas las obras de la empresa activa, con `clients(nombre)` |
| `createObra(obra)` | objeto obra | La obra creada |
| `updateObra(id, updates)` | id, campos a actualizar | La obra actualizada |
| `deleteObra(id)` | id | — (RPC) |
| `getObrasActivas()` | — | Obras con `estado != 'finalizada'` de la empresa activa (usado en selects de asistencia/egresos) |
| `getObraByClaveActiva(clave)` | clave | Una obra — **no se llama desde ninguna página** (código muerto) |
| `getProjectsList()` | — | Lista simple `{id, nombre}` para selects |

### Ventas adicionales (`additional_sales`)

| Función | Parámetros | Retorna |
|---|---|---|
| `getAdditionalSales(projectId)` | projectId | Ventas adicionales de una obra |
| `getAllAdditionalSales()` | — | `{project_id, monto, tipo}` de todas las obras (para agregación en `Obras.jsx`) |
| `createAdditionalSale(sale)` | objeto venta | Venta creada |
| `deleteAdditionalSale(id)` | id | — |

### Egresos (`expenses`)

| Función | Parámetros | Retorna |
|---|---|---|
| `getGastos(obraId?)` | obraId opcional | Egresos de la empresa (filtrados por obra si se pasa) |
| `getEgresosCredito()` | — | Egresos con `medio_pago = 'credito'` (para Cuentas por Pagar) |
| `getGastosDetallado({obraId, fechaDesde, fechaHasta})` | filtros opcionales | Egresos con join a `projects(id, nombre)` |
| `createGasto(gasto)` | objeto egreso | Egreso creado |
| `updateGasto(id, updates)` | id, campos | Egreso actualizado |
| `deleteGasto(id)` | id | — |
| `getExpensasPorObraLite()` | — | `{project_id, monto, categoria}` de todas (para cálculo de CDO en `Obras.jsx`) |

### Documentos (`documents` + Storage)

| Función | Parámetros | Retorna |
|---|---|---|
| `uploadDocumento(carpeta, file)` | carpeta destino (ej. obraId o `'gav'`), archivo | `{path, url}` — sube al bucket `documents` y devuelve la URL pública |
| `getDocumentos(obraId?)` | obraId opcional | Documentos de la empresa (filtrados por obra si se pasa) |
| `createDocumento(doc)` | objeto documento | Documento creado en la tabla `documents` (**paso obligatorio** para que el archivo aparezca en Biblioteca — ver `DATABASE.md`) |
| `deleteDocumento(doc)` | objeto documento completo (necesita `archivo_url` e `id`) | — Borra el objeto en Storage y la fila en `documents` |

### Cuentas por pagar / cobrar

| Función | Parámetros | Retorna |
|---|---|---|
| `getCuentasPagar()` | — | `accounts_payable` con join a `projects(nombre)` |
| `updateCuentaPagar(id, updates)` | id, campos | Actualizado |
| `getCuentasCobrar()` | — | `accounts_receivable` con join a `projects(nombre)` y `clients(nombre)` |
| `updateCuentaCobrar(id, updates)` | id, campos | Actualizado |

### Ingresos / abonos (`income`)

| Función | Parámetros | Retorna |
|---|---|---|
| `getIngresos()` | — | Ingresos de la empresa con join a `projects(nombre)` |
| `createIngreso(ingreso)` | objeto | Creado |
| `updateIngreso(id, updates)` | id, campos | Actualizado |
| `deleteIngreso(id)` | id | — |

### Usuarios (`users` + `user_companies`)

| Función | Parámetros | Retorna |
|---|---|---|
| `getUsuarios()` | — | Usuarios de la empresa activa (join `user_companies` → `users`) con su rol por empresa |
| `createUsuario({email, password, nombre, rol})` | datos | Crea cuenta Auth (cliente temporal sin persistir sesión) + perfil vía RPC + vínculo en `user_companies` |
| `deleteUsuario(id)` | id | — (RPC `delete_user`) |
| `updateUsuarioPerfil(id, updates)` | id, campos | Actualizado en `users` |

### Trabajadores (`workers`)

| Función | Parámetros | Retorna |
|---|---|---|
| `getWorkers()` | — | Trabajadores activos de la empresa |
| `getAllWorkers()` | — | Todos (activos e inactivos), incluye `pin` |
| `createWorker(worker)` | objeto | Creado |
| `updateWorker(id, updates)` | id, campos | Actualizado |
| `deleteWorker(id)` | id | — (RPC) |
| `getWorkerProjectIds(workerId)` | workerId | IDs de obras asignadas |
| `toggleWorkerProject(workerId, projectId, assign)` | ids, boolean | Asigna/desasigna obra↔trabajador |
| `getWorkerObras(workerId)` | workerId | Obras asignadas (con nombre/dirección) |
| `getPublicWorkers()` | — | **Código muerto**, no se llama |
| `verifyWorkerPin(workerId, pin)` | ids | **Código muerto**, no se llama |
| `verifyWorkerPinSolo(pin)` | pin | Trabajador si el PIN es correcto — usado por el kiosco real |

### Baños químicos

| Función | Parámetros | Retorna |
|---|---|---|
| `getActiveBanoByProject(projectId)` | projectId | Baño activo de esa obra, si existe |
| `getBanosQuimicos()` | — | Todos, con join a `projects` |
| `createBanoQuimico(bano)` | objeto | Creado |
| `updateBanoQuimico(id, updates)` | id, campos | Actualizado |
| `deleteBanoQuimico(id)` | id | — |
| `getPagosBano(banoId)` | banoId | Historial de pagos |
| `createPagoBano(pago)` | objeto | Creado |
| `deletePagoBano(id)` | id | — |

### Tareas / Gestión (`tasks`)

| Función | Parámetros | Retorna |
|---|---|---|
| `getTareas()` | — | Tareas de la empresa, con join a `projects(id, nombre)` |
| `createTarea(tarea)` | objeto | Creada |
| `updateTarea(id, updates)` | id, campos | Actualizada |
| `deleteTarea(id)` | id | — |

### Proveedores (`providers`)

| Función | Parámetros | Retorna |
|---|---|---|
| `getProviders()` | — | Lista para autocompletado |
| `upsertProvider(nombre)` | nombre | Inserta si no existe (`onConflict: 'nombre'`) |

### Asistencia (`attendance`)

| Función | Parámetros | Retorna |
|---|---|---|
| `getAttendance({fecha?, projectId?})` | filtros opcionales | Registros con join a `workers`/`projects` |
| `getTodayOpenAttendance(workerId)` | workerId | El registro de hoy sin `salida` (si existe) |
| `registrarAsistenciaManual({...})` | datos | Crea registro con entrada/salida manual, calcula horas y costo |
| `registrarEntrada(workerId, projectId, geo, valorHora)` | datos | Marca "llegué" (kiosco) |
| `actualizarSalidaManual(attendanceId, entrada, fecha, horaSalida, valorHora)` | datos | Edita la hora de salida de un registro existente |
| `registrarSalida(attendanceId, entrada, geo, valorHora)` | datos | Marca "me voy" (kiosco), calcula horas/costo |
| `getAttendanceByProject(projectId)` | projectId | Registros de una obra |
| `getAttendanceRange({desde, hasta, projectId?})` | filtros | Registros en un rango de fechas |
| `getAllTodayAttendance()` | — | Todos los registros de hoy (todas las empresas — **sin filtro de `empresa_id`**, revisar si es intencional) |

### Geolocalización

| Función | Parámetros | Retorna |
|---|---|---|
| `logGeolocalizacion(entry)` | objeto | Inserta un log en `geolocation_logs` |

**Cálculo de costo de asistencia (regla de negocio embebida en el código, no en la BD):** si `horas_trabajadas >= 8` → `costo_total = valor_hora` (día completo); si no → `costo_total = round((horas_trabajadas / 8) * valor_hora)` (proporcional).

## 4. Flujos de autenticación y autorización

### Admin / Dueño (cuenta con Supabase Auth)

1. `Login.jsx` → `loginAdmin(email, password)` → `supabase.auth.signInWithPassword`.
2. Se obtiene el perfil (`fetchUserProfile`) desde `users` (con fallback a metadata de Auth si la tabla falla/demora — timeout de 5s).
3. Se cargan las empresas del usuario (`loadEmpresas` → `user_companies` join `companies`).
4. Si tiene **una sola empresa**, se selecciona automáticamente. Si tiene **más de una** y no hay una guardada en `localStorage` (`vaion_empresa_id`), se lo redirige a `/select-workspace`.
5. `AuthContext` expone `rol` = `empresa?.rol ?? session?.user?.rol` — es decir, **el rol por empresa (`user_companies.rol`) tiene prioridad sobre el rol global (`users.rol`)**.
6. Sesión persistida por Supabase Auth en `localStorage` (claves `sb-*`) con auto-refresh de token.

### Trabajador de terreno (sin cuenta Auth)

1. `/trabajador` (`AccesoTrabajador.jsx`) pide solo un PIN de 4 dígitos.
2. Se valida vía RPC `verify_worker_pin_only(p_pin)`, ejecutado con rol `anon` (sin sesión Auth).
3. Si es válido, `loginTrabajador(worker)` guarda `{...worker, rol: 'trabajador'}` en `localStorage` (`vaion_worker_session`) — **no es una sesión de Supabase Auth real**, es un objeto plano que `AuthContext` trata como si lo fuera.
4. Acceso limitado a `/trabajador/asistencia` (marcar llegada/salida).

### Recuperación de contraseña

- Supabase Auth envía un link con `?code=` o `#type=recovery`.
- `RecoveryRedirect` (en `App.jsx`) detecta ese patrón en **cualquier ruta** y redirige a `/reset-password` conservando los parámetros.

### Selección de empresa (multi-tenancy)

- `SelectWorkspace.jsx` solo es alcanzable si hay sesión Auth pero **sin empresa resuelta** (`SelectWorkspaceRoute`).
- Al elegir, `selectEmpresa(entry)` → `setEmpresaId` (variable en memoria usada por `supabase.js`) + persiste en `localStorage`.
- Cambiar de empresa fuerza un remount de toda la sección autenticada (`key={empresa_id}` en `AppLayoutKeyed`).

### Roles y permisos (`PERMISOS` en `AuthContext.jsx`)

| Permiso | `dueno` | `administrativo` | `trabajador` |
|---|---|---|---|
| `verIngresos` | ✅ | ❌ | — |
| `verMargen` | ✅ | ❌ | — |
| `verEERR` | ✅ | ❌ | — |
| `verFlujoCaja` | ✅ | ❌ | — |
| `verCxC` | ✅ | ❌ | — |
| `verCxP` | ✅ | ✅ | — |
| `verAsistencia` | ✅ | ✅ | — |
| `verObras` | ✅ | ✅ | — |
| `verDocumentos` | ✅ | ✅ | — |
| `subirGastos` | ✅ | ✅ | — |
| `editarTodo` | ✅ | ❌ | — |
| `soloAsistencia` | — | — | ✅ |

**Nota:** el objeto `PERMISOS` existe y se expone vía `can(permiso)` en `AuthContext`, pero la mayoría del control de acceso real observado en el código se hace a nivel de **ruta** (`DuenoRoute`), no llamando a `can()` dentro de cada página — **PENDIENTE DE CONFIRMAR** cuántas páginas realmente consultan `can()` para ocultar/mostrar elementos de UI de forma granular versus solo depender del guard de ruta.
