import { guard, json } from "../_shared/guard.ts";

interface OcrFields {
  weight?: number | null;
  skeletal_muscle?: number | null;
  body_fat_mass?: number | null;
  body_fat_pct?: number | null;
  bmi?: number | null;
  inbody_score?: number | null;
  target_weight?: number | null;
  weight_control?: number | null;
  fat_control?: number | null;
  muscle_control?: number | null;
  raw?: Record<string, unknown> | null;
}

Deno.serve(async (req) => {
  const { error, supabase } = guard(req);
  if (error) return error;

  const body = await req.json() as {
    trainer_id: string;
    member_id: string;
    branch: string;
    image_path: string;
    ocr: OcrFields;
    final: OcrFields;
    is_manually_edited: boolean;
  };

  const { trainer_id, member_id, branch, image_path, ocr, final, is_manually_edited } = body;
  if (!trainer_id || !member_id || !branch) {
    return json({ error: "trainer_id, member_id, branch required" }, 400);
  }

  const { data, error: dbErr } = await supabase
    .from("inbody_records")
    .insert({
      trainer_id,
      member_id,
      branch,
      image_path,
      // OCR 원본
      ocr_weight: ocr?.weight ?? null,
      ocr_skeletal_muscle: ocr?.skeletal_muscle ?? null,
      ocr_body_fat_mass: ocr?.body_fat_mass ?? null,
      ocr_body_fat_pct: ocr?.body_fat_pct ?? null,
      ocr_bmi: ocr?.bmi ?? null,
      ocr_inbody_score: ocr?.inbody_score ?? null,
      ocr_target_weight: ocr?.target_weight ?? null,
      ocr_weight_control: ocr?.weight_control ?? null,
      ocr_fat_control: ocr?.fat_control ?? null,
      ocr_muscle_control: ocr?.muscle_control ?? null,
      ocr_raw_json: ocr?.raw ?? null,
      // 트레이너 확정값
      final_weight: final?.weight ?? null,
      final_skeletal_muscle: final?.skeletal_muscle ?? null,
      final_body_fat_mass: final?.body_fat_mass ?? null,
      final_body_fat_pct: final?.body_fat_pct ?? null,
      final_bmi: final?.bmi ?? null,
      final_inbody_score: final?.inbody_score ?? null,
      final_target_weight: final?.target_weight ?? null,
      final_weight_control: final?.weight_control ?? null,
      final_fat_control: final?.fat_control ?? null,
      final_muscle_control: final?.muscle_control ?? null,
      final_raw_json: final?.raw ?? null,
      is_manually_edited: is_manually_edited ?? false,
    })
    .select("id")
    .single();

  if (dbErr) return json({ error: dbErr.message }, 500);
  return json({ inbody_record_id: data.id });
});
