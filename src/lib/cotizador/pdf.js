import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCLP, formatDate } from '../helpers'
import { calcularCotizacion } from './calculo'
import { cargarFuentes } from './pdfFonts'

// Diseño: handoff "Plantilla de cotización VA" (ver
// docs/cotizador/ si se versiona el HTML de referencia). Colores y
// tipografías tomados literal de ese documento — no inventar variaciones.
const INK = [26, 25, 18] // #1a1912
const PAPER = [251, 250, 247] // #fbfaf7
const ACCENT = [181, 101, 43] // #b5652b (terracota)
const ACCENT_SOFT = [241, 228, 215] // #f1e4d7
const LINE = [226, 222, 212] // #e2ded4
const MUTED = [122, 118, 108] // #7a766c
const ZEBRA = [246, 244, 239] // #f6f4ef

const F_ARCHIVO_500 = 'Archivo-500'
const F_ARCHIVO_600 = 'Archivo-600'
const F_ARCHIVO_700 = 'Archivo-700'
const F_ARCHIVO_800 = 'Archivo-800'
const F_SANS_400 = 'IBMPlexSans-400'
const F_SANS_500 = 'IBMPlexSans-500'
const F_SANS_600 = 'IBMPlexSans-600'
const F_MONO_400 = 'IBMPlexMono-400'
const F_MONO_500 = 'IBMPlexMono-500'

// Placeholder — datos reales de la empresa pendientes (Pedro los pasa después).
const EMPRESA = {
  nombre: 'VA Constructora',
  rut: '76.543.210-K',
  direccion: 'Av. Las Condes 8500, Santiago',
  telefono: '+56 9 1234 5678',
  email: 'contacto@vaconstructora.cl',
}

const CONDICIONES_PLACEHOLDER = {
  pago: '40% anticipo al aprobar la cotización\n30% contra avance de obra (50%)\n30% contra entrega final',
  plazo: '45 días hábiles desde la aprobación\ny recepción del anticipo',
  garantia: '2 años en estructura y obra gruesa\n1 año en instalaciones y terminaciones',
  terminos: 'Esta cotización considera los materiales y cantidades detallados por partida; cualquier modificación al alcance del proyecto será cotizada por separado. Los precios se mantienen vigentes durante el periodo de validez indicado. El inicio de obra queda sujeto a la recepción del anticipo acordado.',
}

const MARGIN = 21.6 // mm, 0.85in
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = PAGE_W - MARGIN * 2
const px = (n) => n * 0.75 // px (96dpi) -> pt, para setFontSize
const mm = (n) => n * 0.2646 // px (96dpi) -> mm, para posiciones/espaciados

const ESTILO_TABLA = {
  theme: 'plain',
  styles: { font: F_SANS_400, fontSize: px(12.5), textColor: INK, cellPadding: { top: mm(9), bottom: mm(9), left: mm(10), right: mm(10) } },
  headStyles: { font: F_ARCHIVO_600, fontSize: px(9.5), textColor: PAPER, fillColor: INK, fontStyle: 'normal' },
  bodyStyles: { lineColor: LINE, lineWidth: { bottom: 0.2 } },
  alternateRowStyles: { fillColor: ZEBRA },
  margin: { left: MARGIN, right: MARGIN, bottom: MARGIN + mm(20) },
}

function saltoDePagina(doc, y, minimoRestante) {
  if (y + minimoRestante > PAGE_H - MARGIN - mm(30)) {
    doc.addPage()
    return MARGIN
  }
  return y
}

function agregarEncabezado(doc, cotizacion) {
  let y = MARGIN + mm(24)
  doc.setFont(F_ARCHIVO_800, 'normal')
  doc.setFontSize(px(30))
  doc.setTextColor(...INK)
  doc.text('VA', MARGIN, y)

  doc.setFont(F_ARCHIVO_600, 'normal')
  doc.setFontSize(px(9.5))
  doc.setTextColor(...MUTED)
  doc.text('CONSTRUCTORA · CONSTRUCCIÓN 360°', MARGIN, y + mm(11), { charSpace: 0.3 })

  const numero = String(cotizacion.numero_correlativo ?? '—').padStart(4, '0')
  doc.setFont(F_ARCHIVO_700, 'normal')
  doc.setFontSize(px(22))
  doc.setTextColor(...INK)
  doc.text('COTIZACIÓN', PAGE_W - MARGIN, y - mm(3), { align: 'right' })
  doc.setFont(F_ARCHIVO_600, 'normal')
  doc.setFontSize(px(9.5))
  doc.setTextColor(...ACCENT)
  doc.text(`N.º ${numero}`, PAGE_W - MARGIN, y + mm(6), { align: 'right' })

  y += mm(30)

  // Ficha de datos
  const boxH = mm(58)
  doc.setFillColor(...ZEBRA)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.2)
  doc.rect(MARGIN, y, CONTENT_W, boxH, 'FD')

  const colW = CONTENT_W / 3.4
  const filas = [
    ['CLIENTE', cotizacion.cliente_nombre],
    ['FECHA DE EMISIÓN', formatDate(cotizacion.fecha)],
    ['VALIDEZ DE LA OFERTA', cotizacion.validez_dias ? `${cotizacion.validez_dias} días desde emisión` : 'Sin definir'],
  ]
  filas.forEach(([label, valor], i) => {
    const x = MARGIN + mm(18) + i * (colW * (i === 0 ? 1.4 : 1))
    doc.setFont(F_ARCHIVO_600, 'normal')
    doc.setFontSize(px(9.5))
    doc.setTextColor(...MUTED)
    doc.text(label, x, y + mm(20))
    doc.setFont(F_SANS_400, 'normal')
    doc.setFontSize(px(13))
    doc.setTextColor(...INK)
    doc.text(valor, x, y + mm(30), { maxWidth: colW * 1.2 })
  })

  return y + boxH + mm(30)
}

function badgeNumerado(doc, x, y, numero) {
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.4)
  doc.circle(x + mm(10), y - mm(3), mm(10), 'D')
  doc.setFont(F_MONO_500, 'normal')
  doc.setFontSize(px(11))
  doc.setTextColor(...ACCENT)
  doc.text(String(numero), x + mm(10), y - mm(0.5), { align: 'center' })
  return x + mm(24)
}

function tituloSeccion(doc, numero, texto, y) {
  const xTexto = badgeNumerado(doc, MARGIN, y, numero)
  doc.setFont(F_ARCHIVO_700, 'normal')
  doc.setFontSize(px(13.5))
  doc.setTextColor(...INK)
  doc.text(texto, xTexto, y)
  return y + mm(16)
}

function barraSubtotal(doc, y, label, valor) {
  const h = mm(17)
  doc.setFillColor(...ACCENT_SOFT)
  doc.rect(MARGIN, y, CONTENT_W, h, 'F')
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, y + h, MARGIN + CONTENT_W, y + h)

  doc.setFont(F_ARCHIVO_600, 'normal')
  doc.setFontSize(px(9.5))
  doc.setTextColor(...INK)
  const valorTexto = formatCLP(valor)
  doc.setFont(F_MONO_500, 'normal')
  doc.setFontSize(px(12.5))
  const valorW = doc.getTextWidth(valorTexto)
  doc.text(valorTexto, PAGE_W - MARGIN - mm(10), y + h / 2 + mm(3.5), { align: 'right' })
  doc.setFont(F_ARCHIVO_600, 'normal')
  doc.setFontSize(px(9.5))
  doc.text(label.toUpperCase(), PAGE_W - MARGIN - mm(10) - valorW - mm(24), y + h / 2 + mm(3.5), { align: 'right' })

  return y + h + mm(26)
}

function agregarCapitulos(doc, capitulos, startY) {
  let y = startY
  let n = 0
  capitulos.forEach((cap) => {
    const lineas = cap.sub_bloque.flatMap((sb) => sb.linea)
    if (lineas.length === 0) return
    n += 1
    y = saltoDePagina(doc, y, mm(60))
    y = tituloSeccion(doc, n, cap.nombre, y)
    const subtotal = lineas.reduce((acc, l) => acc + l.totalLinea, 0)

    autoTable(doc, {
      ...ESTILO_TABLA,
      startY: y,
      head: [['Descripción', 'Unidad', 'Cant.', 'Precio unit.', 'Total']],
      body: lineas.map((l) => [
        l.nota_cliente ? `${l.descripcion}\n${l.nota_cliente}` : l.descripcion,
        l.unidad ?? '',
        String(l.cantidad),
        l.precioUnitario != null ? formatCLP(l.precioUnitario) : '—',
        formatCLP(l.totalLinea),
      ]),
      columnStyles: {
        0: { cellWidth: CONTENT_W * 0.52 },
        2: { font: F_MONO_400, halign: 'right' },
        3: { font: F_MONO_400, halign: 'right' },
        4: { font: F_MONO_400, halign: 'right' },
      },
    })
    y = doc.lastAutoTable.finalY
    y = saltoDePagina(doc, y, mm(17))
    y = barraSubtotal(doc, y, 'Subtotal', subtotal)
  })
  return { y, n }
}

function agregarPlanDePago(doc, paquetes, startY, numeroInicial) {
  const validos = paquetes.filter((p) => p.resultado)
  if (validos.length === 0) return { y: startY, totalGeneral: null }

  let y = startY
  y = saltoDePagina(doc, y, mm(60))
  y = tituloSeccion(doc, numeroInicial, 'Plan de pago', y)

  validos.forEach((p) => {
    y = saltoDePagina(doc, y, mm(50))
    doc.setFont(F_ARCHIVO_700, 'normal')
    doc.setFontSize(px(11))
    doc.setTextColor(...INK)
    doc.text(p.nombre, MARGIN, y)
    y += mm(6)

    autoTable(doc, {
      ...ESTILO_TABLA,
      startY: y,
      head: [['Cuota', '%', 'Total (IVA incluido)']],
      body: p.resultado.hitos.map((h) => [h.glosa, `${h.porcentaje}%`, formatCLP(h.total)]),
      columnStyles: {
        1: { font: F_MONO_400, halign: 'right' },
        2: { font: F_MONO_400, halign: 'right' },
      },
    })
    y = doc.lastAutoTable.finalY
    y = saltoDePagina(doc, y, mm(17))
    y = barraSubtotal(doc, y, `Total ${p.nombre}`, p.resultado.total)
  })

  const totalGeneral = validos.reduce((acc, p) => acc + p.resultado.total, 0)
  const subtotalGeneral = validos.reduce((acc, p) => acc + p.resultado.neto, 0)
  const ivaGeneral = validos.reduce((acc, p) => acc + p.resultado.iva, 0)

  // Caja de totales generales — sección 4 del diseño. La etiqueta dice "IVA"
  // sin "(19%)": la cotización mezcla régimen obra (9.5%) y pleno (19%), un
  // solo porcentaje en la etiqueta sería incorrecto.
  y = saltoDePagina(doc, y, mm(45))
  const boxW = mm(320)
  const boxX = PAGE_W - MARGIN - boxW
  const boxH = mm(70)
  doc.setFillColor(...INK)
  doc.rect(boxX, y, boxW, boxH, 'F')

  const filaY1 = y + mm(20)
  const filaY2 = y + mm(38)
  doc.setFont(F_SANS_400, 'normal')
  doc.setFontSize(px(11.5))
  doc.setTextColor(200, 196, 184)
  doc.text('Subtotal general', boxX + mm(20), filaY1)
  doc.text('IVA', boxX + mm(20), filaY2)
  doc.setFont(F_MONO_400, 'normal')
  doc.text(formatCLP(subtotalGeneral), boxX + boxW - mm(20), filaY1, { align: 'right' })
  doc.text(formatCLP(ivaGeneral), boxX + boxW - mm(20), filaY2, { align: 'right' })

  doc.setDrawColor(69, 67, 58)
  doc.setLineWidth(0.3)
  doc.line(boxX + mm(20), y + mm(46), boxX + boxW - mm(20), y + mm(46))

  doc.setFont(F_ARCHIVO_700, 'normal')
  doc.setFontSize(px(15))
  doc.setTextColor(...PAPER)
  doc.text('Total', boxX + mm(20), y + mm(60))
  doc.setFont(F_MONO_400, 'normal')
  doc.setTextColor(...ACCENT)
  doc.text(formatCLP(totalGeneral), boxX + boxW - mm(20), y + mm(60), { align: 'right' })

  return { y: y + boxH + mm(32), totalGeneral }
}

function agregarCondiciones(doc, startY) {
  let y = saltoDePagina(doc, startY, mm(70))
  const colW = CONTENT_W / 2 - mm(14)
  const bloques = [
    ['CONDICIONES DE PAGO', CONDICIONES_PLACEHOLDER.pago],
    ['PLAZO DE ENTREGA', CONDICIONES_PLACEHOLDER.plazo],
    ['GARANTÍA', CONDICIONES_PLACEHOLDER.garantia],
    ['DATOS DE LA EMPRESA', `${EMPRESA.nombre} · RUT ${EMPRESA.rut}\n${EMPRESA.direccion}`],
  ]
  bloques.forEach(([label, texto], i) => {
    const col = i % 2
    const fila = Math.floor(i / 2)
    const x = MARGIN + col * (colW + mm(28))
    const yy = y + fila * 26
    doc.setFont(F_ARCHIVO_600, 'normal')
    doc.setFontSize(px(9.5))
    doc.setTextColor(...MUTED)
    doc.text(label, x, yy)
    doc.setFont(F_SANS_400, 'normal')
    doc.setFontSize(px(12))
    doc.setTextColor(...INK)
    doc.text(texto, x, yy + mm(14), { lineHeightFactor: 1.5 })
  })
  return y + 60
}

function agregarTerminos(doc, startY) {
  let y = saltoDePagina(doc, startY, mm(40))
  doc.setFont(F_ARCHIVO_600, 'normal')
  doc.setFontSize(px(9.5))
  doc.setTextColor(...MUTED)
  doc.text('TÉRMINOS Y CONDICIONES', MARGIN, y)
  doc.setFont(F_SANS_400, 'normal')
  doc.setFontSize(px(11))
  doc.setTextColor(...MUTED)
  const lineas = doc.splitTextToSize(CONDICIONES_PLACEHOLDER.terminos, mm(640))
  doc.text(lineas, MARGIN, y + mm(10), { lineHeightFactor: 1.6 })
  return y + mm(10) + lineas.length * mm(16) + mm(20)
}

function agregarFirmas(doc, startY) {
  let y = saltoDePagina(doc, startY, mm(30))
  y += mm(46)
  const colW = CONTENT_W / 2 - mm(30)
  const firmas = [
    ['Aceptado por — Cliente', 'Nombre y fecha'],
    [EMPRESA.nombre, 'Nombre y fecha'],
  ]
  firmas.forEach(([linea1, linea2], i) => {
    const x = MARGIN + i * (colW + mm(60))
    doc.setDrawColor(...INK)
    doc.setLineWidth(0.2)
    doc.line(x, y, x + colW, y)
    doc.setFont(F_MONO_400, 'normal')
    doc.setFontSize(px(10.5))
    doc.setTextColor(...MUTED)
    doc.text(linea1, x, y + 6)
    doc.text(linea2, x, y + 11)
  })
}

function agregarPiePagina(doc) {
  const totalPaginas = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, PAGE_H - MARGIN - mm(2), PAGE_W - MARGIN, PAGE_H - MARGIN - mm(2))
    doc.setFont(F_MONO_400, 'normal')
    doc.setFontSize(px(9))
    doc.setTextColor(...MUTED)
    doc.text(`${EMPRESA.nombre} · RUT ${EMPRESA.rut} · ${EMPRESA.direccion}`, MARGIN, PAGE_H - MARGIN + mm(4))
    doc.text(`${EMPRESA.telefono} · ${EMPRESA.email}`, PAGE_W - MARGIN, PAGE_H - MARGIN + mm(4), { align: 'right' })
  }
}

// Genera el PDF de la Vista Cliente: sin costo unitario, margen ni notas
// internas (spec sección 5). Estado 'descartado' nunca aparece (sección 7).
// Async porque las fuentes del diseño se cargan on-demand (no van en el
// bundle, ver pdfFonts.js).
export async function generarPdfCliente(cotizacionCompleta, config) {
  const calculado = calcularCotizacion({
    capitulos: cotizacionCompleta.capitulo,
    paquetes: cotizacionCompleta.paquete_comercial,
    config: { ivaPct: config.iva_pct, ivaObraFactor: config.iva_obra_factor },
  })

  const doc = new jsPDF()
  await cargarFuentes(doc)

  let y = agregarEncabezado(doc, cotizacionCompleta)
  const { y: y2, n } = agregarCapitulos(doc, calculado.capitulos, y)
  y = y2
  const { y: y3 } = agregarPlanDePago(doc, calculado.paquetes, y, n + 1)
  y = y3

  y = agregarCondiciones(doc, y)
  y = agregarTerminos(doc, y)
  agregarFirmas(doc, y)

  agregarPiePagina(doc)
  return doc
}
