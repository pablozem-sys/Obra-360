import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCLP, formatDate } from '../helpers'
import { calcularCotizacion } from './calculo'

const AMBER = [255, 149, 0]
const TEXT = [20, 20, 20]
const MUTED = [120, 120, 120]

function agregarEncabezado(doc, cotizacion) {
  doc.setFontSize(18)
  doc.setTextColor(...TEXT)
  doc.text('Cotización', 14, 20)

  doc.setFontSize(11)
  doc.setTextColor(...MUTED)
  doc.text(cotizacion.nombre_obra, 14, 28)

  doc.setFontSize(9)
  const validez = cotizacion.validez_dias
    ? `Válida ${cotizacion.validez_dias} días desde la fecha de emisión`
    : 'Sin fecha de validez definida'
  doc.text(
    [
      `Cliente: ${cotizacion.cliente_nombre}`,
      cotizacion.direccion ? `Dirección: ${cotizacion.direccion}` : null,
      `Fecha: ${formatDate(cotizacion.fecha)}`,
      validez,
    ].filter(Boolean),
    14, 36
  )
  return 55
}

function agregarCapitulos(doc, capitulos, startY) {
  let y = startY
  capitulos.forEach((cap) => {
    const lineasFirmes = cap.sub_bloque.flatMap((sb) => sb.linea).filter((l) => l.estado === 'firme')
    if (lineasFirmes.length === 0) return

    doc.setFontSize(11)
    doc.setTextColor(...TEXT)
    doc.text(cap.nombre, 14, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['Descripción', 'Unidad', 'Cant.', 'Precio unit.', 'Total']],
      body: lineasFirmes.map((l) => [
        l.nota_cliente ? `${l.descripcion}\n${l.nota_cliente}` : l.descripcion,
        l.unidad ?? '',
        String(l.cantidad),
        l.precioUnitario != null ? formatCLP(l.precioUnitario) : '—',
        formatCLP(l.totalLinea),
      ]),
      theme: 'plain',
      styles: { fontSize: 8, textColor: TEXT },
      headStyles: { textColor: MUTED, fontStyle: 'normal' },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 8
  })
  return y
}

function agregarPlanDePago(doc, paquetes, startY) {
  const validos = paquetes.filter((p) => p.resultado)
  if (validos.length === 0) return startY

  let y = startY
  if (y > 250) { doc.addPage(); y = 20 }
  doc.setFontSize(13)
  doc.setTextColor(...TEXT)
  doc.text('Plan de pago', 14, y)
  y += 6

  const body = []
  validos.forEach((p) => {
    body.push([{ content: p.nombre, colSpan: 3, styles: { fontStyle: 'bold' } }])
    p.resultado.hitos.forEach((h) => {
      body.push([h.glosa, `${h.porcentaje}%`, formatCLP(h.total)])
    })
  })
  const totalGeneral = validos.reduce((acc, p) => acc + p.resultado.total, 0)

  autoTable(doc, {
    startY: y,
    head: [['Cuota', '%', 'Total (IVA incluido)']],
    body,
    theme: 'plain',
    styles: { fontSize: 9, textColor: TEXT },
    headStyles: { textColor: MUTED, fontStyle: 'normal' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    margin: { left: 14, right: 14 },
    foot: [['Total contrato', '', formatCLP(totalGeneral)]],
    footStyles: { fontStyle: 'bold', textColor: TEXT, fillColor: false },
  })
  return doc.lastAutoTable.finalY + 8
}

function agregarSeccionSimple(doc, titulo, lineas, startY, { conPrecio }) {
  if (lineas.length === 0) return startY
  let y = startY
  if (y > 250) { doc.addPage(); y = 20 }
  doc.setFontSize(11)
  doc.setTextColor(...TEXT)
  doc.text(titulo, 14, y)
  y += 4

  autoTable(doc, {
    startY: y,
    head: conPrecio ? [['Descripción', 'Unidad', 'Cant.', 'Precio unit.', 'Total']] : [['Descripción', 'Unidad', 'Cant.']],
    body: lineas.map((l) => {
      const desc = l.nota_cliente ? `${l.descripcion}\n${l.nota_cliente}` : l.descripcion
      return conPrecio
        ? [desc, l.unidad ?? '', String(l.cantidad), l.precioUnitario != null ? formatCLP(l.precioUnitario) : '—', formatCLP(l.totalLinea)]
        : [desc, l.unidad ?? '', String(l.cantidad)]
    }),
    theme: 'plain',
    styles: { fontSize: 8, textColor: MUTED },
    headStyles: { textColor: MUTED, fontStyle: 'normal' },
    margin: { left: 14, right: 14 },
  })
  return doc.lastAutoTable.finalY + 8
}

// Genera el PDF de la Vista Cliente: sin costo unitario, margen ni notas
// internas (spec sección 5). Estado 'descartado' nunca aparece (sección 7).
export function generarPdfCliente(cotizacionCompleta, config) {
  const calculado = calcularCotizacion({
    capitulos: cotizacionCompleta.capitulo,
    paquetes: cotizacionCompleta.paquete_comercial,
    config: { ivaPct: config.iva_pct, ivaObraFactor: config.iva_obra_factor },
  })

  const doc = new jsPDF()
  let y = agregarEncabezado(doc, cotizacionCompleta)
  y = agregarCapitulos(doc, calculado.capitulos, y)
  y = agregarPlanDePago(doc, calculado.paquetes, y)

  const todas = calculado.todasLasLineas
  y = agregarSeccionSimple(doc, 'Opcionales', todas.filter((l) => l.estado === 'opcional'), y, { conPrecio: true })
  y = agregarSeccionSimple(doc, 'Alcance por definir', todas.filter((l) => l.estado === 'por_definir'), y, { conPrecio: false })
  y = agregarSeccionSimple(doc, 'No incluye', todas.filter((l) => l.estado === 'excluido'), y, { conPrecio: false })

  return doc
}

export function descargarPdfCliente(cotizacionCompleta, config) {
  const doc = generarPdfCliente(cotizacionCompleta, config)
  const nombreArchivo = `Cotizacion - ${cotizacionCompleta.nombre_obra}.pdf`
  doc.save(nombreArchivo)
  return doc
}
