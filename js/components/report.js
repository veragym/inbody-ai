// 회원용 인바디 리포트 v9 컴포넌트
// 숫자·판정·목표·조정값은 공통 규칙 모듈에서 산출. AI는 해석문장만.
// PT 권유 없음. '!' 오해주의·항목설명은 정적 상수(사실 기반).

function _esc(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function _memberText(value) {
  if (window.InbodyAnalysisRules?.cleanMemberText) {
    return window.InbodyAnalysisRules.cleanMemberText(value);
  }
  return String(value || '').trim();
}

// ── 흔한 오해 주의 ('!' 각주) ──────────────────────────────────
const MISCONCEPTIONS = {
  inbody_score: "인바디 점수가 곧 건강은 아니에요. 근육이 많으면 100점을 넘기도 하는, 근육 위주의 점수예요.",
  total_body_water: "물을 많이 마신다고 늘지 않아요. 근육이 늘어야 함께 늘고, 측정 직전 식사·운동에 따라 조금씩 흔들려요.",
  protein: "보충제만 먹는다고 오르지 않아요. 근력운동이 함께여야 근육이 되고, 남으면 지방으로 쌓여요.",
  minerals: "골밀도(골다공증) 검사와는 달라요. 낮다고 골다공증은 아니며, 정확한 건 별도 검사가 필요해요.",
  body_fat_mass: "굶으면 근육이 먼저 빠져 오히려 손해예요. '체중'이 아니라 '체지방'을 봐야 해요.",
  bmi: "근육이 많아도 높게 나와요. BMI만으론 비만을 가릴 수 없어, 체지방률을 함께 봐야 해요.",
};

function _noteHtml(text) {
  return `<div class="rep-note"><span class="rep-note-ico" aria-hidden="true">⚠</span><span>${_esc(text)}</span></div>`;
}

function _briefText(text, max = 74) {
  const s = _memberText(text).replace(/\s+/g, " ").trim();
  if (!s) return "";
  const first = s.match(/^(.+?[.!?。]|.+?요\.|.+?다\.)\s/)?.[1] || "";
  const base = first && first.length <= max ? first : s;
  return base.length > max ? `${base.slice(0, max - 1).trim()}…` : base;
}

function _metricChips(final, raw) {
  const chips = [
    { label: "체중", value: final.weight, unit: "kg" },
    { label: "골격근", value: final.skeletal_muscle, unit: "kg" },
    { label: "체지방률", value: final.body_fat_pct, unit: "%" },
    { label: "BMI", value: final.bmi, unit: "" },
    { label: "내장지방", value: raw?.visceral_fat_level, unit: "레벨" },
  ].filter(c => c.value != null && c.value !== "");
  if (!chips.length) return "";
  return `<section class="rep-blk rep-keynums">
  <h2 class="rep-sec">핵심 수치</h2>
  <div class="rep-chipbar">${chips.map(c => `
<div class="rep-chip">
  <span class="rep-chip-label">${_esc(c.label)}</span>
  <span class="rep-chip-value">${_esc(c.value)}${c.unit ? _esc(c.unit) : ""}</span>
</div>`).join("")}</div>
</section>`;
}

function _summaryBlock(ai) {
  const summary = _memberText(ai?.summary);
  const comparison = _memberText(ai?.comparison_note);
  if (!summary && !comparison) return "";
  return `<section class="rep-blk rep-ai-summary">
  <h2 class="rep-sec">현재 상태 요약</h2>
  ${summary ? `<p class="rep-summary">${_esc(summary)}</p>` : ""}
  ${comparison ? `<p class="rep-summary rep-compare">${_esc(comparison)}</p>` : ""}
</section>`;
}

// ── 체성분 (v9: 막대+막대밖% + 항목설명 + 항목별 '!' + 종합) ───
const _COMP_ITEMS = [
  { key: "total_body_water", label: "체수분", unit: "L", grad: "linear-gradient(135deg,#9AC2EF,#6FA4E0)", dot: "#185FA5",
    desc: "혈액·근육 속 물. 근육이 늘면 함께 늘어나요.", note: MISCONCEPTIONS.total_body_water },
  { key: "protein", label: "단백질", unit: "kg", grad: "linear-gradient(135deg,#74D6B8,#4FBE97)", dot: "#0F6E56",
    desc: "근육을 만드는 핵심 재료. 부족하면 근육이 잘 안 붙어요.", note: MISCONCEPTIONS.protein },
  { key: "minerals", label: "무기질", unit: "kg", grad: "linear-gradient(135deg,#C2C0B7,#A8A69D)", dot: "#5F5E5A",
    desc: "뼈를 단단하게 하는 성분. 골밀도와 연결돼요.", note: MISCONCEPTIONS.minerals },
  { key: "body_fat_mass", label: "체지방", unit: "kg", grad: "linear-gradient(135deg,#F4A99C,#EC8676)", dot: "#A32D2D",
    desc: "에너지 저장고지만, 많으면 내장·혈관에 부담이 돼요.", note: MISCONCEPTIONS.body_fat_mass },
];

function _composition(data, gender) {
  const { weight } = data;
  if (!weight) return "";
  const vals = {
    total_body_water: data.total_body_water, protein: data.protein,
    minerals: data.minerals, body_fat_mass: data.body_fat_mass,
  };
  const total = _COMP_ITEMS.reduce((s, it) => s + (vals[it.key] || 0), 0) || weight;
  const present = _COMP_ITEMS.filter(it => vals[it.key] != null);
  if (!present.length) return "";

  const segs = present.map(it => {
    const pct = Math.round((vals[it.key] / total) * 100);
    return { it, pct };
  });
  const barHtml = segs.map(s => `<div class="rep-comp-seg" style="width:${s.pct}%;background:${s.it.grad}"></div>`).join("");
  const pctHtml = segs.map(s => `<div style="width:${s.pct}%">${s.pct}%</div>`).join("");
  const itemsHtml = present.map(it => `
<div class="rep-comp-item">
  <span class="rep-comp-dot" style="color:${it.dot}">●</span>
  <div class="rep-comp-body">
    <span class="rep-comp-name">${it.label} ${vals[it.key]}${it.unit}</span>
    <p class="rep-comp-desc">${it.desc}</p>
    ${_noteHtml(it.note)}
  </div>
</div>`).join("");

  const bfm = data.body_fat_mass, bfp = data.body_fat_pct;
  const stdRef = gender === "남" ? 20 : gender === "여" ? 26 : 22;
  const summary = (bfm != null && bfp != null)
    ? `근육·뼈·물을 뺀 <b>순수 지방이 ${bfm}kg</b>, 체중의 ${bfp}%예요. 같은 성별 표준은 약 ${stdRef}kg 이하예요.`
    : "";

  return `
<section class="rep-blk">
  <h2 class="rep-sec">내 몸은 무엇으로 이뤄졌나</h2>
  <div class="rep-comp-bar">${barHtml}</div>
  <div class="rep-comp-pct">${pctHtml}</div>
  <div class="rep-comp-items">${itemsHtml}</div>
  ${summary ? `<p class="rep-comp-sum">${summary}</p>` : ""}
</section>`;
}

// ── 규준 기반 계산 (analysis_rules.mjs 전역) ────────────────
function _band(metric, value, gender) {
  const gr = window.InbodyAnalysisRules?.getMetricRange?.(metric, gender) ?? null;
  if (value == null || !gr) return { status: "neutral", markerPct: 50, std: null };
  const [lo, hi] = gr.standard, min = gr.low, max = gr.high;
  let status, pct;
  if (value < lo) { status = "low"; pct = Math.max(2, Math.min(32, ((value - min) / (lo - min)) * 33)); }
  else if (value <= hi) { status = "standard"; pct = 33 + ((value - lo) / (hi - lo)) * 34; }
  else { status = "high"; pct = Math.min(98, 67 + ((value - hi) / (max - hi)) * 33); }
  return { status, markerPct: Math.round(pct), std: [lo, hi], min, max };
}

// 추천 목표 + 현재→목표 조정값. higherBetter: true면 표준 하한으로 끌어올림(근육), false면 표준 상한 이하로(지방/BMI)
function _target(metric, value, gender, higherBetter) {
  const b = _band(metric, value, gender);
  if (!b.std || value == null) return null;
  const [lo, hi] = b.std;
  if (higherBetter) {
    if (b.status !== "low") return null;            // 이미 표준 이상이면 목표 표시 안 함
    return { target: lo, delta: +(lo - value).toFixed(1), dir: "up", markerPct: 33 };
  } else {
    if (b.status !== "high") return null;
    return { target: hi, delta: +(hi - value).toFixed(1), dir: "down", markerPct: 67 };
  }
}

// ── 핵심지표 막대 (판정막대 + 현재마커 + 목표마커 + 조정값 + '!') ──
function _reportMetric(metric, value, gender, label, unit, higherBetter, note, interp) {
  const b = _band(metric, value, gender);
  const t = _target(metric, value, gender, higherBetter);
  const disp = value != null ? `${value}${unit}` : "—";
  const STATUS_LABEL = { low: "표준 이하", standard: "표준", high: "표준 이상", neutral: "측정 전" };
  const badgePct = t ? Math.max(14, Math.min(86, t.markerPct)) : null;

  const connHtml = t ? (() => {
    const a = Math.min(b.markerPct, t.markerPct), w = Math.abs(b.markerPct - t.markerPct);
    return `<div class="rep-conn" style="left:${a}%;width:${w}%"></div>`;
  })() : "";
  const deltaBadge = t ? (() => {
    const a = Math.min(b.markerPct, t.markerPct), w = Math.abs(b.markerPct - t.markerPct);
    const deltaPct = Math.max(12, Math.min(88, a + w / 2));
    return `<div class="rep-delta-row"><span class="rep-delta" style="left:${deltaPct}%">${t.delta > 0 ? "+" : ""}${t.delta}${unit}</span></div>`;
  })() : "";
  const tgtMarker = t ? `<div class="rep-tg" style="left:${t.markerPct}%"></div>` : "";
  const tgtBadge = t ? `<div class="rep-tbadge-row"><span class="rep-tbadge" style="left:${badgePct}%">목표 ${t.target}${unit}</span></div>` : "";
  const tgtText = t ? `<div class="rep-metric-target">목표 ${t.target}${unit} ${t.dir === "up" ? "이상 ↑" : "이하 ↓"}</div>` : "";

  return `
<div class="rep-metric">
  <div class="rep-metric-head">
    <span class="rep-metric-label">${label}</span>
    <div class="rep-metric-rt">
      <span class="rep-metric-val inbody-num">${disp}</span>
      ${tgtText}
    </div>
  </div>
  <div class="rep-barwrap">
    ${deltaBadge}
    <div class="rep-tk">
      <div class="rep-zn zn-low"></div><div class="rep-zn zn-std"></div><div class="rep-zn zn-high"></div>
      ${tgtMarker}
      ${connHtml}
      <div class="rep-mk" data-status="${b.status}" style="left:${b.markerPct}%"></div>
    </div>
    ${tgtBadge}
  </div>
  <div class="rep-zl"><span>표준 이하</span><span>표준</span><span>표준 이상</span></div>
  ${interp ? `<p class="rep-mean">${_esc(interp)}</p>` : ""}
  ${note ? _noteHtml(note) : ""}
</div>`;
}

// ── 인바디 점수 도넛 ──────────────────────────────────────────
function _scoreDonut(score) {
  const s = score != null ? score : 0;
  const C = 263.9, off = +(C * (1 - Math.min(100, s) / 100)).toFixed(1);
  const color = s >= 70 ? "#0E6B4F" : "#C04A2B";
  return `
<div class="rep-donut">
  <svg width="118" height="118" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-default,#E0E6E2)" stroke-width="9"/>
    <circle cx="50" cy="50" r="42" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 50 50)"/>
    <text x="50" y="48" text-anchor="middle" font-size="27" font-weight="700" fill="var(--text-primary,#0F1B17)">${score != null ? score : "—"}</text>
    <text x="50" y="65" text-anchor="middle" font-size="11" fill="var(--text-secondary,#4A5752)">/ 100</text>
  </svg>
  <p class="rep-donut-label">인바디 점수</p>
  <p class="rep-donut-sub">표준 70점</p>
</div>`;
}

function _expectedChange(change) {
  if (!change || typeof change !== "object") return "";
  const title = _memberText(change.title) || "예상 변화";
  const current = _memberText(change.current_plan);
  const improved = _memberText(change.improved_plan);
  const condition = _memberText(change.key_condition);
  const caution = _memberText(change.caution);
  if (!current && !improved && !condition) return "";
  return `
<section class="rep-blk">
  <h2 class="rep-sec">${_esc(title)}</h2>
  <div class="rep-change-grid">
    ${current ? `<div class="rep-change-card"><span class="rep-change-k">현재 계획</span><p>${_esc(current)}</p></div>` : ""}
    ${improved ? `<div class="rep-change-card is-strong"><span class="rep-change-k">개선 계획</span><p>${_esc(improved)}</p></div>` : ""}
  </div>
  ${condition ? `<p class="rep-mean"><b>핵심 조건</b><br>${_esc(condition)}</p>` : ""}
  ${caution ? `<p class="rep-comp-desc">${_esc(caution)}</p>` : ""}
</section>`;
}

// ── 부위별 근육 (통증/체형 개인화) ────────────────────────────
function _segmental(raw, pain) {
  const seg = raw?.segmental_muscle;
  if (!seg) return "";
  const parts = [
    { key: "arms", label: "양팔", v: _avg(seg.left_arm, seg.right_arm) },
    { key: "trunk", label: "몸통", v: seg.trunk },
    { key: "legs", label: "양다리", v: _avg(seg.left_leg, seg.right_leg) },
  ].filter(p => p.v != null);
  if (!parts.length) return "";

  // 표준 대비 % (InBody segmental은 보통 100% 기준). 100 미만=부족
  const rowsHtml = parts.map(p => {
    const pct = Math.max(10, Math.min(140, p.v));
    const low = p.v < 95;
    const w = Math.round((pct / 140) * 100);
    return `<div class="rep-seg">
      <span class="rep-seg-n">${p.label}</span>
      <div class="rep-seg-bar"><div class="rep-seg-fill" style="width:${w}%;background:${low ? "#E24B4A" : "#1D9E75"}"></div></div>
      <span class="rep-seg-tag" style="${low ? "background:#FCEBEB;color:#A32D2D" : "background:#E1F5EE;color:#0F6E56"}">${low ? "부족" : "표준"}</span>
    </div>`;
  }).join("");

  const upperPain = (pain || []).some(p => ["거북목", "말린어깨", "목/어깨", "굽은등", "척추측만"].includes(p));
  const painNote = upperPain
    ? `특히 상체 근육이 약한데, ${_esc((pain || []).filter(p => ["거북목", "말린어깨", "굽은등"].includes(p))[0] || "자세 문제")}와 맞물리면 목·어깨 통증으로 이어지기 쉬워요.`
    : `부위별 균형을 보면 어디부터 채워야 할지 알 수 있어요.`;
  return `
<section class="rep-blk">
  <h2 class="rep-sec">부위별 근육</h2>
  ${rowsHtml}
  <p class="rep-mean">${painNote}</p>
</section>`;
}
function _avg(a, b) { const xs = [a, b].filter(x => x != null); return xs.length ? +(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(1) : null; }

// ── 내장지방 경고 ─────────────────────────────────────────────
function _visceral(raw) {
  const lv = raw?.visceral_fat_level;
  if (lv == null) return "";
  if (lv <= 9) return `
<section class="rep-blk"><div class="rep-vsc ok"><span class="rep-vsc-ico">✓</span>
  <div><p class="rep-vsc-t">내장지방 레벨 ${lv} <span>(표준 9 이하)</span></p>
  <p class="rep-vsc-b">장기 주변 지방이 표준 범위예요. 지금 상태를 유지하는 게 좋아요.</p></div></div></section>`;
  return `
<section class="rep-blk"><div class="rep-vsc"><span class="rep-vsc-ico">⚠</span>
  <div><p class="rep-vsc-t">내장지방 레벨 ${lv} <span>(표준 9 이하)</span></p>
  <p class="rep-vsc-b">장기 주변에 쌓인 지방이에요. 표준을 넘으면 당뇨·고혈압과 가장 직접적으로 연결됩니다.</p></div></div></section>`;
}

function _aiTextSection(title, text) {
  if (!text) return "";
  const safeText = _memberText(text);
  const brief = _briefText(safeText);
  return `
<section class="rep-blk">
  <h2 class="rep-sec">${_esc(title)}</h2>
  <details class="rep-reveal">
    <summary>
      <span class="rep-reveal-title">${_esc(brief || title)}</span>
      <span class="rep-reveal-btn">자세히</span>
    </summary>
    <p class="rep-mean">${_esc(safeText)}</p>
  </details>
</section>`;
}

function _priorityGoals(goals) {
  if (!Array.isArray(goals) || goals.length === 0) return "";
  const items = goals.map((g, i) => {
    const title = _memberText(g?.title) || `우선 목표 ${i + 1}`;
    const why = _memberText(g?.why);
    const action = _memberText(g?.action);
    return `
<details class="rep-goal">
  <summary>
    <span class="rep-goal-rank">${i + 1}</span>
    <span class="rep-goal-main">
      <span class="rep-goal-title">${_esc(title)}</span>
      ${why ? `<span class="rep-goal-why">${_esc(_briefText(why, 58))}</span>` : ""}
    </span>
    <span class="rep-reveal-btn">보기</span>
  </summary>
  ${why ? `<p class="rep-comp-desc"><b>왜 중요해요</b><br>${_esc(why)}</p>` : ""}
  ${action ? `<p class="rep-mean"><b>어떻게 할까요</b><br>${_esc(action)}</p>` : ""}
</details>`;
  }).join("");
  return `
<section class="rep-blk">
  <h2 class="rep-sec">지금 가장 먼저 볼 목표</h2>
  <div class="rep-goals">${items}</div>
</section>`;
}

function _aiBulletSection(title, items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const html = items.map(item => _noteHtml(item)).join("");
  return `
<section class="rep-blk">
  <h2 class="rep-sec">${_esc(title)}</h2>
  ${html}
</section>`;
}

function _metricInterpText(value, fallback) {
  if (typeof value === "string") return _memberText(value);
  if (value && typeof value === "object") {
    return typeof value.text === "string" && value.text ? _memberText(value.text) : fallback;
  }
  return fallback;
}

function _metricInterpEvidence(value) {
  if (value && typeof value === "object" && typeof value.evidence === "string" && value.evidence) {
    return value.evidence;
  }
  return "";
}

function _metricInterpConfidence(value) {
  if (value && typeof value === "object" && typeof value.confidence === "string" && value.confidence) {
    return value.confidence;
  }
  return "";
}

function _analysisMetaSection(meta) {
  if (!meta || typeof meta !== "object") return "";
  const deltas = meta.deltas || {};
  const avgs = meta.averages || {};
  const recCount = meta.record_count ?? 0;
  const lowFields = Array.isArray(meta.low_confidence_fields) ? meta.low_confidence_fields : [];
  const items = [
    { label: "측정 횟수", value: `${recCount}회`, desc: "최근 누적 기록" },
    { label: "체중 변화", value: _deltaText(deltas.weight, "kg"), desc: avgs.weight != null ? `평균 ${avgs.weight}kg` : "" },
    { label: "골격근 변화", value: _deltaText(deltas.skeletal_muscle, "kg"), desc: avgs.skeletal_muscle != null ? `평균 ${avgs.skeletal_muscle}kg` : "" },
    { label: "체지방률 변화", value: _deltaText(deltas.body_fat_pct, "%"), desc: avgs.body_fat_pct != null ? `평균 ${avgs.body_fat_pct}%` : "" },
    { label: "인바디 점수 변화", value: _deltaText(deltas.inbody_score, "점"), desc: avgs.inbody_score != null ? `평균 ${avgs.inbody_score}점` : "" },
  ];
  const lowText = lowFields.length ? `<p class="rep-compare">신뢰도 낮은 항목: ${_esc(lowFields.join(", "))}</p>` : "";
  return `
<section class="rep-blk">
  <h2 class="rep-sec">판정 근거</h2>
  <p class="rep-summary">최근 ${recCount}회 기록을 함께 반영해 현재 값과 이전 값, 평균값을 비교했습니다.</p>
  <div class="rep-comp-items">
    ${items.map(it => `
<div class="rep-comp-item">
  <span class="rep-comp-dot" style="color:#0E6B4F">●</span>
  <div class="rep-comp-body">
    <span class="rep-comp-name">${_esc(it.label)} ${_esc(it.value)}</span>
    ${it.desc ? `<p class="rep-comp-desc">${_esc(it.desc)}</p>` : ""}
  </div>
</div>`).join("")}
  </div>
  ${lowText}
</section>`;
}

function _deltaText(v, unit) {
  if (v == null) return "비교 불가";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v}${unit}`;
}

// ── 한 줄 진단(상태 기반 결정론) ──────────────────────────────
function _headline(final, gender) {
  const sm = _band("skeletal_muscle", final.skeletal_muscle, gender).status;
  const bf = _band("body_fat_pct", final.body_fat_pct, gender).status;
  const muscleLow = sm === "low";
  const fatHigh = bf === "high";
  if (muscleLow && fatHigh) return "근육은 표준보다 적고<br>체지방은 많은 상태예요";
  if (fatHigh) return "체지방이 표준보다<br>많은 상태예요";
  if (muscleLow) return "근육이 표준보다<br>적은 상태예요";
  if (bf === "low") return "체지방이 표준보다<br>적은 편이에요";
  return "전반적으로 균형 잡힌<br>몸 상태예요";
}

// ── 메인: 회원 리포트 렌더 ────────────────────────────────────
function renderMemberReport(ai, State) {
  const final = State.finalData || {};
  const gender = State.member?.gender;
  const raw = final.raw || {};
  const pain = State.preInputs?.pain_concerns || [];

  const compData = {
    total_body_water: raw.total_body_water ?? null,
    protein: raw.protein ?? null,
    minerals: raw.minerals ?? null,
    body_fat_mass: final.body_fat_mass ?? null,
    body_fat_pct: final.body_fat_pct ?? null,
    weight: final.weight ?? null,
  };
  return `
<div class="rep">
  <!-- 히어로 -->
  <section class="rep-hero">
    <div class="rep-hero-row">
      <div class="rep-hero-txt">
        <p class="rep-meta">${_esc(State.member?.name || "")} · ${_esc(gender || "")}${State.member?.birth_year ? " " + (new Date().getFullYear() - State.member.birth_year) + "세" : ""} · ${_esc(State.member?.branch || "")}</p>
        <h1 class="rep-h1">${_headline(final, gender)}</h1>
        <p class="rep-hero-sub">나쁜 게 아니라 출발점이에요. 충분히 바꿀 수 있어요.</p>
      </div>
      ${_scoreDonut(final.inbody_score)}
    </div>
    ${_noteHtml(MISCONCEPTIONS.inbody_score)}
  </section>

  <!-- 체성분 -->
  ${_composition(compData, gender)}
  ${_aiTextSection("AI 체성분 정밀 해석", ai?.body_composition_analysis)}
  ${_analysisMetaSection(ai?.analysis_meta)}
  ${_metricChips(final, raw)}
  ${_summaryBlock(ai)}

  <!-- 핵심 지표 -->
  <section class="rep-blk">
    <h2 class="rep-sec">핵심 지표 · 현재와 목표</h2>
    <p class="rep-legend"><span><i class="dot-cur"></i> 현재 위치</span><span><i class="dot-tgt"></i> 추천 목표(같은 성별 표준 기준)</span></p>
    ${_reportMetric("skeletal_muscle", final.skeletal_muscle, gender, "골격근량", "kg", true, null,
      _metricInterpText(ai?.metric_interp?.skeletal_muscle, "무릎·허리를 받치는 근육이 부족하면 계단·등산에서 먼저 지쳐요."))}
    ${_reportMetric("body_fat_pct", final.body_fat_pct, gender, "체지방률", "%", false, null,
      _metricInterpText(ai?.metric_interp?.body_fat_pct, "표준을 넘으면 혈압·혈당 부담이 커지는 구간이에요."))}
    ${_reportMetric("bmi", final.bmi, gender, "체질량지수 (BMI)", "", false, MISCONCEPTIONS.bmi,
      _metricInterpText(ai?.metric_interp?.bmi, "키 대비 체중이 많으면 무릎·허리 관절에 부담이 가요."))}
  </section>

  ${_visceral(raw)}
  ${ai?.segmental_analysis ? _aiTextSection("부위별 균형 해석", ai.segmental_analysis) : _segmental(raw, pain)}
  ${_priorityGoals(ai?.priority_goals)}
  ${_aiTextSection("운동 전략", ai?.exercise_strategy)}
  ${_aiTextSection("식단 전략", ai?.nutrition_strategy)}
  ${_expectedChange(ai?.expected_change)}

  <p class="rep-foot">이 분석은 ${_esc(State.member?.name || "")}님의 InBody 측정값과 표준 규준을 기준으로 작성되었습니다. 예상 변화는 일반적 추정이며 개인차가 있습니다.</p>
</div>`;
}
