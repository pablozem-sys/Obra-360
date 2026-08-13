-- ============================================================
-- VAION — Cotizador: umbral de desvío de precio (Etapa 9)
-- Advertencia de la sección 9: "una línea usa un precio que se
-- aleja más de un umbral configurable respecto del catálogo".
-- ============================================================

ALTER TABLE cotizador_config
  ADD COLUMN IF NOT EXISTS umbral_desvio_precio_pct numeric NOT NULL DEFAULT 15;
