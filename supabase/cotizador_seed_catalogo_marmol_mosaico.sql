-- ============================================================
-- VAION — Cotizador: semilla catálogo mármoles/mosaicos
-- 20 productos reales entregados por el cliente (VA Constructora).
-- Precios netos ("+ IVA"), igual convención que costo_unitario_ref
-- ya usado en el resto del catálogo — el IVA se aplica después a
-- nivel de capítulo vía regimen_iva/calcularIva.
--
-- Requiere que cotizador_catalogo_lineas_producto.sql ya se haya
-- corrido (columnas linea_producto, cobertura_m2_caja).
-- ============================================================

-- empresa_id = VA Constructora (fb63e805-ab9a-4523-ba43-bac164120144)
INSERT INTO partida_catalogo
  (empresa_id, codigo, descripcion, unidad_sugerida, costo_unitario_ref, familia, linea_producto, cobertura_m2_caja, activa, notas_internas)
VALUES
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'FAT30,5', 'Faja 30x1', 'ML', 42990.0, 'Mármol Travertino', 'Terrazas', NULL, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'FAT40', 'Faja 40x1', 'ML', 43990.0, 'Mármol Travertino', 'Terrazas', NULL, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'FAT45,7', 'Faja 45,7x1', 'ML', 44990.0, 'Mármol Travertino', 'Terrazas', NULL, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'BT40', 'Borde 40x2', 'ML', 42990.0, 'Mármol Travertino', 'Borde Piscina', NULL, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'BT50', 'Borde 50x2', 'ML', 45990.0, 'Mármol Travertino', 'Borde Piscina', NULL, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'PS 3000', 'Blanco Niebla', 'CAJA', 13266.0, 'Mosaico', 'Niebla', 2, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'PS 3001', 'Negro Niebla', 'CAJA', 14686.0, 'Mosaico', 'Niebla', 2, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'PS 3051', 'Gris Niebla', 'CAJA', 14686.0, 'Mosaico', 'Niebla', 2, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'PS 3007', 'Turqueza Niebla', 'CAJA', NULL, 'Mosaico', 'Niebla', 2, true, 'Precio pendiente de confirmar con proveedor.'),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'PS 3058', 'Beige Pastel Niebla', 'CAJA', NULL, 'Mosaico', 'Niebla', 2, true, 'Precio pendiente de confirmar con proveedor.'),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'PS 3004', 'Celeste Niebla', 'CAJA', 12216.0, 'Mosaico', 'Niebla', 2, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'PS 3002', 'Azul Marine Niebla', 'CAJA', 12216.0, 'Mosaico', 'Niebla', 2, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'PS 3057', 'Verde Caribe Niebla', 'CAJA', 12616.0, 'Mosaico', 'Niebla', 2, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'PS 7736', 'Jeju', 'CAJA', 21668.0, 'Mosaico', 'Elite Pool', 2, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'PS 7738', 'Manhattan', 'CAJA', 21668.0, 'Mosaico', 'Elite Pool', 2, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'PS 7724', 'Ceos', 'CAJA', 21668.0, 'Mosaico', 'Elite Pool', 2, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'PS 7733', 'Papua Brown', 'CAJA', 21668.0, 'Mosaico', 'Elite Pool', 2, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'PS 7737', 'Santorini', 'CAJA', 21668.0, 'Mosaico', 'Elite Pool', 2, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'PS 7723', 'Creta', 'CAJA', 21668.0, 'Mosaico', 'Elite Pool', 2, true, NULL),
  ('fb63e805-ab9a-4523-ba43-bac164120144', 'PS 7734', 'Papua Blue', 'CAJA', 21668.0, 'Mosaico', 'Elite Pool', 2, true, NULL);
