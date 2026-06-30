// ② 회원 검색/등록 화면

function escapeHtml(value) {
  if (value == null) return "";
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

registerScreen("member-search", {
  mount(el) {
    if (!State.trainer) { navigate("login"); return; }

    el.innerHTML = `
<div class="screen screen-member-search">
  <header class="screen-header">
    <button class="back-btn" id="back-btn">← 뒤로</button>
    <h1 class="screen-title">회원 검색</h1>
    <p class="screen-subtitle">${escapeHtml(State.trainer.name)} 트레이너 · ${escapeHtml(State.trainer.branch)}</p>
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
        <label>나이</label>
        <input type="number" id="new-age" class="form-input" placeholder="35" min="10" max="100" inputmode="numeric" />
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
    let searchSeq = 0;
    let selectedGender = null;

    const searchInput = document.getElementById("search-input");
    const resultsEl = document.getElementById("search-results");
    const newFormEl = document.getElementById("new-member-form");
    const newTriggerEl = document.getElementById("new-member-trigger");

    function showNewTrigger() {
      newTriggerEl.classList.remove("hidden");
    }

    function clearMemberSearchCache() {
      State.uiCache.memberSearchByQuery = {};
    }

    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      const q = searchInput.value.trim();
      searchTimer = setTimeout(() => doSearch(q || " "), 300);
    });

    function renderMembers(name, members) {
        if (!members || members.length === 0) {
          resultsEl.innerHTML = `<p class="empty-msg">'${escapeHtml(name)}'(으)로 검색된 회원이 없어요.</p>`;
          showNewTrigger();
          return;
        }
        resultsEl.innerHTML = members.map(m => `
<div class="member-row">
  <button class="member-btn" data-id="${escapeHtml(m.id)}" data-name="${escapeHtml(m.name)}"
    data-gender="${escapeHtml(m.gender || "")}" data-birth="${escapeHtml(m.birth_year || "")}"
    data-phone="${escapeHtml(m.phone_last4 || "")}" data-branch="${escapeHtml(m.branch)}">
    <span class="member-name">${escapeHtml(m.name)}${m.phone_last4 ? " " + escapeHtml(m.phone_last4) : ""}</span>
    <span class="member-meta">${escapeHtml(m.gender || "—")} ${m.birth_year ? (new Date().getFullYear() - m.birth_year) + "세" : ""}</span>
  </button>
  <div class="member-row-actions">
    <span class="member-history-badge" id="hist-${escapeHtml(m.id)}">기록 확인 중...</span>
    <button class="btn-delete" data-id="${escapeHtml(m.id)}" data-name="${escapeHtml(m.name)}">삭제</button>
  </div>
</div>`).join("");
        showNewTrigger();

        members.forEach(m => {
          const badge = document.getElementById(`hist-${m.id}`);
          if (!badge) return;
          const lastRecord = m.last_record;
          if (lastRecord) {
            const date = new Date(lastRecord.measured_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
            badge.textContent = `최근 이력 ${date}`;
            badge.classList.add("has-record");
          } else {
            badge.textContent = "첫 방문";
            badge.classList.add("no-record");
          }
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
              clearMemberSearchCache();
              btn.closest(".member-row").remove();
            } catch {
              alert("삭제 중 오류가 생겼어요.");
              btn.disabled = false;
              btn.textContent = "삭제";
            }
          });
        });

        resultsEl.querySelectorAll(".member-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            State.member = {
              id: btn.dataset.id,
              name: btn.dataset.name,
              gender: btn.dataset.gender || null,
              birth_year: btn.dataset.birth ? Number(btn.dataset.birth) : null,
              phone_last4: btn.dataset.phone || null,
              branch: btn.dataset.branch,
            };
            State.preInputs = null;
            State.lastRecord = null;
            State.selectedHistoryRecord = null;
            navigate("history");
          });
        });
    }

    async function doSearch(name) {
      const normalizedName = name.trim() || "%";
      const cacheKey = `${State.trainer.id}:${normalizedName}`;
      const seq = ++searchSeq;
      const cached = State.uiCache.memberSearchByQuery[cacheKey];
      if (cached) {
        renderMembers(name, cached);
      } else {
        resultsEl.innerHTML = `<div class="loading-spinner">불러오는 중...</div>`;
      }
      try {
        const { members } = await callFn("inbody-members-search", {
          action: "search",
          trainer_id: State.trainer.id,
          name: normalizedName,
        });
        if (seq !== searchSeq) return;
        State.uiCache.memberSearchByQuery[cacheKey] = members || [];
        renderMembers(name, members);
      } catch (e) {
        if (seq !== searchSeq) return;
        if (cached) return;
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
      newFormEl.scrollIntoView({ block: "start" });
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
      const ageVal = document.getElementById("new-age").value;
      const birth_year = ageVal ? new Date().getFullYear() - Number(ageVal) : null;
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
        clearMemberSearchCache();
        State.member = { ...member };
        State.preInputs = null;
        State.lastRecord = null;
        State.preInputBackScreen = "member-search";
        navigate("capture");
      } catch (e) {
        alert("등록 중 오류가 생겼어요. 다시 시도해주세요.");
        createBtn.disabled = false;
        createBtn.textContent = "등록하기";
      }
    });
  },
  unmount() {},
});
