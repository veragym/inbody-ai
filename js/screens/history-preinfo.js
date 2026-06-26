registerScreen("history-preinfo", {
  mount(el) {
    const rec = State.selectedHistoryRecord;
    if (!rec || !State.member) { navigate("history"); return; }

    const c = rec.consultation;
    if (!c) { navigate("history"); return; }

    const date = new Date(rec.measured_at).toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric",
    });

    const data = {
      exercise_purpose: c.exercise_purpose ?? [],
      exercise_experience: c.exercise_experience ?? null,
      pain_concerns: c.pain_concerns ?? [],
      body_shape_concerns: c.body_shape_concerns ?? [],
      member_tendency: c.member_tendency ?? null,
      motivation_level: c.motivation_level ?? null,
      exercise_frequency: c.exercise_frequency ?? null,
      protein_intake: c.protein_intake ?? null,
      carb_intake: c.carb_intake ?? null,
      fat_intake: c.fat_intake ?? null,
    };

    function esc(v) {
      return String(v ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      }[ch]));
    }

    function valueHtml(value) {
      const arr = Array.isArray(value) ? value.filter(Boolean) : (value ? [value] : []);
      if (arr.length === 0) return `<span class="preinfo-empty">미입력</span>`;
      return `<div class="preinfo-chips">${arr.map(v => `<span class="preinfo-chip">${esc(v)}</span>`).join("")}</div>`;
    }

    const rows = Object.entries(PRE_INPUT_CONFIG).map(([key, cfg]) => `
      <section class="preinfo-row">
        <h2 class="preinfo-label">${esc(cfg.label)}</h2>
        ${valueHtml(data[key])}
      </section>
    `).join("");

    el.innerHTML = `
<div class="screen screen-history-preinfo">
  <header class="screen-header">
    <button class="back-btn" id="back-btn">← 뒤로</button>
    <h1 class="screen-title">사전정보</h1>
    <p class="screen-subtitle">${esc(State.member.name)} 회원 · ${esc(date)}</p>
  </header>

  <div class="preinfo-body">
    ${rows}
  </div>
</div>`;

    document.getElementById("back-btn").addEventListener("click", () => navigate("history"));
  },
  unmount() {},
});
