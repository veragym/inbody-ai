import { guard, json } from "../_shared/guard.ts";

function normalizeAiOutput(ai: Record<string, unknown> | null | undefined) {
  const metricInterp = (ai?.metric_interp && typeof ai.metric_interp === "object")
    ? ai.metric_interp as Record<string, unknown>
    : {};
  return {
    summary: typeof ai?.summary === "string" ? ai.summary : "",
    comparison_note: typeof ai?.comparison_note === "string" ? ai.comparison_note : null,
    body_composition_analysis: typeof ai?.body_composition_analysis === "string" ? ai.body_composition_analysis : "",
    metric_interp: {
      skeletal_muscle: typeof metricInterp.skeletal_muscle === "string" ? metricInterp.skeletal_muscle : "",
      body_fat_pct: typeof metricInterp.body_fat_pct === "string" ? metricInterp.body_fat_pct : "",
      bmi: typeof metricInterp.bmi === "string" ? metricInterp.bmi : "",
    },
    segmental_analysis: typeof ai?.segmental_analysis === "string" ? ai.segmental_analysis : null,
    priority_goals: Array.isArray(ai?.priority_goals) ? ai.priority_goals : [],
    exercise_strategy: typeof ai?.exercise_strategy === "string" ? ai.exercise_strategy : "",
    nutrition_strategy: typeof ai?.nutrition_strategy === "string" ? ai.nutrition_strategy : "",
    trainer_talk_track: Array.isArray(ai?.trainer_talk_track) ? ai.trainer_talk_track : [],
    caution_notes: Array.isArray(ai?.caution_notes) ? ai.caution_notes : [],
    session_lineup: Array.isArray(ai?.session_lineup) ? ai.session_lineup : [],
    recommended_sessions: typeof ai?.recommended_sessions === "number" ? ai.recommended_sessions : null,
    hook_message: typeof ai?.hook_message === "string" ? ai.hook_message : null,
  };
}

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

  const normalizedAi = normalizeAiOutput(ai_output);

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
      ai_summary: normalizedAi.summary || null,
      ai_comparison_note: normalizedAi.comparison_note,
      ai_report_json: normalizedAi,
      ai_session_lineup: normalizedAi.session_lineup,
      ai_recommended_sessions: normalizedAi.recommended_sessions,
      ai_hook_message: normalizedAi.hook_message,
      pt_registered: pt_registered ?? null,
      registered_sessions: registered_sessions ?? null,
      memo: memo ?? null,
    })
    .select("id")
    .single();

  if (dbErr) return json({ error: dbErr.message }, 500);
  return json({ consultation_id: data.id });
});
