// ⑦⑧ 회원 인바디 리포트 화면 (v9) — 회원에게 보여주는 분석 리포트
// 숫자·판정·목표는 코드+규준(report.js/judge-bar.js), 해석문장은 AI. PT 권유 없음.

registerScreen("result", {
  mount(el) {
    if (!State.inbodyRecordId) { navigate("ocr-confirm"); return; }

    el.innerHTML = `
<div class="screen screen-result">
  <header class="screen-header">
    <h1 class="screen-title">인바디 분석 리포트</h1>
    <p class="screen-subtitle">${State.member.name} 회원</p>
  </header>

  <div id="result-loading" class="result-loading">
    <div class="ai-loading-wrap">
      <div class="ai-spinner"></div>
      <p class="ai-loading-text">맞춤 분석을 준비하고 있어요...</p>
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
        renderReport(aiOutput);
      } catch (e) {
        console.error("generate-scripts failed:", e);
        document.getElementById("result-loading").innerHTML =
          `<p class="error-msg">분석 중 오류가 생겼어요. 네트워크를 확인하고 다시 시도해주세요.</p>
           <button class="btn-secondary" id="retry-ai-btn">다시 시도</button>`;
        document.getElementById("retry-ai-btn")?.addEventListener("click", () => {
          document.getElementById("result-loading").innerHTML =
            `<div class="ai-loading-wrap"><div class="ai-spinner"></div><p class="ai-loading-text">다시 분석 중...</p></div>`;
          loadResult();
        });
      }
    }

    function renderReport(ai) {
      document.getElementById("result-loading").classList.add("hidden");
      const content = document.getElementById("result-content");
      content.classList.remove("hidden");
      document.getElementById("result-bottom").classList.remove("hidden");

      try {
        content.innerHTML = renderMemberReport(ai, State);
      } catch (err) {
        console.error("renderMemberReport failed:", err);
        content.innerHTML = `<p class="error-msg">리포트 표시 중 오류가 생겼어요. 다시 시도해주세요.</p>`;
      }

      document.getElementById("consult-btn").addEventListener("click", () => navigate("consultation"));
    }

    loadResult();
  },
  unmount() {},
});
