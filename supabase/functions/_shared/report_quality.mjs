const METRIC_FIELDS = [
  ["weight", "weight", "kg"],
  ["skeletal_muscle", "skeletal_muscle", "kg"],
  ["body_fat_pct", "body_fat_pct", "%"],
  ["bmi", "bmi", ""],
  ["inbody_score", "inbody_score", ""],
];

const DELTA_FIELDS = [
  ["weight", "kg"],
  ["skeletal_muscle", "kg"],
  ["body_fat_pct", "%"],
  ["inbody_score", ""],
];

function toNum(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function round1(value) {
  const n = toNum(value);
  return n == null ? null : Math.round(n * 10) / 10;
}

function normalizeText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(normalizeText).join(" ");
  if (typeof value === "object") return Object.values(value).map(normalizeText).join(" ");
  return "";
}

function flattenReport(report) {
  return normalizeText({
    summary: report?.summary,
    comparison_note: report?.comparison_note,
    body_composition_analysis: report?.body_composition_analysis,
    metric_interp: report?.metric_interp,
    segmental_analysis: report?.segmental_analysis,
    priority_goals: report?.priority_goals,
    exercise_strategy: report?.exercise_strategy,
    nutrition_strategy: report?.nutrition_strategy,
    expected_change: report?.expected_change,
  });
}

function numberTokens(value) {
  const n = round1(value);
  if (n == null) return [];
  const fixed = n.toFixed(1);
  const compact = String(Number(fixed));
  return [...new Set([fixed, compact])];
}

function hasNumber(text, value) {
  return numberTokens(value).some((token) => text.includes(token));
}

function arrayValues(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function hasAnyValue(text, values) {
  return values.some((value) => value && text.includes(value));
}

function passCheck(checks, code, pass, detail) {
  checks.push({ code, pass: !!pass, detail });
}

export function assessReportQuality(context, report, source = "ai") {
  const text = flattenReport(report);
  const final = context?.inbody_final ?? {};
  const meta = context?.analysis_meta ?? {};
  const pre = context?.pre_inputs ?? {};
  const checks = [];

  const metricMatches = METRIC_FIELDS
    .map(([code, key]) => ({ code, value: toNum(final[key]), pass: toNum(final[key]) != null && hasNumber(text, final[key]) }))
    .filter((item) => item.value != null);
  passCheck(
    checks,
    "current_metrics_mentioned",
    metricMatches.filter((item) => item.pass).length >= Math.min(3, metricMatches.length),
    `${metricMatches.filter((item) => item.pass).map((item) => item.code).join(", ") || "none"}`,
  );

  const deltas = meta?.deltas && typeof meta.deltas === "object" ? meta.deltas : {};
  const deltaMatches = DELTA_FIELDS
    .map(([key]) => ({ key, value: toNum(deltas[key]), pass: toNum(deltas[key]) != null && hasNumber(text, deltas[key]) }))
    .filter((item) => item.value != null);
  const hasHistory = toNum(meta?.record_count) != null && toNum(meta.record_count) > 1;
  passCheck(
    checks,
    "recent_history_reflected",
    !hasHistory || deltaMatches.length === 0 || deltaMatches.some((item) => item.pass),
    hasHistory ? `${deltaMatches.filter((item) => item.pass).map((item) => item.key).join(", ") || "no delta value"}` : "first visit or no history",
  );

  const purpose = arrayValues(pre.exercise_purpose);
  passCheck(
    checks,
    "exercise_purpose_reflected",
    purpose.length === 0 || hasAnyValue(text, purpose),
    purpose.join(", ") || "none",
  );

  const pain = arrayValues(pre.pain_concerns);
  const shape = arrayValues(pre.body_shape_concerns);
  passCheck(
    checks,
    "concerns_reflected",
    pain.length + shape.length === 0 || hasAnyValue(text, [...pain, ...shape]),
    [...pain, ...shape].join(", ") || "none",
  );

  const nutrition = [pre.protein_intake, pre.carb_intake, pre.fat_intake].filter(Boolean).map(String);
  passCheck(
    checks,
    "nutrition_reflected",
    nutrition.length === 0 || hasAnyValue(text, nutrition),
    nutrition.join(", ") || "none",
  );

  passCheck(
    checks,
    "frequency_reflected",
    !pre.exercise_frequency || text.includes(String(pre.exercise_frequency)),
    pre.exercise_frequency || "none",
  );

  passCheck(
    checks,
    "no_placeholder_text",
    !/(undefined|null|NaN)/i.test(text),
    "forbidden placeholder scan",
  );

  const score = Math.round((checks.filter((check) => check.pass).length / checks.length) * 100);
  const failed = checks.filter((check) => !check.pass).map((check) => check.code);
  return {
    source,
    score,
    level: score >= 85 ? "high" : score >= 70 ? "medium" : "low",
    checks,
    failed,
  };
}

export function isReportQualityAcceptable(quality) {
  return !!quality && quality.score >= 70;
}
