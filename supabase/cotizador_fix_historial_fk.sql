-- ============================================================
-- VAION — Cotizador: fix de esquema (bug de Etapa 2)
-- historial_precio.cotizacion_id no tenía ON DELETE configurado
-- (default NO ACTION) — borrar una cotización con algún override de
-- precio fallaba por violación de foreign key. El historial de
-- precios es del catálogo, no de la cotización: al borrar la
-- cotización, se desvincula (SET NULL) en vez de bloquear el borrado
-- o borrar también el historial.
-- ============================================================

ALTER TABLE historial_precio
  DROP CONSTRAINT historial_precio_cotizacion_id_fkey,
  ADD CONSTRAINT historial_precio_cotizacion_id_fkey
    FOREIGN KEY (cotizacion_id) REFERENCES cotizacion(id) ON DELETE SET NULL;
