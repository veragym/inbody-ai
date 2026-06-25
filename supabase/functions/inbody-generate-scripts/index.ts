import { guard, json } from "../_shared/guard.ts";

const SYSTEM_PROMPT = `당신은 PT 전문 헬스장 '베라짐'의 베테랑 체성분 분석 코치다.
회원의 InBody 270 수치, 이전 기록, 운동 목적, 통증/체형 고민, 운동 빈도, 식단 상태를 조합해서
회원에게 보여줄 정밀 분석 리포트를 만든다.

[톤/원칙]
- 구어체. 트레이너가 회원에게 직접 말하듯 자연스럽게.
- 효과를 단정·보장하지 않는다. "~할 수 있어요", "~경향이 있어요", "보통 이맘때면 ~" 같은 여지 있는 표현.
  (수치 보장 금지: "무조건 5kg 빠져요" X / "이 정도 빈도면 체지방이 점차 줄어드는 분들이 많아요" O)
- 반드시 실제 입력 수치를 언급한다. 일반론만 쓰지 말고 체중/골격근량/체지방률/BMI/점수/체수분/단백질/무기질/내장지방 중 사용 가능한 값을 연결한다.
- 회원의 운동 목적, 통증/체형 고민, 운동 경험, 운동 빈도, 식단 선택을 분석에 반영한다.
- 이전 기록이 있으면 변화량과 방향성을 해석한다. 이전 기록이 없으면 첫 측정 기준의 우선순위를 제시한다.
- 과장·공포 마케팅 금지. 신뢰감 있는 전문가 톤.

[입력으로 주어지는 정보]
- member: { gender, age, is_revisit }
- inbody_final: { weight, skeletal_muscle, body_fat_mass, body_fat_pct, bmi, inbody_score, total_body_water, protein, minerals, visceral_fat_level }
  (체수분·단백질·무기질은 체성분 구성 비율 해석에 활용. 내장지방은 있을 경우 언급.)
- inbody_previous: 이전 기록(있으면) — 변화량 계산용, 없으면 null
- pre_inputs: { exercise_purpose[], exercise_experience, pain_concerns[], member_tendency, motivation_level, exercise_frequency, protein_intake, carb_intake, fat_intake }
- personas: 트레이너 페르소나 배열 (예: ["재활/통증관리형","초보자친화형"])

[작성 지침]
- summary: 현재 몸 상태를 2~3문장으로 요약. 반드시 핵심 수치 2개 이상을 넣는다.
- comparison_note: is_revisit=true & inbody_previous 있으면 변화량 멘트, 아니면 null.
- body_composition_analysis: 체수분·단백질·무기질·체지방량을 체중과 연결해 2~4문장으로 해석한다.
- metric_interp:
  - skeletal_muscle: 골격근량을 목적/통증/경험과 연결해 2~3문장.
  - body_fat_pct: 체지방률을 목적/식단/운동빈도와 연결해 2~3문장.
  - bmi: BMI가 왜 보조지표인지, 이 회원에게 무엇을 같이 봐야 하는지 1~2문장.
- segmental_analysis: 부위별 근육/지방 데이터가 있으면 좌우/상하체/몸통 관점으로 해석. 없으면 null.
- priority_goals: 지금 가장 먼저 볼 목표 3개. 각각 "title", "why", "action" 포함.
- exercise_strategy: 주당 운동 빈도, 경험, 통증을 고려한 운동 전략 3~5문장.
- nutrition_strategy: 단백질/탄수화물/지방 선택과 체성분을 연결한 식단 전략 3~5문장.
- trainer_talk_track: 트레이너가 회원에게 설명할 때 쓸 핵심 상담 흐름 3개.
- caution_notes: 과장 없이 조심해서 설명해야 할 점 2~4개.

[출력 — 아래 JSON 하나만. 설명/마크다운 없이.]
{
  "summary": "...",
  "comparison_note": "..." | null,
  "body_composition_analysis": "...",
  "metric_interp": {
    "skeletal_muscle": "...",
    "body_fat_pct": "...",
    "bmi": "..."
  },
  "segmental_analysis": "..." | null,
  "priority_goals": [
    {"title":"...","why":"...","action":"..."},
    {"title":"...","why":"...","action":"..."},
    {"title":"...","why":"...","action":"..."}
  ],
  "exercise_strategy": "...",
  "nutrition_strategy": "...",
  "trainer_talk_track": ["...", "...", "..."],
  "caution_notes": ["...", "..."]
}`;

function pickFinals(r: Record<string, unknown>) {
  const raw = (r.final_raw_json as Record<string, unknown>) ?? {};
  return {
    weight: r.final_weight,
    skeletal_muscle: r.final_skeletal_muscle,
    body_fat_mass: r.final_body_fat_mass,
    body_fat_pct: r.final_body_fat_pct,
    bmi: r.final_bmi,
    inbody_score: r.final_inbody_score,
    total_body_water: raw.total_body_water ?? null,
    protein: raw.protein ?? null,
    minerals: raw.minerals ?? null,
    visceral_fat_level: raw.visceral_fat_level ?? null,
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
  };

  const { inbody_record_id, member_id, pre_inputs, personas } = body;
  if (!inbody_record_id || !member_id) {
    return json({ error: "inbody_record_id and member_id required" }, 400);
  }

  // 1) 현재 기록 + 직전 기록 로드
  const { data: records, error: recErr } = await supabase
    .from("inbody_records")
    .select("*")
    .eq("member_id", member_id)
    .order("measured_at", { ascending: false })
    .limit(2);
  if (recErr) return json({ error: recErr.message }, 500);

  const current = (records ?? []).find((r: Record<string, unknown>) => r.id === inbody_record_id) ?? records?.[0];
  const previous = (records ?? []).find((r: Record<string, unknown>) => r.id !== current?.id) ?? null;
  if (!current) return json({ error: "record_not_found" }, 404);

  // 회원 정보 로드 (성별/생년)
  const { data: member } = await supabase
    .from("inbody_members")
    .select("gender, birth_year")
    .eq("id", member_id)
    .single();

  const currentYear = new Date().getFullYear();
  const age = member?.birth_year ? currentYear - member.birth_year : null;
  const is_revisit = previous !== null;

  // 2) Claude Opus 4.6 호출
  const aiReq = {
    model: "claude-opus-4-6",
    max_tokens: 3800,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          member: { gender: member?.gender, age, is_revisit },
          inbody_final: pickFinals(current as Record<string, unknown>),
          inbody_previous: previous ? pickFinals(previous as Record<string, unknown>) : null,
          pre_inputs,
          personas,
        }),
      },
    ],
  };

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(aiReq),
  });
  if (!resp.ok) return json({ error: "ai_failed", detail: await resp.text() }, 502);

  const ai = await resp.json();
  const text = ai.content?.find((b: { type: string }) => b.type === "text")?.text ?? "{}";

  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  let out: Record<string, unknown>;
  try {
    out = JSON.parse(cleaned);
  } catch {
    return json({ error: "ai_bad_json", raw: text }, 502);
  }

  return json(out);
});
