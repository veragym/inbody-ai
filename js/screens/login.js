// ① 로그인 화면 — 트레이너 이름 선택 (비밀번호 없음)

registerScreen("login", {
  mount(el) {
    State.reset();
    el.innerHTML = `
<div class="screen screen-login">
  <header class="screen-header">
    <h1 class="screen-title">베라짐 인바디 AI</h1>
    <p class="screen-subtitle">트레이너를 선택해주세요</p>
  </header>

  <div class="branch-tabs">
    <button class="branch-tab active" data-branch="">전체</button>
    <button class="branch-tab" data-branch="미사점">미사점</button>
    <button class="branch-tab" data-branch="동탄점">동탄점</button>
  </div>

  <div id="trainer-list" class="trainer-list">
    <div class="loading-spinner">불러오는 중...</div>
  </div>
</div>`;

    let activeBranch = "";
    let trainerLoadSeq = 0;

    async function loadTrainers(branch) {
      const seq = ++trainerLoadSeq;
      const listEl = document.getElementById("trainer-list");
      listEl.innerHTML = `<div class="loading-spinner">불러오는 중...</div>`;
      try {
        const { trainers } = await callFn("inbody-trainers-list", branch ? { branch } : {});
        if (seq !== trainerLoadSeq) return;
        if (!trainers || trainers.length === 0) {
          listEl.innerHTML = `<p class="empty-msg">등록된 트레이너가 없어요.</p>`;
          return;
        }
        listEl.innerHTML = trainers.map(t => `
<button class="trainer-btn" data-id="${t.id}" data-name="${t.name}" data-branch="${t.branch}">
  <span class="trainer-name">${t.name}</span>
  <span class="trainer-branch">${t.branch}</span>
</button>`).join("");

        listEl.querySelectorAll(".trainer-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            State.trainer = {
              id: btn.dataset.id,
              name: btn.dataset.name,
              branch: btn.dataset.branch,
            };
            navigate("member-search");
          });
        });
      } catch (e) {
        if (seq !== trainerLoadSeq) return;
        listEl.innerHTML = `<p class="error-msg">트레이너 목록을 불러오지 못했어요. 네트워크를 확인해주세요.</p>`;
      }
    }

    el.querySelectorAll(".branch-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        el.querySelectorAll(".branch-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        activeBranch = tab.dataset.branch;
        loadTrainers(activeBranch);
      });
    });

    loadTrainers(activeBranch);
  },
  unmount() {},
});
