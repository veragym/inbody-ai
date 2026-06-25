import { guard, json } from "../_shared/guard.ts";

Deno.serve(async (req) => {
  const { error, supabase } = guard(req);
  if (error) return error;

  const body = await req.json() as {
    inbody_record_id: string;
    member_id: string;
    trainer_id: string;
    pre_inputs: {
      exercise_purpose: string[];
      exercise_experience: string;
      pain_concerns: string[];
      member_tendency: string;
      motivation_level: string;
      exercise_frequency: string;
      protein_intake?: string | null;
      carb_intake?: string | null;
      fat_intake?: string | null;
    };
    personas: string[];
    ai_output: {
      summary: string;
      comparison_note: string | null;
      body_composition_analysis?: string | null;
      metric_interp?: Record<string, string>;
      segmental_analysis?: string | null;
      priority_goals?: unknown[];
      exercise_strategy?: string | null;
      nutrition_strategy?: string | null;
      trainer_talk_track?: string[];
      caution_notes?: string[];
      session_lineup?: unknown[];
      recommended_sessions?: number;
      hook_message?: string;
    };
    pt_registered: "등록" | "미등록" | "보류";
    registered_sessions?: number;
    memo?: string;
  };

  const {
    inbody_record_id, member_id, trainer_id,
    pre_inputs, personas, ai_output,
    pt_registered, registered_sessions, memo,
  } = body;

  if (!inbody_record_id || !member_id || !trainer_id) {
    return json({ error: "inbody_record_id, member_id, trainer_id required" }, 400);
  }

  const { data, error: dbErr } = await supabase
    .from("inbody_consultation_logs")
    .insert({
      inbody_record_id,
      member_id,
      trainer_id,
      exercise_purpose: pre_inputs?.exercise_purpose ?? [],
      exercise_experience: pre_inputs?.exercise_experience ?? null,
      pain_concerns: pre_inputs?.pain_concerns ?? [],
      member_tendency: pre_inputs?.member_tendency ?? null,
      motivation_level: pre_inputs?.motivation_level ?? null,
      exercise_frequency: pre_inputs?.exercise_frequency,
      protein_intake: pre_inputs?.protein_intake ?? null,
      carb_intake: pre_inputs?.carb_intake ?? null,
      fat_intake: pre_inputs?.fat_intake ?? null,
      trainer_personas: personas ?? [],
      ai_summary: ai_output?.summary ?? null,
      ai_comparison_note: ai_output?.comparison_note ?? null,
      ai_report_json: ai_output ?? null,
      ai_session_lineup: ai_output?.session_lineup ?? null,
      ai_recommended_sessions: ai_output?.recommended_sessions ?? null,
      ai_hook_message: ai_output?.hook_message ?? null,
      pt_registered: pt_registered ?? null,
      registered_sessions: registered_sessions ?? null,
      memo: memo ?? null,
    })
    .select("id")
    .single();

  if (dbErr) return json({ error: dbErr.message }, 500);
  return json({ consultation_id: data.id });
});
