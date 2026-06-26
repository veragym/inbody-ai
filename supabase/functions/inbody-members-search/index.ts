import { guard, json } from "../_shared/guard.ts";

Deno.serve(async (req) => {
  const { error, supabase } = guard(req);
  if (error) return error;

  const body = await req.json();
  const { action, trainer_id } = body as {
    action: "search" | "create";
    trainer_id: string;
    name?: string;
    gender?: string;
    birth_year?: number;
    branch?: string;
    phone_last4?: string;
  };

  if (!trainer_id) return json({ error: "trainer_id required" }, 400);

  if (action === "search") {
    const { name } = body as { name?: string };

    let q = supabase
      .from("inbody_members")
      .select("id, name, gender, birth_year, phone_last4, branch")
      .eq("trainer_id", trainer_id)
      .is("deleted_at", null)
      .order("name");

    if (name && name.trim() && name.trim() !== "%") {
      q = q.ilike("name", `%${name.trim()}%`);
    }

    const { data, error: dbErr } = await q;
    if (dbErr) return json({ error: dbErr.message }, 500);

    const members = data ?? [];
    const memberIds = members.map((m) => m.id);
    let consultationMap: Record<string, unknown> = {};
    let recordMap: Record<string, unknown> = {};

    if (memberIds.length > 0) {
      const { data: logs } = await supabase
        .from("inbody_consultation_logs")
        .select("member_id, exercise_purpose, exercise_experience, pain_concerns, body_shape_concerns, member_tendency, motivation_level, exercise_frequency, protein_intake, carb_intake, fat_intake, ai_report_json, created_at")
        .in("member_id", memberIds)
        .order("created_at", { ascending: false });

      (logs ?? []).forEach((log) => {
        const key = log.member_id as string;
        if (!consultationMap[key]) consultationMap[key] = log;
      });

      const { data: records } = await supabase
        .from("inbody_records")
        .select("member_id, final_weight, final_skeletal_muscle, final_body_fat_mass, final_body_fat_pct, final_inbody_score, measured_at")
        .in("member_id", memberIds)
        .order("measured_at", { ascending: false });

      (records ?? []).forEach((record) => {
        const key = record.member_id as string;
        if (!recordMap[key]) recordMap[key] = record;
      });
    }

    return json({
      members: members.map((m) => ({
        ...m,
        last_consultation: consultationMap[m.id] ?? null,
        last_record: recordMap[m.id] ?? null,
      })),
    });
  }

  if (action === "create") {
    const { name, gender, birth_year, branch, phone_last4 } = body as {
      name: string;
      gender?: string;
      birth_year?: number;
      branch: string;
      phone_last4?: string;
    };
    if (!name || !branch) return json({ error: "name and branch required" }, 400);

    const { data, error: dbErr } = await supabase
      .from("inbody_members")
      .insert({ trainer_id, name, gender, birth_year, branch, phone_last4 })
      .select("id, name, gender, birth_year, phone_last4, branch")
      .single();
    if (dbErr) return json({ error: dbErr.message }, 500);
    return json({ member: data });
  }

  // 회원의 마지막 상담 + 인바디 기록 조회 (재방문 사전입력 자동완성용)
  if (action === "history") {
    const { member_id } = body as { member_id: string };
    if (!member_id) return json({ error: "member_id required" }, 400);

    const { data: lastLog } = await supabase
      .from("inbody_consultation_logs")
      .select("exercise_purpose, exercise_experience, pain_concerns, body_shape_concerns, member_tendency, motivation_level, exercise_frequency, protein_intake, carb_intake, fat_intake, ai_report_json, created_at")
      .eq("member_id", member_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const { data: lastRecord } = await supabase
      .from("inbody_records")
      .select("final_weight, final_skeletal_muscle, final_body_fat_mass, final_body_fat_pct, final_inbody_score, measured_at")
      .eq("member_id", member_id)
      .order("measured_at", { ascending: false })
      .limit(1)
      .single();

    return json({ last_consultation: lastLog ?? null, last_record: lastRecord ?? null });
  }

  // 회원 소프트 삭제
  if (action === "delete") {
    const { member_id } = body as { member_id: string };
    if (!member_id) return json({ error: "member_id required" }, 400);

    const { error: dbErr } = await supabase
      .from("inbody_members")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", member_id)
      .eq("trainer_id", trainer_id);

    if (dbErr) return json({ error: dbErr.message }, 500);
    return json({ ok: true });
  }

  return json({ error: "invalid action" }, 400);
});
