-- ============================================================
-- VAION — Cotizador: esquema de base de datos (Etapa 2)
-- 10 entidades + tabla de configuración de tenant + RLS por empresa.
-- NO EJECUTADO TODAVÍA. Revisar antes de correr en Supabase SQL Editor.
-- ============================================================

-- ── Configuración por empresa (IVA, sección 6.2 de la spec) ───
CREATE TABLE IF NOT EXISTS cotizador_config (
  empresa_id       uuid PRIMARY KEY REFERENCES companies(id),
  iva_pct          numeric NOT NULL DEFAULT 19,
  iva_obra_factor  numeric NOT NULL DEFAULT 0.5,
  created_at       timestamptz DEFAULT now()
);

-- ── Catálogo maestro de partidas (sección 4) ───────────────────
CREATE TABLE IF NOT EXISTS partida_catalogo (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id               uuid NOT NULL REFERENCES companies(id),
  codigo                   text,
  descripcion              text NOT NULL,
  unidad_sugerida          text,
  costo_unitario_ref       numeric,
  familia                  text,
  activa                   boolean NOT NULL DEFAULT true,
  notas_internas           text,
  created_at               timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partida_catalogo_empresa ON partida_catalogo(empresa_id);

-- ── Cotización (sección 5 y 11) ─────────────────────────────────
-- cliente es texto libre, no fk a `clients`: en esta etapa el
-- cliente suele ser un prospecto que todavía no existe en esa tabla.
CREATE TABLE IF NOT EXISTS cotizacion (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL REFERENCES companies(id),
  cliente_nombre   text NOT NULL,
  cliente_contacto text,
  nombre_obra      text NOT NULL,
  direccion        text,
  propietario      text,
  fecha            date NOT NULL DEFAULT CURRENT_DATE,
  validez_dias     integer,
  estado           text NOT NULL DEFAULT 'borrador'
                     CHECK (estado IN ('borrador','emitida','aceptada','rechazada','expirada')),
  version_actual   integer NOT NULL DEFAULT 0,
  obra_id          uuid REFERENCES projects(id),  -- nulo en fase 1, ver sección 2 de la spec
  created_by       uuid REFERENCES users(id),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cotizacion_empresa ON cotizacion(empresa_id);

-- ── Versionamiento (sección 10) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS cotizacion_version (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id  uuid NOT NULL REFERENCES cotizacion(id) ON DELETE CASCADE,
  numero         integer NOT NULL,
  fecha_emision  timestamptz NOT NULL DEFAULT now(),
  autor          uuid REFERENCES users(id),
  aceptada       boolean NOT NULL DEFAULT false,
  snapshot       jsonb NOT NULL,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (cotizacion_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_cotizacion_version_cotizacion ON cotizacion_version(cotizacion_id);

-- ── Capítulo (sección 3, 6.1, 6.2) ──────────────────────────────
CREATE TABLE IF NOT EXISTS capitulo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id  uuid NOT NULL REFERENCES cotizacion(id) ON DELETE CASCADE,
  orden          integer NOT NULL DEFAULT 0,
  nombre         text NOT NULL,
  margen_pct     numeric,
  regimen_iva    text CHECK (regimen_iva IN ('obra','pleno')),
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capitulo_cotizacion ON capitulo(cotizacion_id);

-- ── Sub-bloque (sección 3) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS sub_bloque (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capitulo_id  uuid NOT NULL REFERENCES capitulo(id) ON DELETE CASCADE,
  orden        integer NOT NULL DEFAULT 0,
  nombre       text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_bloque_capitulo ON sub_bloque(capitulo_id);

-- ── Línea (sección 4 regla 3, sección 5, sección 7) ─────────────
CREATE TABLE IF NOT EXISTS linea (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_bloque_id          uuid NOT NULL REFERENCES sub_bloque(id) ON DELETE CASCADE,
  partida_id             uuid REFERENCES partida_catalogo(id),
  descripcion            text NOT NULL,
  unidad                 text,
  cantidad               numeric NOT NULL DEFAULT 1,
  costo_unit_catalogo    numeric,
  costo_unit_usado       numeric NOT NULL,
  precio_unit            numeric,
  estado                 text NOT NULL DEFAULT 'firme'
                            CHECK (estado IN ('firme','opcional','por_definir','excluido','descartado')),
  nota_interna           text,
  nota_cliente           text,
  motivo_override        text,
  orden                  integer NOT NULL DEFAULT 0,
  created_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linea_sub_bloque ON linea(sub_bloque_id);
CREATE INDEX IF NOT EXISTS idx_linea_partida ON linea(partida_id);

-- ── Paquete comercial (sección 8) ────────────────────────────────
CREATE TABLE IF NOT EXISTS paquete_comercial (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id  uuid NOT NULL REFERENCES cotizacion(id) ON DELETE CASCADE,
  nombre         text NOT NULL,
  orden          integer NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paquete_comercial_cotizacion ON paquete_comercial(cotizacion_id);

-- ── Paquete ↔ Capítulo/Sub-bloque (sección 8 regla 1) ───────────
CREATE TABLE IF NOT EXISTS paquete_capitulo (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paquete_id    uuid NOT NULL REFERENCES paquete_comercial(id) ON DELETE CASCADE,
  capitulo_id   uuid REFERENCES capitulo(id) ON DELETE CASCADE,
  sub_bloque_id uuid REFERENCES sub_bloque(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  CONSTRAINT paquete_capitulo_un_solo_destino CHECK (
    (capitulo_id IS NOT NULL)::int + (sub_bloque_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_paquete_capitulo_paquete ON paquete_capitulo(paquete_id);

-- ── Hito de pago (sección 8 regla 2 y 3) ─────────────────────────
CREATE TABLE IF NOT EXISTS hito_pago (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paquete_id   uuid NOT NULL REFERENCES paquete_comercial(id) ON DELETE CASCADE,
  orden        integer NOT NULL DEFAULT 0,
  glosa        text NOT NULL,
  porcentaje   numeric NOT NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hito_pago_paquete ON hito_pago(paquete_id);

-- ── Historial de precios (sección 4 regla 4) ────────────────────
-- cotizacion_id nulo cuando el precio se actualiza directo en el
-- catálogo (fuera del contexto de una cotización puntual).
CREATE TABLE IF NOT EXISTS historial_precio (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id     uuid NOT NULL REFERENCES partida_catalogo(id) ON DELETE CASCADE,
  cotizacion_id  uuid REFERENCES cotizacion(id),
  precio         numeric NOT NULL,
  fecha          timestamptz NOT NULL DEFAULT now(),
  usuario        uuid REFERENCES users(id),
  motivo         text,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_precio_partida ON historial_precio(partida_id);

-- ============================================================
-- RLS — acceso por empresa (dueno / administrativo)
-- Nota deliberada: a diferencia de las políticas legacy de VAION
-- (rls_role_based.sql), que NO filtran por empresa_id (gap de
-- seguridad ya documentado), estas políticas nuevas sí lo hacen
-- desde el día uno vía user_companies.empresa_id.
-- ============================================================

ALTER TABLE cotizador_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE partida_catalogo     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizacion           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizacion_version   ENABLE ROW LEVEL SECURITY;
ALTER TABLE capitulo             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_bloque           ENABLE ROW LEVEL SECURITY;
ALTER TABLE linea                ENABLE ROW LEVEL SECURITY;
ALTER TABLE paquete_comercial    ENABLE ROW LEVEL SECURITY;
ALTER TABLE paquete_capitulo     ENABLE ROW LEVEL SECURITY;
ALTER TABLE hito_pago            ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_precio     ENABLE ROW LEVEL SECURITY;

-- Helpers de navegación (evitan repetir el join completo en cada policy)
CREATE OR REPLACE FUNCTION public.cotizador_tiene_acceso(p_cotizacion_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM cotizacion c
    JOIN user_companies uc ON uc.empresa_id = c.empresa_id
    WHERE c.id = p_cotizacion_id
      AND uc.user_id = auth.uid()
      AND uc.rol IN ('dueno','administrativo')
  );
$$;

CREATE OR REPLACE FUNCTION public.cotizador_cotizacion_de_capitulo(p_capitulo_id uuid)
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT cotizacion_id FROM capitulo WHERE id = p_capitulo_id;
$$;

CREATE OR REPLACE FUNCTION public.cotizador_capitulo_de_sub_bloque(p_sub_bloque_id uuid)
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT capitulo_id FROM sub_bloque WHERE id = p_sub_bloque_id;
$$;

CREATE OR REPLACE FUNCTION public.cotizador_cotizacion_de_paquete(p_paquete_id uuid)
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT cotizacion_id FROM paquete_comercial WHERE id = p_paquete_id;
$$;

-- cotizador_config: acceso ligado a la empresa directamente
CREATE POLICY "cotizador_config_rls" ON cotizador_config
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_companies uc
      WHERE uc.user_id = auth.uid()
        AND uc.empresa_id = cotizador_config.empresa_id
        AND uc.rol IN ('dueno','administrativo')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_companies uc
      WHERE uc.user_id = auth.uid()
        AND uc.empresa_id = cotizador_config.empresa_id
        AND uc.rol IN ('dueno','administrativo')
    )
  );

-- partida_catalogo
CREATE POLICY "partida_catalogo_rls" ON partida_catalogo
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_companies uc
      WHERE uc.user_id = auth.uid()
        AND uc.empresa_id = partida_catalogo.empresa_id
        AND uc.rol IN ('dueno','administrativo')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_companies uc
      WHERE uc.user_id = auth.uid()
        AND uc.empresa_id = partida_catalogo.empresa_id
        AND uc.rol IN ('dueno','administrativo')
    )
  );

-- cotizacion
CREATE POLICY "cotizacion_rls" ON cotizacion
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_companies uc
      WHERE uc.user_id = auth.uid()
        AND uc.empresa_id = cotizacion.empresa_id
        AND uc.rol IN ('dueno','administrativo')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_companies uc
      WHERE uc.user_id = auth.uid()
        AND uc.empresa_id = cotizacion.empresa_id
        AND uc.rol IN ('dueno','administrativo')
    )
  );

-- cotizacion_version
CREATE POLICY "cotizacion_version_rls" ON cotizacion_version
  FOR ALL TO authenticated
  USING (cotizador_tiene_acceso(cotizacion_version.cotizacion_id))
  WITH CHECK (cotizador_tiene_acceso(cotizacion_version.cotizacion_id));

-- capitulo
CREATE POLICY "capitulo_rls" ON capitulo
  FOR ALL TO authenticated
  USING (cotizador_tiene_acceso(capitulo.cotizacion_id))
  WITH CHECK (cotizador_tiene_acceso(capitulo.cotizacion_id));

-- sub_bloque
CREATE POLICY "sub_bloque_rls" ON sub_bloque
  FOR ALL TO authenticated
  USING (cotizador_tiene_acceso(cotizador_cotizacion_de_capitulo(sub_bloque.capitulo_id)))
  WITH CHECK (cotizador_tiene_acceso(cotizador_cotizacion_de_capitulo(sub_bloque.capitulo_id)));

-- linea
CREATE POLICY "linea_rls" ON linea
  FOR ALL TO authenticated
  USING (
    cotizador_tiene_acceso(
      cotizador_cotizacion_de_capitulo(
        cotizador_capitulo_de_sub_bloque(linea.sub_bloque_id)
      )
    )
  )
  WITH CHECK (
    cotizador_tiene_acceso(
      cotizador_cotizacion_de_capitulo(
        cotizador_capitulo_de_sub_bloque(linea.sub_bloque_id)
      )
    )
  );

-- paquete_comercial
CREATE POLICY "paquete_comercial_rls" ON paquete_comercial
  FOR ALL TO authenticated
  USING (cotizador_tiene_acceso(paquete_comercial.cotizacion_id))
  WITH CHECK (cotizador_tiene_acceso(paquete_comercial.cotizacion_id));

-- paquete_capitulo
CREATE POLICY "paquete_capitulo_rls" ON paquete_capitulo
  FOR ALL TO authenticated
  USING (cotizador_tiene_acceso(cotizador_cotizacion_de_paquete(paquete_capitulo.paquete_id)))
  WITH CHECK (cotizador_tiene_acceso(cotizador_cotizacion_de_paquete(paquete_capitulo.paquete_id)));

-- hito_pago
CREATE POLICY "hito_pago_rls" ON hito_pago
  FOR ALL TO authenticated
  USING (cotizador_tiene_acceso(cotizador_cotizacion_de_paquete(hito_pago.paquete_id)))
  WITH CHECK (cotizador_tiene_acceso(cotizador_cotizacion_de_paquete(hito_pago.paquete_id)));

-- historial_precio: cotizacion_id puede ser nulo (edición directa de catálogo)
CREATE POLICY "historial_precio_rls" ON historial_precio
  FOR ALL TO authenticated
  USING (
    (historial_precio.cotizacion_id IS NOT NULL AND cotizador_tiene_acceso(historial_precio.cotizacion_id))
    OR (
      historial_precio.cotizacion_id IS NULL
      AND EXISTS (
        SELECT 1 FROM partida_catalogo pc
        JOIN user_companies uc ON uc.empresa_id = pc.empresa_id
        WHERE pc.id = historial_precio.partida_id
          AND uc.user_id = auth.uid()
          AND uc.rol IN ('dueno','administrativo')
      )
    )
  )
  WITH CHECK (
    (historial_precio.cotizacion_id IS NOT NULL AND cotizador_tiene_acceso(historial_precio.cotizacion_id))
    OR (
      historial_precio.cotizacion_id IS NULL
      AND EXISTS (
        SELECT 1 FROM partida_catalogo pc
        JOIN user_companies uc ON uc.empresa_id = pc.empresa_id
        WHERE pc.id = historial_precio.partida_id
          AND uc.user_id = auth.uid()
          AND uc.rol IN ('dueno','administrativo')
      )
    )
  );
