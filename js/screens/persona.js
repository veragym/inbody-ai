// ④ 트레이너 페르소나 선택 화면

const PERSONAS = [
  "재활/통증관리형",
  "3대 운동 마스터",
  "스트랭스 코치",
  "체형교정 전문",
  "바디라인/다이어트",
  "초보자 친화형",
  "하드코어 트레이닝",
  "시니어/여성특화",
  "퍼포먼스 향상",
];

registerScreen("persona", {
  mount(el) {
    if (!State.preInputs) { navigate("pre-input"); return; }

    const selected = new Set(State.personas);

    el.innerHTML = `
<div class="screen screen-persona">
  <header class="screen-header">
    <button class="back-btn" id="back-btn">← 뒤로</button>
    <h1 class="screen-title">트레이너 페르소나</h1>
    <p class="screen-subtitle">나를 표현하는 스타일을 골라주세요 (복수 선택 가능)</p>
  </header>

  <div class="chip-group persona-chip-group" id="persona-chips">
    ${PERSONAS.map(p => `
      <button class="chip persona-chip${selected.has(p) ? " selected" : ""}" data-val="${p}">${p}</button>
    `).join("")}
  </div>

  <div class="sticky-bottom">
    <button class="btn-secondary" id="save-exit-btn">저장 후 나가기</button>
    <button class="btn-primary" id="next-btn">다음</button>
  </div>
</div>`;

    document.getElementById("back-btn").addEventListener("click", () => navigate("pre-input"));

    el.querySelectorAll(".persona-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const val = chip.dataset.val;
        if (selected.has(val)) {
          selected.delete(val);
          chip.classList.remove("selected");
        } else {
          selected.add(val);
          chip.classList.add("selected");
        }
      });
    });

    document.getElementById("save-exit-btn").addEventListener("click", () => {
      State.personas = [...selected];
      navigate("member-search");
    });

    document.getElementById("next-btn").addEventListener("click", () => {
      State.personas = [...selected];
      navigate("capture");
    });
  },
  unmount() {},
});
