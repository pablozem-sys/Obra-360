-- ============================================================
-- VAION — Cotizador: número correlativo de cotización
-- Necesario para el "N.º 0248" del nuevo diseño del PDF.
-- Autoincremental POR EMPRESA (no global), asignado por trigger al
-- insertar — así el cliente ve "cotización N.º 12", no un UUID.
-- ============================================================

ALTER TABLE cotizacion
  ADD COLUMN IF NOT EXISTS numero_correlativo integer;

CREATE OR REPLACE FUNCTION public.asignar_numero_correlativo_cotizacion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.numero_correlativo IS NULL THEN
    SELECT COALESCE(MAX(numero_correlativo), 0) + 1
    INTO NEW.numero_correlativo
    FROM cotizacion
    WHERE empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_numero_correlativo_cotizacion ON cotizacion;
CREATE TRIGGER trg_numero_correlativo_cotizacion
  BEFORE INSERT ON cotizacion
  FOR EACH ROW
  EXECUTE FUNCTION public.asignar_numero_correlativo_cotizacion();

-- Evita duplicados si dos inserts concurrentes calculan el mismo número
-- (poco probable en el volumen de uso actual, pero mejor que falle el
-- segundo insert a que dos cotizaciones queden con el mismo N.º).
ALTER TABLE cotizacion
  ADD CONSTRAINT cotizacion_empresa_numero_unico UNIQUE (empresa_id, numero_correlativo);

-- Cotizaciones ya creadas antes de este cambio no tienen número — se les
-- asigna uno ahora, en el orden en que se crearon.
WITH numerados AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY empresa_id ORDER BY created_at) AS n
  FROM cotizacion
  WHERE numero_correlativo IS NULL
)
UPDATE cotizacion
SET numero_correlativo = numerados.n
FROM numerados
WHERE cotizacion.id = numerados.id;
