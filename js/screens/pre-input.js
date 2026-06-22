// ③ 사전 입력 화면 — 칩 선택 UI

const PRE_INPUT_CONFIG = {
  exercise_purpose: {
    label: "운동 목적",
    multi: true,
    options: ["체중감량", "체중증량", "체력증진", "근육량증가/근력향상", "자세교정", "스트레스해소", "바디라인다듬기", "근골격계통증완화", "산전산후관리", "건강한습관만들기"],
  },
  exercise_experience: {
    label: "운동 경험",
    multi: false,
    options: ["무경험", "경험있음(중단)", "꾸준히해옴"],
  },
  pain_concerns: {
    label: "통증·체형 고민",
    multi: true,
    options: ["목/어깨", "복부", "팔", "둔부", "가슴", "허벅지", "등", "종아리", "거북목", "척추측만", "말린어깨", "O다리", "굽은등", "X다리", "일자허리", "평발"],
  },
  member_tendency: {
    label: "회원 성향",
    multi: false,
    options: ["결과중심형", "과정중시형", "불안형", "자기주도형"],
  },
  motivation_level: {
    label: "동기 수준",
    multi: false,
    options: ["강함", "보통", "약함"],
  },
  exercise_frequency: {
    label: "운동 빈도 (주당, PT+개인운동 합산)",
    multi: false,
    required: true,
    options: ["주1회", "주2회", "주3회", "주4회이상"],
  },
};

registerScreen("pre-input", {
  mount(el) {
    if (!State.member) { navigate("member-search"); return; }

    // 이전 상담 데이터 있으면 pre-fill, 없으면 빈 값으로 시작
    const prev = State.preInputs;
    const selected = {};
    Object.keys(PRE_INPUT_CONFIG).forEach(k => {
      if (prev) {
        selected[k] = prev[k] ?? (PRE_INPUT_CONFIG[k].multi ? [] : null);
      } else {
        selected[k] = PRE_INPUT_CONFIG[k].multi ? [] : null;
      }
    });

    function renderSections() {
      return Object.entries(PRE_INPUT_CONFIG).map(([key, cfg]) => `
<div class="form-section">
  <h3 class="section-title">${cfg.label}${cfg.required ? ' <span class="required">*</span>' : ""}</h3>
  <div class="chip-group" data-key="${key}" data-multi="${cfg.multi}">
    ${cfg.options.map(opt => `
      <button class="chip" data-val="${opt}">${opt}</button>
    `).join("")}
  </div>
</div>`).join("");
    }

    const revisitBanner = prev
      ? `<div class="revisit-banner">이전 상담 내용이 자동으로 불러와졌어요. 변경 사항이 있으면 수정해주세요.</div>`
      : "";

    el.innerHTML = `
<div class="screen screen-pre-input">
  <header class="screen-header">
    <button class="back-btn" id="back-btn">← 뒤로</button>
    <h1 class="screen-title">사전 입력</h1>
    <p class="screen-subtitle">${State.member.name} 회원${prev ? " · 재방문" : " · 첫 방문"}</p>
  </header>

  ${revisitBanner}

  <div class="form-body">
    ${renderSections()}
  </div>

  <div class="sticky-bottom">
    <button class="btn-primary" id="next-btn">다음</button>
  </div>
</div>`;

    document.getElementById("back-btn").addEventListener("click", () => navigate("member-search"));

    // 저장된 선택값 칩에 반영
    el.querySelectorAll(".chip-group").forEach(group => {
      const key = group.dataset.key;
      const val = selected[key];
      if (!val) return;
      group.querySelectorAll(".chip").forEach(chip => {
        const isSelected = Array.isArray(val) ? val.includes(chip.dataset.val) : val === chip.dataset.val;
        if (isSelected) chip.classList.add("selected");
      });
    });

    // 칩 선택 이벤트
    el.querySelectorAll(".chip-group").forEach(group => {
      const key = group.dataset.key;
      const isMulti = group.dataset.multi === "true";

      group.querySelectorAll(".chip").forEach(chip => {
        chip.addEventListener("click", () => {
          const val = chip.dataset.val;
          if (isMulti) {
            const arr = selected[key];
            const idx = arr.indexOf(val);
            if (idx >= 0) {
              arr.splice(idx, 1);
              chip.classList.remove("selected");
            } else {
              arr.push(val);
              chip.classList.add("selected");
            }
          } else {
            group.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
            selected[key] = val;
            chip.classList.add("selected");
          }
        });
      });
    });

    document.getElementById("next-btn").addEventListener("click", () => {
      if (!selected.exercise_frequency) {
        alert("운동 빈도는 필수 항목이에요. 선택해주세요.");
        return;
      }
      State.preInputs = { ...selected };
      navigate("persona");
    });
  },
  unmount() {},
});
