alter table public.inbody_consultation_logs
  add column if not exists protein_intake text,
  add column if not exists carb_intake text,
  add column if not exists fat_intake text,
  add column if not exists ai_report_json jsonb;
