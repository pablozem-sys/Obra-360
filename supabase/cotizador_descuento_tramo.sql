-- ============================================================
-- VAION — Cotizador: tramos de descuento por volumen
-- Descuento por mayor, por empresa y por familia de partida_catalogo,
-- evaluado contra la cantidad de la propia línea (no el agregado de
-- la cotización). Mismo patrón de RLS que partida_catalogo_rls.
--
-- Esta migración NO siembra tramos — la tabla queda vacía a propósito
-- hasta que el cliente cargue números reales desde el modal de
-- Inventario. El descuento es inerte (0%) mientras no haya tramos.
-- ============================================================

CREATE TABLE IF NOT EXISTS descuento_tramo (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL REFERENCES companies(id),
  familia          text NOT NULL,
  cantidad_desde   numeric NOT NULL,
  cantidad_hasta   numeric,              -- NULL = sin tope ("en adelante")
  porcentaje       numeric NOT NULL,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_descuento_tramo_empresa ON descuento_tramo(empresa_id);

ALTER TABLE descuento_tramo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "descuento_tramo_rls" ON descuento_tramo
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_companies uc
      WHERE uc.user_id = auth.uid()
        AND uc.empresa_id = descuento_tramo.empresa_id
        AND uc.rol IN ('dueno','administrativo')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_companies uc
      WHERE uc.user_id = auth.uid()
        AND uc.empresa_id = descuento_tramo.empresa_id
        AND uc.rol IN ('dueno','administrativo')
    )
  );
