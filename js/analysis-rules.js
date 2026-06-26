window.InbodyAnalysisRules = (() => {
  const ranges = {
    body_fat_pct: {
      male: { low: 0, standard: [10, 20], high: 100 },
      female: { low: 0, standard: [18, 28], high: 100 },
      default: { low: 0, standard: [10, 25], high: 100 },
    },
    bmi: {
      default: { low: 0, standard: [18.5, 25], high: 50 },
    },
    skeletal_muscle: {
      male: { low: 0, standard: [29, 37], high: 60 },
      female: { low: 0, standard: [18, 24], high: 45 },
      default: { low: 0, standard: [20, 30], high: 60 },
    },
    body_fat_mass: {
      male: { low: 0, standard: [6, 20], high: 60 },
      female: { low: 0, standard: [10, 26], high: 60 },
      default: { low: 0, standard: [8, 24], high: 60 },
    },
    inbody_score: {
      default: { low: 0, standard: [70, 90], high: 100 },
    },
    weight: {
      default: { low: 30, standard: [45, 85], high: 150 },
    },
  };

  const genderAliases = {
    male: "male",
    m: "male",
    man: "male",
    "남": "male",
    "남성": "male",
    "남자": "male",
    female: "female",
    f: "female",
    woman: "female",
    "여": "female",
    "여성": "female",
    "여자": "female",
  };

  const memberTextReplacements = [
    [/불안형\s*성향과\s*스트레스/g, "운동 부담과 스트레스"],
    [/불안형\s*성향/g, "운동 시작 부담"],
    [/결과중심형\s*성향|과정중시형\s*성향|자기주도형\s*성향/g, "운동 접근 방식"],
    [/회원\s*성향/g, "현재 상태"],
    [/불안형|결과중심형|과정중시형|자기주도형|모르겠음/g, ""],
    [/\s*성향/g, ""],
    [/\s{2,}/g, " "],
  ];

  function normalizeGender(gender) {
    if (gender == null) return "default";
    return genderAliases[String(gender).trim().toLowerCase()] ?? "default";
  }

  function getMetricRange(metric, gender) {
    const range = ranges[metric];
    if (!range) return null;
    return range[normalizeGender(gender)] ?? range.default ?? null;
  }

  function cleanMemberText(value) {
    if (typeof value !== "string") return "";
    return memberTextReplacements
      .reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
      .trim();
  }

  return { ranges, normalizeGender, getMetricRange, cleanMemberText };
})();

