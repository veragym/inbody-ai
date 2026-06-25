// 이력 상세 화면 - 저장된 분석 결과를 촬영 직후 리포트와 같은 컴포넌트로 표시

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

    const reportState = {
      ...State,
      finalData: {
        weight: rec.final_weight,
        skeletal_muscle: rec.final_skeletal_muscle,
        body_fat_mass: rec.final_body_fat_mass,
        body_fat_pct: rec.final_body_fat_pct,
        bmi: rec.final_bmi,
        inbody_score: rec.final_inbody_score,
        raw: rec.final_raw_json ?? {},
      },
      preInputs: {
        exercise_purpose: c.exercise_purpose ?? [],
        exercise_experience: c.exercise_experience ?? null,
        pain_concerns: c.pain_concerns ?? [],
        member_tendency: c.member_tendency ?? null,
        motivation_level: c.motivation_level ?? null,
        exercise_frequency: c.exercise_frequency ?? null,
        protein_intake: c.protein_intake ?? State.preInputs?.protein_intake ?? null,
        carb_intake: c.carb_intake ?? State.preInputs?.carb_intake ?? null,
        fat_intake: c.fat_intake ?? State.preInputs?.fat_intake ?? null,
      },
    };

    const ai = c.ai_report_json ?? {
      summary: c.ai_summary ?? null,
      comparison_note: c.ai_comparison_note ?? null,
      session_lineup: c.ai_session_lineup ?? [],
      recommended_sessions: c.ai_recommended_sessions ?? null,
      hook_message: c.ai_hook_message ?? null,
    };

    try {
      document.getElementById("detail-content").innerHTML = renderMemberReport(ai, reportState);
    } catch (err) {
      console.error("renderMemberReport failed:", err);
      document.getElementById("detail-content").innerHTML =
        `<p class="error-msg">리포트 표시 중 오류가 생겼어요. 다시 시도해주세요.</p>`;
    }
  },
  unmount() {},
});
