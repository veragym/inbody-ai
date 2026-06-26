import { getMetricRange } from "./analysis_rules.mjs";

const FIELD_LABELS = {
  weight: "체중",
  skeletal_muscle: "골격근량",
  body_fat_mass: "체지방량",
  body_fat_pct: "체지방률",
  bmi: "BMI",
  inbody_score: "인바디 점수",
};

const FIELD_UNITS = {
  weight: "kg",
  skeletal_muscle: "kg",
  body_fat_mass: "kg",
  body_fat_pct: "%",
  bmi: "",
  inbody_score: "점",
};

const BODY_SHAPE_CONCERN_SET = new Set(["복부", "거북목", "척추측만", "말린어깨", "O다리", "굽은등", "X다리", "일자허리", "평발", "팔뚝", "복부라인", "하체라인"]);

const GENDER_ALIASES = {
  male: "male",
  m: "male",
  man: "male",
  남: "male",
  남성: "male",
  남자: "male",
  female: "female",
  f: "female",
  woman: "female",
  여: "female",
  여성: "female",
  여자: "female",
};

function splitConcerns(preInputs) {
  const mixedPain = Array.isArray(preInputs?.pain_concerns) ? preInputs.pain_concerns : [];
  const explicitShape = Array.isArray(preInputs?.body_shape_concerns) ? preInputs.body_shape_concerns : [];
  return {
    pain: mixedPain.filter((v) => !BODY_SHAPE_CONCERN_SET.has(v)),
    shape: [...new Set([...explicitShape, ...mixedPain.filter((v) => BODY_SHAPE_CONCERN_SET.has(v))])],
  };
}

function toNum(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 1) {
  if (value == null) return null;
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

function normalizeGender(gender) {
  if (gender == null) return "default";
  return GENDER_ALIASES[String(gender).trim().toLowerCase()] ?? "default";
}

function getRange(metric, gender) {
  return getMetricRange(metric, gender);
}

function classifyMetric(metric, value, gender) {
  const n = toNum(value);
  const range = getRange(metric, gender);
  if (n == null || !range) {
    return { status: "unknown", value: n, label: "판정 불가", standard: null, distance: null };
  }

  const [lo, hi] = range.standard;
  let status = "standard";
  let distance = 0;
  if (n < lo) {
    status = "low";
    distance = round(lo - n);
  } else if (n > hi) {
    status = "high";
    distance = round(n - hi);
  }

  return {
    status,
    value: n,
    label: status === "low" ? "표준 이하" : status === "high" ? "표준 이상" : "표준",
    standard: [lo, hi],
    distance,
  };
}

function deltaOf(meta, field) {
  const delta = meta?.deltas?.[field];
  return typeof delta === "number" && Number.isFinite(delta) ? delta : null;
}

function trendLabel(field, delta) {
  if (delta == null) return "비교 기록 없음";
  if (Math.abs(delta) < 0.05) return "큰 변화 없음";
  const lowerIsBetter = field === "body_fat_pct" || field === "body_fat_mass" || field === "weight";
  const better = lowerIsBetter ? delta < 0 : delta > 0;
  return better ? "개선 방향" : "관리 필요";
}

function formatDelta(field, delta) {
  if (delta == null) return "비교 기록이 아직 없습니다";
  const sign = delta > 0 ? "+" : "";
  return `${FIELD_LABELS[field]} ${sign}${round(delta)}${FIELD_UNITS[field]}`;
}

function valueText(value, unit = "") {
  return value == null ? "미측정" : `${value}${unit}`;
}

function confidenceFromInput(finals, preInputs, meta) {
  const required = ["weight", "skeletal_muscle", "body_fat_pct", "bmi"];
  const missing = required.filter((key) => toNum(finals?.[key]) == null);
  const lowFields = Array.isArray(meta?.low_confidence_fields) ? meta.low_confidence_fields : [];
  const preInputCount = [
    preInputs?.exercise_experience,
    preInputs?.exercise_frequency,
    preInputs?.motivation_level,
    ...(Array.isArray(preInputs?.exercise_purpose) ? preInputs.exercise_purpose : []),
  ].filter(Boolean).length;

  if (missing.length === 0 && lowFields.length === 0 && preInputCount >= 3) return "high";
  if (missing.length <= 1 && lowFields.length <= 2) return "medium";
  return "low";
}

function buildDbSignals(input, bands) {
  const final = input.inbody_final ?? {};
  const meta = input.analysis_meta ?? {};
  const raw = {
    total_body_water: toNum(final.total_body_water),
    protein: toNum(final.protein),
    minerals: toNum(final.minerals),
    visceral_fat_level: toNum(final.visceral_fat_level),
  };

  const signals = [];
  if (bands.skeletal_muscle.status === "low") {
    signals.push({
      code: "muscle_low",
      severity: "high",
      metric: "skeletal_muscle",
      evidence: `골격근량 ${valueText(bands.skeletal_muscle.value, "kg")}이 표준 하한 ${bands.skeletal_muscle.standard?.[0]}kg보다 낮습니다.`,
    });
  }
  if (bands.body_fat_pct.status === "high") {
    signals.push({
      code: "body_fat_high",
      severity: "high",
      metric: "body_fat_pct",
      evidence: `체지방률 ${valueText(bands.body_fat_pct.value, "%")}이 표준 상한 ${bands.body_fat_pct.standard?.[1]}%보다 높습니다.`,
    });
  }
  if (bands.bmi.status === "high") {
    signals.push({
      code: "bmi_high",
      severity: "medium",
      metric: "bmi",
      evidence: `BMI ${valueText(bands.bmi.value)}가 표준 상한 ${bands.bmi.standard?.[1]}보다 높습니다.`,
    });
  }
  if (raw.visceral_fat_level != null && raw.visceral_fat_level >= 10) {
    signals.push({
      code: "visceral_fat_attention",
      severity: "high",
      metric: "visceral_fat_level",
      evidence: `내장지방 레벨 ${raw.visceral_fat_level}로 표준 관리선인 9 이하보다 높습니다.`,
    });
  }

  const muscleDelta = deltaOf(meta, "skeletal_muscle");
  const fatDelta = deltaOf(meta, "body_fat_pct");
  if (muscleDelta != null) {
    signals.push({
      code: muscleDelta >= 0 ? "muscle_trend_up" : "muscle_trend_down",
      severity: muscleDelta >= 0 ? "positive" : "medium",
      metric: "skeletal_muscle",
      evidence: formatDelta("skeletal_muscle", muscleDelta),
    });
  }
  if (fatDelta != null) {
    signals.push({
      code: fatDelta <= 0 ? "fat_trend_down" : "fat_trend_up",
      severity: fatDelta <= 0 ? "positive" : "medium",
      metric: "body_fat_pct",
      evidence: formatDelta("body_fat_pct", fatDelta),
    });
  }

  return signals;
}

function metricInterp(metric, band, delta, confidence) {
  const label = FIELD_LABELS[metric];
  const unit = FIELD_UNITS[metric];
  const trend = trendLabel(metric, delta);
  const evidence = [
    `${label} ${valueText(band.value, unit)}`,
    band.standard ? `표준 ${band.standard[0]}~${band.standard[1]}${unit}` : null,
    delta != null ? formatDelta(metric, delta) : null,
  ].filter(Boolean).join(", ");

  let text = `${label}은 현재 ${band.label} 구간입니다.`;
  if (band.status === "low" && metric === "skeletal_muscle") {
    text = `골격근량이 표준보다 낮아 근력 운동과 단백질 섭취를 우선순위로 두는 편이 좋습니다.`;
  } else if (band.status === "high" && metric === "body_fat_pct") {
    text = `체지방률이 표준보다 높아 감량보다 근육 보존을 전제로 한 체지방 관리가 먼저입니다.`;
  } else if (band.status === "high" && metric === "bmi") {
    text = `BMI가 높지만 근육량 영향을 받을 수 있어 체지방률과 함께 보는 것이 정확합니다.`;
  } else if (band.status === "standard") {
    text = `${label}은 표준 구간입니다. 현재 흐름을 유지하면서 다른 취약 지표를 보완하면 됩니다.`;
  }

  if (trend !== "비교 기록 없음") {
    text += ` 최근 변화는 ${trend}입니다.`;
  }

  return { text, evidence, confidence };
}

function buildPriorityGoals(bands, signals, preInputs) {
  const goals = [];
  const purposes = Array.isArray(preInputs?.exercise_purpose) ? preInputs.exercise_purpose.join(", ") : "";
  const { pain, shape } = splitConcerns(preInputs);
  const pains = pain.join(", ");
  const shapes = shape.join(", ");

  if (bands.body_fat_pct.status === "high" || signals.some((s) => s.code === "visceral_fat_attention")) {
    goals.push({
      title: "체지방과 내장지방 관리",
      why: "체지방 관련 지표가 표준보다 높으면 같은 체중에서도 피로감과 대사 부담이 커질 수 있습니다.",
      action: "주 2~3회 근력 운동을 유지하면서 식사에서는 단 음료, 야식, 정제 탄수화물을 먼저 줄입니다.",
    });
  }
  if (bands.skeletal_muscle.status === "low") {
    goals.push({
      title: "골격근량 회복",
      why: "근육량이 낮으면 기초대사량과 운동 지속력이 떨어져 체지방 관리도 느려집니다.",
      action: "하체, 등, 가슴 중심의 큰 근육 운동을 우선하고 매 끼니 단백질을 빠뜨리지 않습니다.",
    });
  }
  if (pains) {
    goals.push({
      title: "통증 부위에 맞춘 강도 조절",
      why: `${pains} 이슈가 있으면 운동 효과보다 자세 안정과 부하 조절이 먼저입니다.`,
      action: "통증이 있는 동작은 가동 범위와 중량을 낮추고, 대체 동작으로 운동 흐름을 유지합니다.",
    });
  }
  if (shapes) {
    goals.push({
      title: "체형 고민과 라인 균형 확인",
      why: `${shapes} 고민은 통증으로 단정하지 않고 근육 균형, 자세, 체지방 분포를 함께 봐야 합니다.`,
      action: "해당 부위만 반복하기보다 전신 근력 운동과 자세 정렬 동작을 함께 배치합니다.",
    });
  }
  if (purposes) {
    goals.push({
      title: "운동 목적과 지표 연결",
      why: `회원 목표가 ${purposes}이므로 체성분 지표를 목표와 연결해서 관리해야 합니다.`,
      action: "인바디 점수보다 골격근량, 체지방률, 운동 빈도의 변화를 함께 확인합니다.",
    });
  }
  goals.push({
    title: "측정 기준 고정",
    why: "측정 시간과 식사, 운동 직후 여부가 달라지면 체수분과 체중 변화 해석이 흔들릴 수 있습니다.",
    action: "다음 측정도 비슷한 시간대와 컨디션에서 진행해 변화량의 신뢰도를 높입니다.",
  });
  goals.push({
    title: "운동 루틴 유지",
    why: "지표가 표준권에 있어도 운동 빈도가 흔들리면 근육량과 체지방률이 다시 변할 수 있습니다.",
    action: "현재 가능한 주간 운동 횟수를 먼저 고정하고, 강도는 컨디션에 맞춰 천천히 올립니다.",
  });

  return goals.slice(0, 3);
}

function buildExerciseStrategy(input, bands) {
  const pre = input.pre_inputs ?? {};
  const experience = pre.exercise_experience || "운동 경험 정보 없음";
  const frequency = pre.exercise_frequency || "운동 빈도 미입력";
  const { pain, shape } = splitConcerns(pre);
  const pains = pain.length
    ? ` 통증 부위(${pain.join(", ")})는 강도를 낮춰 확인합니다.`
    : "";
  const shapes = shape.length
    ? ` 체형 고민(${shape.join(", ")})은 통증으로 보지 않고 자세 정렬과 라인 균형 기준으로 반영합니다.`
    : "";
  const musclePart = bands.skeletal_muscle.status === "low"
    ? "큰 근육 위주의 기본 근력 운동을 우선 배치하고,"
    : "현재 근육량을 유지할 수 있게 전신 근력 운동을 유지하고,";
  const fatPart = bands.body_fat_pct.status === "high"
    ? "유산소는 운동 후 15~25분 정도로 붙여 체지방 관리 흐름을 만듭니다."
    : "유산소는 회복과 컨디션 유지 목적의 보조 운동으로 둡니다.";
  return `${experience}, ${frequency} 기준으로 ${musclePart} ${fatPart}${pains}${shapes}`;
}

function buildNutritionStrategy(input, bands) {
  const pre = input.pre_inputs ?? {};
  const protein = pre.protein_intake ? `단백질은 현재 선택한 '${pre.protein_intake}' 수준을 기준으로 매 끼니 분산합니다.` : "단백질은 매 끼니 손바닥 1개 분량을 기준으로 잡습니다.";
  const carb = pre.carb_intake ? ` 탄수화물은 '${pre.carb_intake}' 패턴에서 운동 전후로 몰아 배치합니다.` : " 탄수화물은 운동 전후와 낮 시간에 우선 배치합니다.";
  const fat = pre.fat_intake ? ` 지방은 '${pre.fat_intake}' 선택을 유지하되 튀김과 야식은 줄입니다.` : " 지방은 견과류, 계란, 생선처럼 포만감이 있는 식품으로 선택합니다.";
  const focus = bands.body_fat_pct.status === "high"
    ? "체지방률이 높아 총량 관리를 먼저 보고, 단백질을 줄이지 않는 방식이 필요합니다."
    : "체지방률이 표준권이면 식사 제한보다 운동 수행과 회복을 안정시키는 쪽이 좋습니다.";
  return `${focus} ${protein}${carb}${fat}`;
}

function buildSegmentalAnalysis(final) {
  const seg = final?.segmental_muscle;
  if (!seg || typeof seg !== "object") return null;
  const parts = [
    ["왼팔", toNum(seg.left_arm)],
    ["오른팔", toNum(seg.right_arm)],
    ["몸통", toNum(seg.trunk)],
    ["왼다리", toNum(seg.left_leg)],
    ["오른다리", toNum(seg.right_leg)],
  ].filter(([, value]) => value != null);
  if (!parts.length) return null;
  const low = parts.filter(([, value]) => value < 95).map(([name]) => name);
  if (!low.length) return "부위별 근육은 전반적으로 표준권에 가깝습니다. 좌우 차이는 다음 측정에서도 같은 기준으로 확인하면 됩니다.";
  return `${low.join(", ")} 부위가 표준 대비 낮게 보입니다. 해당 부위는 중량보다 자세 안정과 반복 품질을 먼저 봅니다.`;
}

function buildSummary(input, bands, signals) {
  const final = input.inbody_final ?? {};
  const score = toNum(final.inbody_score);
  const parts = [
    `현재 체중은 ${valueText(toNum(final.weight), "kg")}, 골격근량은 ${valueText(toNum(final.skeletal_muscle), "kg")}, 체지방률은 ${valueText(toNum(final.body_fat_pct), "%")}입니다.`,
  ];
  if (score != null) parts.push(`인바디 점수는 ${score}점이지만, 점수보다 근육량과 체지방률의 조합을 우선 봅니다.`);
  if (bands.skeletal_muscle.status === "low" && bands.body_fat_pct.status === "high") {
    parts.push("근육은 보강하고 체지방은 낮추는 재구성 전략이 가장 적합합니다.");
  } else if (bands.body_fat_pct.status === "high") {
    parts.push("현재는 체지방 관리가 가장 먼저 보이는 과제입니다.");
  } else if (bands.skeletal_muscle.status === "low") {
    parts.push("현재는 근육량 보강이 가장 먼저 보이는 과제입니다.");
  } else if (signals.some((s) => s.severity === "positive")) {
    parts.push("최근 변화 중 긍정적인 흐름이 있어 같은 기준으로 이어가는 것이 좋습니다.");
  } else {
    parts.push("전반적인 균형을 유지하면서 운동 빈도와 식사 기준을 고정하는 단계입니다.");
  }
  return parts.join(" ");
}

function buildComparisonNote(input) {
  const meta = input.analysis_meta ?? {};
  const changes = ["weight", "skeletal_muscle", "body_fat_pct", "inbody_score"]
    .map((field) => {
      const delta = deltaOf(meta, field);
      return delta == null ? null : formatDelta(field, delta);
    })
    .filter(Boolean);
  if (!changes.length) return null;
  return `직전 기록과 비교하면 ${changes.join(", ")} 변화가 있습니다. 한 번의 변화보다 같은 조건에서 반복 측정된 방향성을 더 중요하게 봅니다.`;
}

function buildExpectedChange(bands) {
  const focus = bands.body_fat_pct.status === "high"
    ? "체지방 관리"
    : bands.skeletal_muscle.status === "low"
      ? "근육량 보강"
      : "현재 균형 유지";
  return {
    title: "예상 변화 방향",
    current_plan: "현재 패턴을 그대로 유지하면 가장 약한 지표의 변화가 느리거나 정체될 수 있습니다.",
    improved_plan: `${focus}에 맞춰 운동 빈도, 단백질, 탄수화물 배치를 고정하면 다음 측정에서 방향성을 확인하기 쉬워집니다.`,
    key_condition: "측정 조건을 비슷하게 맞추고 최소 4주 이상 같은 기준으로 실행해야 비교가 가능합니다.",
    caution: "예상 변화는 보장 수치가 아니라 현재 지표와 입력값으로 본 관리 방향입니다.",
  };
}

function buildQualityChecks(report) {
  const required = [
    ["summary", report.summary],
    ["body_composition_analysis", report.body_composition_analysis],
    ["metric_interp.skeletal_muscle.text", report.metric_interp?.skeletal_muscle?.text],
    ["metric_interp.body_fat_pct.text", report.metric_interp?.body_fat_pct?.text],
    ["metric_interp.bmi.text", report.metric_interp?.bmi?.text],
    ["priority_goals", Array.isArray(report.priority_goals) && report.priority_goals.length === 3],
    ["exercise_strategy", report.exercise_strategy],
    ["nutrition_strategy", report.nutrition_strategy],
    ["expected_change.current_plan", report.expected_change?.current_plan],
    ["expected_change.improved_plan", report.expected_change?.improved_plan],
  ];
  const checks = required.map(([name, value]) => ({ name, pass: !!value }));
  const score = Math.round((checks.filter((c) => c.pass).length / checks.length) * 100);
  return { score, checks };
}

export function generateRuleAnalysis(input) {
  const final = input.inbody_final ?? {};
  const gender = input.member?.gender ?? "default";
  const confidence = confidenceFromInput(final, input.pre_inputs, input.analysis_meta);
  const bands = {
    skeletal_muscle: classifyMetric("skeletal_muscle", final.skeletal_muscle, gender),
    body_fat_pct: classifyMetric("body_fat_pct", final.body_fat_pct, gender),
    bmi: classifyMetric("bmi", final.bmi, gender),
    body_fat_mass: classifyMetric("body_fat_mass", final.body_fat_mass, gender),
    inbody_score: classifyMetric("inbody_score", final.inbody_score, gender),
  };
  const signals = buildDbSignals(input, bands);

  const report = {
    summary: buildSummary(input, bands, signals),
    comparison_note: buildComparisonNote(input),
    body_composition_analysis: [
      `체수분 ${valueText(toNum(final.total_body_water), "L")}, 단백질 ${valueText(toNum(final.protein), "kg")}, 무기질 ${valueText(toNum(final.minerals), "kg")}, 체지방량 ${valueText(toNum(final.body_fat_mass), "kg")}을 체중과 함께 봅니다.`,
      bands.body_fat_pct.status === "high"
        ? "체지방 비중이 높아 체중 감량만이 아니라 근육 보존을 같이 관리해야 합니다."
        : "체성분 구성은 한 항목만 보기보다 근육, 지방, 수분을 함께 비교해야 합니다.",
    ].join(" "),
    metric_interp: {
      skeletal_muscle: metricInterp("skeletal_muscle", bands.skeletal_muscle, deltaOf(input.analysis_meta, "skeletal_muscle"), confidence),
      body_fat_pct: metricInterp("body_fat_pct", bands.body_fat_pct, deltaOf(input.analysis_meta, "body_fat_pct"), confidence),
      bmi: metricInterp("bmi", bands.bmi, deltaOf(input.analysis_meta, "bmi"), confidence),
    },
    segmental_analysis: buildSegmentalAnalysis(final),
    priority_goals: buildPriorityGoals(bands, signals, input.pre_inputs),
    exercise_strategy: buildExerciseStrategy(input, bands),
    nutrition_strategy: buildNutritionStrategy(input, bands),
    expected_change: buildExpectedChange(bands),
    analysis_confidence: confidence,
    rule_engine: {
      version: "2026-06-26.1",
      bands,
      signals,
      quality: null,
    },
  };

  report.rule_engine.quality = buildQualityChecks(report);
  return report;
}

export function validateRuleAnalysis(report) {
  return buildQualityChecks(report);
}
