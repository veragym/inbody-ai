alter table public.inbody_consultation_logs
  add column if not exists body_shape_concerns text[] default '{}'::text[];
