import { guard, json } from "../_shared/guard.ts";

Deno.serve(async (req) => {
  const { error, supabase } = guard(req);
  if (error) return error;

  const { trainer_id, member_id } = await req.json() as {
    trainer_id: string;
    member_id: string;
  };
  if (!trainer_id || !member_id) {
    return json({ error: "trainer_id and member_id required" }, 400);
  }

  const uuid = crypto.randomUUID();
  const image_path = `${trainer_id}/${member_id}/${uuid}.jpg`;

  const { data, error: storErr } = await supabase.storage
    .from("inbody-images")
    .createSignedUploadUrl(image_path);

  if (storErr) return json({ error: storErr.message }, 500);
  return json({ image_path, signed_upload_url: data.signedUrl });
});
