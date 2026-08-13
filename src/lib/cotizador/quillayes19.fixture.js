// Fixture generado desde MATIAS_QUILLAYES_19_V2.xlsx (hoja PPTO), verificado
// línea por línea contra los subtotales de capítulo y el EEPP (hoja EEPP).
// Ver docs/cotizador/spec-funcional-v1.md sección 12.
//
// Sin estados de línea (se sacaron del producto): la línea "Aislación
// Térmica, Fisiterm." del capítulo 7 (Terraza) marcaba "no aplica" en el
// Excel original y no sumaba a ese capítulo — antes se representaba con
// estado 'excluido', ahora directamente no está en la plantilla (en el
// modelo nuevo, lo que no aplica se borra). Sigue existiendo en el
// capítulo 8 (Quincho), donde sí aplicaba y sí sumaba.

export const capitulos = [
  {
    nombre: "1. Inicio de la obra",
    margenPct: 0,
    regimen: "obra",
    subBloques: [
      {
        nombre: "General",
        lineas: [
          { descripcion: "Instalación de Faena, Replanteo general taquimetro, niveles y trazado del proyecto", unidad: "GL", cantidad: 1, costoUnitario: 165000, estado: "firme" },
          { descripcion: "Retiros de escombros", unidad: "UN", cantidad: 3, costoUnitario: 160000, estado: "firme" },
          { descripcion: "Flete de materiales", unidad: "UN", cantidad: 5, costoUnitario: 70000, estado: "firme" },
          { descripcion: "Baño químico - arriendo mensual lo que dure el proyecto.", unidad: "UN", cantidad: 4, costoUnitario: 169000, estado: "firme" },
          { descripcion: "Limpieza General y entrega del proyecto", unidad: "UN", cantidad: 1, costoUnitario: 390000, estado: "firme" },
          { descripcion: "Nivelacion del terreno", unidad: "GL", cantidad: 1, costoUnitario: null, estado: "firme" },
          { descripcion: "Retiros de escombro para nivelación del terreno", unidad: "GL", cantidad: 1, costoUnitario: null, estado: "firme" },
        ],
      },
    ],
  },
  {
    nombre: "2. Piscina construcción",
    margenPct: 0,
    regimen: "obra",
    subBloques: [
      {
        nombre: "General",
        lineas: [
          { descripcion: "Construcción de piscina - Incluye movimientos de tierra y nivelación del terreno", unidad: "M2", cantidad: 80, costoUnitario: 155000, estado: "firme" },
        ],
      },
    ],
  },
  {
    nombre: "3. Revestimiento interior definitivo",
    margenPct: 0,
    regimen: "obra",
    subBloques: [
      {
        nombre: "General",
        lineas: [
          { descripcion: "Mosaico español Joint Point ALTTO GLASS (caja 2m2) MODELO FOG NIEBLA", unidad: "UN", cantidad: 33, costoUnitario: 45900, estado: "firme" },
          { descripcion: "Materiales: Adhesivo KERAKOLL", unidad: "UN", cantidad: 12, costoUnitario: 27900, estado: "firme" },
          { descripcion: "Instalación Mosaico e impermeabilización de piscina", unidad: "M2", cantidad: 66, costoUnitario: 25000, estado: "firme" },
          { descripcion: "Fragüe", unidad: "M2", cantidad: 66, costoUnitario: 3500, estado: "firme" },
        ],
      },
    ],
  },
  {
    nombre: "4. Borde de piscina",
    margenPct: 0,
    regimen: "obra",
    subBloques: [
      {
        nombre: "General",
        lineas: [
          { descripcion: "Mármol travertino rústico / Formato 40 x LL x 2cm / canto recto biselado", unidad: "ML", cantidad: 20, costoUnitario: 45990, estado: "firme" },
          { descripcion: "Esquinero: Mármol travertino rústico 50 x 50", unidad: "UN", cantidad: 3, costoUnitario: 45990, estado: "firme" },
        ],
      },
    ],
  },
  {
    nombre: "5. Pisos terraza piscina",
    margenPct: 0,
    regimen: "obra",
    subBloques: [
      {
        nombre: "General",
        lineas: [
          { descripcion: "Niveles, cuadratura y escarpe del terreno", unidad: "M2", cantidad: 1, costoUnitario: 45000, estado: "firme" },
          { descripcion: "Excavación, compactación y realización de la cancha", unidad: "GL", cantidad: 1, costoUnitario: 140000, estado: "firme" },
          { descripcion: "Hormigonado terraza", unidad: "M2", cantidad: 45, costoUnitario: 40000, estado: "firme" },
          { descripcion: "Suministro piso: Mármol travertino para pisos o porcelanato según corresponda", unidad: "M2", cantidad: 15, costoUnitario: 42990, estado: "firme" },
          { descripcion: "Instalación piso: Mármol travertino según corresponda. (Incluye pegamento)", unidad: "M2", cantidad: 15, costoUnitario: 25000, estado: "firme" },
          { descripcion: "Fragües", unidad: "M2", cantidad: 15, costoUnitario: 3500, estado: "firme" },
        ],
      },
    ],
  },
  {
    nombre: "6. Jardinera y muros",
    margenPct: 0,
    regimen: "obra",
    subBloques: [
      {
        nombre: "Obra civil",
        lineas: [
          { descripcion: "Excavación del terreno", unidad: "M3", cantidad: 9, costoUnitario: 25000, estado: "firme" },
          { descripcion: "Cadena fundacion para contencion de pandereta y muros", unidad: "ML", cantidad: 24, costoUnitario: 35000, estado: "firme" },
          { descripcion: "Fabricacion muro nivelacion prefrabicado bloque 40x15 con enfierradura", unidad: "ML", cantidad: 24, costoUnitario: 45000, estado: "firme" },
          { descripcion: "Terminacion muros. Mediterranea + pintura sherwin williams color condominio", unidad: "GL", cantidad: 1, costoUnitario: 395000, estado: "firme" },
          { descripcion: "Suministros marmol travertino para muro cascada y volado asiento", unidad: "ML", cantidad: 7, costoUnitario: 42990, estado: "firme" },
          { descripcion: "Instalacion marmol traveritno en muro cascada", unidad: "ML", cantidad: 7, costoUnitario: 35000, estado: "firme" },
          { descripcion: "Frague marmol travertino muro cascada", unidad: "ML", cantidad: 7, costoUnitario: 3500, estado: "firme" },
          { descripcion: "Sistema hidraulico para velo de agua + velo de agua + instalacion", unidad: "GL", cantidad: 1, costoUnitario: 690000, estado: "firme" },
          { descripcion: "Fabricación de asientos en \"volado\" con respaldo de hormigón armado. 1,90 x 5,54", unidad: "GL", cantidad: 1, costoUnitario: 2290000, estado: "firme" },
        ],
      },
      {
        nombre: "Proyecto iluminación",
        lineas: [
          { descripcion: "Empalmes eléctrico - Alimentadores", unidad: "GL", cantidad: 1, costoUnitario: 145000, estado: "firme" },
          { descripcion: "Instalacion mangeras LED bajo escalon volado. transformadores, perfiles", unidad: "GL", cantidad: 1, costoUnitario: null, estado: "firme" },
          { descripcion: "Interrruptor", unidad: "GL", cantidad: 3, costoUnitario: null, estado: "firme" },
          { descripcion: "Arranque de fuerza para jkz", unidad: "UN", cantidad: 1, costoUnitario: null, estado: "firme" },
        ],
      },
    ],
  },
  {
    nombre: "7. Terraza actual salida de la casa",
    margenPct: 0,
    regimen: "obra",
    subBloques: [
      {
        nombre: "Obra civil",
        lineas: [
          { descripcion: "Fabricación y estructura de fierros perfiles rectangulares 200x100x3", unidad: "GL", cantidad: 1, costoUnitario: 2390000, estado: "firme" },
          { descripcion: "Fijaciones, pernos, anclajes y pulidos", unidad: "GL", cantidad: 1, costoUnitario: 540000, estado: "firme" },
          { descripcion: "Pintura anticorrosivo y terminación", unidad: "GL", cantidad: 1, costoUnitario: 415000, estado: "firme" },
        ],
      },
      {
        nombre: "Techumbre y cielo",
        lineas: [
          { descripcion: "Fabricación serchas estructurales en acero galvanizado", unidad: "UN", cantidad: 6, costoUnitario: 30000, estado: "firme" },
          { descripcion: "Estructura cubierta de techo con terciado estructural de 15mm", unidad: "M2", cantidad: 16, costoUnitario: 75000, estado: "firme" },
          { descripcion: "Hojalatería techumbre. Emballetado 0,4mm", unidad: "M2", cantidad: 16, costoUnitario: 34500, estado: "firme" },
          { descripcion: "Hojalatería: Forros, atraques y coronaciones", unidad: "ML", cantidad: 18, costoUnitario: 27500, estado: "firme" },
          { descripcion: "Hojalatería Canaleta de agua", unidad: "ML", cantidad: 7, costoUnitario: 27500, estado: "firme" },
          { descripcion: "Pre pintado negro Cubierta de techo americano", unidad: "M2", cantidad: 16, costoUnitario: 12500, estado: "firme" },
          { descripcion: "Sellos poliuterano", unidad: "GL", cantidad: 1, costoUnitario: 225000, estado: "firme" },
          { descripcion: "Cielo: estructura cubierta de cielo para correcta instalacion de revestimiento ranurado WPC", unidad: "M2", cantidad: 16, costoUnitario: 18500, estado: "firme" },
          { descripcion: "Revestimiento ranurado WPC libre de mantención color eleccion MK", unidad: "M2", cantidad: 16, costoUnitario: null, estado: "firme" },
          { descripcion: "Instalacion revestimiendo ranurado en cielos", unidad: "M2", cantidad: 16, costoUnitario: 25000, estado: "firme" },
          { descripcion: "Tragaluz rectangular - vidrio laminado 8mm fijaciones, transporte, topes, instalacion y sellos 0,75 x 0,95", unidad: "UN", cantidad: 5, costoUnitario: 221500, estado: "firme" },
          { descripcion: "Perfiles y angulos de terminacion 20x20 aluminio negro mate", unidad: "GL", cantidad: 1, costoUnitario: 190000, estado: "firme" },
        ],
      },
      {
        nombre: "Proyecto iluminación",
        lineas: [
          { descripcion: "Empalmes eléctrico - Alimentadores", unidad: "GL", cantidad: 1, costoUnitario: 145000, estado: "firme" },
          { descripcion: "Puntos eléctricos - canalización / cableado / instalación focos - ILUMINACION GENERAL", unidad: "UN", cantidad: 10, costoUnitario: 61500, estado: "firme" },
          { descripcion: "Puntos eléctricos con soporte para ventilador + instalación", unidad: "UN", cantidad: 2, costoUnitario: 91500, estado: "firme" },
          { descripcion: "Ventiladores Primaterm", unidad: "UN", cantidad: 2, costoUnitario: null, estado: "firme" },
          { descripcion: "Instalación, armado y montaje de ventiladores", unidad: "UN", cantidad: 2, costoUnitario: 65000, estado: "firme" },
        ],
      },
    ],
  },
  {
    nombre: "8. Quincho",
    margenPct: 0,
    regimen: "obra",
    subBloques: [
      {
        nombre: "Muro hormigón adosamiento",
        lineas: [
          { descripcion: "Retiro de pandereta actual con vecino", unidad: "ML", cantidad: 1, costoUnitario: null, estado: "firme" },
          { descripcion: "Cadena fundacion para muro albañeria", unidad: "ML", cantidad: 34, costoUnitario: 45000, estado: "firme" },
          { descripcion: "Muro pre fabricado de hormigón con pilares altura 2,7m", unidad: "M2", cantidad: 92, costoUnitario: 65000, estado: "firme" },
          { descripcion: "Terminación pintura segun EETT", unidad: "GL", cantidad: 1, costoUnitario: 445000, estado: "firme" },
          { descripcion: "Terminación hormigon al a vista", unidad: "GL", cantidad: 1, costoUnitario: null, estado: "firme" },
        ],
      },
      {
        nombre: "Pisos",
        lineas: [
          { descripcion: "Niveles, cuadratura y escarpe del terreno", unidad: "GL", cantidad: 1, costoUnitario: 145000, estado: "firme" },
          { descripcion: "Hormigonado", unidad: "M2", cantidad: 75, costoUnitario: 40000, estado: "firme" },
          { descripcion: "Suministro piso marmol travertino corte a la veta 30xLL según corresponda", unidad: "M2", cantidad: 75, costoUnitario: 30000, estado: "firme" },
          { descripcion: "Instalación piso Incluye pegamento", unidad: "M2", cantidad: 75, costoUnitario: 25000, estado: "firme" },
          { descripcion: "Fragües", unidad: "M2", cantidad: 75, costoUnitario: 3500, estado: "firme" },
        ],
      },
      {
        nombre: "Obra civil estructura de fierro",
        lineas: [
          { descripcion: "Fabricación y montaje estructura de fierro. coronacion perimetral", unidad: "GL", cantidad: 1, costoUnitario: 4790000, estado: "firme" },
          { descripcion: "Perfiles de fierros a la vista tipo vigas 50mm", unidad: "UN", cantidad: 8, costoUnitario: 55000, estado: "firme" },
          { descripcion: "Fijaciones, pernos, anclajes y pulidos", unidad: "GL", cantidad: 1, costoUnitario: 790000, estado: "firme" },
          { descripcion: "Pintura anticorrosivo y terminación", unidad: "GL", cantidad: 1, costoUnitario: 540000, estado: "firme" },
          { descripcion: "Angulos de terminación y embellecedor", unidad: "GL", cantidad: 1, costoUnitario: 180000, estado: "firme" },
        ],
      },
      {
        nombre: "Techumbre y cielo",
        lineas: [
          { descripcion: "Fabricación serchas estructurales en acero galvanizado 90", unidad: "UN", cantidad: 15, costoUnitario: 45000, estado: "firme" },
          { descripcion: "Estructura cubierta de techo con terciado estructural de 15mm", unidad: "M2", cantidad: 61, costoUnitario: 75000, estado: "firme" },
          { descripcion: "Hojalatería techumbre. Emballetado 0,4mm", unidad: "M2", cantidad: 61, costoUnitario: 34500, estado: "firme" },
          { descripcion: "Hojalatería: Forros, atraques y coronaciones", unidad: "ML", cantidad: 36, costoUnitario: 27500, estado: "firme" },
          { descripcion: "Hojalatería Canaleta de agua", unidad: "ML", cantidad: 14, costoUnitario: 27500, estado: "firme" },
          { descripcion: "Pre pintado negro Cubierta de techo americano", unidad: "M2", cantidad: 61, costoUnitario: 12500, estado: "firme" },
          { descripcion: "Sellos poliuterano", unidad: "GL", cantidad: 1, costoUnitario: 420000, estado: "firme" },
          { descripcion: "Aislación Térmica, Fisiterm.", unidad: "M2", cantidad: 61, costoUnitario: 16500, estado: "firme" },
          { descripcion: "Cielo: estructura cubierta de cielo para correcta instalacion de revestimiento ranurado WPC", unidad: "M2", cantidad: 61, costoUnitario: 18500, estado: "firme" },
          { descripcion: "Revestimiento ranurado WPC libre de mantención color eleccion MK", unidad: "M2", cantidad: 61, costoUnitario: null, estado: "firme" },
          { descripcion: "Instalacion revestimiendo ranurado en cielos", unidad: "M2", cantidad: 61, costoUnitario: 25000, estado: "firme" },
          { descripcion: "Tragaluz rectangular - vidrio laminado 8mm fijaciones, transporte, topes, instalacion y sellos 1,65x0,85", unidad: "UN", cantidad: 7, costoUnitario: 366000, estado: "firme" },
          { descripcion: "Perfiles y angulos de terminacion 20x20 aluminio negro mate", unidad: "GL", cantidad: 1, costoUnitario: 315000, estado: "firme" },
        ],
      },
      {
        nombre: "Proyecto eléctrico",
        lineas: [
          { descripcion: "Fabricación tablero general con automaticos y protecciones independientes para cada circuito", unidad: "GL", cantidad: 1, costoUnitario: 790000, estado: "firme" },
          { descripcion: "Empalme eléctrico / alimentador general para nuevo tablero", unidad: "GL", cantidad: 1, costoUnitario: 185000, estado: "firme" },
          { descripcion: "Puntos eléctricos luminaria - canalización / cableado / instalación focos GU10 / lamparas decorativas, apliques.", unidad: "UN", cantidad: 27, costoUnitario: 62500, estado: "firme" },
          { descripcion: "Enchufes / interruptes y arranques: (campana, calefactores, ventiladores, refrigerador, parlantes, extractor)", unidad: "UN", cantidad: 16, costoUnitario: 92500, estado: "firme" },
          { descripcion: "Instalaciones, armado y montaje", unidad: "GL", cantidad: 1, costoUnitario: 390000, estado: "firme" },
        ],
      },
      {
        nombre: "Baño servicio / obra civil",
        lineas: [
          { descripcion: "Suministro marmol travertino para muro", unidad: "M2", cantidad: 8, costoUnitario: 30000, estado: "firme" },
          { descripcion: "Instalacion revestimiendo ranurado en cielos", unidad: "M2", cantidad: 8, costoUnitario: 35000, estado: "firme" },
          { descripcion: "Fragues", unidad: "M2", cantidad: 8, costoUnitario: 3500, estado: "firme" },
          { descripcion: "Pinturas y terminaciones: Muros y cielo: Estuco, yeso, huinchas americanas, aparejo y pintura 2 manos SW KEN PRO", unidad: "GL", cantidad: 1, costoUnitario: 590000, estado: "firme" },
        ],
      },
      {
        nombre: "Especialidades",
        lineas: [
          { descripcion: "Conexion sanitaria desague a tapa de camara", unidad: "GL", cantidad: 1, costoUnitario: null, estado: "firme" },
          { descripcion: "Alimentación agua potable tuberia PPR agua fria / caliente", unidad: "GL", cantidad: 1, costoUnitario: null, estado: "firme" },
          { descripcion: "Artefactos y accesorios: WC, espejo, griferias, mobiliario, accesorios", unidad: "GL", cantidad: 1, costoUnitario: null, estado: "firme" },
          { descripcion: "Instalaciones", unidad: "GL", cantidad: 1, costoUnitario: null, estado: "firme" },
        ],
      },
    ],
  },
  {
    nombre: "9. Mobiliario y quincho (Casa Forma)",
    margenPct: 0,
    regimen: "pleno",
    subBloques: [
      {
        nombre: "General",
        lineas: [
          { descripcion: "Mueble mesón Parrilla quincho zona trabajo cocina y parrilla", unidad: "GL", cantidad: 1, costoUnitario: 6787530, estado: "firme" },
          { descripcion: "Mueble mesón Isla 3,6 metros de largo", unidad: "GL", cantidad: 1, costoUnitario: 5667899, estado: "firme" },
          { descripcion: "Mueble Tv-Bar 3,595 mt de largo x 2,7 mt de alto", unidad: "GL", cantidad: 1, costoUnitario: 1868908, estado: "firme" },
          { descripcion: "Baño aereo de 1,1 mt de largo", unidad: "GL", cantidad: 1, costoUnitario: 924370, estado: "firme" },
          { descripcion: "Accesorios", unidad: "GL", cantidad: 1, costoUnitario: 84034, estado: "firme" },
          { descripcion: "Cubiertas y pulidos mineralli en muros", unidad: "GL", cantidad: 1, costoUnitario: 1390000, estado: "firme" },
          { descripcion: "Despacho y embalaje", unidad: "GL", cantidad: 1, costoUnitario: 245000, estado: "firme" },
          { descripcion: "Instalacion, armado y montaje varios (parrillas, horno, refrigerador, keveri, TV, parlantes, etc)", unidad: "GL", cantidad: 1, costoUnitario: 390000, estado: "firme" },
        ],
      },
    ],
  },
  {
    nombre: "Cierre ventanal Arquiglass",
    margenPct: 0,
    regimen: "pleno",
    subBloques: [
      {
        nombre: "General",
        lineas: [
          { descripcion: "Cierre ventanal Arquiglass", unidad: "GL", cantidad: 1, costoUnitario: 9766539, estado: "firme" },
        ],
      },
    ],
  },
];

export const paquetes = [
  {
    nombre: "Piscina, muros, jardinera y aterrazado",
    cuotas: [40, 30, 20, 10],
    destinos: [{ capitulo: 0 }, { capitulo: 1 }, { capitulo: 2 }, { capitulo: 3 }, { capitulo: 4 }, { capitulo: 5 }],
  },
  {
    nombre: "Terraza salida actual casa",
    cuotas: [40, 30, 20, 10],
    destinos: [{ capitulo: 6 }],
  },
  {
    nombre: "Quincho: muros, pisos, obra civil fierros",
    cuotas: [40, 30, 20, 10],
    destinos: [{ capitulo: 7, subBloque: 0 }, { capitulo: 7, subBloque: 1 }, { capitulo: 7, subBloque: 2 }],
  },
  {
    nombre: "Quincho: techumbre, cielo, proyecto eléctrico, baño",
    cuotas: [40, 30, 20, 10],
    destinos: [{ capitulo: 7, subBloque: 3 }, { capitulo: 7, subBloque: 4 }, { capitulo: 7, subBloque: 5 }, { capitulo: 7, subBloque: 6 }],
  },
  {
    nombre: "Mobiliario quincho",
    cuotas: [50, 50],
    destinos: [{ capitulo: 8 }],
  },
  {
    nombre: "Cierre ventanal Arquiglass",
    cuotas: [50, 50],
    destinos: [{ capitulo: 9 }],
  },
];
