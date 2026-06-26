import { guard, json } from "../_shared/guard.ts";
import { jsonrepair } from "https://esm.sh/jsonrepair@3.0.0";
import { generateRuleAnalysis } from "../_shared/analysis_engine.mjs";

const SYSTEM_PROMPT = `당신은 PT 전문 헬스장 '베라짐'의 정밀 체성분 분석 전문가다.
근골격계, 체형 평가, 운동처방, 운동생리학, 영양, 통증 관리 관점을 통합해서
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
- 청소년/성장기 회원은 성인 BMI 기준을 단정적으로 적용하지 않는다. "비만 범주" 대신 "체중 관리가 필요한 구간"처럼 완화해서 설명한다.
- "위협", "위험하다", "반드시 병원"처럼 불안을 키우는 표현을 피한다. "장기적으로 관리가 필요한 신호", "통증이 지속되거나 악화되면 전문가 상담"처럼 안전하게 쓴다.
- 근거가 입력값에 없는 또래 평균, 백분위, 의학적 진단명, 질병 예측을 만들지 않는다.
- 통증/체형 고민은 운동 자세와 강도 조절 관점으로만 연결한다. 치료·진단처럼 보이는 문장은 쓰지 않는다.
- member_tendency는 트레이너가 설명 강도와 진행 방식을 잡기 위한 내부 참고 정보다. 결과 문장에는 "불안형", "결과중심형", "과정중시형", "자기주도형", "모르겠음", "성향", "회원 성향"을 절대 쓰지 않는다.
- 성향 정보가 필요하면 회원에게 보이는 표현으로 바꾸지 말고, 문장의 친절도와 실행 제안 방식에만 조용히 반영한다.

[입력으로 주어지는 정보]
- member: { gender, age, is_revisit }
- inbody_final: { weight, skeletal_muscle, body_fat_mass, body_fat_pct, bmi, inbody_score, total_body_water, protein, minerals, visceral_fat_level }
  (체수분·단백질·무기질은 체성분 구성 비율 해석에 활용. 내장지방은 있을 경우 언급.)
- inbody_previous: 이전 기록(있으면) — 변화량 계산용, 없으면 null
- recent_records: 최근 측정 기록 5개까지. 현재/이전뿐 아니라 누적 추세를 읽는 데 사용.
- analysis_meta: 서버가 계산한 최신/이전/평균 추세 요약. AI는 이 수치를 근거로 해석한다.
- pre_inputs: { exercise_purpose[], exercise_experience, pain_concerns[], member_tendency, motivation_level, exercise_frequency, protein_intake, carb_intake, fat_intake }
- personas: 트레이너 페르소나 배열 (예: ["재활/통증관리형","초보자친화형"])

[작성 지침]
- summary: 현재 몸 상태를 2~3문장으로 요약. 반드시 핵심 수치 2개 이상을 넣는다.
- comparison_note: is_revisit=true & inbody_previous 있으면 변화량 멘트, 아니면 null.
- body_composition_analysis: 체수분·단백질·무기질·체지방량을 체중과 연결해 2~4문장으로 해석한다.
- metric_interp:
  - skeletal_muscle: { "text": "...", "evidence": "...", "confidence": "high|medium|low" }
  - body_fat_pct: { "text": "...", "evidence": "...", "confidence": "high|medium|low" }
  - bmi: { "text": "...", "evidence": "...", "confidence": "high|medium|low" }
- segmental_analysis: 부위별 근육/지방 데이터가 있으면 좌우/상하체/몸통 관점으로 해석. 없으면 null.
- priority_goals: 지금 가장 먼저 볼 목표 3개. 각각 "title", "why", "action" 포함.
- exercise_strategy: 주당 운동 빈도, 경험, 통증을 고려한 운동 전략 3~5문장.
- nutrition_strategy: 단백질/탄수화물/지방 선택과 체성분을 연결한 식단 전략 3~5문장.
- expected_change: 현재 계획과 개선 계획을 비교한 예상 변화. 보장 수치가 아니라 방향성과 조건을 설명한다.
  { "title", "current_plan", "improved_plan", "key_condition", "caution" }
- analysis_confidence: 전체 해석 신뢰도 "high|medium|low"
- 회원에게 그대로 보여주는 리포트이므로 트레이너 내부 상담 흐름, 설명 시 주의점, 운영 메모는 출력하지 않는다.

[출력 — 아래 JSON 하나만. 설명/마크다운 없이.]
{
  "summary": "...",
  "comparison_note": "..." | null,
  "body_composition_analysis": "...",
  "metric_interp": {
    "skeletal_muscle": { "text": "...", "evidence": "...", "confidence": "high" },
    "body_fat_pct": { "text": "...", "evidence": "...", "confidence": "medium" },
    "bmi": { "text": "...", "evidence": "...", "confidence": "low" }
  },
  "segmental_analysis": "..." | null,
  "priority_goals": [
    {"title":"...","why":"...","action":"..."},
    {"title":"...","why":"...","action":"..."},
    {"title":"...","why":"...","action":"..."}
  ],
  "exercise_strategy": "...",
  "nutrition_strategy": "...",
  "expected_change": {
    "title": "...",
    "current_plan": "...",
    "improved_plan": "...",
    "key_condition": "...",
    "caution": "..."
  },
  "analysis_confidence": "high|medium|low"
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
    segmental_muscle: raw.segmental_muscle ?? null,
    segmental_fat: raw.segmental_fat ?? null,
    low_confidence_fields: raw.low_confidence_fields ?? [],
    measured_date_on_sheet: raw.measured_date_on_sheet ?? null,
  };
}

function toNum(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function round1(v: number | null) {
  return v == null ? null : +v.toFixed(1);
}

function cleanMemberFacingText(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/불안형\s*성향과\s*스트레스/g, "운동 부담과 스트레스")
    .replace(/불안형\s*성향/g, "운동 시작 부담")
    .replace(/결과중심형\s*성향|과정중시형\s*성향|자기주도형\s*성향/g, "운동 접근 방식")
    .replace(/회원\s*성향/g, "현재 상태")
    .replace(/불안형|결과중심형|과정중시형|자기주도형|모르겠음/g, "")
    .replace(/\s*성향/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildAnalysisMeta(records: Record<string, unknown>[]) {
  const current = records[0] ?? null;
  const previous = records[1] ?? null;
  const fields = [
    ["weight", "final_weight"],
    ["skeletal_muscle", "final_skeletal_muscle"],
    ["body_fat_mass", "final_body_fat_mass"],
    ["body_fat_pct", "final_body_fat_pct"],
    ["bmi", "final_bmi"],
    ["inbody_score", "final_inbody_score"],
  ] as const;

  const averages: Record<string, number | null> = {};
  const deltas: Record<string, number | null> = {};
  const directions: Record<string, string> = {};

  for (const [alias, key] of fields) {
    const nums = records.map((r) => toNum(r[key])).filter((v): v is number => v != null);
    const avg = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
    const cur = toNum(current?.[key]);
    const prev = toNum(previous?.[key]);
    averages[alias] = round1(avg);
    deltas[alias] = round1(cur != null && prev != null ? cur - prev : null);
    if (deltas[alias] == null) {
      directions[alias] = "unknown";
    } else if (alias === "body_fat_pct" || alias === "weight" || alias === "body_fat_mass") {
      directions[alias] = deltas[alias]! < 0 ? "improving" : deltas[alias]! > 0 ? "needs_attention" : "flat";
    } else {
      directions[alias] = deltas[alias]! > 0 ? "improving" : deltas[alias]! < 0 ? "needs_attention" : "flat";
    }
  }

  return {
    record_count: records.length,
    current_measured_at: current?.measured_at ?? null,
    previous_measured_at: previous?.measured_at ?? null,
    averages,
    deltas,
    directions,
    low_confidence_fields: (current?.final_raw_json as Record<string, unknown> | undefined)?.low_confidence_fields ?? [],
  };
}

function normalizeReport(out: Record<string, unknown>) {
  const metricInterp = (out.metric_interp && typeof out.metric_interp === "object")
    ? out.metric_interp as Record<string, unknown>
    : {};
  const goals = Array.isArray(out.priority_goals) ? out.priority_goals : [];
  return {
    summary: cleanMemberFacingText(out.summary),
    comparison_note: typeof out.comparison_note === "string" ? cleanMemberFacingText(out.comparison_note) : null,
    body_composition_analysis: cleanMemberFacingText(out.body_composition_analysis),
    metric_interp: {
      skeletal_muscle: normalizeMetricInterp(metricInterp.skeletal_muscle),
      body_fat_pct: normalizeMetricInterp(metricInterp.body_fat_pct),
      bmi: normalizeMetricInterp(metricInterp.bmi),
    },
    segmental_analysis: typeof out.segmental_analysis === "string" ? cleanMemberFacingText(out.segmental_analysis) : null,
    priority_goals: goals
      .filter((g) => g && typeof g === "object")
      .map((g: Record<string, unknown>) => ({
        title: cleanMemberFacingText(g.title),
        why: cleanMemberFacingText(g.why),
        action: cleanMemberFacingText(g.action),
      }))
      .filter((g) => g.title || g.why || g.action)
      .slice(0, 3),
    exercise_strategy: cleanMemberFacingText(out.exercise_strategy),
    nutrition_strategy: cleanMemberFacingText(out.nutrition_strategy),
    expected_change: normalizeExpectedChange(out.expected_change),
    analysis_confidence: typeof out.analysis_confidence === "string" ? out.analysis_confidence : null,
    analysis_meta: (out.analysis_meta && typeof out.analysis_meta === "object") ? out.analysis_meta : null,
  };
}

function normalizeMetricInterp(value: unknown) {
  if (typeof value === "string") {
    return { text: cleanMemberFacingText(value), evidence: "", confidence: null };
  }
  if (!value || typeof value !== "object") {
    return { text: "", evidence: "", confidence: null };
  }
  const v = value as Record<string, unknown>;
  return {
    text: cleanMemberFacingText(v.text),
    evidence: cleanMemberFacingText(v.evidence),
    confidence: typeof v.confidence === "string" ? v.confidence : null,
  };
}

function normalizeExpectedChange(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const v = value as Record<string, unknown>;
  return {
    title: cleanMemberFacingText(v.title),
    current_plan: cleanMemberFacingText(v.current_plan),
    improved_plan: cleanMemberFacingText(v.improved_plan),
    key_condition: cleanMemberFacingText(v.key_condition),
    caution: cleanMemberFacingText(v.caution),
  };
}

function validateReport(out: Record<string, unknown>) {
  const r = normalizeReport(out);
  return !!r.summary
    && !!r.body_composition_analysis
    && !!r.metric_interp.skeletal_muscle.text
    && !!r.metric_interp.body_fat_pct.text
    && !!r.metric_interp.bmi.text
    && r.priority_goals.length === 3
    && !!r.exercise_strategy
    && !!r.nutrition_strategy
    && !!r.expected_change?.current_plan
    && !!r.expected_change?.improved_plan;
}

async function callAnthropicWithFallback(aiReqBase: Record<string, unknown>, models: string[]) {
  let lastErrorText = "";

  for (const model of models) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...aiReqBase, model }),
    });

    const text = await resp.text();
    if (resp.ok) {
      try {
        const parsed = JSON.parse(text);
        const rawText = parsed.content?.find((b: { type: string }) => b.type === "text")?.text ?? "{}";
        const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        let out: Record<string, unknown>;
        try {
          out = JSON.parse(cleaned);
        } catch {
          out = JSON.parse(jsonrepair(cleaned));
        }
        if (validateReport(out)) return out;
        lastErrorText = `invalid_schema:${cleaned}`;
        continue;
      } catch (err) {
        lastErrorText = `parse_failed:${String(err)}`;
        continue;
      }
    }

    lastErrorText = text;
    const normalized = text.toLowerCase();
    if (!normalized.includes("capacity") && !normalized.includes("overloaded") && !normalized.includes("temporarily unavailable")) {
      break;
    }
  }

  throw new Error(lastErrorText || "anthropic_request_failed");
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
    .limit(5);
  if (recErr) return json({ error: recErr.message }, 500);

  const current = (records ?? []).find((r: Record<string, unknown>) => r.id === inbody_record_id) ?? records?.[0];
  const previous = (records ?? []).find((r: Record<string, unknown>) => r.id !== current?.id) ?? null;
  if (!current) return json({ error: "record_not_found" }, 404);
  const recent_records = (records ?? []).map((r: Record<string, unknown>) => ({
    measured_at: r.measured_at ?? null,
    weight: r.final_weight ?? null,
    skeletal_muscle: r.final_skeletal_muscle ?? null,
    body_fat_mass: r.final_body_fat_mass ?? null,
    body_fat_pct: r.final_body_fat_pct ?? null,
    bmi: r.final_bmi ?? null,
    inbody_score: r.final_inbody_score ?? null,
  }));
  const analysis_meta = buildAnalysisMeta(records ?? []);

  // 회원 정보 로드 (성별/생년)
  const { data: member } = await supabase
    .from("inbody_members")
    .select("gender, birth_year")
    .eq("id", member_id)
    .single();

  const currentYear = new Date().getFullYear();
  const age = member?.birth_year ? currentYear - member.birth_year : null;
  const is_revisit = previous !== null;
  const ruleContext = {
    member: { gender: member?.gender, age, is_revisit },
    inbody_final: pickFinals(current as Record<string, unknown>),
    inbody_previous: previous ? pickFinals(previous as Record<string, unknown>) : null,
    recent_records,
    analysis_meta,
    pre_inputs,
    personas,
  };
  const ruleReport = generateRuleAnalysis(ruleContext);

  // 2) Claude Opus 4.6 호출
  const aiReq = {
    max_tokens: 2400,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          ...ruleContext,
          rule_analysis: ruleReport,
        }),
      },
    ],
  };

  let ai;
  try {
    ai = await callAnthropicWithFallback(aiReq, [
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
    ]);
  } catch (err) {
    return json({
      ...ruleReport,
      analysis_meta,
      ai_fallback: true,
      ai_error: String(err),
    });
  }

  return json({
    ...normalizeReport(ai),
    analysis_meta,
    rule_engine: ruleReport.rule_engine,
  });
});
