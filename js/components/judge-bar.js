// 시그니처 컴포넌트: 막대그래프 판정 바
// 색 + 마커 위치 + 라벨 3중 인코딩 (WCAG AA, 직사광선, 회색조 대응)

// InBody 270 기준 표준 범위 (성별/항목별)
// ⚠️ 정확한 임상 기준은 트레이너 미팅 후 조정 필요 (05_아키텍처 6절)
const RANGES = {
  body_fat_pct: {
    남: { low: 0, standard: [10, 20], high: 100 },
    여: { low: 0, standard: [18, 28], high: 100 },
    default: { low: 0, standard: [10, 25], high: 100 },
  },
  bmi: {
    default: { low: 0, standard: [18.5, 25], high: 50 },
  },
  skeletal_muscle: {
    남: { low: 0, standard: [29, 37], high: 60 },   // kg 기준 성인 남성
    여: { low: 0, standard: [18, 24], high: 45 },
    default: { low: 0, standard: [20, 30], high: 60 },
  },
  body_fat_mass: {
    남: { low: 0, standard: [6, 20], high: 60 },
    여: { low: 0, standard: [10, 26], high: 60 },
    default: { low: 0, standard: [8, 24], high: 60 },
  },
  inbody_score: {
    default: { low: 0, standard: [70, 90], high: 100 },
  },
  weight: {
    default: { low: 30, standard: [45, 85], high: 150 },
  },
};

const STATUS_LABEL = {
  low: "표준 이하",
  standard: "표준",
  high: "표준 이상",
  neutral: "측정값 없음",
};

const STATUS_ICON = {
  low: "▼",
  standard: "●",
  high: "▲",
  neutral: "—",
};

/**
 * 판정 바 HTML 생성
 * @param {string} metric - 항목 키 (body_fat_pct, skeletal_muscle 등)
 * @param {number|null} value - 측정값
 * @param {string} gender - '남' | '여' | null
 * @param {string} label - 화면 표시 이름
 * @param {string} unit - 단위 (%, kg 등)
 */
function createJudgeBar(metric, value, gender, label, unit = "") {
  const range = RANGES[metric];
  const genderRange = range
    ? (range[gender] ?? range["default"])
    : null;

  let status = "neutral";
  let markerPct = 50; // 기본 중앙

  if (value !== null && value !== undefined && genderRange) {
    const [stdLow, stdHigh] = genderRange.standard;
    const min = genderRange.low;
    const max = genderRange.high;

    if (value < stdLow) {
      status = "low";
      markerPct = Math.max(2, Math.min(32, ((value - min) / (stdLow - min)) * 33));
    } else if (value <= stdHigh) {
      status = "standard";
      markerPct = 33 + ((value - stdLow) / (stdHigh - stdLow)) * 34;
    } else {
      status = "high";
      markerPct = Math.min(98, 67 + ((value - stdHigh) / (max - stdHigh)) * 33);
    }
    markerPct = Math.round(markerPct);
  }

  const displayValue = value !== null && value !== undefined
    ? `${value}${unit}`
    : "—";

  return `
<div class="judge-bar-wrap" data-metric="${metric}">
  <div class="judge-bar-header">
    <span class="judge-bar-label">${label}</span>
    <span class="judge-bar-value inbody-num" data-status="${status}">${displayValue}</span>
    <span class="judge-bar-status-label" data-status="${status}">
      ${STATUS_ICON[status]} ${STATUS_LABEL[status]}
    </span>
  </div>
  <div class="judge-bar" role="img" aria-label="${label} ${displayValue} — ${STATUS_LABEL[status]}">
    <div class="judge-bar-track">
      <div class="judge-bar-zone zone-low" aria-hidden="true"></div>
      <div class="judge-bar-zone zone-standard" aria-hidden="true"></div>
      <div class="judge-bar-zone zone-high" aria-hidden="true"></div>
    </div>
    <div class="judge-marker" data-status="${status}" style="left:${markerPct}%" aria-hidden="true"></div>
    <div class="judge-bar-ticks" aria-hidden="true">
      <span class="tick-label tick-low">낮음</span>
      <span class="tick-label tick-standard">표준</span>
      <span class="tick-label tick-high">높음</span>
    </div>
  </div>
</div>`;
}

/**
 * 체성분 각 항목의 트레이너 설명 카드 — 회원 수치 기반 개인화
 * 출처: ACSM 운동처방지침 11판, InBody 270 가이드, 대한비만학회·대한골대사학회 기준
 *
 * @param {{ total_body_water, protein, minerals, body_fat_mass, body_fat_pct, weight }} data
 * @param {string|null} gender  '남' | '여' | null
 */
function createCompositionGuide(data, gender) {
  if (!data || !data.weight) return "";
  const { total_body_water, protein, minerals, body_fat_mass, weight } = data;
  const bfPct = data.body_fat_pct != null
    ? data.body_fat_pct
    : (body_fat_mass != null ? +((body_fat_mass / weight) * 100).toFixed(1) : null);

  function classify(value, lo, hi) {
    if (value == null) return null;
    if (value < lo) return "low";
    if (value <= hi) return "normal";
    return "high";
  }

  // 체수분 — 체중 대비 % (ACSM / InBody Reference)
  const wPct = total_body_water != null ? +((total_body_water / weight) * 100).toFixed(1) : null;
  const [wLo, wHi] = gender === "남" ? [57, 67] : gender === "여" ? [50, 62] : [53, 65];
  const wStatus = classify(wPct, wLo, wHi);

  // 단백질 — 체중 대비 % (성별 무관)
  const pPct = protein != null ? +((protein / weight) * 100).toFixed(1) : null;
  const pStatus = classify(pPct, 15, 20);

  // 무기질 — 체중 대비 % (성별 무관)
  const mPct = minerals != null ? +((minerals / weight) * 100).toFixed(1) : null;
  const mStatus = classify(mPct, 4.5, 6.5);

  // 체지방률 — 직접 사용
  const [bfLo, bfHi] = gender === "남" ? [10, 20] : gender === "여" ? [18, 28] : [10, 25];
  const bfStatus = classify(bfPct, bfLo, bfHi);

  const CONTENT = {
    total_body_water: {
      color: "#1E6FB0", label: "체수분", value: total_body_water, unit: "L",
      low: {
        title: "체수분 부족",
        body: `체수분이 체중의 ${wPct}%로 표준(${wLo}~${wHi}%)보다 낮아요. 근육의 약 75%는 수분으로 구성되어 있어서 체수분이 부족하면 근수축 효율 저하·영양소 운반 감소·피로 물질 축적이 일어나요. 이 상태를 방치하면 운동 강도를 올려도 효율이 나오지 않고, 회복 시간도 길어져요.`,
        tip: "근육량을 늘리면 체수분도 함께 증가해요. 규칙적인 운동과 하루 체중(kg) × 30~35ml의 수분 섭취 습관이 병행되어야 해요.",
      },
      normal: {
        title: "체수분 정상",
        body: `체수분이 체중의 ${wPct}%로 정상 범위(${wLo}~${wHi}%) 안에 있어요. 세포내외액 균형이 유지되어 근수축·영양소 운반·노폐물 제거가 원활한 상태예요.`,
        tip: "운동 강도가 높아질수록 시간당 최대 1,500ml의 수분을 잃어요. 운동 전중후 수분 보충 루틴을 만들어야 이 균형이 유지돼요.",
      },
      high: {
        title: "체수분 표준 이상",
        body: `체수분이 체중의 ${wPct}%로 표준(${wLo}~${wHi}%)보다 높아요. 근육량이 많을 때 나타나는 경우가 많아요. 다만 세포외액(ECF) 비율이 높다면 만성 염분 과잉 섭취, 활동 부족에 의한 부종일 수 있어요.`,
        tip: "세포외액 과잉 상태라면 나트륨 제한 식단과 규칙적인 유산소 운동이 세포외액 비율 정상화에 도움이 돼요. ECF/ICF 비율 0.38 이하가 정상이에요.",
      },
    },
    protein: {
      color: "#0E6B4F", label: "단백질", value: protein, unit: "kg",
      low: {
        title: "단백질 부족 — 근육량 부족",
        body: `단백질이 체중의 ${pPct}%로 표준(15~20%)보다 낮아요. 근육량이 부족하면 기초대사량이 낮아지고, 기초대사량이 낮으면 같은 식사량으로도 체지방이 더 잘 쌓이는 악순환이 시작돼요. 이 악순환은 운동과 식이 관리 없이는 저절로 해결되지 않아요.`,
        tip: "저항성 운동으로 근단백 합성 신호를 만들고, 체중 1kg당 하루 1.6~2.2g의 단백질 식이가 함께 이루어져야 이 수치를 올릴 수 있어요.",
      },
      normal: {
        title: "단백질 정상 — 근육량 양호",
        body: `단백질이 체중의 ${pPct}%로 정상 범위(15~20%) 안에 있어요. 골격근이 잘 유지되어 기초대사량이 안정적인 상태예요. 하지만 운동을 중단하면 근단백 분해 속도가 합성을 앞질러 3~6개월 내 수치가 떨어질 수 있어요.`,
        tip: "운동 후 30분 이내 단백질 20~40g 섭취로 근단백 합성 기회를 놓치지 않는 것이 이 수준을 지키는 핵심이에요.",
      },
      high: {
        title: "단백질 우수 — 근육량 높음",
        body: `단백질이 체중의 ${pPct}%로 표준(15~20%)보다 높아요. 골격근 발달이 우수하고 기초대사량도 높아요. 단백질량 1kg 증가 시 하루 안정 시 에너지 소비가 약 13~15kcal 늘어나요.`,
        tip: "운동 없이 단백질만 섭취하면 잉여 아미노산은 지방으로 전환돼요. 지속적인 운동 자극과 단백질 섭취가 함께 이루어져야 이 수준이 유지돼요.",
      },
    },
    minerals: {
      color: "#4A5752", label: "무기질", value: minerals, unit: "kg",
      low: {
        title: "무기질 부족 — 골밀도 주의",
        body: `무기질이 체중의 ${mPct}%로 표준(4.5~6.5%)보다 낮아요. 이 수치는 골밀도와 직결돼요. 방치하면 골감소증·골다공증으로 진행되고, 일상적인 충격에도 골절 위험이 높아져요. 뼈는 한번 소실되면 회복이 매우 느려요.`,
        tip: "뼈에 기계적 자극을 주는 체중 부하 운동(스쿼트, 걷기 등)과 칼슘 1,000mg·비타민 D 800~1,000IU의 식이 보충을 병행해야 골밀도가 실질적으로 회복돼요.",
      },
      normal: {
        title: "무기질 정상 — 뼈 건강 양호",
        body: `무기질이 체중의 ${mPct}%로 정상 범위(4.5~6.5%) 안에 있어요. 골밀도가 잘 유지되어 뼈 강도와 근골격계 안정성이 양호한 상태예요.`,
        tip: "운동 없이 칼슘만 섭취해도 뼈에 실제로 흡착되는 양은 제한적이에요. 체중 부하 운동이 골 형성 자극의 핵심이고, 식이 칼슘은 그 원료를 공급해요.",
      },
      high: {
        title: "무기질 우수 — 골밀도 높음",
        body: `무기질이 체중의 ${mPct}%로 표준(4.5~6.5%)보다 높아요. 골밀도가 높아 뼈 강도와 근골격계 내구성이 우수해요. 고강도 훈련 시에도 골절 저항성이 높은 상태예요.`,
        tip: "활동량이 크게 줄면 뼈에 가해지는 기계적 자극이 없어지면서 6~12개월 내 골밀도가 감소하기 시작해요. 꾸준한 운동 유지가 필수예요.",
      },
    },
    body_fat_mass: {
      color: "#C04A2B", label: "체지방", value: body_fat_mass, unit: "kg",
      low: {
        title: "체지방 부족 — 필수지방 범위 미달",
        body: `체지방률이 ${bfPct}%로 표준(${bfLo}~${bfHi}%)보다 낮아요. 체지방은 호르몬 합성·지용성 비타민 흡수·내장 보호에 반드시 필요해요.${gender === "여" ? " 여성은 에스트로겐의 30~40%가 지방 조직에서 합성되기 때문에 이 수준에서 체지방이 더 줄면 월경 불순·골밀도 감소로 이어져요." : " 남성도 이 수준 아래로 내려가면 테스토스테론 생성과 면역 기능이 저하돼요."}`,
        tip: "추가 감량보다 근육량을 늘리는 방향으로 운동과 식단을 재설계해야 해요. 단백질 섭취를 충분히 유지하면서 칼로리를 급격히 줄이지 않는 것이 중요해요.",
      },
      normal: {
        title: "체지방 정상",
        body: `체지방률이 ${bfPct}%로 정상 범위(${bfLo}~${bfHi}%) 안에 있어요. 에너지 저장·호르몬 합성·장기 보호 기능이 균형 있게 유지되고 있어요.`,
        tip: "체지방률이 정상이어도 운동 부족과 정제 탄수화물 과잉 섭취가 지속되면 내장지방이 증가해 대사 위험이 올라가요. 인바디의 내장지방 레벨(10 이하 정상)을 함께 확인하세요.",
      },
      high: {
        title: "체지방 초과",
        body: `체지방률이 ${bfPct}%로 표준(${bfLo}~${bfHi}%)보다 높아요. 과잉 내장지방은 인슐린 저항성·만성 염증·고혈압·이상지질혈증을 유발하는 내분비 교란 물질을 분비해요. 식이 조절 없이 운동만으로는 칼로리 적자를 만들기 어렵고, 운동 없이 식이만 줄이면 근육도 함께 빠져요.`,
        tip: "정제 탄수화물·포화지방 제한 식단으로 칼로리 적자를 만들고, 저항성 운동으로 근육량을 유지하는 두 가지가 동시에 이루어져야 체지방이 실질적으로 감소해요.",
      },
    },
  };

  const STATUS_COLOR = { low: "#C04A2B", normal: "#0E6B4F", high: "#1E6FB0" };
  const STATUS_TAG   = { low: "표준 이하", normal: "표준", high: "표준 이상" };

  const entries = [
    { key: "total_body_water", status: wStatus },
    { key: "protein",          status: pStatus },
    { key: "minerals",         status: mStatus },
    { key: "body_fat_mass",    status: bfStatus },
  ].filter(e => e.status !== null && CONTENT[e.key].value != null);

  if (entries.length === 0) return "";

  const cards = entries.map(({ key, status }) => {
    const c = CONTENT[key];
    const t = c[status];
    return `
<div class="comp-guide-card" data-status="${status}">
  <div class="comp-guide-card-header">
    <span class="comp-guide-dot" style="background:${c.color}"></span>
    <span class="comp-guide-label">${c.label}</span>
    <span class="comp-guide-val inbody-num">${c.value}${c.unit}</span>
    <span class="comp-guide-status-tag" style="color:${STATUS_COLOR[status]}">${STATUS_TAG[status]}</span>
    <span class="comp-guide-title">${t.title}</span>
  </div>
  <p class="comp-guide-body">${t.body}</p>
  <p class="comp-guide-tip">💡 ${t.tip}</p>
</div>`;
  }).join("");

  return `<div class="comp-guide-grid">${cards}</div>`;
}

/**
 * 체성분분석 바 — InBody 270 상단 구성 막대 재현
 * 체수분 / 단백질 / 무기질 / 체지방 → 합계=체중
 * @param {{ total_body_water, protein, minerals, body_fat_mass, weight }} data
 */
function createCompositionBar(data) {
  const { total_body_water, protein, minerals, body_fat_mass, weight } = data;

  // 값이 없으면 렌더링 안 함
  if (!weight) return "";

  const segments = [
    { key: "total_body_water", label: "체수분",  color: "#1E6FB0", value: total_body_water },
    { key: "protein",          label: "단백질",  color: "#0E6B4F", value: protein },
    { key: "minerals",         label: "무기질",  color: "#4A5752", value: minerals },
    { key: "body_fat_mass",    label: "체지방",  color: "#C04A2B", value: body_fat_mass },
  ];

  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0) || weight;

  const bars = segments.map(seg => {
    if (!seg.value) return "";
    const pct = Math.round((seg.value / total) * 100);
    return `<div class="comp-segment" style="width:${pct}%;background:${seg.color}"
      title="${seg.label} ${seg.value}kg (${pct}%)" aria-label="${seg.label} ${seg.value}kg"></div>`;
  }).join("");

  const legend = segments.map(seg => `
<div class="comp-legend-item">
  <span class="comp-legend-dot" style="background:${seg.color}"></span>
  <span class="comp-legend-label">${seg.label}</span>
  <span class="comp-legend-value inbody-num">${seg.value !== null && seg.value !== undefined ? seg.value + (seg.key === "total_body_water" ? "L" : "kg") : "—"}</span>
</div>`).join("");

  return `
<div class="comp-bar-wrap">
  <div class="comp-bar" role="img" aria-label="체성분 구성 막대">${bars}</div>
  <div class="comp-legend">${legend}</div>
</div>`;
}
