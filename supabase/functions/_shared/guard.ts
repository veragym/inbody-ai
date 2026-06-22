import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-tablet-key, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function guard(req: Request): {
  error?: Response;
  supabase?: ReturnType<typeof createClient>;
} {
  if (req.method === "OPTIONS") {
    return { error: new Response("ok", { headers: cors }) };
  }
  if (req.headers.get("x-tablet-key") !== Deno.env.get("TABLET_SECRET")) {
    return { error: json({ error: "unauthorized" }, 401) };
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  return { supabase };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
