import assert from "node:assert/strict";
import test from "node:test";
import { generateRuleAnalysis, validateRuleAnalysis } from "../supabase/functions/_shared/analysis_engine.mjs";

const baseInput = {
  member: { gender: "남성", age: 38, is_revisit: true },
  inbody_final: {
    weight: 84.2,
    skeletal_muscle: 27.8,
    body_fat_mass: 25.4,
    body_fat_pct: 30.2,
    bmi: 27.1,
    inbody_score: 68,
    total_body_water: 39.1,
    protein: 10.6,
    minerals: 3.7,
    visceral_fat_level: 12,
    segmental_muscle: {
      left_arm: 92,
      right_arm: 94,
      trunk: 97,
      left_leg: 90,
      right_leg: 91,
    },
  },
  inbody_previous: {
    weight: 85.3,
    skeletal_muscle: 27.1,
    body_fat_mass: 27.0,
    body_fat_pct: 31.7,
    bmi: 27.6,
    inbody_score: 65,
  },
  recent_records: [],
  analysis_meta: {
    record_count: 2,
    deltas: {
      weight: -1.1,
      skeletal_muscle: 0.7,
      body_fat_mass: -1.6,
      body_fat_pct: -1.5,
      bmi: -0.5,
      inbody_score: 3,
    },
    averages: {
      weight: 84.8,
      skeletal_muscle: 27.5,
      body_fat_pct: 31.0,
      inbody_score: 66.5,
    },
    low_confidence_fields: [],
  },
  pre_inputs: {
    exercise_purpose: ["체지방 감량", "근력 증가"],
    exercise_experience: "초보",
    pain_concerns: ["허리"],
    member_tendency: "과정중시형",
    motivation_level: "중간",
    exercise_frequency: "주 2회",
    protein_intake: "부족",
    carb_intake: "많음",
    fat_intake: "보통",
  },
  personas: ["초보 코칭형", "통증 관리형"],
};

test("generates a complete report with deterministic DB/rule evidence", () => {
  const report = generateRuleAnalysis(baseInput);
  const quality = validateRuleAnalysis(report);

  assert.equal(quality.score, 100);
  assert.equal(report.priority_goals.length, 3);
  assert.equal(report.analysis_confidence, "high");
  assert.equal(report.rule_engine.bands.skeletal_muscle.status, "low");
  assert.equal(report.rule_engine.bands.body_fat_pct.status, "high");
  assert.equal(report.rule_engine.bands.bmi.status, "high");
  assert.ok(report.rule_engine.signals.some((signal) => signal.code === "visceral_fat_attention"));
  assert.match(report.comparison_note, /골격근량 \+0.7kg/);
  assert.match(report.metric_interp.skeletal_muscle.evidence, /표준 29~37kg/);
});

test("keeps output usable when optional history and raw composition fields are missing", () => {
  const report = generateRuleAnalysis({
    ...baseInput,
    member: { gender: "여성", age: 29, is_revisit: false },
    inbody_final: {
      weight: 56.4,
      skeletal_muscle: 21.1,
      body_fat_mass: 13.5,
      body_fat_pct: 23.9,
      bmi: 21.2,
      inbody_score: 78,
    },
    inbody_previous: null,
    analysis_meta: { record_count: 1, deltas: {}, averages: {}, low_confidence_fields: ["protein"] },
    pre_inputs: { exercise_purpose: ["체형 개선"], exercise_frequency: "주 3회" },
  });

  const quality = validateRuleAnalysis(report);
  assert.equal(quality.score, 100);
  assert.equal(report.comparison_note, null);
  assert.equal(report.analysis_confidence, "medium");
  assert.equal(report.rule_engine.bands.body_fat_pct.status, "standard");
  assert.doesNotMatch(report.summary, /undefined|null/);
  assert.doesNotMatch(report.nutrition_strategy, /undefined|null/);
});
