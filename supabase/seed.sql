-- =====================================================================
-- SEED — SOLO PARA STAGING (vaion-staging). Datos 100% ficticios: una
-- constructora inventada ("Constructora Rukan SpA"), ningún nombre, RUT,
-- obra, monto ni trabajador real de VA Constructora ni VR Asociados.
--
-- NUNCA correr este archivo contra producción (ffxexpasoneowquvtouz).
-- Se aplica automáticamente con `supabase db reset` (local, contra Docker)
-- o manualmente contra vaion-staging vía
--   supabase db query --project-ref <ref-de-staging> -f supabase/seed.sql
-- Ver docs/MIGRATIONS.md para el flujo completo.
--
-- Corre como rol postgres (vía CLI de migraciones), no a través de
-- PostgREST — por diseño, esto bypassea RLS igual que cualquier otra
-- migración. Los datos están armados para ser CONSISTENTES con lo que
-- esas políticas esperarían de un usuario real (empresa_id correcto en
-- cada tabla que lo tiene, membresías en user_companies antes de asumir
-- rol, etc.), pero la inserción en sí no pasa por el chequeo de policy.
-- Dos casos structurales donde ni un usuario real podría hacer este
-- insert vía la API (documentados, no “solucionados” porque no son un
-- bug sino el diseño esperado):
--   1. `companies` no tiene policy de INSERT para authenticated/anon —
--      las empresas se crean fuera de la app (Dashboard/CLI), nunca
--      desde la UI. Ver docs/DATABASE.md.
--   2. La membresía `user_companies` del primer dueño de una empresa
--      nueva no la puede crear nadie vía la app (la policy
--      `dueno_insert_user_companies` exige ya ser dueño de esa empresa
--      — problema del huevo y la gallina inherente al bootstrap). En
--      producción esto se resuelve a mano (igual que se hizo para
--      VA Constructora); acá el seed hace ese mismo paso "a mano".
--
-- Login demo para probar la app apuntando a staging:
--   Dueño         demo.dueno@rukan-demo.test          Demo1234!
--   Administrativo demo.admin@rukan-demo.test         Demo1234!
--   PINs de kiosco (trabajador): 1101 a 1108 (ver tabla de trabajadores)
-- =====================================================================

create extension if not exists pgcrypto;

-- Reproducible: mismos datos "aleatorios" (asistencia) en cada corrida.
select setseed(0.42);

-- ── IDs fijos (legibles a propósito, no gen_random_uuid) ──────────────
-- Empresa:            aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1
-- Usuarios:            ...d1 (dueño), ...d2 (administrativo)
-- Clientes:            ...c1, ...c2
-- Obras:               ...b1, ...b2, ...b3
-- Trabajadores:        ...f1 .. f8

-- =====================================================================
-- 1. Empresa ficticia
-- =====================================================================
insert into public.companies (id, nombre, slug) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', 'Constructora Rukan SpA', 'rukan-demo');

-- =====================================================================
-- 2. Usuarios admin (auth.users + public.users + user_companies)
-- =====================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000d1',
   'authenticated', 'authenticated', 'demo.dueno@rukan-demo.test',
   crypt('Demo1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000d2',
   'authenticated', 'authenticated', 'demo.admin@rukan-demo.test',
   crypt('Demo1234!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000d1', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000d1',
   '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-0000000000d1","email":"demo.dueno@rukan-demo.test"}', 'email', now(), now(), now()),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000d2', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000d2',
   '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-0000000000d2","email":"demo.admin@rukan-demo.test"}', 'email', now(), now(), now());

insert into public.users (id, nombre, email, rol, avatar) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000d1', 'Ignacio Farías', 'demo.dueno@rukan-demo.test', 'dueno', 'IF'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000d2', 'Daniela Salas',  'demo.admin@rukan-demo.test', 'administrativo', 'DS');

insert into public.user_companies (user_id, empresa_id, rol) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000d1', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', 'dueno'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000d2', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', 'administrativo');

-- =====================================================================
-- 3. Clientes
-- =====================================================================
insert into public.clients (id, nombre, email, telefono, empresa_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000c1', 'Familia Vergara Rojas', 'jvergara.demo@example.test', '+56 9 5551 0011', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000c2', 'Comunidad Edificio Altavista', 'admin.altavista.demo@example.test', '+56 9 5551 0022', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1');

-- =====================================================================
-- 4. Obras — 3 estados distintos (tipos reales de TIPOS_OBRA en helpers.js)
-- =====================================================================
insert into public.projects
  (id, nombre, client_id, direccion, tipo, fecha_inicio, fecha_termino, presupuesto, responsable_id, estado, descripcion, avance, empresa_id)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1', 'Piscina + Quincho Los Aromos',
   'aaaaaaaa-aaaa-aaaa-aaaa-0000000000c1', 'Los Aromos 1450, La Reina', 'piscina',
   current_date - 45, null, 42000000, 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000d1',
   'en_ejecucion', 'Piscina 8x4m + quincho techado con parrilla de obra.', 55,
   'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b2', 'Ampliación segundo piso — Casa Vergara',
   'aaaaaaaa-aaaa-aaaa-aaaa-0000000000c1', 'Camino Real 220, Peñalolén', 'ampliacion',
   null, null, 38000000, 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000d2',
   'cotizada', 'Ampliación de 32m2: 2 dormitorios + baño.', 0,
   'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b3', 'Remodelación baños y cocina — Depto Altavista 402',
   'aaaaaaaa-aaaa-aaaa-aaaa-0000000000c2', 'Av. Altavista 890, depto 402, Vitacura', 'remodelacion',
   current_date - 120, current_date - 20, 24000000, 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000d1',
   'finalizada', 'Remodelación completa de 2 baños y cocina.', 100,
   'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1');

-- =====================================================================
-- 5. Trabajadores (8, con PIN) + asignación a la obra activa
-- =====================================================================
insert into public.workers (id, nombre, avatar, valor_hora, activo, pin, empresa_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000f1', 'Juan Carlos Muñoz',   'JM', 42000, true, '1101', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000f2', 'Manuel Antonio Soto', 'MS', 35000, true, '1102', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000f3', 'Cristian Espinoza',   'CE', 34000, true, '1103', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000f4', 'Rodrigo Vergara',     'RV', 26000, true, '1104', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000f5', 'Luis Alberto Contreras','LC', 25000, true, '1105', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000f6', 'Marcelo Reyes',       'MR', 24000, true, '1106', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000f7', 'Francisco Bravo',     'FB', 22000, true, '1107', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000f8', 'Héctor Sepúlveda',    'HS', 22000, true, '1108', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1');

insert into public.worker_projects (worker_id, project_id, empresa_id)
select w.id, 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1'
from public.workers w
where w.empresa_id = 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1';

-- =====================================================================
-- 6. Asistencia — ~30 días, solo días hábiles, ~85% de asistencia por
--    trabajador/día, jornada 8h (6.5h los sábados, igual que
--    horasBaseJornada() en helpers.js). Todo contra la obra activa (b1).
-- =====================================================================
with base as (
  select
    w.id as worker_id,
    'aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1'::uuid as project_id,
    d::date as fecha,
    w.valor_hora,
    (d::date + time '08:00' + (floor(random() * 20))::int * interval '1 minute') as entrada,
    (case when extract(dow from d) = 6 then 6.5 else 8.0 end) as horas_base
  from public.workers w
  cross join generate_series(current_date - 29, current_date, interval '1 day') as d
  where w.empresa_id = 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1'
    and extract(dow from d) <> 0          -- sin domingos
    and d::date <= current_date
    and random() < 0.85                   -- ausencias ocasionales
),
timed as (
  select
    *,
    entrada + (horas_base * interval '1 hour')
            + ((floor(random() * 30) - 15)::int * interval '1 minute') as salida
  from base
)
insert into public.attendance
  (worker_id, project_id, fecha, entrada, salida, horas_trabajadas, valor_hora, costo_total, bono)
select
  worker_id, project_id, fecha, entrada, salida,
  round(extract(epoch from (salida - entrada)) / 3600.0, 2) as horas_trabajadas,
  valor_hora,
  case
    when round(extract(epoch from (salida - entrada)) / 3600.0, 2) >= horas_base
      then valor_hora
    else round((round(extract(epoch from (salida - entrada)) / 3600.0, 2) / horas_base) * valor_hora)
  end as costo_total,
  0 as bono
from timed;

-- =====================================================================
-- 7. Egresos — cubre cada categoría de CATEGORIAS_GASTO (helpers.js)
-- =====================================================================
insert into public.expenses
  (project_id, monto, categoria, proveedor, fecha, medio_pago, comentario, estado, empresa_id, plazo_credito, fecha_vencimiento)
values
  -- CDO (con obra) — obra activa (b1)
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1', 3850000, 'materiales',       'Sodimac Empresas',        current_date - 25, 'credito', 'Cemento, fierro y áridos para radier piscina', 'pendiente', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', 30, current_date + 5),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1', 4200000, 'subcontratos',     'Impermeabilizaciones Aconcagua Ltda.', current_date - 20, 'contado', 'Impermeabilización de piscina', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', null, null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1',  680000, 'equipos',          'Rental Maq. del Sur',     current_date - 18, 'contado', 'Arriendo bomba de hormigón 2 días', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', null, null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1',  920000, 'aridos',           'Áridos Los Maitenes',     current_date - 22, 'contado', 'Arena y gravilla', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', null, null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1',  310000, 'retiro_escombros', 'Fletes y Retiros Puente Alto', current_date - 15, 'contado', 'Retiro escombros excavación piscina', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', null, null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1',  150000, 'banio_quimico',    'Portolet',                current_date - 40, 'credito', 'Arriendo mensual baño químico obra', 'pendiente', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', 30, current_date + 10),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1',  245000, 'flete',            'Transportes Rengifo',     current_date - 12, 'contado', 'Flete materiales', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', null, null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1',  180000, 'otros_operacion',  'Ferretería El Tornillo',  current_date - 8,  'contado', 'Insumos varios de obra', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', null, null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1', 1250000, 'mano_obra',        'Cuadrilla externa Soto y Cía.', current_date - 10, 'credito', 'Refuerzo cuadrilla 3 días', 'pendiente', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', 15, current_date + 5),
  -- CDO obra finalizada (b3) — histórico
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b3', 2100000, 'materiales',       'Sodimac Empresas',        current_date - 60, 'contado', 'Cerámicos y grifería', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', null, null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b3',  980000, 'subcontratos',     'Gasfitería Rápida Ltda.', current_date - 50, 'contado', 'Instalación sanitaria baños', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', null, null),
  -- GAV (sin obra, gasto general de la empresa)
  (null, 2600000, 'sueldos',     'Nómina interna',            current_date - 5,  'contado', 'Sueldo administrativa (parcial)', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', null, null),
  (null,  180000, 'publicidad',  'Meta Ads',                  current_date - 14, 'contado', 'Campaña Instagram captación clientes', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', null, null),
  (null,   95000, 'marketing',   'Diseñador freelance',       current_date - 30, 'contado', 'Actualización portafolio de obras', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', null, null),
  (null,  120000, 'bencina',     'Copec',                     current_date - 6,  'contado', 'Combustible camioneta', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', null, null),
  (null,  340000, 'herramientas','Ferretería El Tornillo',    current_date - 28, 'contado', 'Herramientas eléctricas menores', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', null, null),
  (null,  450000, 'arriendo',    'Bodega Rukan',              current_date - 3,  'credito', 'Arriendo bodega/oficina del mes', 'pendiente', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', 30, current_date + 27),
  (null,  135000, 'cuentas',     'CGE / Aguas Andinas',       current_date - 4,  'contado', 'Luz y agua bodega', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', null, null),
  (null,  200000, 'retiros',     'Ignacio Farías',            current_date - 2,  'contado', 'Retiro socio', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', null, null),
  (null,   75000, 'otros',       'Varios',                    current_date - 9,  'contado', 'Gastos varios de oficina', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1', null, null);

-- =====================================================================
-- 8. Ingresos (abonos de clientes)
-- =====================================================================
insert into public.income (project_id, tipo, monto, fecha, descripcion, medio_pago, estado, empresa_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1', 'abono', 15000000, current_date - 44, 'Anticipo firma de contrato', 'transferencia', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1', 'abono', 10000000, current_date - 20, 'Segundo estado de pago (avance 50%)', 'transferencia', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b3', 'abono', 24000000, current_date - 25, 'Pago final entrega de obra', 'transferencia', 'pagado', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1');

-- =====================================================================
-- 9. Cuentas por pagar (a subcontratistas/proveedores, con crédito)
-- =====================================================================
insert into public.accounts_payable
  (project_id, proveedor, monto, fecha_emision, fecha_vencimiento, estado, responsable_id, descripcion, empresa_id)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1', 'Sodimac Empresas', 3850000, current_date - 25, current_date + 5, 'pendiente', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000d1', 'Factura materiales radier', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1', 'Cuadrilla externa Soto y Cía.', 1250000, current_date - 10, current_date + 5, 'pendiente', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000d1', 'Refuerzo cuadrilla', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1');

-- =====================================================================
-- 10. Cuentas por cobrar / Estados de pago a clientes
-- =====================================================================
insert into public.accounts_receivable
  (project_id, client_id, monto_contrato, cobrado, saldo_pendiente, fecha_compromiso, estado, descripcion, empresa_id)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b1', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000c1', 42000000, 25000000, 17000000, current_date + 30, 'pendiente', 'Tercer estado de pago pendiente de facturar (avance 100%)', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-0000000000b3', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000c2', 24000000, 24000000, 0, current_date - 25, 'pagado', 'Estado de pago único — obra entregada y pagada', 'aaaaaaaa-aaaa-aaaa-aaaa-0000000000e1');
