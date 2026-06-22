import { guard, json } from "../_shared/guard.ts";

Deno.serve(async (req) => {
  const { error, supabase } = guard(req);
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const { branch } = body as { branch?: string };

  let q = supabase
    .from("inbody_trainers")
    .select("id, name, branch")
    .eq("is_active", true);
  if (branch) q = q.eq("branch", branch);

  const { data, error: dbErr } = await q.order("name");
  if (dbErr) return json({ error: dbErr.message }, 500);
  return json({ trainers: data });
});
