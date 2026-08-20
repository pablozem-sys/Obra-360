-- ============================================================
-- VAION — Cotizador: segundo nivel de categoría + cobertura de caja
-- linea_producto es el nivel 2 bajo familia (nivel 1), ej. familia
-- "Mosaico" → linea_producto "Niebla"/"Elite Pool". cobertura_m2_caja
-- solo aplica a ítems vendidos por caja (Mosaico); NULL en el resto.
-- ============================================================

ALTER TABLE partida_catalogo
  ADD COLUMN IF NOT EXISTS linea_producto text,
  ADD COLUMN IF NOT EXISTS cobertura_m2_caja numeric;
