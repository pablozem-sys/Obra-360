# VAION — Módulo Cotizador

**Especificación funcional v1 · Para revisión con VA Constructora**
Base: presupuesto obra "Matías Quillayes 19" (archivo `MATIAS_QUILLAYES_19_V2.xlsx`)

---

## 1. Qué problema resuelve

Hoy cada cotización es un Excel que se arma copiando el de la obra anterior. Sobre el archivo de Quillayes 19, que es el caso de referencia, se detectó lo siguiente:

| Hallazgo | Detalle |
|---|---|
| Subtotal que omite una línea | El subtotal de iluminación de jardinera suma `G58:G60` y deja fuera `G61` (arranque de fuerza JKZ) |
| Subtotal sin fórmula | El subtotal de especialidades del baño de servicio está vacío: 4 líneas de sanitarios y artefactos no entran en ningún total |
| 14 líneas sin precio | Unas dicen "pendiente" o "definir", otras tienen el precio unitario vacío y suman **$0 en silencio** (WPC de cielos 61 m², mangueras LED, ventiladores Primaterm, interruptores) |
| Descripción mal copiada | La línea 146, dentro del baño, dice "Instalación revestimiento ranurado en cielos" a $35.000/m² pero está entre partidas de mármol de muro |
| Tres totales distintos | Subtotal neto $82.345.050 (sin mobiliario), "Total Proyecto" $90.167.830 (sin mobiliario ni ventanal), contrato real $122.445.722 |
| Estados de pago desconectados | La hoja EEPP está escrita a mano. Cuadra exacto con el presupuesto hoy, pero si cambia una cantidad no se entera |
| Partida fantasma | El cierre ventanal Arquiglass ($9.766.539) existe solo en el EEPP, nunca fue presupuestado |
| Mismo insumo, tres precios | El suministro de mármol travertino aparece a $45.990, $42.990 y $30.000 dentro de la misma obra |

El módulo apunta a que ninguno de esos ocho casos pueda volver a ocurrir sin que el sistema avise.

---

## 2. Alcance

**Entra en fase 1**

- Catálogo maestro de partidas con precios de referencia
- Armado de cotizaciones por capítulos y líneas
- Doble vista: costeo interno y vista cliente
- Paquetes comerciales y plan de estados de pago
- Versionamiento de cotizaciones
- Emisión de PDF para el cliente

**No entra en fase 1**

- Crear la obra ni el plan de abonos en VAION al aprobarse (se hace a mano, como hoy)
- Especificaciones técnicas con imágenes (hoja EETT del Excel)
- Cotización vía agente de WhatsApp
- Portal del cliente para aceptar en línea

> **Recomendación técnica:** aunque la aprobación no cree nada en VAION, la cotización nace con los campos `estado` y `obra_id` (nulo). Conectarla después es una tarea de horas; agregar esos campos después obliga a migrar datos.

---

## 3. Conceptos

- **Partida (catálogo):** unidad reutilizable entre obras. Ej: "Fragüe", "Hormigonado terraza".
- **Cotización:** documento comercial para un cliente y una dirección. Tiene versiones.
- **Capítulo (ítem):** agrupación del presupuesto. Ej: "8. Quincho". Es donde se aplica el margen.
- **Sub-bloque:** división interna del capítulo. Ej: dentro de Quincho: "Muro hormigón", "Pisos", "Techumbre y cielo". Existe porque el Excel ya lo usa y porque los paquetes comerciales cortan por ahí.
- **Línea:** una partida cotizada dentro de un sub-bloque, con cantidad, unidad y precio.
- **Paquete comercial:** agrupación de capítulos o sub-bloques que se cobra como un bloque. No coincide con los capítulos.
- **Hito de pago:** cuota dentro de un paquete (ej. 40% al inicio).

---

## 4. Catálogo maestro de partidas

Campos: `codigo`, `descripcion`, `unidad_sugerida`, `costo_unitario_referencia`, `familia`, `activa`, `notas_internas`.

Reglas:

1. **La unidad no es fija.** "Fragüe" se cotiza en m² y también en ml. La unidad de catálogo es una sugerencia; la línea manda.
2. **El precio de catálogo es referencia, no obligación.** Toda línea puede pisarlo.
3. **Todo override queda trazado:** se guarda `costo_unitario_catalogo`, `costo_unitario_usado`, `usuario`, `fecha` y un `motivo` opcional (ej. "valor proforma").
4. **Al cotizar, el sistema muestra el histórico** de esa partida en obras anteriores: últimos precios usados, en qué obra y cuándo. Esta es la función que más valor entrega y la que justifica el catálogo por sobre seguir en Excel.
5. Actualizar el precio de catálogo **no** modifica cotizaciones ya emitidas.

**Carga inicial:** las ~154 líneas del presupuesto de Quillayes 19, deduplicadas, quedan como semilla del catálogo.

---

## 5. Estructura de una cotización

```
Cotización (cliente, obra, dirección, fecha, validez, versión)
└── Capítulo  [margen %]
    └── Sub-bloque
        └── Línea (partida, unidad, cantidad, costo unit., precio unit., estado, notas)
```

Cada línea tiene:

| Campo | Vista interna | Vista cliente |
|---|---|---|
| Descripción | sí | sí |
| Unidad | sí | sí |
| Cantidad | sí | sí |
| Costo unitario | sí | **no** |
| Precio unitario | sí | sí |
| Total línea | sí | sí |
| Margen resultante | sí | no |
| Nota interna | sí | **no** |
| Nota al cliente | sí | sí |

> La separación entre nota interna y nota al cliente es obligatoria. Hoy la columna Observaciones mezcla "revisar", "valor proforma" y "se presenta propuesta" —que son internas— con "no incluye cojines" y "no incluye el foco ni lámparas", que el cliente sí debe ver.

---

## 6. Reglas de cálculo

### 6.1 Margen

El margen se define **por capítulo**, en porcentaje. El precio unitario de venta de cada línea se calcula:

```
precio_unitario = redondear( costo_unitario × (1 + margen_capitulo) )
total_linea     = precio_unitario × cantidad
subtotal_capitulo = suma de los totales de línea
```

El subtotal del capítulo se calcula **sumando líneas ya redondeadas**, nunca aplicando el margen al subtotal de costos. Si no, el PDF muestra un subtotal que no cuadra con la suma de sus propias líneas y el cliente lo nota.

### 6.2 IVA

Dos regímenes, definidos a nivel de capítulo:

| Régimen | Cálculo | Aplica a |
|---|---|---|
| `obra` | `neto × 19% × 50%` | Capítulos de ejecución |
| `pleno` | `neto × 19%` | Partidas de terceros (mobiliario, ventanal) |

Ambos valores (`19%` y `50%`) son **configuración del tenant**, no constantes en el código.

> ⚠️ **Punto a validar con el contador de VA Constructora antes de que esto quede como default.** La base del 50% no corresponde a ninguna franquicia estándar de empresas constructoras, y una vez configurada se va a imprimir en todas las cotizaciones de todos los clientes.

### 6.3 Redondeo

Todo se redondea a peso. El IVA se calcula y redondea **por hito de pago**, no sobre el total, porque así lo hace el EEPP actual (por eso hoy hay diferencias de ±$1 entre el total del EEPP y el total del presupuesto).

---

## 7. Estados de línea

Una línea tiene uno de estos cinco estados:

| Estado | Suma al total | Aparece en PDF cliente |
|---|---|---|
| `firme` | sí | sí |
| `opcional` | no | sí, en sección "Opcionales", con su precio |
| `por_definir` | no | sí, como alcance sin monto |
| `excluido` | no | sí, en sección "No incluye" |
| `descartado` | no | no |

> **Esto es una contrapropuesta a lo conversado.** La instrucción fue ocultar al cliente todo lo que no esté definido. El riesgo concreto: en Quillayes 19 el tragaluz está marcado "opcional" con precio ($221.500 × 5 unidades) —ocultarlo es dejar de vender—, los 61 m² de WPC de cielo del quincho se van a ejecutar igual aunque no tengan precio, y la aislación térmica dice "no aplica", que es una exclusión que conviene dejar por escrito. Si igual se prefiere ocultar todo, se configura; pero es la decisión que después genera los adicionales que el cliente no reconoce.

---

## 8. Paquetes comerciales y plan de pago

El plan de pago **no** se genera automáticamente desde los capítulos. Se arma con paquetes que agrupan capítulos o sub-bloques.

Motivo: en Quillayes 19 el EEPP tiene 6 paquetes contra 9 capítulos. Junta los capítulos 1 al 6 en un solo bloque y **parte el capítulo 8 (Quincho, $44.347.000) en dos paquetes distintos**. Generar un hito por capítulo cambiaría cómo cobran, no cómo se ve el documento.

Reglas:

1. Un paquete agrupa uno o más capítulos o sub-bloques. Por defecto se propone un paquete por capítulo; el usuario los junta o los parte.
2. Cada paquete tiene su **propio esquema de cuotas**: en esta obra la ejecución va 40/30/20/10 y las partidas de terceros van 50/50.
3. Las cuotas de un paquete deben sumar 100%. El sistema bloquea si no.
4. Todo capítulo debe pertenecer a exactamente un paquete. El sistema bloquea si queda alguno suelto — así el caso "cierre ventanal que existe en el plan de pago pero no en el presupuesto" no puede ocurrir.
5. El IVA se calcula por cuota, según el régimen del paquete.

---

## 9. Validaciones antes de emitir

El sistema **no permite** generar el PDF si:

- Hay líneas en estado `firme` sin precio unitario
- Un capítulo no tiene margen definido
- Las cuotas de un paquete no suman 100%
- Hay capítulos sin paquete asignado
- La cotización no tiene fecha de validez

Advertencias que no bloquean:

- Una línea usa un precio que se aleja más de un umbral configurable respecto del catálogo
- Un precio de catálogo lleva más de X meses sin actualizar
- Hay líneas con nota interna sin resolver

---

## 10. Versionamiento

El archivo actual se llama `V2` y no hay registro de qué cambió respecto de V1 ni de cuál firmó el cliente.

- Cada emisión congela una versión: número, fecha, autor y snapshot completo de líneas y precios.
- Se puede comparar dos versiones y ver qué líneas se agregaron, sacaron o cambiaron de precio.
- Solo una versión puede estar marcada como **aceptada por el cliente**.
- Las versiones emitidas son inmutables.

---

## 11. Entidades de datos

| Entidad | Campos principales |
|---|---|
| `partida_catalogo` | codigo, descripcion, unidad_sugerida, costo_unitario_ref, familia, activa |
| `cotizacion` | cliente, nombre_obra, direccion, propietario, fecha, validez_dias, estado, version_actual, obra_id (nulo en fase 1) |
| `cotizacion_version` | cotizacion_id, numero, fecha_emision, autor, aceptada, snapshot |
| `capitulo` | cotizacion_id, orden, nombre, margen_pct, regimen_iva |
| `sub_bloque` | capitulo_id, orden, nombre |
| `linea` | sub_bloque_id, partida_id, descripcion, unidad, cantidad, costo_unit_catalogo, costo_unit_usado, precio_unit, estado, nota_interna, nota_cliente |
| `paquete_comercial` | cotizacion_id, nombre, orden |
| `paquete_capitulo` | paquete_id, capitulo_id o sub_bloque_id |
| `hito_pago` | paquete_id, orden, glosa, porcentaje |
| `historial_precio` | partida_id, cotizacion_id, precio, fecha, usuario, motivo |

Multi-tenant: catálogo, cotizaciones y configuración de IVA son por workspace, consistente con la arquitectura actual de VAION.

---

## 12. Caso de aceptación — Matías Quillayes 19

El módulo se considera validado cuando, cargando este presupuesto, reproduce exactamente estos números:

**Capítulos (neto)**

| # | Capítulo | Neto |
|---|---|---|
| 1 | Inicio de la obra | $2.061.000 |
| 2 | Piscina construcción | $12.400.000 |
| 3 | Revestimiento interior | $3.730.500 |
| 4 | Borde de piscina | $1.057.770 |
| 5 | Pisos terraza piscina | $3.057.350 |
| 6 | Jardinera y muros | $6.235.430 |
| 7 | Terraza salida casa | $9.456.000 |
| 8 | Quincho | $44.347.000 |
| 9 | Mobiliario (Casa Forma) | $17.357.741 |
| — | Cierre ventanal (Arquiglass) | $9.766.539 |

**Paquetes comerciales y plan de pago**

| Paquete | Capítulos | Neto | Cuotas | IVA | Total |
|---|---|---|---|---|---|
| Piscina, muros, jardinera y aterrazado | 1 a 6 | $28.542.050 | 40/30/20/10 | $2.711.495 | $31.253.545 |
| Terraza salida actual casa | 7 | $9.456.000 | 40/30/20/10 | $898.320 | $10.354.320 |
| Quincho: muros, pisos, obra civil fierros | 8 (parcial) | $22.227.500 | 40/30/20/10 | $2.111.613 | $24.339.113 |
| Quincho: techumbre, cielo, eléctrico, baño | 8 (parcial) | $22.119.500 | 40/30/20/10 | $2.101.353 | $24.220.853 |
| Mobiliario quincho | 9 | $17.357.741 | 50/50 | $3.297.971 | $20.655.712 |
| Cierre ventanal Arquiglass | — | $9.766.539 | 50/50 | $1.855.642 | $11.622.181 |
| **Total contrato** | | **$109.469.330** | | **$12.976.394** | **$122.445.724** |

Verificaciones adicionales:

- Los dos paquetes de quincho suman exactamente el capítulo 8 ($44.347.000)
- El módulo **debe rechazar la emisión** de este presupuesto tal como está, por las 14 líneas firmes sin precio
- El subtotal de especialidades del baño ya no puede quedar fuera de ningún total

---

## 13. Decisiones abiertas para la reunión

1. **Base del IVA (50%)** — validar con el contador antes de dejarla como configuración por defecto del workspace.
2. **Estados de línea** — ¿se acepta la propuesta de cinco estados de la sección 7, o se mantiene ocultar todo lo no definido?
3. **Margen por capítulo** — ¿qué porcentaje se usa hoy, y es el mismo para ejecución que para partidas de terceros? Los precios de mobiliario de Casa Forma vienen con decimales ($6.787.530, $5.667.899), lo que sugiere que hoy pasan sin margen.
4. **Moneda** — todo está en pesos nominales para obras de varios meses. ¿Hay reajuste, o se asume el riesgo?
5. **Validez de la oferta** — hoy no existe. ¿Cuántos días?
6. **Quién cotiza** — ¿solo oficina, o también en terreno desde el celular?
7. **Convivencia con Excel** — ¿se necesita exportar a xlsx en fase 1, o el PDF basta?
