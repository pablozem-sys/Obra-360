// Fuentes del diseño VA Constructora (handoff): Archivo, IBM Plex Sans,
// IBM Plex Mono. jsPDF no las trae — se sirven como estáticos desde
// /public/fonts/cotizador y se registran en tiempo de ejecución (solo al
// generar un PDF, no en el bundle) via VFS. Se cachean en memoria para no
// volver a pedirlas en la misma sesión.
const FUENTES = [
  { archivo: 'Archivo-500.ttf', family: 'Archivo-500' },
  { archivo: 'Archivo-600.ttf', family: 'Archivo-600' },
  { archivo: 'Archivo-700.ttf', family: 'Archivo-700' },
  { archivo: 'Archivo-800.ttf', family: 'Archivo-800' },
  { archivo: 'IBMPlexSans-400.ttf', family: 'IBMPlexSans-400' },
  { archivo: 'IBMPlexSans-500.ttf', family: 'IBMPlexSans-500' },
  { archivo: 'IBMPlexSans-600.ttf', family: 'IBMPlexSans-600' },
  { archivo: 'IBMPlexMono-400.ttf', family: 'IBMPlexMono-400' },
  { archivo: 'IBMPlexMono-500.ttf', family: 'IBMPlexMono-500' },
];

let fuentesCache = null;

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function cargarFuentes(doc) {
  if (!fuentesCache) {
    fuentesCache = await Promise.all(
      FUENTES.map(async (f) => {
        const res = await fetch(`/fonts/cotizador/${f.archivo}`);
        const buf = await res.arrayBuffer();
        return { ...f, base64: arrayBufferToBase64(buf) };
      })
    );
  }
  fuentesCache.forEach((f) => {
    doc.addFileToVFS(f.archivo, f.base64);
    doc.addFont(f.archivo, f.family, 'normal');
  });
}
