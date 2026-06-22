// ⑦⑧ AI 분석 결과 화면 — 수치 해석 + 회차 라인업 + 후킹 멘트

const SESSION_PRICE = { 12: 60000, 24: 57000, 36: 54000, 48: 51000, 60: 48000, 100: 42000 };

function formatPrice(sessions) {
  const perSession = SESSION_PRICE[sessions];
  const total = perSession * sessions;
  return `회당 ${perSession.toLocaleString()}원 · 총 ${total.toLocaleString()}원`;
}

registerScreen("result", {
  mount(el) {
    if (!State.inbodyRecordId) { navigate("ocr-confirm"); return; }

    el.innerHTML = `
<div class="screen screen-result">
  <header class="screen-header">
    <h1 class="screen-title">AI 분석 결과</h1>
    <p class="screen-subtitle">${State.member.name} 회원 · ${State.trainer.name} 트레이너</p>
  </header>

  <div id="result-loading" class="result-loading">
    <div class="ai-loading-wrap">
      <div class="ai-spinner"></div>
      <p class="ai-loading-text">AI가 맞춤 멘트를 생성하고 있어요...</p>
      <p class="ai-loading-sub">보통 10~20초 정도 걸려요</p>
    </div>
  </div>

  <div id="result-content" class="result-content hidden"></div>

  <div class="sticky-bottom hidden" id="result-bottom">
    <button class="btn-primary" id="consult-btn">상담 결과 기록하기</button>
  </div>
</div>`;

    async function loadResult() {
      try {
        const aiOutput = await callFn("inbody-generate-scripts", {
          inbody_record_id: State.inbodyRecordId,
          member_id: State.member.id,
          trainer_id: State.trainer.id,
          pre_inputs: State.preInputs,
          personas: State.personas,
        });
        State.aiOutput = aiOutput;
        renderResult(aiOutput);
      } catch (e) {
        document.getElementById("result-loading").innerHTML =
          `<p class="error-msg">AI 분석 중 오류가 생겼어요. 네트워크를 확인하고 다시 시도해주세요.</p>
           <button class="btn-secondary" id="retry-ai-btn">다시 시도</button>`;
        document.getElementById("retry-ai-btn")?.addEventListener("click", () => {
          document.getElementById("result-loading").innerHTML = `<div class="ai-loading-wrap"><div class="ai-spinner"></div><p class="ai-loading-text">다시 분석 중...</p></div>`;
          loadResult();
        });
      }
    }

    function renderResult(ai) {
      document.getElementById("result-loading").classList.add("hidden");
      const content = document.getElementById("result-content");
      content.classList.remove("hidden");
      document.getElementById("result-bottom").classList.remove("hidden");

      const final = State.finalData || {};
      const gender = State.member.gender;

      // 수치 판정 바 항목
      const metrics = [
        { key: "weight",          label: "체중",      unit: "kg" },
        { key: "skeletal_muscle", label: "골격근량",   unit: "kg" },
        { key: "body_fat_mass",   label: "체지방량",   unit: "kg" },
        { key: "body_fat_pct",    label: "체지방률",   unit: "%" },
        { key: "bmi",             label: "BMI",       unit: "" },
        { key: "inbody_score",    label: "인바디 점수", unit: "점" },
      ];

      const barsHtml = metrics.map(m =>
        createJudgeBar(m.key, final[m.key] ?? null, gender, m.label, m.unit)
      ).join("");

      const lineupHtml = (ai.session_lineup || []).map(s => {
        const isRec = s.sessions === ai.recommended_sessions;
        return `
<div class="session-card${isRec ? " is-recommended" : ""}">
  <div class="session-header">
    <span class="session-count inbody-num">${s.sessions}회</span>
    <span class="session-price">${formatPrice(s.sessions)}</span>
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

      content.innerHTML = `
<!-- 1. 수치 해석 요약 -->
<section class="result-section">
  <h2 class="section-title">인바디 수치 해석</h2>
  <div class="card">
    <p class="result-summary">${ai.summary}</p>
    ${ai.comparison_note ? `<p class="result-comparison">${ai.comparison_note}</p>` : ""}
  </div>
</section>

<!-- 2. 체성분분석 구성 막대 -->
${(() => {
  const compData = {
    total_body_water: final.raw?.total_body_water ?? null,
    protein:          final.raw?.protein ?? null,
    minerals:         final.raw?.minerals ?? null,
    body_fat_mass:    final.body_fat_mass ?? null,
    body_fat_pct:     final.body_fat_pct ?? null,
    weight:           final.weight ?? null,
  };
  const bar = createCompositionBar(compData);
  const guide = createCompositionGuide(compData, gender);
  if (!bar) return "";
  return `
<section class="result-section">
  <h2 class="section-title">체성분 구성</h2>
  <div class="card">${bar}</div>
  ${guide ? `<div class="comp-guide-wrap">${guide}</div>` : ""}
</section>`;
})()}

<!-- 3. 판정 바 시각화 -->
<section class="result-section">
  <h2 class="section-title">수치 판정</h2>
  <div class="card judge-bars-wrap">
    ${barsHtml}
  </div>
</section>

<!-- 4. 회차 카드 라인업 -->
<section class="result-section">
  <h2 class="section-title">회차별 멘트 라인업</h2>
  <p class="section-desc">어느 회차든 자유롭게 선택해서 말씀해주세요</p>
  <div class="session-lineup">
    ${lineupHtml}
  </div>
</section>

<!-- 5. 후킹 멘트 -->
<section class="result-section">
  <h2 class="section-title">후킹 멘트</h2>
  <div class="card hook-card">
    <p class="hook-message">${ai.hook_message}</p>
  </div>
</section>`;

      document.getElementById("consult-btn").addEventListener("click", () => navigate("consultation"));
    }

    loadResult();
  },
  unmount() {},
});
