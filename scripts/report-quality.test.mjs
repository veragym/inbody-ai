import assert from "node:assert/strict";
import test from "node:test";
import { assessReportQuality, isReportQualityAcceptable } from "../supabase/functions/_shared/report_quality.mjs";

const context = {
  inbody_final: {
    weight: 84.2,
    skeletal_muscle: 27.8,
    body_fat_pct: 30.2,
    bmi: 27.1,
    inbody_score: 68,
  },
  analysis_meta: {
    record_count: 2,
    deltas: {
      weight: -1.1,
      skeletal_muscle: 0.7,
      body_fat_pct: -1.5,
      inbody_score: 3,
    },
  },
  pre_inputs: {
    exercise_purpose: ["체중감량", "근력향상"],
    pain_concerns: ["목/어깨"],
    body_shape_concerns: ["복부"],
    exercise_frequency: "주 2회",
    protein_intake: "부족",
    carb_intake: "많음",
    fat_intake: "보통",
  },
};

test("accepts reports that reflect metrics, history, and pre-inputs", () => {
  const report = {
    summary: "현재 체중은 84.2kg, 골격근량은 27.8kg, 체지방률은 30.2%입니다. BMI는 27.1이고 인바디 점수는 68점입니다.",
    comparison_note: "직전 대비 체중 -1.1kg, 골격근량 +0.7kg, 체지방률 -1.5% 변화가 있습니다.",
    body_composition_analysis: "체중감량과 근력향상 목표를 같이 보면서 복부 고민을 체지방률과 함께 봅니다.",
    metric_interp: {
      skeletal_muscle: { text: "골격근량 27.8kg 기준으로 근력향상이 필요합니다." },
      body_fat_pct: { text: "체지방률 30.2%는 관리가 필요합니다." },
      bmi: { text: "BMI 27.1은 체지방률과 함께 봅니다." },
    },
    priority_goals: [{ title: "체지방 관리" }, { title: "근력향상" }, { title: "복부 라인" }],
    exercise_strategy: "주 2회 기준으로 목/어깨 부담을 조절합니다.",
    nutrition_strategy: "단백질은 부족, 탄수화물은 많음, 지방은 보통으로 반영합니다.",
    expected_change: { current_plan: "현재 유지", improved_plan: "개선 계획" },
  };

  const quality = assessReportQuality(context, report, "ai:test");
  assert.ok(quality.score >= 85);
  assert.equal(quality.level, "high");
  assert.equal(isReportQualityAcceptable(quality), true);
});

test("rejects generic reports that omit personal evidence", () => {
  const report = {
    summary: "현재 몸 상태를 기준으로 운동과 식단을 관리하면 좋습니다.",
    comparison_note: "최근 변화가 있습니다.",
    body_composition_analysis: "전체적으로 균형을 보면 됩니다.",
    metric_interp: {
      skeletal_muscle: { text: "근육 관리가 필요합니다." },
      body_fat_pct: { text: "체지방 관리가 필요합니다." },
      bmi: { text: "BMI를 참고합니다." },
    },
    priority_goals: [{ title: "관리" }, { title: "운동" }, { title: "식단" }],
    exercise_strategy: "운동을 꾸준히 합니다.",
    nutrition_strategy: "식단을 조절합니다.",
    expected_change: { current_plan: "현재 유지", improved_plan: "개선 계획" },
  };

  const quality = assessReportQuality(context, report, "ai:test");
  assert.ok(quality.score < 70);
  assert.equal(isReportQualityAcceptable(quality), false);
  assert.ok(quality.failed.includes("current_metrics_mentioned"));
  assert.ok(quality.failed.includes("exercise_purpose_reflected"));
});
