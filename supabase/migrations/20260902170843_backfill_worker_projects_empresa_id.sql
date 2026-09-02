-- Backfill de empresa_id en worker_projects.
--
-- Contexto: toggleWorkerProject() insertaba en worker_projects sin
-- `empresa_id` (bug arreglado en el commit "fix(asistencia): asignar obra
-- a trabajador fallaba con 403 silencioso"). La policy worker_projects_rls
-- (Fase 1, 2026-08-30) exige tiene_acceso_empresa(empresa_id) para poder
-- LEER la fila — con empresa_id NULL, la asignación queda invisible en la
-- app aunque la fila exista de verdad en la base (por eso un segundo
-- intento de asignar la misma obra tira error de duplicado: la fila está,
-- solo que RLS la esconde del SELECT).
--
-- Este backfill actualiza únicamente las filas viejas con empresa_id NULL,
-- tomando el empresa_id del proyecto asociado. Es seguro re-ejecutarlo
-- (no toca filas que ya tengan empresa_id).
update public.worker_projects wp
set empresa_id = p.empresa_id
from public.projects p
where wp.project_id = p.id
  and wp.empresa_id is null;
