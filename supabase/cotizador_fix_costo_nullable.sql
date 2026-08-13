-- ============================================================
-- VAION — Cotizador: fix de esquema (bug de Etapa 2)
-- costo_unit_usado se definió NOT NULL, pero una línea 'firme' sin
-- precio (el caso central que el módulo debe detectar, sección 9)
-- necesita poder guardarse con costo null.
-- ============================================================

ALTER TABLE linea
  ALTER COLUMN costo_unit_usado DROP NOT NULL;
