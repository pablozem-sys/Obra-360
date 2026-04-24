export const obras = [
  {
    id: '1',
    nombre: 'Piscina Villa El Golf',
    cliente: 'Carlos Mendez Rojas',
    clienteId: '1',
    direccion: 'Los Militares 6280, Las Condes',
    tipo: 'piscina',
    fechaInicio: '2024-01-15',
    fechaTermino: '2024-04-30',
    presupuesto: 28500000,
    responsable: 'Juan Torres',
    estado: 'en_ejecucion',
    lat: -33.4189,
    lng: -70.5785,
    descripcion: 'Piscina 8x4m con jacuzzi y sistema de filtrado automático',
    avance: 65,
  },
  {
    id: '2',
    nombre: 'Quincho Los Dominicos',
    cliente: 'María Fernández Silva',
    clienteId: '2',
    direccion: 'Camino El Alba 11357, Las Condes',
    tipo: 'quincho',
    fechaInicio: '2024-02-01',
    fechaTermino: '2024-03-15',
    presupuesto: 12800000,
    responsable: 'Pedro Sánchez',
    estado: 'finalizada',
    lat: -33.385,
    lng: -70.562,
    descripcion: 'Quincho con bar, parrilla y espacio para 30 personas',
    avance: 100,
  },
  {
    id: '3',
    nombre: 'Ampliación Lo Barnechea',
    cliente: 'Roberto Castillo',
    clienteId: '3',
    direccion: 'Av. La Dehesa 1200, Lo Barnechea',
    tipo: 'ampliacion',
    fechaInicio: '2024-03-01',
    fechaTermino: '2024-07-30',
    presupuesto: 45000000,
    responsable: 'Juan Torres',
    estado: 'en_ejecucion',
    lat: -33.35,
    lng: -70.51,
    descripcion: 'Ampliación 2do piso 120m² con 3 dormitorios y 2 baños',
    avance: 30,
  },
  {
    id: '4',
    nombre: 'Remodelación Providencia',
    cliente: 'Ana González Vidal',
    clienteId: '4',
    direccion: 'Av. Providencia 2100, Providencia',
    tipo: 'remodelacion',
    fechaInicio: '2024-01-10',
    fechaTermino: '2024-02-28',
    presupuesto: 8500000,
    responsable: 'Luis Morales',
    estado: 'pausada',
    lat: -33.429,
    lng: -70.621,
    descripcion: 'Remodelación cocina y baño principal',
    avance: 45,
  },
  {
    id: '5',
    nombre: 'Piscina Vitacura Premium',
    cliente: 'Diego Herrera',
    clienteId: '5',
    direccion: 'Av. Vitacura 5890, Vitacura',
    tipo: 'piscina',
    fechaInicio: '2024-04-01',
    fechaTermino: '2024-06-30',
    presupuesto: 32000000,
    responsable: 'Pedro Sánchez',
    estado: 'cotizada',
    lat: -33.401,
    lng: -70.587,
    descripcion: 'Piscina 10x5m infinity con iluminación LED y calefacción solar',
    avance: 0,
  },
]

export const gastos = [
  { id: '1',  obraId: '1', monto: 2450000, categoria: 'materiales',   proveedor: 'Sodimac Professional',    fecha: '2024-01-20', medioPago: 'transferencia', comentario: 'Cemento, áridos y enfierradura',  documento: 'factura_001.pdf', lat: -33.4189, lng: -70.5785, usuario: 'Juan Torres',   estado: 'pagado' },
  { id: '2',  obraId: '1', monto: 1800000, categoria: 'mano_obra',    proveedor: 'Jorge Alvarado',           fecha: '2024-01-31', medioPago: 'transferencia', comentario: 'Avance quincena enero',          documento: null,              lat: -33.4189, lng: -70.5785, usuario: 'Juan Torres',   estado: 'pagado' },
  { id: '3',  obraId: '1', monto: 890000,  categoria: 'materiales',   proveedor: 'Easy',                     fecha: '2024-02-05', medioPago: 'tarjeta',       comentario: 'Tuberías y fitings piscina',    documento: 'boleta_015.jpg',  lat: -33.4195, lng: -70.578,  usuario: 'Pedro García', estado: 'pagado' },
  { id: '4',  obraId: '1', monto: 3200000, categoria: 'subcontratos', proveedor: 'Piscinas del Norte Ltda',  fecha: '2024-02-15', medioPago: 'transferencia', comentario: 'Instalación sistema filtrado',  documento: 'factura_018.pdf', lat: -33.4189, lng: -70.5785, usuario: 'Juan Torres',   estado: 'pendiente' },
  { id: '5',  obraId: '1', monto: 250000,  categoria: 'transporte',   proveedor: 'Fletes Rápidos',            fecha: '2024-02-18', medioPago: 'efectivo',      comentario: 'Flete materiales',              documento: null,              lat: -33.42,   lng: -70.577,  usuario: 'Pedro García', estado: 'pagado' },
  { id: '6',  obraId: '2', monto: 1250000, categoria: 'materiales',   proveedor: 'Construmart',              fecha: '2024-02-05', medioPago: 'transferencia', comentario: 'Ladrillos y mortero',           documento: 'factura_012.pdf', lat: -33.385,  lng: -70.562,  usuario: 'Pedro Sánchez',estado: 'pagado' },
  { id: '7',  obraId: '2', monto: 980000,  categoria: 'mano_obra',    proveedor: 'Equipo Terreno B',          fecha: '2024-02-15', medioPago: 'transferencia', comentario: 'Avance semanal',                documento: null,              lat: -33.385,  lng: -70.562,  usuario: 'Pedro Sánchez',estado: 'pagado' },
  { id: '8',  obraId: '2', monto: 450000,  categoria: 'materiales',   proveedor: 'Ferretería Central',        fecha: '2024-02-20', medioPago: 'efectivo',      comentario: 'Materiales terminaciones',      documento: 'boleta_022.jpg',  lat: -33.3848, lng: -70.5618, usuario: 'Luis González',estado: 'pagado' },
  { id: '9',  obraId: '3', monto: 4500000, categoria: 'materiales',   proveedor: 'Cementos Bío Bío',          fecha: '2024-03-05', medioPago: 'transferencia', comentario: 'Cemento, bloquetas y ladrillos', documento: 'factura_025.pdf', lat: -33.35,   lng: -70.51,   usuario: 'Juan Torres',   estado: 'pagado' },
  { id: '10', obraId: '3', monto: 2800000, categoria: 'mano_obra',    proveedor: 'Equipo Maestros Norte',     fecha: '2024-03-15', medioPago: 'transferencia', comentario: 'Quincena 1 marzo',               documento: null,              lat: -33.35,   lng: -70.51,   usuario: 'Juan Torres',   estado: 'pagado' },
  { id: '11', obraId: '3', monto: 1200000, categoria: 'materiales',   proveedor: 'Sodimac Professional',    fecha: '2024-03-20', medioPago: 'transferencia', comentario: 'Fierro en barra y malla',       documento: 'factura_031.pdf', lat: -33.3502, lng: -70.5098, usuario: 'Carlos Díaz',  estado: 'pagado' },
  { id: '12', obraId: '3', monto: 650000,  categoria: 'arriendo',     proveedor: 'Arriendo Equipos Sur',      fecha: '2024-03-25', medioPago: 'transferencia', comentario: 'Arriendo andamios marzo',       documento: 'factura_035.pdf', lat: -33.35,   lng: -70.51,   usuario: 'Juan Torres',   estado: 'pendiente' },
  { id: '13', obraId: '3', monto: 380000,  categoria: 'permisos',     proveedor: 'Municipalidad Lo Barnechea',fecha: '2024-03-28', medioPago: 'efectivo',      comentario: 'Permiso edificación',           documento: 'permiso_001.pdf', lat: -33.3495, lng: -70.5105, usuario: 'Juan Torres',   estado: 'pagado' },
  { id: '14', obraId: '4', monto: 890000,  categoria: 'materiales',   proveedor: 'Easy',                     fecha: '2024-01-15', medioPago: 'tarjeta',       comentario: 'Porcelanato y adhesivo',        documento: 'boleta_008.jpg',  lat: -33.429,  lng: -70.621,  usuario: 'Luis Morales',  estado: 'pagado' },
  { id: '15', obraId: '4', monto: 560000,  categoria: 'mano_obra',    proveedor: 'Gasfíter García',           fecha: '2024-01-20', medioPago: 'efectivo',      comentario: 'Instalación gasfitería baño',   documento: null,              lat: -33.429,  lng: -70.621,  usuario: 'Luis Morales',  estado: 'pagado' },
]

export const ingresos = [
  { id: '1', obraId: '1', tipo: 'anticipo',      monto: 8550000,  fecha: '2024-01-10', descripcion: '30% anticipo contrato', medioPago: 'transferencia', estado: 'cobrado' },
  { id: '2', obraId: '1', tipo: 'estado_pago',   monto: 9500000,  fecha: '2024-02-15', descripcion: 'Estado de pago #1',     medioPago: 'transferencia', estado: 'cobrado' },
  { id: '3', obraId: '2', tipo: 'anticipo',      monto: 3840000,  fecha: '2024-02-01', descripcion: '30% anticipo',          medioPago: 'transferencia', estado: 'cobrado' },
  { id: '4', obraId: '2', tipo: 'liquidacion',   monto: 8960000,  fecha: '2024-03-15', descripcion: 'Saldo final obra',      medioPago: 'transferencia', estado: 'cobrado' },
  { id: '5', obraId: '3', tipo: 'anticipo',      monto: 13500000, fecha: '2024-03-01', descripcion: '30% anticipo',          medioPago: 'transferencia', estado: 'cobrado' },
  { id: '6', obraId: '4', tipo: 'anticipo',      monto: 2550000,  fecha: '2024-01-10', descripcion: '30% anticipo',          medioPago: 'transferencia', estado: 'cobrado' },
]

export const cuentasPagar = [
  { id: '1', obraId: '1', proveedor: 'Piscinas del Norte Ltda',    monto: 3200000, fechaEmision: '2024-02-15', fechaVencimiento: '2024-03-15', estado: 'pendiente', documento: 'factura_018.pdf', responsable: 'Juan Torres',   descripcion: 'Instalación sistema filtrado' },
  { id: '2', obraId: '3', proveedor: 'Arriendo Equipos Sur',        monto: 650000,  fechaEmision: '2024-03-25', fechaVencimiento: '2024-04-10', estado: 'pendiente', documento: 'factura_035.pdf', responsable: 'Juan Torres',   descripcion: 'Andamios marzo' },
  { id: '3', obraId: '3', proveedor: 'Cementos Bío Bío',            monto: 2100000, fechaEmision: '2024-03-20', fechaVencimiento: '2024-04-05', estado: 'vencido',   documento: 'factura_038.pdf', responsable: 'Juan Torres',   descripcion: 'Segundo despacho cemento' },
  { id: '4', obraId: '1', proveedor: 'Sodimac Professional',       monto: 1450000, fechaEmision: '2024-03-01', fechaVencimiento: '2024-03-31', estado: 'pagado',    documento: 'factura_042.pdf', responsable: 'Pedro Sánchez', descripcion: 'Materiales terminaciones' },
  { id: '5', obraId: '2', proveedor: 'Construmart',                 monto: 890000,  fechaEmision: '2024-02-20', fechaVencimiento: '2024-03-05', estado: 'pagado',    documento: 'factura_019.pdf', responsable: 'Pedro Sánchez', descripcion: 'Revestimientos quincho' },
  { id: '6', obraId: '3', proveedor: 'Easy',                        monto: 780000,  fechaEmision: '2024-04-01', fechaVencimiento: '2024-04-20', estado: 'pendiente', documento: 'factura_051.pdf', responsable: 'Carlos Díaz',   descripcion: 'Pinturas y esmaltes' },
]

export const cuentasCobrar = [
  { id: '1', obraId: '1', clienteId: '1', cliente: 'Carlos Mendez Rojas',   montoContrato: 28500000, cobrado: 18050000, saldoPendiente: 10450000, fechaCompromiso: '2024-04-30', estado: 'pendiente', descripcion: 'Anticipo + EP#1' },
  { id: '2', obraId: '2', clienteId: '2', cliente: 'María Fernández Silva', montoContrato: 12800000, cobrado: 12800000, saldoPendiente: 0,        fechaCompromiso: '2024-03-15', estado: 'cobrado',   descripcion: 'Anticipo + liquidación' },
  { id: '3', obraId: '3', clienteId: '3', cliente: 'Roberto Castillo',      montoContrato: 45000000, cobrado: 13500000, saldoPendiente: 31500000, fechaCompromiso: '2024-07-30', estado: 'pendiente', descripcion: 'Solo anticipo recibido' },
  { id: '4', obraId: '4', clienteId: '4', cliente: 'Ana González Vidal',    montoContrato: 8500000,  cobrado: 2550000,  saldoPendiente: 5950000,  fechaCompromiso: '2024-02-28', estado: 'vencido',   descripcion: 'Obra pausada - saldo vencido' },
  { id: '5', obraId: '5', clienteId: '5', cliente: 'Diego Herrera',          montoContrato: 32000000, cobrado: 0,        saldoPendiente: 32000000, fechaCompromiso: '2024-06-30', estado: 'pendiente', descripcion: 'Obra cotizada sin anticipo' },
]

export const documentos = [
  { id: '1',  obraId: '1', tipo: 'factura',   nombre: 'Factura Sodimac Cemento',       archivo: 'factura_001.pdf', fecha: '2024-01-20', proveedor: 'Sodimac Professional',    monto: 2450000,  categoria: 'materiales',   tamaño: '245 KB' },
  { id: '2',  obraId: '1', tipo: 'boleta',    nombre: 'Boleta Tuberías Easy',           archivo: 'boleta_015.jpg',  fecha: '2024-02-05', proveedor: 'Easy',                     monto: 890000,   categoria: 'materiales',   tamaño: '1.2 MB' },
  { id: '3',  obraId: '1', tipo: 'factura',   nombre: 'Factura Piscinas Norte',         archivo: 'factura_018.pdf', fecha: '2024-02-15', proveedor: 'Piscinas del Norte Ltda',  monto: 3200000,  categoria: 'subcontratos', tamaño: '189 KB' },
  { id: '4',  obraId: '1', tipo: 'contrato',  nombre: 'Contrato Piscina El Golf',       archivo: 'contrato_001.pdf',fecha: '2024-01-10', proveedor: null,                       monto: 28500000, categoria: null,           tamaño: '1.9 MB' },
  { id: '5',  obraId: '2', tipo: 'factura',   nombre: 'Factura Construmart Ladrillos',  archivo: 'factura_012.pdf', fecha: '2024-02-05', proveedor: 'Construmart',              monto: 1250000,  categoria: 'materiales',   tamaño: '210 KB' },
  { id: '6',  obraId: '2', tipo: 'foto',      nombre: 'Avance obra quincho',            archivo: 'foto_quincho.jpg',fecha: '2024-02-20', proveedor: null,                       monto: null,     categoria: null,           tamaño: '3.4 MB' },
  { id: '7',  obraId: '3', tipo: 'factura',   nombre: 'Factura Cementos Bío Bío',       archivo: 'factura_025.pdf', fecha: '2024-03-05', proveedor: 'Cementos Bío Bío',          monto: 4500000,  categoria: 'materiales',   tamaño: '330 KB' },
  { id: '8',  obraId: '3', tipo: 'permiso',   nombre: 'Permiso Municipalidad',          archivo: 'permiso_001.pdf', fecha: '2024-03-28', proveedor: 'Municipalidad Lo Barnechea',monto: 380000,   categoria: 'permisos',     tamaño: '520 KB' },
  { id: '9',  obraId: '3', tipo: 'contrato',  nombre: 'Contrato Ampliación Barnechea',  archivo: 'contrato_003.pdf',fecha: '2024-02-28', proveedor: null,                       monto: 45000000, categoria: null,           tamaño: '2.1 MB' },
  { id: '10', obraId: '4', tipo: 'boleta',    nombre: 'Boleta Porcelanato Easy',        archivo: 'boleta_008.jpg',  fecha: '2024-01-15', proveedor: 'Easy',                     monto: 890000,   categoria: 'materiales',   tamaño: '1.8 MB' },
  { id: '11', obraId: '4', tipo: 'cotizacion',nombre: 'Cotización Remodelación Prov.',  archivo: 'cotiz_004.pdf',   fecha: '2024-01-05', proveedor: null,                       monto: 8500000,  categoria: null,           tamaño: '890 KB' },
]

export const flujoCajaData = [
  { mes: 'Ene', ingresos: 11100000, egresos: 5700000,  saldo: 5400000  },
  { mes: 'Feb', ingresos: 13500000, egresos: 8570000,  saldo: 10330000 },
  { mes: 'Mar', ingresos: 13500000, egresos: 9530000,  saldo: 14300000 },
  { mes: 'Abr', ingresos: 10450000, egresos: 7200000,  saldo: 17550000 },
  { mes: 'May', ingresos: 8000000,  egresos: 9500000,  saldo: 16050000 },
  { mes: 'Jun', ingresos: 16000000, egresos: 7800000,  saldo: 24250000 },
]

export const flujoCajaSemanData = [
  { semana: 'S1 Abr', ingresos: 0,        egresos: 1800000, saldo: -1800000 },
  { semana: 'S2 Abr', ingresos: 5000000,  egresos: 2100000, saldo: 1100000  },
  { semana: 'S3 Abr', ingresos: 3200000,  egresos: 1900000, saldo: 2400000  },
  { semana: 'S4 Abr', ingresos: 2250000,  egresos: 1400000, saldo: 3250000  },
]

export const currentUser = {
  id: '1',
  nombre: 'Pedro Torres',
  email: 'admin@controlobras360.cl',
  rol: 'administrador',
  avatar: 'PT',
}

export const trabajadores = [
  { id: 't1', nombre: 'Jorge Alvarado', avatar: 'JA', valorHora: 5000 },
  { id: 't2', nombre: 'Luis González',  avatar: 'LG', valorHora: 4500 },
  { id: 't3', nombre: 'Carlos Díaz',    avatar: 'CD', valorHora: 5500 },
  { id: 't4', nombre: 'Mario Soto',     avatar: 'MS', valorHora: 4800 },
  { id: 't5', nombre: 'Rodrigo Muñoz',  avatar: 'RM', valorHora: 4200 },
]

export const registrosAsistencia = [
  {
    id: 'a1', trabajadorId: 't1', obraId: '1', fecha: '2024-04-22',
    entrada: '2024-04-22T08:15:00', lat_entrada: -33.4189, lng_entrada: -70.5785,
    salida:  '2024-04-22T17:30:00', lat_salida:  -33.4189, lng_salida:  -70.5785,
    horasTrabajadas: 9.25, valorHora: 5000, costoTotal: 46250,
  },
  {
    id: 'a2', trabajadorId: 't2', obraId: '1', fecha: '2024-04-22',
    entrada: '2024-04-22T08:30:00', lat_entrada: -33.419,  lng_entrada: -70.5784,
    salida:  '2024-04-22T17:00:00', lat_salida:  -33.419,  lng_salida:  -70.5784,
    horasTrabajadas: 8.5,  valorHora: 4500, costoTotal: 38250,
  },
  {
    id: 'a3', trabajadorId: 't3', obraId: '3', fecha: '2024-04-22',
    entrada: '2024-04-22T07:45:00', lat_entrada: -33.35,   lng_entrada: -70.51,
    salida:  '2024-04-22T16:45:00', lat_salida:  -33.35,   lng_salida:  -70.51,
    horasTrabajadas: 9.0,  valorHora: 5500, costoTotal: 49500,
  },
  {
    id: 'a4', trabajadorId: 't1', obraId: '1', fecha: '2024-04-23',
    entrada: '2024-04-23T08:00:00', lat_entrada: -33.4189, lng_entrada: -70.5785,
    salida:  '2024-04-23T17:45:00', lat_salida:  -33.4189, lng_salida:  -70.5785,
    horasTrabajadas: 9.75, valorHora: 5000, costoTotal: 48750,
  },
  {
    id: 'a5', trabajadorId: 't2', obraId: '3', fecha: '2024-04-23',
    entrada: '2024-04-23T08:20:00', lat_entrada: -33.3502, lng_entrada: -70.5098,
    salida:  '2024-04-23T17:20:00', lat_salida:  -33.3502, lng_salida:  -70.5098,
    horasTrabajadas: 9.0,  valorHora: 4500, costoTotal: 40500,
  },
  {
    id: 'a6', trabajadorId: 't4', obraId: '1', fecha: '2024-04-23',
    entrada: '2024-04-23T08:10:00', lat_entrada: -33.4189, lng_entrada: -70.5785,
    salida:  null, lat_salida: null, lng_salida: null,
    horasTrabajadas: null, valorHora: 4800, costoTotal: null,
  },
]
