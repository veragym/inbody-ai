import { guard, json } from "../_shared/guard.ts";

Deno.serve(async (req) => {
  const { error, supabase } = guard(req);
  if (error) return error;

  const { image_path } = await req.json() as { image_path: string };
  if (!image_path) return json({ error: "image_path required" }, 400);

  const { data, error: storErr } = await supabase.storage
    .from("inbody-images")
    .createSignedUrl(image_path, 300);

  if (storErr) return json({ error: storErr.message }, 500);
  return json({ url: data.signedUrl, expires_in: 300 });
});
