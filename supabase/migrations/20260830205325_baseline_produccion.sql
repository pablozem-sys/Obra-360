SET local check_function_bodies = off;

CREATE TABLE "public"."accounts_payable" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "project_id"        uuid,
  "proveedor"         text,
  "monto"             numeric,
  "fecha_emision"     date,
  "fecha_vencimiento" date,
  "estado"            text                     DEFAULT 'pendiente'::text,
  "documento_url"     text,
  "responsable_id"    uuid,
  "descripcion"       text,
  "created_at"        timestamp with time zone DEFAULT now(),
  "empresa_id"        uuid,
  CONSTRAINT "accounts_payable_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."accounts_payable"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."accounts_receivable" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "project_id"       uuid,
  "client_id"        uuid,
  "monto_contrato"   numeric,
  "cobrado"          numeric                  DEFAULT 0,
  "saldo_pendiente"  numeric,
  "fecha_compromiso" date,
  "estado"           text                     DEFAULT 'pendiente'::text,
  "descripcion"      text,
  "created_at"       timestamp with time zone DEFAULT now(),
  "empresa_id"       uuid,
  CONSTRAINT "accounts_receivable_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."accounts_receivable"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."additional_sales" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "project_id"    uuid,
  "descripcion"   text                     NOT NULL,
  "monto"         numeric                  NOT NULL,
  "created_at"    timestamp with time zone DEFAULT now(),
  "documento_url" text,
  "tipo"          text                     DEFAULT 'adicional'::text,
  CONSTRAINT "additional_sales_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."additional_sales"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."attendance" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "worker_id"        uuid,
  "project_id"       uuid,
  "fecha"            date                     NOT NULL,
  "entrada"          timestamp with time zone NOT NULL,
  "lat_entrada"      numeric,
  "lng_entrada"      numeric,
  "salida"           timestamp with time zone,
  "lat_salida"       numeric,
  "lng_salida"       numeric,
  "horas_trabajadas" numeric,
  "valor_hora"       integer                  NOT NULL,
  "costo_total"      numeric,
  "created_at"       timestamp with time zone DEFAULT now(),
  "bono"             numeric                  DEFAULT 0,
  CONSTRAINT "attendance_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."attendance"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."banos_quimicos_pagos" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "bano_id"     uuid                     NOT NULL,
  "fecha_pago"  date                     NOT NULL,
  "monto"       numeric                  NOT NULL,
  "descripcion" text,
  "created_at"  timestamp with time zone DEFAULT now(),
  CONSTRAINT "banos_quimicos_pagos_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."banos_quimicos_pagos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."banos_quimicos" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "empresa_id"    uuid,
  "project_id"    uuid,
  "proveedor"     text                     NOT NULL DEFAULT 'Portolet'::text,
  "fecha_entrada" date                     NOT NULL,
  "fecha_salida"  date,
  "monto_mensual" numeric                  NOT NULL,
  "notas"         text,
  "estado"        text                     NOT NULL DEFAULT 'activo'::text,
  "pagado"        boolean                  NOT NULL DEFAULT false,
  "created_at"    timestamp with time zone DEFAULT now(),
  "expense_id"    uuid,
  CONSTRAINT "banos_quimicos_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."banos_quimicos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."capitulo" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "cotizacion_id" uuid                     NOT NULL,
  "orden"         integer                  NOT NULL DEFAULT 0,
  "nombre"        text                     NOT NULL,
  "margen_pct"    numeric,
  "regimen_iva"   text,
  "created_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "capitulo_pkey" PRIMARY KEY (id),
  CONSTRAINT "capitulo_regimen_iva_check" CHECK ((regimen_iva = ANY (ARRAY['obra'::text, 'pleno'::text])))
);

ALTER TABLE "public"."capitulo"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."clients" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nombre"     text                     NOT NULL,
  "email"      text,
  "telefono"   text,
  "created_at" timestamp with time zone DEFAULT now(),
  "empresa_id" uuid,
  CONSTRAINT "clients_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."clients"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."companies" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nombre"     text                     NOT NULL,
  "slug"       text                     NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "companies_pkey" PRIMARY KEY (id),
  CONSTRAINT "companies_slug_key" UNIQUE (slug)
);

ALTER TABLE "public"."companies"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."cotizacion_version" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "cotizacion_id" uuid                     NOT NULL,
  "numero"        integer                  NOT NULL,
  "fecha_emision" timestamp with time zone NOT NULL DEFAULT now(),
  "autor"         uuid,
  "aceptada"      boolean                  NOT NULL DEFAULT false,
  "snapshot"      jsonb                    NOT NULL,
  "created_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "cotizacion_version_cotizacion_id_numero_key" UNIQUE (cotizacion_id, numero),
  CONSTRAINT "cotizacion_version_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."cotizacion_version"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."cotizacion" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "empresa_id"       uuid                     NOT NULL,
  "cliente_nombre"   text                     NOT NULL,
  "cliente_contacto" text,
  "nombre_obra"      text                     NOT NULL,
  "direccion"        text,
  "propietario"      text,
  "fecha"            date                     NOT NULL DEFAULT CURRENT_DATE,
  "validez_dias"     integer,
  "estado"           text                     NOT NULL DEFAULT 'borrador'::text,
  "version_actual"   integer                  NOT NULL DEFAULT 0,
  "obra_id"          uuid,
  "created_by"       uuid,
  "created_at"       timestamp with time zone DEFAULT now(),
  CONSTRAINT "cotizacion_estado_check" CHECK ((estado = ANY (ARRAY['borrador'::text, 'emitida'::text, 'aceptada'::text, 'rechazada'::text, 'expirada'::text]))),
  CONSTRAINT "cotizacion_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."cotizacion"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."cotizador_config" (
  "empresa_id"      uuid                     NOT NULL,
  "iva_pct"         numeric                  NOT NULL DEFAULT 19,
  "iva_obra_factor" numeric                  NOT NULL DEFAULT 0.5,
  "created_at"      timestamp with time zone DEFAULT now(),
  CONSTRAINT "cotizador_config_pkey" PRIMARY KEY (empresa_id)
);

ALTER TABLE "public"."cotizador_config"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."descuento_tramo" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "empresa_id"     uuid                     NOT NULL,
  "familia"        text                     NOT NULL,
  "cantidad_desde" numeric                  NOT NULL,
  "cantidad_hasta" numeric,
  "porcentaje"     numeric                  NOT NULL,
  "created_at"     timestamp with time zone DEFAULT now(),
  CONSTRAINT "descuento_tramo_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."descuento_tramo"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."documents" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "project_id"  uuid,
  "tipo"        text,
  "nombre"      text,
  "archivo_url" text,
  "fecha"       date,
  "proveedor"   text,
  "monto"       numeric,
  "categoria"   text,
  "tamaño"      text,
  "created_at"  timestamp with time zone DEFAULT now(),
  "empresa_id"  uuid,
  CONSTRAINT "documents_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."documents"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."expenses" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "project_id"        uuid,
  "monto"             numeric                  NOT NULL,
  "categoria"         text,
  "proveedor"         text,
  "fecha"             date,
  "medio_pago"        text,
  "comentario"        text,
  "documento_url"     text,
  "lat"               numeric,
  "lng"               numeric,
  "usuario_id"        uuid,
  "estado"            text                     DEFAULT 'pendiente'::text,
  "created_at"        timestamp with time zone DEFAULT now(),
  "plazo_credito"     integer,
  "empresa_id"        uuid,
  "fecha_vencimiento" date,
  CONSTRAINT "expenses_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."expenses"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."geolocation_logs" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "project_id" uuid,
  "expense_id" uuid,
  "lat"        numeric,
  "lng"        numeric,
  "usuario_id" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "geolocation_logs_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."geolocation_logs"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."historial_precio" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "partida_id"    uuid                     NOT NULL,
  "cotizacion_id" uuid,
  "precio"        numeric                  NOT NULL,
  "fecha"         timestamp with time zone NOT NULL DEFAULT now(),
  "usuario"       uuid,
  "motivo"        text,
  "created_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "historial_precio_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."historial_precio"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."hito_pago" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "paquete_id" uuid                     NOT NULL,
  "orden"      integer                  NOT NULL DEFAULT 0,
  "glosa"      text                     NOT NULL,
  "porcentaje" numeric                  NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "hito_pago_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."hito_pago"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."income" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "project_id"  uuid,
  "tipo"        text,
  "monto"       numeric                  NOT NULL,
  "fecha"       date,
  "descripcion" text,
  "medio_pago"  text,
  "estado"      text                     DEFAULT 'pendiente'::text,
  "created_at"  timestamp with time zone DEFAULT now(),
  "empresa_id"  uuid,
  CONSTRAINT "income_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."income"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."linea" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "sub_bloque_id"       uuid                     NOT NULL,
  "partida_id"          uuid,
  "descripcion"         text                     NOT NULL,
  "unidad"              text,
  "cantidad"            numeric                  NOT NULL DEFAULT 1,
  "costo_unit_catalogo" numeric,
  "costo_unit_usado"    numeric,
  "precio_unit"         numeric,
  "estado"              text                     NOT NULL DEFAULT 'firme'::text,
  "nota_interna"        text,
  "nota_cliente"        text,
  "motivo_override"     text,
  "orden"               integer                  NOT NULL DEFAULT 0,
  "created_at"          timestamp with time zone DEFAULT now(),
  CONSTRAINT "linea_estado_check" CHECK ((estado = ANY (ARRAY['firme'::text, 'opcional'::text, 'por_definir'::text, 'excluido'::text, 'descartado'::text]))),
  CONSTRAINT "linea_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."linea"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."paquete_capitulo" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "paquete_id"    uuid                     NOT NULL,
  "capitulo_id"   uuid,
  "sub_bloque_id" uuid,
  "created_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "paquete_capitulo_pkey" PRIMARY KEY (id),
  CONSTRAINT "paquete_capitulo_un_solo_destino" CHECK (((((capitulo_id IS NOT NULL))::integer + ((sub_bloque_id IS NOT NULL))::integer) = 1))
);

ALTER TABLE "public"."paquete_capitulo"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."paquete_comercial" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "cotizacion_id" uuid                     NOT NULL,
  "nombre"        text                     NOT NULL,
  "orden"         integer                  NOT NULL DEFAULT 0,
  "created_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "paquete_comercial_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."paquete_comercial"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."partida_catalogo" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "empresa_id"         uuid                     NOT NULL,
  "codigo"             text,
  "descripcion"        text                     NOT NULL,
  "unidad_sugerida"    text,
  "costo_unitario_ref" numeric,
  "familia"            text,
  "activa"             boolean                  NOT NULL DEFAULT true,
  "notas_internas"     text,
  "created_at"         timestamp with time zone DEFAULT now(),
  "linea_producto"     text,
  "cobertura_m2_caja"  numeric,
  CONSTRAINT "partida_catalogo_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."partida_catalogo"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."projects" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nombre"         text                     NOT NULL,
  "client_id"      uuid,
  "direccion"      text,
  "tipo"           text,
  "fecha_inicio"   date,
  "fecha_termino"  date,
  "presupuesto"    numeric,
  "responsable_id" uuid,
  "estado"         text                     DEFAULT 'cotizada'::text,
  "lat"            numeric,
  "lng"            numeric,
  "descripcion"    text,
  "avance"         integer                  DEFAULT 0,
  "created_at"     timestamp with time zone DEFAULT now(),
  "empresa_id"     uuid,
  CONSTRAINT "projects_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."projects"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."providers" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nombre"     text                     NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "providers_nombre_key" UNIQUE (nombre),
  CONSTRAINT "providers_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."providers"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."sub_bloque" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "capitulo_id" uuid                     NOT NULL,
  "orden"       integer                  NOT NULL DEFAULT 0,
  "nombre"      text                     NOT NULL,
  "created_at"  timestamp with time zone DEFAULT now(),
  CONSTRAINT "sub_bloque_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."sub_bloque"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."tasks" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "empresa_id"   uuid,
  "tarea"        text                     NOT NULL,
  "obra_id"      uuid,
  "status"       text                     NOT NULL DEFAULT 'pendiente'::text,
  "created_at"   timestamp with time zone DEFAULT now(),
  "completed_at" timestamp with time zone,
  CONSTRAINT "tasks_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."tasks"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."user_companies" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid,
  "empresa_id" uuid,
  "rol"        text                     NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "user_companies_pkey" PRIMARY KEY (id),
  CONSTRAINT "user_companies_rol_check" CHECK ((rol = ANY (ARRAY['dueno'::text, 'administrativo'::text]))),
  CONSTRAINT "user_companies_user_id_empresa_id_key" UNIQUE (user_id, empresa_id)
);

ALTER TABLE "public"."user_companies"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."users" (
  "id"         uuid                     NOT NULL,
  "nombre"     text                     NOT NULL,
  "email"      text,
  "rol"        text                     NOT NULL DEFAULT 'administrativo'::text,
  "avatar"     text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "users_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."users"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."worker_projects" (
  "worker_id"  uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "empresa_id" uuid,
  CONSTRAINT "worker_projects_pkey" PRIMARY KEY (worker_id, project_id)
);

ALTER TABLE "public"."worker_projects"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."workers" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nombre"     text                     NOT NULL,
  "avatar"     text,
  "valor_hora" integer                  NOT NULL DEFAULT 5000,
  "activo"     boolean                  NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "pin"        text,
  "empresa_id" uuid,
  CONSTRAINT "workers_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."workers"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cotizador_capitulo_de_sub_bloque (
  p_sub_bloque_id uuid
)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  SELECT capitulo_id FROM sub_bloque WHERE id = p_sub_bloque_id;
$function$;

CREATE OR REPLACE FUNCTION public.cotizador_cotizacion_de_capitulo (
  p_capitulo_id uuid
)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  SELECT cotizacion_id FROM capitulo WHERE id = p_capitulo_id;
$function$;

CREATE OR REPLACE FUNCTION public.cotizador_cotizacion_de_paquete (
  p_paquete_id uuid
)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  SELECT cotizacion_id FROM paquete_comercial WHERE id = p_paquete_id;
$function$;

CREATE OR REPLACE FUNCTION public.cotizador_tiene_acceso (
  p_cotizacion_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  SELECT EXISTS (
    SELECT 1 FROM cotizacion c
    JOIN user_companies uc ON uc.empresa_id = c.empresa_id
    WHERE c.id = p_cotizacion_id
      AND uc.user_id = auth.uid()
      AND uc.rol IN ('dueno','administrativo')
  );
$function$;

CREATE OR REPLACE FUNCTION public.create_user_profile (
  user_id     uuid,
  user_email  text,
  user_nombre text,
  user_rol    text,
  user_avatar text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  BEGIN
    INSERT INTO public.users (id, email, nombre, rol, avatar)
    VALUES (user_id, user_email, user_nombre, user_rol, user_avatar)                                                    
    ON CONFLICT (id) DO UPDATE SET
      nombre = EXCLUDED.nombre,                                                                                         
      rol    = EXCLUDED.rol,                                
      avatar = EXCLUDED.avatar;                                                                                         
  END;
  $function$;

CREATE OR REPLACE FUNCTION public.delete_obra (
  p_project_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$                                         
  BEGIN
    DELETE FROM accounts_receivable WHERE project_id = p_project_id;                                                    
    DELETE FROM accounts_payable WHERE project_id = p_project_id;                                                       
    DELETE FROM worker_projects WHERE project_id = p_project_id;
    DELETE FROM attendance WHERE project_id = p_project_id;                                                             
    DELETE FROM projects WHERE id = p_project_id;              
  END; $function$;

CREATE OR REPLACE FUNCTION public.delete_user (
  user_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
begin
  if not is_dueno() then
    raise exception 'No autorizado';
  end if;

  delete from public.user_companies where user_companies.user_id = delete_user.user_id;
  delete from public.users where id = delete_user.user_id;
  delete from auth.users where id = delete_user.user_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_worker (
  p_worker_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$                                         
  BEGIN
    DELETE FROM worker_projects WHERE worker_id = p_worker_id;                                                          
    DELETE FROM attendance WHERE worker_id = p_worker_id;      
    DELETE FROM workers WHERE id = p_worker_id;                                                                         
  END; $function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis (
  p_empresa_id uuid,
  p_month      text DEFAULT NULL::text
)
  RETURNS TABLE (
    venta_adicional numeric,
    total_abonos    numeric,
    total_mano_obra numeric,
    gastos_cdo      numeric,
    gastos_gav      numeric,
    total_gastos    numeric
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
  select
    coalesce((
      select sum(case when s.tipo = 'descuento' then -s.monto else s.monto end)
      from public.additional_sales s
      join public.projects p on p.id = s.project_id
      where p.empresa_id = p_empresa_id
        and (p_month is null or to_char(s.created_at, 'YYYY-MM') = p_month)
    ), 0) as venta_adicional,
    coalesce((
      select sum(i.monto)
      from public.income i
      where i.empresa_id = p_empresa_id
        and (p_month is null or to_char(i.fecha::date, 'YYYY-MM') = p_month)
    ), 0) as total_abonos,
    coalesce((
      select sum(a.costo_total)
      from public.attendance a
      join public.projects p on p.id = a.project_id
      where p.empresa_id = p_empresa_id
        and (p_month is null or to_char(a.fecha::date, 'YYYY-MM') = p_month)
    ), 0) as total_mano_obra,
    coalesce((
      select sum(e.monto)
      from public.expenses e
      where e.empresa_id = p_empresa_id
        and e.categoria in (
          'materiales', 'subcontratos', 'equipos', 'aridos', 'retiro_escombros',
          'banio_quimico', 'flete', 'otros_operacion', 'mano_obra', 'transporte'
        )
        and (p_month is null or to_char(e.fecha::date, 'YYYY-MM') = p_month)
    ), 0) as gastos_cdo,
    coalesce((
      select sum(e.monto)
      from public.expenses e
      where e.empresa_id = p_empresa_id
        and e.categoria in (
          'sueldos', 'publicidad', 'marketing', 'bencina', 'herramientas',
          'arriendo', 'cuentas', 'retiros', 'imposiciones', 'autopistas', 'otros'
        )
        and (p_month is null or to_char(e.fecha::date, 'YYYY-MM') = p_month)
    ), 0) as gastos_gav,
    coalesce((
      select sum(e.monto)
      from public.expenses e
      where e.empresa_id = p_empresa_id
        and (p_month is null or to_char(e.fecha::date, 'YYYY-MM') = p_month)
    ), 0) as total_gastos;
$function$;

CREATE OR REPLACE FUNCTION public.get_flujo_caja_mensual (
  p_empresa_id uuid,
  p_meses      integer DEFAULT 8
)
  RETURNS TABLE (
    mes      text,
    ingresos numeric,
    egresos  numeric
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
  select
    coalesce(i.mes, e.mes) as mes,
    coalesce(i.total, 0)   as ingresos,
    coalesce(e.total, 0)   as egresos
  from (
    select to_char(fecha::date, 'YYYY-MM') as mes, sum(monto) as total
    from public.income
    where empresa_id = p_empresa_id and fecha is not null
    group by 1
  ) i
  full outer join (
    select to_char(fecha::date, 'YYYY-MM') as mes, sum(monto) as total
    from public.expenses
    where empresa_id = p_empresa_id and fecha is not null
    group by 1
  ) e on e.mes = i.mes
  order by coalesce(i.mes, e.mes) desc nulls last
  limit p_meses;
$function$;

CREATE OR REPLACE FUNCTION public.get_flujo_caja_semanal (
  p_empresa_id uuid,
  p_semanas    integer DEFAULT 8
)
  RETURNS TABLE (
    semana   date,
    ingresos numeric,
    egresos  numeric
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
  select
    coalesce(i.semana, e.semana) as semana,
    coalesce(i.total, 0) as ingresos,
    coalesce(e.total, 0) as egresos
  from (
    select (fecha::date - extract(dow from fecha::date)::int) as semana, sum(monto) as total
    from public.income
    where empresa_id = p_empresa_id and fecha is not null
    group by 1
  ) i
  full outer join (
    select (fecha::date - extract(dow from fecha::date)::int) as semana, sum(monto) as total
    from public.expenses
    where empresa_id = p_empresa_id and fecha is not null
    group by 1
  ) e on e.semana = i.semana
  order by coalesce(i.semana, e.semana) desc nulls last
  limit p_semanas;
$function$;

CREATE OR REPLACE FUNCTION public.get_meses_disponibles (
  p_empresa_id uuid
)
  RETURNS TABLE (
    mes text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
  select distinct mes from (
    select to_char(e.fecha::date, 'YYYY-MM') as mes
    from public.expenses e
    where e.empresa_id = p_empresa_id
    union
    select to_char(i.fecha::date, 'YYYY-MM')
    from public.income i
    where i.empresa_id = p_empresa_id
    union
    select to_char(a.fecha::date, 'YYYY-MM')
    from public.attendance a
    join public.projects p on p.id = a.project_id
    where p.empresa_id = p_empresa_id
    union
    select to_char(s.created_at, 'YYYY-MM')
    from public.additional_sales s
    join public.projects p on p.id = s.project_id
    where p.empresa_id = p_empresa_id
  ) meses
  where mes is not null
  order by mes desc;
$function$;

CREATE OR REPLACE FUNCTION public.get_obra_metrics (
  p_empresa_id uuid
)
  RETURNS TABLE (
    project_id  uuid,
    cdo         numeric,
    costo_mod   numeric,
    adicionales numeric,
    descuentos  numeric,
    abonos      numeric
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
  select
    p.id as project_id,
    coalesce(e.cdo, 0)          as cdo,
    coalesce(a.costo_mod, 0)    as costo_mod,
    coalesce(s.adicionales, 0)  as adicionales,
    coalesce(s.descuentos, 0)   as descuentos,
    coalesce(i.abonos, 0)       as abonos
  from public.projects p
  left join (
    select project_id, sum(monto) as cdo
    from public.expenses
    where empresa_id = p_empresa_id
      and categoria in (
        'materiales', 'subcontratos', 'equipos', 'aridos', 'retiro_escombros',
        'banio_quimico', 'flete', 'otros_operacion', 'mano_obra', 'transporte'
      )
    group by project_id
  ) e on e.project_id = p.id
  left join (
    select project_id, sum(costo_total) as costo_mod
    from public.attendance
    where project_id is not null
    group by project_id
  ) a on a.project_id = p.id
  left join (
    select
      project_id,
      sum(monto) filter (where tipo <> 'descuento') as adicionales,
      sum(monto) filter (where tipo = 'descuento')  as descuentos
    from public.additional_sales
    group by project_id
  ) s on s.project_id = p.id
  left join (
    select project_id, sum(monto) as abonos
    from public.income
    where empresa_id = p_empresa_id
    group by project_id
  ) i on i.project_id = p.id
  where p.empresa_id = p_empresa_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_workers()
  RETURNS TABLE (
    id     uuid,
    nombre text,
    avatar text
  )
  LANGUAGE sql
  SECURITY DEFINER
  AS $function$                                                               
    SELECT id, nombre, avatar FROM workers WHERE activo = true ORDER BY nombre;                                         
  $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_companies()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
  begin
    if new.email = 'aballesteros@vaconstructora.cl' then
      insert into user_companies (user_id, empresa_id, rol)
      values (
        new.id,
        (select id from companies where slug = 'va-constructora'),
        'dueno'
      ) on conflict (user_id, empresa_id) do nothing;
    end if;
    return new;
  end;
  $function$;

CREATE OR REPLACE FUNCTION public.is_administrativo()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND rol = 'administrativo'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = auth.uid() AND rol = 'administrativo'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_dueno()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
    SELECT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND rol = 'dueno'
    )
    OR EXISTS (
      SELECT 1 FROM public.user_companies
      WHERE user_id = auth.uid() AND rol = 'dueno'
    );
  $function$;

CREATE OR REPLACE FUNCTION public.verify_worker_pin (
  p_worker_id uuid,
  p_pin       text
)
  RETURNS TABLE (
    id         uuid,
    nombre     text,
    avatar     text,
    valor_hora integer
  )
  LANGUAGE sql
  SECURITY DEFINER
  AS $function$                                           
    SELECT id, nombre, avatar, valor_hora                   
    FROM workers                                                                                                        
    WHERE id = p_worker_id AND pin = p_pin AND activo = true;
  $function$;

CREATE OR REPLACE FUNCTION public.verify_worker_pin_only (
  p_pin          text,
  p_company_slug text
)
  RETURNS TABLE (
    id         uuid,
    nombre     text,
    avatar     text,
    valor_hora numeric
  )
  LANGUAGE sql
  SECURITY DEFINER
  AS $function$
  SELECT w.id, w.nombre, w.avatar, w.valor_hora
  FROM workers w
  JOIN companies c ON c.id = w.empresa_id
  WHERE w.pin = p_pin AND w.activo = true AND c.slug = p_company_slug
  LIMIT 1;
$function$;

ALTER TABLE "public"."banos_quimicos_pagos"
  ADD CONSTRAINT "banos_quimicos_pagos_bano_id_fkey" FOREIGN KEY (bano_id) REFERENCES public.banos_quimicos(id) ON DELETE CASCADE;

ALTER TABLE "public"."accounts_receivable"
  ADD CONSTRAINT "accounts_receivable_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(id);

ALTER TABLE "public"."accounts_payable"
  ADD CONSTRAINT "accounts_payable_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.companies(id);

ALTER TABLE "public"."accounts_receivable"
  ADD CONSTRAINT "accounts_receivable_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.companies(id);

ALTER TABLE "public"."banos_quimicos"
  ADD CONSTRAINT "banos_quimicos_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE "public"."clients"
  ADD CONSTRAINT "clients_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.companies(id);

ALTER TABLE "public"."cotizacion"
  ADD CONSTRAINT "cotizacion_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.companies(id);

ALTER TABLE "public"."capitulo"
  ADD CONSTRAINT "capitulo_cotizacion_id_fkey" FOREIGN KEY (cotizacion_id) REFERENCES public.cotizacion(id) ON DELETE CASCADE;

ALTER TABLE "public"."cotizacion_version"
  ADD CONSTRAINT "cotizacion_version_cotizacion_id_fkey" FOREIGN KEY (cotizacion_id) REFERENCES public.cotizacion(id) ON DELETE CASCADE;

ALTER TABLE "public"."cotizador_config"
  ADD CONSTRAINT "cotizador_config_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.companies(id);

ALTER TABLE "public"."descuento_tramo"
  ADD CONSTRAINT "descuento_tramo_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.companies(id);

ALTER TABLE "public"."documents"
  ADD CONSTRAINT "documents_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.companies(id);

ALTER TABLE "public"."expenses"
  ADD CONSTRAINT "expenses_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.companies(id);

ALTER TABLE "public"."banos_quimicos"
  ADD CONSTRAINT "banos_quimicos_expense_id_fkey" FOREIGN KEY (expense_id) REFERENCES public.expenses(id);

ALTER TABLE "public"."geolocation_logs"
  ADD CONSTRAINT "geolocation_logs_expense_id_fkey" FOREIGN KEY (expense_id) REFERENCES public.expenses(id);

ALTER TABLE "public"."historial_precio"
  ADD CONSTRAINT "historial_precio_cotizacion_id_fkey" FOREIGN KEY (cotizacion_id) REFERENCES public.cotizacion(id);

ALTER TABLE "public"."income"
  ADD CONSTRAINT "income_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.companies(id);

ALTER TABLE "public"."paquete_capitulo"
  ADD CONSTRAINT "paquete_capitulo_capitulo_id_fkey" FOREIGN KEY (capitulo_id) REFERENCES public.capitulo(id) ON DELETE CASCADE;

ALTER TABLE "public"."paquete_comercial"
  ADD CONSTRAINT "paquete_comercial_cotizacion_id_fkey" FOREIGN KEY (cotizacion_id) REFERENCES public.cotizacion(id) ON DELETE CASCADE;

ALTER TABLE "public"."hito_pago"
  ADD CONSTRAINT "hito_pago_paquete_id_fkey" FOREIGN KEY (paquete_id) REFERENCES public.paquete_comercial(id) ON DELETE CASCADE;

ALTER TABLE "public"."paquete_capitulo"
  ADD CONSTRAINT "paquete_capitulo_paquete_id_fkey" FOREIGN KEY (paquete_id) REFERENCES public.paquete_comercial(id) ON DELETE CASCADE;

ALTER TABLE "public"."partida_catalogo"
  ADD CONSTRAINT "partida_catalogo_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.companies(id);

ALTER TABLE "public"."historial_precio"
  ADD CONSTRAINT "historial_precio_partida_id_fkey" FOREIGN KEY (partida_id) REFERENCES public.partida_catalogo(id) ON DELETE CASCADE;

ALTER TABLE "public"."linea"
  ADD CONSTRAINT "linea_partida_id_fkey" FOREIGN KEY (partida_id) REFERENCES public.partida_catalogo(id);

ALTER TABLE "public"."projects"
  ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(id);

ALTER TABLE "public"."projects"
  ADD CONSTRAINT "projects_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.companies(id);

ALTER TABLE "public"."accounts_payable"
  ADD CONSTRAINT "accounts_payable_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id);

ALTER TABLE "public"."accounts_receivable"
  ADD CONSTRAINT "accounts_receivable_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id);

ALTER TABLE "public"."additional_sales"
  ADD CONSTRAINT "additional_sales_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."attendance"
  ADD CONSTRAINT "attendance_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id);

ALTER TABLE "public"."banos_quimicos"
  ADD CONSTRAINT "banos_quimicos_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE "public"."cotizacion"
  ADD CONSTRAINT "cotizacion_obra_id_fkey" FOREIGN KEY (obra_id) REFERENCES public.projects(id);

ALTER TABLE "public"."documents"
  ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."expenses"
  ADD CONSTRAINT "expenses_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."geolocation_logs"
  ADD CONSTRAINT "geolocation_logs_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id);

ALTER TABLE "public"."income"
  ADD CONSTRAINT "income_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."sub_bloque"
  ADD CONSTRAINT "sub_bloque_capitulo_id_fkey" FOREIGN KEY (capitulo_id) REFERENCES public.capitulo(id) ON DELETE CASCADE;

ALTER TABLE "public"."linea"
  ADD CONSTRAINT "linea_sub_bloque_id_fkey" FOREIGN KEY (sub_bloque_id) REFERENCES public.sub_bloque(id) ON DELETE CASCADE;

ALTER TABLE "public"."paquete_capitulo"
  ADD CONSTRAINT "paquete_capitulo_sub_bloque_id_fkey" FOREIGN KEY (sub_bloque_id) REFERENCES public.sub_bloque(id) ON DELETE CASCADE;

ALTER TABLE "public"."tasks"
  ADD CONSTRAINT "tasks_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE "public"."tasks"
  ADD CONSTRAINT "tasks_obra_id_fkey" FOREIGN KEY (obra_id) REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE "public"."user_companies"
  ADD CONSTRAINT "user_companies_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE "public"."users"
  ADD CONSTRAINT "users_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."accounts_payable"
  ADD CONSTRAINT "accounts_payable_responsable_id_fkey" FOREIGN KEY (responsable_id) REFERENCES public.users(id);

ALTER TABLE "public"."cotizacion"
  ADD CONSTRAINT "cotizacion_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE "public"."cotizacion_version"
  ADD CONSTRAINT "cotizacion_version_autor_fkey" FOREIGN KEY (autor) REFERENCES public.users(id);

ALTER TABLE "public"."expenses"
  ADD CONSTRAINT "expenses_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES public.users(id);

ALTER TABLE "public"."geolocation_logs"
  ADD CONSTRAINT "geolocation_logs_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES public.users(id);

ALTER TABLE "public"."historial_precio"
  ADD CONSTRAINT "historial_precio_usuario_fkey" FOREIGN KEY (usuario) REFERENCES public.users(id);

ALTER TABLE "public"."projects"
  ADD CONSTRAINT "projects_responsable_id_fkey" FOREIGN KEY (responsable_id) REFERENCES public.users(id);

ALTER TABLE "public"."user_companies"
  ADD CONSTRAINT "user_companies_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."worker_projects"
  ADD CONSTRAINT "worker_projects_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.companies(id);

ALTER TABLE "public"."worker_projects"
  ADD CONSTRAINT "worker_projects_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."workers"
  ADD CONSTRAINT "workers_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES public.companies(id);

ALTER TABLE "public"."attendance"
  ADD CONSTRAINT "attendance_worker_id_fkey" FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE CASCADE;

ALTER TABLE "public"."worker_projects"
  ADD CONSTRAINT "worker_projects_worker_id_fkey" FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE CASCADE;

CREATE INDEX idx_capitulo_cotizacion ON public.capitulo USING btree (cotizacion_id);

CREATE INDEX idx_cotizacion_empresa ON public.cotizacion USING btree (empresa_id);

CREATE INDEX idx_cotizacion_version_cotizacion ON public.cotizacion_version USING btree (cotizacion_id);

CREATE INDEX idx_descuento_tramo_empresa ON public.descuento_tramo USING btree (empresa_id);

CREATE INDEX idx_historial_precio_partida ON public.historial_precio USING btree (partida_id);

CREATE INDEX idx_hito_pago_paquete ON public.hito_pago USING btree (paquete_id);

CREATE INDEX idx_linea_partida ON public.linea USING btree (partida_id);

CREATE INDEX idx_linea_sub_bloque ON public.linea USING btree (sub_bloque_id);

CREATE INDEX idx_paquete_capitulo_paquete ON public.paquete_capitulo USING btree (paquete_id);

CREATE INDEX idx_paquete_comercial_cotizacion ON public.paquete_comercial USING btree (cotizacion_id);

CREATE INDEX idx_partida_catalogo_empresa ON public.partida_catalogo USING btree (empresa_id);

CREATE INDEX idx_sub_bloque_capitulo ON public.sub_bloque USING btree (capitulo_id);

CREATE TRIGGER on_new_user_assign_companies
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_companies();

CREATE POLICY "accounts_payable_rls" ON "public"."accounts_payable"
  FOR ALL
  TO "authenticated"
  USING ((public.is_dueno() OR (responsable_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = accounts_payable.project_id) AND (p.responsable_id = auth.uid()))))))
  WITH CHECK ((public.is_dueno() OR (responsable_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = accounts_payable.project_id) AND (p.responsable_id = auth.uid()))))));

CREATE POLICY "accounts_receivable_rls" ON "public"."accounts_receivable"
  FOR ALL
  TO "authenticated"
  USING ((public.is_dueno() OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = accounts_receivable.project_id) AND (p.responsable_id = auth.uid()))))))
  WITH CHECK ((public.is_dueno() OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = accounts_receivable.project_id) AND (p.responsable_id = auth.uid()))))));

CREATE POLICY "additional_sales_rls" ON "public"."additional_sales"
  FOR ALL
  TO "authenticated"
  USING ((public.is_dueno() OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = additional_sales.project_id) AND (p.responsable_id = auth.uid()))))))
  WITH CHECK ((public.is_dueno() OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = additional_sales.project_id) AND (p.responsable_id = auth.uid()))))));

CREATE POLICY "anon_insert_attend" ON "public"."attendance"
  FOR INSERT
  TO "anon"
  WITH CHECK (true);

CREATE POLICY "anon_select_attend" ON "public"."attendance"
  FOR SELECT
  TO "anon"
  USING (true);

CREATE POLICY "anon_update_attend" ON "public"."attendance"
  FOR UPDATE
  TO "anon"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "attendance_auth_rls" ON "public"."attendance"
  FOR ALL
  TO "authenticated"
  USING ((public.is_dueno() OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = attendance.project_id) AND (p.responsable_id = auth.uid()))))))
  WITH CHECK ((public.is_dueno() OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = attendance.project_id) AND (p.responsable_id = auth.uid()))))));

CREATE POLICY "authenticated full access" ON "public"."banos_quimicos"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated full access" ON "public"."banos_quimicos_pagos"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "capitulo_rls" ON "public"."capitulo"
  FOR ALL
  TO "authenticated"
  USING (public.cotizador_tiene_acceso(cotizacion_id))
  WITH CHECK (public.cotizador_tiene_acceso(cotizacion_id));

CREATE POLICY "clients_rls" ON "public"."clients"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated puede leer empresas" ON "public"."companies"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "cotizacion_rls" ON "public"."cotizacion"
  FOR ALL
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.user_companies uc
  WHERE ((uc.user_id = auth.uid()) AND (uc.empresa_id = cotizacion.empresa_id) AND (uc.rol = ANY (ARRAY['dueno'::text, 'administrativo'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_companies uc
  WHERE ((uc.user_id = auth.uid()) AND (uc.empresa_id = cotizacion.empresa_id) AND (uc.rol = ANY (ARRAY['dueno'::text, 'administrativo'::text]))))));

CREATE POLICY "cotizacion_version_rls" ON "public"."cotizacion_version"
  FOR ALL
  TO "authenticated"
  USING (public.cotizador_tiene_acceso(cotizacion_id))
  WITH CHECK (public.cotizador_tiene_acceso(cotizacion_id));

CREATE POLICY "cotizador_config_rls" ON "public"."cotizador_config"
  FOR ALL
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.user_companies uc
  WHERE ((uc.user_id = auth.uid()) AND (uc.empresa_id = cotizador_config.empresa_id) AND (uc.rol = ANY (ARRAY['dueno'::text, 'administrativo'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_companies uc
  WHERE ((uc.user_id = auth.uid()) AND (uc.empresa_id = cotizador_config.empresa_id) AND (uc.rol = ANY (ARRAY['dueno'::text, 'administrativo'::text]))))));

CREATE POLICY "descuento_tramo_rls" ON "public"."descuento_tramo"
  FOR ALL
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.user_companies uc
  WHERE ((uc.user_id = auth.uid()) AND (uc.empresa_id = descuento_tramo.empresa_id) AND (uc.rol = ANY (ARRAY['dueno'::text, 'administrativo'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_companies uc
  WHERE ((uc.user_id = auth.uid()) AND (uc.empresa_id = descuento_tramo.empresa_id) AND (uc.rol = ANY (ARRAY['dueno'::text, 'administrativo'::text]))))));

CREATE POLICY "documents_rls" ON "public"."documents"
  FOR ALL
  TO "authenticated"
  USING ((public.is_dueno() OR ((project_id IS NULL) AND public.is_administrativo()) OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = documents.project_id) AND (p.responsable_id = auth.uid()))))))
  WITH CHECK ((public.is_dueno() OR ((project_id IS NULL) AND public.is_administrativo()) OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = documents.project_id) AND (p.responsable_id = auth.uid()))))));

CREATE POLICY "auth_insert" ON "public"."expenses"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (true);

CREATE POLICY "auth_select" ON "public"."expenses"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "auth_update" ON "public"."expenses"
  FOR UPDATE
  TO "authenticated"
  USING (true);

CREATE POLICY "expenses_rls" ON "public"."expenses"
  FOR ALL
  TO "authenticated"
  USING ((public.is_dueno() OR (usuario_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = expenses.project_id) AND (p.responsable_id = auth.uid()))))))
  WITH CHECK ((public.is_dueno() OR (usuario_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = expenses.project_id) AND (p.responsable_id = auth.uid()))))));

CREATE POLICY "geolocation_rls" ON "public"."geolocation_logs"
  FOR ALL
  TO "authenticated"
  USING ((public.is_dueno() OR (usuario_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = geolocation_logs.project_id) AND (p.responsable_id = auth.uid()))))))
  WITH CHECK ((public.is_dueno() OR (usuario_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = geolocation_logs.project_id) AND (p.responsable_id = auth.uid()))))));

CREATE POLICY "historial_precio_rls" ON "public"."historial_precio"
  FOR ALL
  TO "authenticated"
  USING ((((cotizacion_id IS NOT NULL) AND public.cotizador_tiene_acceso(cotizacion_id)) OR ((cotizacion_id IS NULL) AND (EXISTS ( SELECT 1
   FROM (public.partida_catalogo pc
     JOIN public.user_companies uc ON ((uc.empresa_id = pc.empresa_id)))
  WHERE ((pc.id = historial_precio.partida_id) AND (uc.user_id = auth.uid()) AND (uc.rol = ANY (ARRAY['dueno'::text, 'administrativo'::text]))))))))
  WITH CHECK ((((cotizacion_id IS NOT NULL) AND public.cotizador_tiene_acceso(cotizacion_id)) OR ((cotizacion_id IS NULL) AND (EXISTS ( SELECT 1
   FROM (public.partida_catalogo pc
     JOIN public.user_companies uc ON ((uc.empresa_id = pc.empresa_id)))
  WHERE ((pc.id = historial_precio.partida_id) AND (uc.user_id = auth.uid()) AND (uc.rol = ANY (ARRAY['dueno'::text, 'administrativo'::text]))))))));

CREATE POLICY "hito_pago_rls" ON "public"."hito_pago"
  FOR ALL
  TO "authenticated"
  USING (public.cotizador_tiene_acceso(public.cotizador_cotizacion_de_paquete(paquete_id)))
  WITH CHECK (public.cotizador_tiene_acceso(public.cotizador_cotizacion_de_paquete(paquete_id)));

CREATE POLICY "income_rls" ON "public"."income"
  FOR ALL
  TO "authenticated"
  USING ((public.is_dueno() OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = income.project_id) AND (p.responsable_id = auth.uid()))))))
  WITH CHECK ((public.is_dueno() OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = income.project_id) AND (p.responsable_id = auth.uid()))))));

CREATE POLICY "linea_rls" ON "public"."linea"
  FOR ALL
  TO "authenticated"
  USING (public.cotizador_tiene_acceso(public.cotizador_cotizacion_de_capitulo(public.cotizador_capitulo_de_sub_bloque(sub_bloque_id))))
  WITH CHECK (public.cotizador_tiene_acceso(public.cotizador_cotizacion_de_capitulo(public.cotizador_capitulo_de_sub_bloque(sub_bloque_id))));

CREATE POLICY "paquete_capitulo_rls" ON "public"."paquete_capitulo"
  FOR ALL
  TO "authenticated"
  USING (public.cotizador_tiene_acceso(public.cotizador_cotizacion_de_paquete(paquete_id)))
  WITH CHECK (public.cotizador_tiene_acceso(public.cotizador_cotizacion_de_paquete(paquete_id)));

CREATE POLICY "paquete_comercial_rls" ON "public"."paquete_comercial"
  FOR ALL
  TO "authenticated"
  USING (public.cotizador_tiene_acceso(cotizacion_id))
  WITH CHECK (public.cotizador_tiene_acceso(cotizacion_id));

CREATE POLICY "partida_catalogo_rls" ON "public"."partida_catalogo"
  FOR ALL
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.user_companies uc
  WHERE ((uc.user_id = auth.uid()) AND (uc.empresa_id = partida_catalogo.empresa_id) AND (uc.rol = ANY (ARRAY['dueno'::text, 'administrativo'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_companies uc
  WHERE ((uc.user_id = auth.uid()) AND (uc.empresa_id = partida_catalogo.empresa_id) AND (uc.rol = ANY (ARRAY['dueno'::text, 'administrativo'::text]))))));

CREATE POLICY "anon_read_projects" ON "public"."projects"
  FOR SELECT
  TO "anon"
  USING (true);

CREATE POLICY "projects_rls" ON "public"."projects"
  FOR ALL
  TO "authenticated"
  USING ((public.is_dueno() OR (responsable_id = auth.uid())))
  WITH CHECK ((public.is_dueno() OR (responsable_id = auth.uid())));

CREATE POLICY "providers_all" ON "public"."providers"
  FOR ALL
  TO PUBLIC
  USING (true)
  WITH CHECK (true);

CREATE POLICY "providers_rls" ON "public"."providers"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "sub_bloque_rls" ON "public"."sub_bloque"
  FOR ALL
  TO "authenticated"
  USING (public.cotizador_tiene_acceso(public.cotizador_cotizacion_de_capitulo(capitulo_id)))
  WITH CHECK (public.cotizador_tiene_acceso(public.cotizador_cotizacion_de_capitulo(capitulo_id)));

CREATE POLICY "authenticated full access" ON "public"."tasks"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "usuario ve sus propias membresías" ON "public"."user_companies"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "dueno_administrativo_select_user_companies" ON "public"."user_companies"
  FOR SELECT
  TO "authenticated"
  USING ((public.is_dueno() OR public.is_administrativo()));

CREATE POLICY "dueno_insert_user_companies" ON "public"."user_companies"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (public.is_dueno());

CREATE POLICY "users_delete_rls" ON "public"."users"
  FOR DELETE
  TO "authenticated"
  USING (public.is_dueno());

CREATE POLICY "users_insert_rls" ON "public"."users"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (public.is_dueno());

CREATE POLICY "users_select_rls" ON "public"."users"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "users_update_rls" ON "public"."users"
  FOR UPDATE
  TO "authenticated"
  USING ((public.is_dueno() OR (id = auth.uid())))
  WITH CHECK ((public.is_dueno() OR (id = auth.uid())));

CREATE POLICY "anon_select" ON "public"."worker_projects"
  FOR SELECT
  TO "anon"
  USING (true);

CREATE POLICY "worker_projects_rls" ON "public"."worker_projects"
  FOR ALL
  TO "authenticated"
  USING ((public.is_dueno() OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = worker_projects.project_id) AND (p.responsable_id = auth.uid()))))))
  WITH CHECK ((public.is_dueno() OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = worker_projects.project_id) AND (p.responsable_id = auth.uid()))))));

CREATE POLICY "workers_select_rls" ON "public"."workers"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "workers_write_rls" ON "public"."workers"
  FOR ALL
  TO "authenticated"
  USING (public.is_dueno())
  WITH CHECK (public.is_dueno());

CREATE POLICY "Authenticated users can delete documents" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING ((bucket_id = 'documents'::text));

CREATE POLICY "Authenticated users can upload documents" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((bucket_id = 'documents'::text));

CREATE POLICY "Authenticated users can view documents" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING ((bucket_id = 'documents'::text));

GRANT EXECUTE ON FUNCTION "public"."cotizador_capitulo_de_sub_bloque"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."cotizador_cotizacion_de_capitulo"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."cotizador_cotizacion_de_paquete"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."cotizador_tiene_acceso"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."create_user_profile"(uuid, text, text, text, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."delete_obra"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."delete_user"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."delete_worker"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_dashboard_kpis"(uuid, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_flujo_caja_mensual"(uuid, integer) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_flujo_caja_semanal"(uuid, integer) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_meses_disponibles"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_obra_metrics"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_public_workers"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user_companies"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_administrativo"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_dueno"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."verify_worker_pin"(uuid, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."verify_worker_pin_only"(text, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."accounts_payable" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."accounts_receivable" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."additional_sales" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."attendance" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."banos_quimicos" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."banos_quimicos_pagos" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."capitulo" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clients" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."companies" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."cotizacion" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."cotizacion_version" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."cotizador_config" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."descuento_tramo" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."documents" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."expenses" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."geolocation_logs" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."historial_precio" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hito_pago" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."income" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."linea" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."paquete_capitulo" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."paquete_comercial" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."partida_catalogo" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."projects" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."providers" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sub_bloque" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tasks" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_companies" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."users" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."worker_projects" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."workers" TO "anon", "authenticated", "postgres", "service_role";

