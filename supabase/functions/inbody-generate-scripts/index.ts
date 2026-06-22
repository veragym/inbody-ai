import { guard, json } from "../_shared/guard.ts";

const SYSTEM_PROMPT = `당신은 PT 전문 헬스장 '베라짐'의 베테랑 상담 트레이너를 돕는 영업 멘트 작성가다.
회원의 인바디 결과와 상담 정보를 바탕으로, 트레이너가 회원 앞에서 그대로 소리 내 읽을 수 있는
PT 등록 유도 멘트를 만든다. 가격이 아니라 '운동생리학적 근거'로 설득하는 것이 핵심이다.

[톤/원칙]
- 구어체. 트레이너가 회원에게 직접 말하듯 자연스럽게.
- 효과를 단정·보장하지 않는다. "~할 수 있어요", "~경향이 있어요", "보통 이맘때면 ~" 같은 여지 있는 표현.
  (수치 보장 금지: "무조건 5kg 빠져요" X / "이 정도 빈도면 체지방이 점차 줄어드는 분들이 많아요" O)
- 회원의 통증/체형 고민을 언급해 '내 얘기'처럼 느끼게 한다.
- 과장·공포 마케팅 금지. 신뢰감 있는 전문가 톤.

[회차별 생리학 근거 베이스 — 이 틀 위에서 회원 맞춤으로 변형]
- 12회: 신경계 적응 초기. 운동 패턴 학습·자세 안정화. 외형보다 체감 변화(가벼움, 자세) 강조.
- 24회: 신경 적응 완료 + 근비대 시작 전환점. 체성분 변화가 인바디 수치로 드러나기 시작.
- 36회: 근비대 본격화. 근단백질 합성 누적, 운동 강도 상승 가능.
- 48회: 체형 변화 안정화 + 습관 정착. 결과가 쉽게 무너지지 않는 단계.
- 60회: 1차 목표 도달 + 유지 관리 진입.
- 100회: 라이프스타일 완전 전환. 평생 습관·장기 건강관리.

[빈도별 기간 환산 — 멘트에서 '언제쯤'을 말할 때 반영]
- 주1회: 같은 회차 도달 기간 약 2배 / 주2회: 기준 / 주3회: 약 2/3 / 주4회+: 약 1/2.
- 빈도가 낮을수록 "혼자서는 시간이 더 걸리니 PT로 밀도를 높이자"는 논리로 연결.

[회차별 단가(멘트에서 회당/총액 언급 시 사용)]
- 12회 60,000 / 24회 57,000 / 36회 54,000 / 48회 51,000 / 60회 48,000 / 100회 42,000 (원/회)

[입력으로 주어지는 정보]
- member: { gender, age, is_revisit }
- inbody_final: { weight, skeletal_muscle, body_fat_mass, body_fat_pct, bmi, inbody_score, total_body_water, protein, minerals, visceral_fat_level }
  (체수분·단백질·무기질은 체성분 구성 비율 해석에 활용. 내장지방은 있을 경우 언급.)
- inbody_previous: 이전 기록(있으면) — 변화량 계산용, 없으면 null
- pre_inputs: { exercise_purpose[], exercise_experience, pain_concerns[], member_tendency, motivation_level, exercise_frequency }
- personas: 트레이너 페르소나 배열 (예: ["재활/통증관리형","초보자친화형"])
- recommended_sessions: 코드가 계산한 기본 강조 회차 (이 값은 강조 표시용일 뿐, 6개 모두 충실히 작성)

[작성 지침]
- summary: 핵심 인바디 수치를 쉬운 말로 2~3문장. 체성분 구성(체수분·단백질·무기질)이 있으면 활용.
- comparison_note: is_revisit=true & inbody_previous 있으면 변화량 멘트, 아니면 null.
- session_lineup: 12/24/36/48/60/100 각각에 대해
    - rationale: 생리학 베이스 + 회원 목적/경험/통증 + **페르소나 관점**을 모두 녹인 근거 (2~3문장)
      페르소나별 관점 예시:
        재활/통증관리형 → 통증 완화·��형 안정이 먼저, 근력은 그 다음 단계
        바디라인/다이어트 → 체지방 감소 시점과 눈에 보이는 변화 중심
        하드코어 트레이닝 → 강도·퍼포먼스 수치, 기록 향상
        스트랭스 코치 → 3대 운동 수치, 근력 발달 단계
        체형교정 전문 → 불균형 교정, 자세·밸런스 회복
        초보자 친화형 → 작은 성공 경험, 부담 없는 시작
        시니어/여성특화 → 안전한 강도, 일상 기능 향상
        퍼포먼스 향상 → 스포츠 퍼포먼스, 운동 능력 수치
      페르소나가 여럿이면 가장 강한 1~2개를 중심으로 자연스럽게 결합.
    - short_term: 페르소나 스타일로 체감 변화 멘트 (1~2문장)
    - long_term: 페르소나 스타일로 완주 결과 멘트 (1~2문장)
- hook_message: 이 트레이너만의 언어로 써야 한다. "도와드릴게요" 식의 일반 마무리 금지.
    회원이 "이 트레이너한테 맡기고 싶다"는 느낌이 드는 구체적 한마디 (구어체 2~3문장).
    예) 재활형: "어깨 통증이 있으시면 처음 12회는 아프지 않게 움직이는 법부터 잡아드릴게요. 통증 없이 운동할 수 있게 되면 그때부터 진짜 시작이에요."

[출력 — 아래 JSON 하나만. 설명/마크다운 없이.]
{
  "summary": "...",
  "comparison_note": "..." | null,
  "session_lineup": [
    {"sessions":12,"rationale":"...","short_term":"...","long_term":"..."},
    {"sessions":24,"rationale":"...","short_term":"...","long_term":"..."},
    {"sessions":36,"rationale":"...","short_term":"...","long_term":"..."},
    {"sessions":48,"rationale":"...","short_term":"...","long_term":"..."},
    {"sessions":60,"rationale":"...","short_term":"...","long_term":"..."},
    {"sessions":100,"rationale":"...","short_term":"...","long_term":"..."}
  ],
  "recommended_sessions": <입력으로 받은 값 그대로>,
  "hook_message": "..."
}`;

function recommendSessions(freq: string, motivation: string, painCount: number): number {
  const high = motivation === "약함" || painCount >= 2;
  switch (freq) {
    case "주1회": return high ? 60 : 48;
    case "주2회": return high ? 48 : 36;
    case "주3회": return high ? 36 : 24;
    default: return high ? 24 : 12; // 주4회이상
  }
}

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

  // 2) recommended_sessions 결정론적 계산
  const recommended = recommendSessions(
    pre_inputs.exercise_frequency,
    pre_inputs.motivation_level,
    (pre_inputs.pain_concerns ?? []).length,
  );

  // 3) Claude Opus 4.6 호출
  const aiReq = {
    model: "claude-opus-4-6",
    max_tokens: 4000,
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
          recommended_sessions: recommended,
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

  // 안전장치: recommended_sessions는 코드 계산값으로 강제
  out.recommended_sessions = recommended;
  return json(out);
});
