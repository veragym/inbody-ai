import { guard, json } from "../_shared/guard.ts";

Deno.serve(async (req) => {
  const { error, supabase } = guard(req);
  if (error) return error;

  const { member_id, trainer_id } = await req.json() as {
    member_id: string;
    trainer_id: string;
  };

  if (!member_id || !trainer_id) {
    return json({ error: "member_id and trainer_id required" }, 400);
  }

  // 인바디 기록 목록 (최신순)
  const { data: records, error: recErr } = await supabase
    .from("inbody_records")
    .select(`
      id, measured_at,
      final_weight, final_skeletal_muscle, final_body_fat_mass,
      final_body_fat_pct, final_bmi, final_inbody_score,
      final_raw_json
    `)
    .eq("member_id", member_id)
    .eq("trainer_id", trainer_id)
    .order("measured_at", { ascending: false })
    .limit(20);

  if (recErr) return json({ error: recErr.message }, 500);

  // 각 기록에 상담 로그 연결
  const recordIds = (records ?? []).map((r) => r.id);
  let logMap: Record<string, unknown> = {};

  if (recordIds.length > 0) {
    const { data: logs } = await supabase
      .from("inbody_consultation_logs")
      .select(`
        inbody_record_id,
        exercise_purpose, exercise_experience, pain_concerns,
        member_tendency, motivation_level, exercise_frequency,
        trainer_personas,
        ai_summary, ai_comparison_note, ai_session_lineup,
        ai_hook_message, ai_recommended_sessions,
        pt_registered, registered_sessions, memo,
        created_at
      `)
      .in("inbody_record_id", recordIds)
      .order("created_at", { ascending: false });

    // 기록 ID당 가장 최근 상담 로그 하나만
    (logs ?? []).forEach((log) => {
      const rid = log.inbody_record_id as string;
      if (!logMap[rid]) logMap[rid] = log;
    });
  }

  const enriched = (records ?? []).map((r, idx) => {
    const prev = records?.[idx + 1];
    return {
      ...r,
      consultation: logMap[r.id] ?? null,
      diff: prev
        ? {
            weight: r.final_weight != null && prev.final_weight != null
              ? +(r.final_weight - prev.final_weight).toFixed(1) : null,
            body_fat_pct: r.final_body_fat_pct != null && prev.final_body_fat_pct != null
              ? +(r.final_body_fat_pct - prev.final_body_fat_pct).toFixed(1) : null,
            skeletal_muscle: r.final_skeletal_muscle != null && prev.final_skeletal_muscle != null
              ? +(r.final_skeletal_muscle - prev.final_skeletal_muscle).toFixed(1) : null,
          }
        : null,
    };
  });

  return json({ records: enriched });
});
