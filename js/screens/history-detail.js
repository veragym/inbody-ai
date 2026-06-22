// 이력 상세 화면 — 저장된 분석 결과 그대로 표시 (AI 재생성 없음)

const SESSION_PRICE_HD = { 12: 60000, 24: 57000, 36: 54000, 48: 51000, 60: 48000, 100: 42000 };

function formatPriceHD(sessions) {
  const perSession = SESSION_PRICE_HD[sessions];
  const total = perSession * sessions;
  return `회당 ${perSession.toLocaleString()}원 · 총 ${total.toLocaleString()}원`;
}

registerScreen("history-detail", {
  mount(el) {
    const rec = State.selectedHistoryRecord;
    if (!rec || !State.member) { navigate("history"); return; }

    const c = rec.consultation;
    if (!c) { navigate("history"); return; }

    const date = new Date(rec.measured_at).toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric",
    });

    el.innerHTML = `
<div class="screen screen-result">
  <header class="screen-header">
    <button class="back-btn" id="back-btn">← 뒤로</button>
    <h1 class="screen-title">분석 결과</h1>
    <p class="screen-subtitle">${State.member.name} 회원 · ${date}</p>
  </header>
  <div id="detail-content" class="result-content"></div>
</div>`;

    document.getElementById("back-btn").addEventListener("click", () => navigate("history"));

    const final = {
      weight:          rec.final_weight,
      skeletal_muscle: rec.final_skeletal_muscle,
      body_fat_mass:   rec.final_body_fat_mass,
      body_fat_pct:    rec.final_body_fat_pct,
      bmi:             rec.final_bmi,
      inbody_score:    rec.final_inbody_score,
      raw: rec.final_raw_json ?? {},
    };
    const gender = State.member.gender;

    const metrics = [
      { key: "weight",          label: "체중",       unit: "kg" },
      { key: "skeletal_muscle", label: "골격근량",    unit: "kg" },
      { key: "body_fat_mass",   label: "체지방량",    unit: "kg" },
      { key: "body_fat_pct",    label: "체지방률",    unit: "%" },
      { key: "bmi",             label: "BMI",        unit: "" },
      { key: "inbody_score",    label: "인바디 점수",  unit: "점" },
    ];

    const barsHtml = metrics.map(m =>
      createJudgeBar(m.key, final[m.key] ?? null, gender, m.label, m.unit)
    ).join("");

    const lineup = c.ai_session_lineup || [];
    const recSessions = c.ai_recommended_sessions;

    const lineupHtml = lineup.map(s => {
      const isRec = s.sessions === recSessions;
      return `
<div class="session-card${isRec ? " is-recommended" : ""}">
  <div class="session-header">
    <span class="session-count inbody-num">${s.sessions}회</span>
    <span class="session-price">${formatPriceHD(s.sessions)}</span>
    ${isRec ? `<span class="badge-recommend">추천</span>` : ""}
  </div>
  <div class="session-body">
    <div class="session-section">
      <h4 class="session-section-title">운동생리학적 근거</h4>
      <p class="session-text">${s.rationale}</p>
    </div>
    <div class="session-section">
      <h4 class="session-section-title">단기 효과</h4>
      <p class="session-text">${s.short_term}</p>
    </div>
    <div class="session-section">
      <h4 class="session-section-title">장기 효과</h4>
      <p class="session-text">${s.long_term}</p>
    </div>
  </div>
</div>`;
    }).join("");

    // PT 등록 결과 배지
    const ptBadge = c.pt_registered
      ? `<div class="history-result-row">
           <span class="history-result-label">PT 등록 결과</span>
           <span class="history-result-val ${c.pt_registered === "등록" ? "val-good" : "val-neutral"}">${c.pt_registered}${c.registered_sessions ? ` · ${c.registered_sessions}회` : ""}</span>
         </div>`
      : "";

    const memoHtml = c.memo
      ? `<div class="history-result-row"><span class="history-result-label">메모</span><span class="history-result-val">${c.memo}</span></div>`
      : "";

    const compData = {
      total_body_water: final.raw?.total_body_water ?? null,
      protein:          final.raw?.protein ?? null,
      minerals:         final.raw?.minerals ?? null,
      body_fat_mass:    final.body_fat_mass ?? null,
      body_fat_pct:     final.body_fat_pct ?? null,
      weight:           final.weight ?? null,
    };
    const compositionHtml = createCompositionBar(compData);
    const compositionGuideHtml = createCompositionGuide(compData, gender);

    document.getElementById("detail-content").innerHTML = `
<!-- 1. 수치 해석 -->
<section class="result-section">
  <h2 class="section-title">인바디 수치 해석</h2>
  <div class="card">
    <p class="result-summary">${c.ai_summary || "—"}</p>
    ${c.ai_comparison_note ? `<p class="result-comparison">${c.ai_comparison_note}</p>` : ""}
  </div>
</section>

<!-- 2. 체성분 구성 -->
${compositionHtml ? `
<section class="result-section">
  <h2 class="section-title">체성분 구성</h2>
  <div class="card">${compositionHtml}</div>
  ${compositionGuideHtml ? `<div class="comp-guide-wrap">${compositionGuideHtml}</div>` : ""}
</section>` : ""}

<!-- 3. 판정 바 -->
<section class="result-section">
  <h2 class="section-title">수치 판정</h2>
  <div class="card judge-bars-wrap">${barsHtml}</div>
</section>

<!-- 4. 회차 라인업 -->
${lineup.length > 0 ? `
<section class="result-section">
  <h2 class="section-title">회차별 멘트 라인업</h2>
  <p class="section-desc">어느 회차든 자유롭게 선택해서 말씀해주세요</p>
  <div class="session-lineup">${lineupHtml}</div>
</section>` : ""}

<!-- 5. 후킹 멘트 -->
${c.ai_hook_message ? `
<section class="result-section">
  <h2 class="section-title">후킹 멘트</h2>
  <div class="card hook-card">
    <p class="hook-message">${c.ai_hook_message}</p>
  </div>
</section>` : ""}

<!-- 6. 상담 결과 -->
${ptBadge || memoHtml ? `
<section class="result-section">
  <h2 class="section-title">상담 결과</h2>
  <div class="card history-result-card">
    ${ptBadge}${memoHtml}
  </div>
</section>` : ""}`;
  },
  unmount() {},
});
