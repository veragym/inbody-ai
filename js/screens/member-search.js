// ② 회원 검색/등록 화면

registerScreen("member-search", {
  mount(el) {
    if (!State.trainer) { navigate("login"); return; }

    el.innerHTML = `
<div class="screen screen-member-search">
  <header class="screen-header">
    <button class="back-btn" id="back-btn">← 뒤로</button>
    <h1 class="screen-title">회원 검색</h1>
    <p class="screen-subtitle">${State.trainer.name} 트레이너 · ${State.trainer.branch}</p>
  </header>

  <div class="search-area">
    <input type="text" id="search-input" class="search-input" placeholder="회원 이름 검색..." autocomplete="off" />
    <button class="btn-new-member-inline" id="show-new-form-btn">+ 신규 등록</button>
  </div>

  <div id="search-results" class="search-results"></div>

  <div id="new-member-form" class="new-member-form hidden">
    <h2 class="form-title">신규 회원 등록</h2>
    <div class="form-group">
      <label>이름 <span class="required">*</span></label>
      <input type="text" id="new-name" class="form-input" placeholder="홍길동" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>성별</label>
        <div class="chip-group">
          <button class="chip" data-val="남">남</button>
          <button class="chip" data-val="여">여</button>
        </div>
      </div>
      <div class="form-group">
        <label>출생년도</label>
        <input type="number" id="new-birth" class="form-input" placeholder="1990" min="1930" max="2015" />
      </div>
    </div>
    <div class="form-group">
      <label>연락처 끝 4자리 (동명이인 구분용)</label>
      <input type="text" id="new-phone4" class="form-input" placeholder="1234" maxlength="4" inputmode="numeric" />
    </div>
    <button class="btn-primary" id="create-btn">등록하기</button>
    <button class="btn-secondary" id="cancel-create-btn">취소</button>
  </div>

  <div class="sticky-bottom hidden" id="new-member-trigger"></div>
</div>`;

    document.getElementById("back-btn").addEventListener("click", () => navigate("login"));

    let searchTimer = null;
    let selectedGender = null;

    const searchInput = document.getElementById("search-input");
    const resultsEl = document.getElementById("search-results");
    const newFormEl = document.getElementById("new-member-form");
    const newTriggerEl = document.getElementById("new-member-trigger");

    function showNewTrigger() {
      newTriggerEl.classList.remove("hidden");
    }

    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      const q = searchInput.value.trim();
      searchTimer = setTimeout(() => doSearch(q || " "), 300);
    });

    async function doSearch(name) {
      resultsEl.innerHTML = `<div class="loading-spinner">불러오는 중...</div>`;
      try {
        const { members } = await callFn("inbody-members-search", {
          action: "search",
          trainer_id: State.trainer.id,
          name: name.trim() || "%",
        });
        if (!members || members.length === 0) {
          resultsEl.innerHTML = `<p class="empty-msg">'${name}'(으)로 검색된 회원이 없어요.</p>`;
          showNewTrigger();
          return;
        }
        resultsEl.innerHTML = members.map(m => `
<div class="member-row">
  <button class="member-btn" data-id="${m.id}" data-name="${m.name}"
    data-gender="${m.gender || ""}" data-birth="${m.birth_year || ""}"
    data-phone="${m.phone_last4 || ""}" data-branch="${m.branch}">
    <div class="member-btn-left">
      <span class="member-name">${m.name}</span>
      <span class="member-meta">${m.gender || "—"} · ${m.birth_year ? m.birth_year + "년생" : "—"} · ${m.phone_last4 ? "***" + m.phone_last4 : "—"}</span>
    </div>
    <span class="member-history-badge" id="hist-${m.id}">기록 확인 중...</span>
  </button>
  <button class="btn-history" data-id="${m.id}" data-name="${m.name}"
    data-gender="${m.gender || ""}" data-birth="${m.birth_year || ""}"
    data-phone="${m.phone_last4 || ""}" data-branch="${m.branch}">이력</button>
  <button class="btn-delete" data-id="${m.id}" data-name="${m.name}">삭제</button>
</div>`).join("");
        showNewTrigger();

        // 각 회원의 이전 기록 비동기 로드
        members.forEach(m => {
          callFn("inbody-members-search", { action: "history", trainer_id: State.trainer.id, member_id: m.id })
            .then(({ last_record }) => {
              const badge = document.getElementById(`hist-${m.id}`);
              if (!badge) return;
              if (last_record) {
                const date = new Date(last_record.measured_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
                badge.textContent = `${date} · ${last_record.final_weight}kg · ${last_record.final_body_fat_pct}%`;
                badge.classList.add("has-record");
              } else {
                badge.textContent = "첫 방문";
                badge.classList.add("no-record");
              }
            })
            .catch(() => {
              const badge = document.getElementById(`hist-${m.id}`);
              if (badge) badge.textContent = "";
            });
        });

        // 이력 조회 버튼
        resultsEl.querySelectorAll(".btn-history").forEach(btn => {
          btn.addEventListener("click", () => {
            State.member = {
              id: btn.dataset.id,
              name: btn.dataset.name,
              gender: btn.dataset.gender || null,
              birth_year: btn.dataset.birth ? Number(btn.dataset.birth) : null,
              phone_last4: btn.dataset.phone || null,
              branch: btn.dataset.branch,
            };
            navigate("history");
          });
        });

        // 삭제 버튼
        resultsEl.querySelectorAll(".btn-delete").forEach(btn => {
          btn.addEventListener("click", async () => {
            if (!confirm(`'${btn.dataset.name}' 회원을 삭제할까요?\n삭제된 회원은 목록에서 사라지지만 기록은 보존됩니다.`)) return;
            btn.disabled = true;
            btn.textContent = "...";
            try {
              await callFn("inbody-members-search", {
                action: "delete",
                trainer_id: State.trainer.id,
                member_id: btn.dataset.id,
              });
              btn.closest(".member-row").remove();
            } catch {
              alert("삭제 중 오류가 생겼어요.");
              btn.disabled = false;
              btn.textContent = "삭제";
            }
          });
        });

        resultsEl.querySelectorAll(".member-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            State.member = {
              id: btn.dataset.id,
              name: btn.dataset.name,
              gender: btn.dataset.gender || null,
              birth_year: btn.dataset.birth ? Number(btn.dataset.birth) : null,
              phone_last4: btn.dataset.phone || null,
              branch: btn.dataset.branch,
            };
            // 이전 상담 사전입력 불러와서 pre-fill
            try {
              const { last_consultation, last_record } = await callFn("inbody-members-search", {
                action: "history",
                trainer_id: State.trainer.id,
                member_id: State.member.id,
              });
              if (last_consultation) {
                State.preInputs = {
                  exercise_purpose:    last_consultation.exercise_purpose ?? [],
                  exercise_experience: last_consultation.exercise_experience ?? null,
                  pain_concerns:       last_consultation.pain_concerns ?? [],
                  member_tendency:     last_consultation.member_tendency ?? null,
                  motivation_level:    last_consultation.motivation_level ?? null,
                  exercise_frequency:  last_consultation.exercise_frequency ?? null,
                };
                State.personas = last_consultation.trainer_personas ?? [];
              } else {
                State.preInputs = null;
                State.personas = [];
              }
              State.lastRecord = last_record ?? null;
            } catch {
              State.preInputs = null;
              State.personas = [];
              State.lastRecord = null;
            }
            navigate("pre-input");
          });
        });
      } catch (e) {
        resultsEl.innerHTML = `<p class="error-msg">검색 중 오류가 생겼어요. 다시 시도해주세요.</p>`;
        showNewTrigger();
      }
    }

    // 화면 열리면 전체 회원 바로 로드
    doSearch("");

    document.getElementById("show-new-form-btn").addEventListener("click", () => {
      newFormEl.classList.remove("hidden");
      newTriggerEl.classList.add("hidden");
      document.getElementById("new-name").value = searchInput.value.trim();
      newFormEl.scrollIntoView({ behavior: "smooth" });
    });

    document.getElementById("cancel-create-btn").addEventListener("click", () => {
      newFormEl.classList.add("hidden");
      showNewTrigger();
    });

    // 성별 칩 선택
    newFormEl.querySelectorAll(".chip").forEach(chip => {
      chip.addEventListener("click", () => {
        newFormEl.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
        chip.classList.add("selected");
        selectedGender = chip.dataset.val;
      });
    });

    document.getElementById("create-btn").addEventListener("click", async () => {
      const name = document.getElementById("new-name").value.trim();
      if (!name) { alert("이름을 입력해주세요."); return; }
      const birth_year = document.getElementById("new-birth").value
        ? Number(document.getElementById("new-birth").value) : null;
      const phone_last4 = document.getElementById("new-phone4").value.trim() || null;

      const createBtn = document.getElementById("create-btn");
      createBtn.disabled = true;
      createBtn.textContent = "등록 중...";
      try {
        const { member } = await callFn("inbody-members-search", {
          action: "create",
          trainer_id: State.trainer.id,
          name,
          gender: selectedGender,
          birth_year,
          branch: State.trainer.branch,
          phone_last4,
        });
        State.member = { ...member };
        navigate("pre-input");
      } catch (e) {
        alert("등록 중 오류가 생겼어요. 다시 시도해주세요.");
        createBtn.disabled = false;
        createBtn.textContent = "등록하기";
      }
    });
  },
  unmount() {},
});
