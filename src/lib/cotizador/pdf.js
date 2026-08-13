import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCLP, formatDate } from '../helpers'
import { calcularCotizacion } from './calculo'

const NOMBRE_EMPRESA = 'VA CONSTRUCTORA'

const AMBER = [255, 149, 0]
const AMBER_DIM = [255, 243, 224]
const INK = [25, 25, 28]
const TEXT = [40, 40, 44]
const MUTED = [130, 130, 138]
const BORDER = [232, 232, 236]

const MARGIN = 14
const PAGE_WIDTH = 210 // A4 mm

function agregarEncabezado(doc, cotizacion) {
  // Banda de marca
  doc.setFillColor(...INK)
  doc.rect(0, 0, PAGE_WIDTH, 32, 'F')
  doc.setFontSize(9)
  doc.setTextColor(...AMBER)
  doc.setFont(undefined, 'bold')
  doc.text(NOMBRE_EMPRESA, MARGIN, 13)
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text('Cotización', MARGIN, 24)
  doc.setFont(undefined, 'normal')
  doc.setFontSize(10)
  doc.text(cotizacion.nombre_obra, PAGE_WIDTH - MARGIN, 24, { align: 'right' })

  // Ficha del cliente
  let y = 42
  doc.setFontSize(9)
  doc.setTextColor(...TEXT)
  const filas = [
    ['Cliente', cotizacion.cliente_nombre],
    cotizacion.direccion ? ['Dirección', cotizacion.direccion] : null,
    ['Fecha', formatDate(cotizacion.fecha)],
    ['Validez', cotizacion.validez_dias ? `${cotizacion.validez_dias} días desde la fecha de emisión` : 'Sin definir'],
  ].filter(Boolean)
  filas.forEach(([label, valor]) => {
    doc.setTextColor(...MUTED)
    doc.text(`${label}`, MARGIN, y)
    doc.setTextColor(...TEXT)
    doc.text(valor, MARGIN + 22, y)
    y += 5.5
  })
  return y + 6
}

function tituloSeccion(doc, texto, y) {
  doc.setDrawColor(...AMBER)
  doc.setLineWidth(0.8)
  doc.line(MARGIN, y, MARGIN + 8, y)
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...INK)
  doc.text(texto, MARGIN + 12, y + 1.2)
  doc.setFont(undefined, 'normal')
  return y + 7
}

const ESTILO_TABLA = {
  theme: 'grid',
  styles: { fontSize: 8.5, textColor: TEXT, lineColor: BORDER, lineWidth: 0.2, cellPadding: 2.5 },
  headStyles: { fillColor: INK, textColor: 255, fontStyle: 'bold', fontSize: 8 },
  alternateRowStyles: { fillColor: [250, 250, 251] },
  margin: { left: MARGIN, right: MARGIN },
}

function agregarCapitulos(doc, capitulos, startY) {
  let y = startY
  capitulos.forEach((cap) => {
    const lineasFirmes = cap.sub_bloque.flatMap((sb) => sb.linea).filter((l) => l.estado === 'firme')
    if (lineasFirmes.length === 0) return
    if (y > 250) { doc.addPage(); y = 20 }

    y = tituloSeccion(doc, cap.nombre, y)
    const subtotal = lineasFirmes.reduce((acc, l) => acc + l.totalLinea, 0)

    autoTable(doc, {
      ...ESTILO_TABLA,
      startY: y,
      head: [['Descripción', 'Unidad', 'Cant.', 'Precio unit.', 'Total']],
      body: lineasFirmes.map((l) => [
        l.nota_cliente ? `${l.descripcion}\n${l.nota_cliente}` : l.descripcion,
        l.unidad ?? '',
        String(l.cantidad),
        l.precioUnitario != null ? formatCLP(l.precioUnitario) : '—',
        formatCLP(l.totalLinea),
      ]),
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      foot: [[{ content: 'Subtotal', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', textColor: INK } }, { content: formatCLP(subtotal), styles: { fontStyle: 'bold', textColor: INK } }]],
      footStyles: { fillColor: AMBER_DIM, lineColor: BORDER, lineWidth: 0.2 },
    })
    y = doc.lastAutoTable.finalY + 10
  })
  return y
}

function agregarPlanDePago(doc, paquetes, startY) {
  const validos = paquetes.filter((p) => p.resultado)
  if (validos.length === 0) return startY

  let y = startY
  if (y > 240) { doc.addPage(); y = 20 }
  y = tituloSeccion(doc, 'Plan de pago', y)

  const body = []
  validos.forEach((p) => {
    body.push([{ content: p.nombre, colSpan: 3, styles: { fillColor: [245, 245, 247], fontStyle: 'bold', textColor: INK } }])
    p.resultado.hitos.forEach((h) => {
      body.push([h.glosa, `${h.porcentaje}%`, formatCLP(h.total)])
    })
  })
  const totalGeneral = validos.reduce((acc, p) => acc + p.resultado.total, 0)

  autoTable(doc, {
    ...ESTILO_TABLA,
    startY: y,
    head: [['Cuota', '%', 'Total (IVA incluido)']],
    body,
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  })
  y = doc.lastAutoTable.finalY + 4

  // Total del contrato, destacado
  const boxH = 14
  if (y + boxH > 280) { doc.addPage(); y = 20 }
  doc.setFillColor(...INK)
  doc.rect(PAGE_WIDTH - MARGIN - 80, y, 80, boxH, 'F')
  doc.setFontSize(8)
  doc.setTextColor(...AMBER)
  doc.text('TOTAL CONTRATO', PAGE_WIDTH - MARGIN - 76, y + 5.5)
  doc.setFontSize(13)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(formatCLP(totalGeneral), PAGE_WIDTH - MARGIN - 4, y + 11, { align: 'right' })
  doc.setFont(undefined, 'normal')

  return y + boxH + 10
}

function agregarSeccionSimple(doc, titulo, lineas, startY, { conPrecio }) {
  if (lineas.length === 0) return startY
  let y = startY
  if (y > 250) { doc.addPage(); y = 20 }
  y = tituloSeccion(doc, titulo, y)

  autoTable(doc, {
    ...ESTILO_TABLA,
    startY: y,
    head: conPrecio ? [['Descripción', 'Unidad', 'Cant.', 'Precio unit.', 'Total']] : [['Descripción', 'Unidad', 'Cant.']],
    body: lineas.map((l) => {
      const desc = l.nota_cliente ? `${l.descripcion}\n${l.nota_cliente}` : l.descripcion
      return conPrecio
        ? [desc, l.unidad ?? '', String(l.cantidad), l.precioUnitario != null ? formatCLP(l.precioUnitario) : '—', formatCLP(l.totalLinea)]
        : [desc, l.unidad ?? '', String(l.cantidad)]
    }),
    headStyles: { ...ESTILO_TABLA.headStyles, fillColor: [90, 90, 96] },
    columnStyles: conPrecio
      ? { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
      : { 1: { halign: 'center' }, 2: { halign: 'right' } },
  })
  return doc.lastAutoTable.finalY + 10
}

function agregarPiePagina(doc) {
  const totalPaginas = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, 287, PAGE_WIDTH - MARGIN, 287)
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(NOMBRE_EMPRESA, MARGIN, 292)
    doc.text(`Página ${i} de ${totalPaginas}`, PAGE_WIDTH - MARGIN, 292, { align: 'right' })
  }
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

  agregarPiePagina(doc)
  return doc
}

export function descargarPdfCliente(cotizacionCompleta, config) {
  const doc = generarPdfCliente(cotizacionCompleta, config)
  const nombreArchivo = `Cotizacion - ${cotizacionCompleta.nombre_obra}.pdf`
  doc.save(nombreArchivo)
  return doc
}
