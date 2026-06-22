// ⑩ 상담 결과 기록 화면

registerScreen("consultation", {
  mount(el) {
    if (!State.aiOutput) { navigate("result"); return; }

    el.innerHTML = `
<div class="screen screen-consultation">
  <header class="screen-header">
    <button class="back-btn" id="back-btn">← 뒤로</button>
    <h1 class="screen-title">상담 결과 기록</h1>
    <p class="screen-subtitle">${State.member.name} 회원</p>
  </header>

  <div class="form-body">
    <div class="form-section">
      <h3 class="section-title">PT 등록 여부 <span class="required">*</span></h3>
      <div class="chip-group" id="reg-chips">
        <button class="chip" data-val="등록">등록</button>
        <button class="chip" data-val="미등록">미등록</button>
        <button class="chip" data-val="보류">보류</button>
      </div>
    </div>

    <div class="form-section" id="sessions-section" style="display:none">
      <h3 class="section-title">등록 회차</h3>
      <input type="number" id="registered-sessions" class="form-input" placeholder="예: 36" min="1" max="200" />
      <p class="input-hint">추천 회차: ${State.aiOutput.recommended_sessions}회</p>
    </div>

    <div class="form-section">
      <h3 class="section-title">메모 (선택)</h3>
      <textarea id="memo-input" class="form-input form-textarea" placeholder="상담 특이사항, 다음 미팅 내용 등..." rows="4"></textarea>
    </div>
  </div>

  <div class="sticky-bottom">
    <button class="btn-primary" id="save-btn" disabled>저장 완료</button>
  </div>
</div>`;

    document.getElementById("back-btn").addEventListener("click", () => navigate("result"));

    let selectedRegistered = null;

    document.getElementById("reg-chips").querySelectorAll(".chip").forEach(chip => {
      chip.addEventListener("click", () => {
        document.getElementById("reg-chips").querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
        chip.classList.add("selected");
        selectedRegistered = chip.dataset.val;

        const sessionsSection = document.getElementById("sessions-section");
        sessionsSection.style.display = selectedRegistered === "등록" ? "block" : "none";
        document.getElementById("save-btn").disabled = false;
      });
    });

    document.getElementById("save-btn").addEventListener("click", async () => {
      if (!selectedRegistered) { alert("등록 여부를 선택해주세요."); return; }

      const registeredSessions = document.getElementById("registered-sessions").value
        ? Number(document.getElementById("registered-sessions").value) : null;
      const memo = document.getElementById("memo-input").value.trim() || null;

      const saveBtn = document.getElementById("save-btn");
      saveBtn.disabled = true;
      saveBtn.textContent = "저장 중...";

      try {
        await callFn("inbody-consultation-save", {
          inbody_record_id: State.inbodyRecordId,
          member_id: State.member.id,
          trainer_id: State.trainer.id,
          pre_inputs: State.preInputs,
          personas: State.personas,
          ai_output: State.aiOutput,
          pt_registered: selectedRegistered,
          registered_sessions: registeredSessions,
          memo,
        });

        // 완료 화면
        el.querySelector(".screen").innerHTML = `
<div class="done-screen">
  <div class="done-icon">✓</div>
  <h2 class="done-title">상담 기록 완료</h2>
  <p class="done-msg">${State.member.name} 회원의 상담 내용이 저장됐어요.</p>
  <button class="btn-primary done-btn" id="home-btn">새 상담 시작</button>
</div>`;

        document.getElementById("home-btn").addEventListener("click", () => {
          State.reset();
          navigate("login");
        });
      } catch (e) {
        alert("저장 중 오류가 생겼어요. 다시 시도해주세요.");
        saveBtn.disabled = false;
        saveBtn.textContent = "저장 완료";
      }
    });
  },
  unmount() {},
});
