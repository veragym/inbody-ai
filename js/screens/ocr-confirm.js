// ⑥ OCR 인식 결과 확인·수정 화면

// 상단 직접 컬럼 필드
const OCR_FIELDS = [
  { key: "weight",          label: "체중",          unit: "kg" },
  { key: "skeletal_muscle", label: "골격근량",       unit: "kg" },
  { key: "body_fat_mass",   label: "체지방량",       unit: "kg" },
  { key: "body_fat_pct",    label: "체지방률",       unit: "%" },
  { key: "bmi",             label: "BMI",           unit: "" },
  { key: "inbody_score",    label: "인바디 점수",    unit: "점" },
  { key: "target_weight",   label: "적정체중 제안",  unit: "kg" },
  { key: "weight_control",  label: "체중조절 제안",  unit: "kg" },
  { key: "fat_control",     label: "지방조절 제안",  unit: "kg" },
  { key: "muscle_control",  label: "근육조절 제안",  unit: "kg" },
];

// raw 객체 안 체성분 필드
const OCR_RAW_FIELDS = [
  { key: "total_body_water", label: "체수분",  unit: "L" },
  { key: "protein",          label: "단백질",  unit: "kg" },
  { key: "minerals",         label: "무기질",  unit: "kg" },
];

const OCR_FIELD_LABELS = Object.fromEntries([...OCR_FIELDS, ...OCR_RAW_FIELDS].map(f => [f.key, f.label]));
const OCR_LIMITS = {
  weight: { min: 25, max: 220 },
  skeletal_muscle: { min: 8, max: 70 },
  body_fat_mass: { min: 2, max: 90 },
  body_fat_pct: { min: 3, max: 60 },
  bmi: { min: 12, max: 50 },
  inbody_score: { min: 40, max: 120 },
  target_weight: { min: 25, max: 220 },
  total_body_water: { min: 15, max: 80 },
  protein: { min: 4, max: 25 },
  minerals: { min: 1, max: 8 },
};

function ocrNum(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ocrWarningMap(data) {
  const raw = data.raw || {};
  const warnings = {};

  function add(key, message) {
    warnings[key] ||= [];
    warnings[key].push(message);
  }

  Object.entries(OCR_LIMITS).forEach(([key, limit]) => {
    const value = ocrNum(key in raw ? raw[key] : data[key]);
    if (value == null) return;
    if (value < limit.min || value > limit.max) {
      add(key, `일반 범위(${limit.min}~${limit.max})를 벗어났어요.`);
    }
  });

  const weight = ocrNum(data.weight);
  const bodyFatMass = ocrNum(data.body_fat_mass);
  const bodyFatPct = ocrNum(data.body_fat_pct);
  if (weight != null && bodyFatMass != null && bodyFatMass > weight) {
    add("body_fat_mass", "체지방량이 체중보다 큽니다.");
  }
  if (weight != null && bodyFatMass != null && bodyFatPct != null) {
    const expected = weight * bodyFatPct / 100;
    const gap = Math.abs(expected - bodyFatMass);
    if (gap > Math.max(2.5, weight * 0.04)) {
      add("body_fat_mass", "체중·체지방률과 계산값이 맞지 않아요.");
      add("body_fat_pct", "체중·체지방량과 계산값이 맞지 않아요.");
    }
  }

  const weightControl = ocrNum(data.weight_control);
  const fatControl = ocrNum(data.fat_control);
  const muscleControl = ocrNum(data.muscle_control);
  if (weightControl != null && fatControl != null && muscleControl != null) {
    const sum = +(fatControl + muscleControl).toFixed(1);
    if (Math.abs(weightControl - sum) > 0.2) {
      add("weight_control", "지방조절+근육조절 합과 차이가 있어요.");
    }
  }

  const targetWeight = ocrNum(data.target_weight);
  if (weight != null && weightControl != null && targetWeight != null) {
    const expectedTarget = +(weight + weightControl).toFixed(1);
    if (Math.abs(targetWeight - expectedTarget) > 0.5) {
      add("target_weight", "체중+체중조절 값과 차이가 있어요.");
    }
  }

  const lowConfidence = Array.isArray(raw.low_confidence_fields) ? raw.low_confidence_fields : [];
  lowConfidence.forEach(key => add(key, "AI가 낮은 신뢰도로 표시한 항목이에요."));

  return warnings;
}

registerScreen("ocr-confirm", {
  mount(el) {
    if (!State.imagePath) { navigate("capture"); return; }

    el.innerHTML = `
<div class="screen screen-ocr-confirm">
  <header class="screen-header">
    <button class="back-btn" id="back-btn">← 뒤로</button>
    <h1 class="screen-title">인식 결과 확인</h1>
    <p class="screen-subtitle">AI가 인식한 수치를 확인하고 틀린 값은 수정해주세요</p>
  </header>

  <div id="ocr-status" class="ocr-status">
    <div class="loading-spinner">인바디 수치를 읽는 중...</div>
  </div>

  <div id="ocr-form" class="ocr-form hidden"></div>

  <div class="sticky-bottom">
    <button class="btn-primary" id="confirm-btn" disabled>확인 완료</button>
  </div>
</div>`;

    document.getElementById("back-btn").addEventListener("click", () => navigate("capture"));

    let ocrOriginal = {};

    async function ensureLastPreInputs() {
      if (State.preInputs || !State.member?.id || !State.trainer?.id) return;
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
            body_shape_concerns: last_consultation.body_shape_concerns ?? [],
            member_tendency:     last_consultation.member_tendency ?? null,
            motivation_level:    last_consultation.motivation_level ?? null,
            exercise_frequency:  last_consultation.exercise_frequency ?? null,
            protein_intake:      last_consultation.protein_intake ?? null,
            carb_intake:         last_consultation.carb_intake ?? null,
            fat_intake:          last_consultation.fat_intake ?? null,
          };
        }
        State.lastRecord = last_record ?? null;
      } catch { /* 이전 사전정보가 없어도 진행 */ }
    }

    async function runOcr() {
      try {
        const result = await callFn("inbody-ocr-analyze", { image_path: State.imagePath });

        if (result.error === "not_inbody_sheet") {
          document.getElementById("ocr-status").innerHTML =
            `<p class="error-msg">인바디 결과지로 인식되지 않아요. 사진이 흐리거나 결과지 전체가 안 보이면 다시 촬영해주세요.</p>
             <button class="btn-secondary" id="retry-btn">다시 선택하기</button>`;
          document.getElementById("retry-btn").addEventListener("click", () => navigate("capture"));
          return;
        }

        ocrOriginal = { ...result };
        State.ocrData = { ...result };
        renderForm(result);
      } catch (e) {
        document.getElementById("ocr-status").innerHTML =
          `<p class="error-msg">인식 중 오류가 생겼어요: ${e.message || "알 수 없는 오류"}</p>
           <button class="btn-secondary" id="retry-btn">다시 선택하기</button>`;
        document.getElementById("retry-btn")?.addEventListener("click", () => navigate("capture"));
      }
    }

    function fieldRow(key, label, unit, value, warnings, isRaw = false) {
      const val = value !== null && value !== undefined ? value : "";
      const warningText = (warnings[key] || []).join(" ");
      return `
<div class="ocr-field-row${warningText ? " is-warning" : ""}" data-key="${key}" data-raw="${isRaw}">
  <label class="ocr-field-label">${label}${unit ? ` <span class="ocr-unit">(${unit})</span>` : ""}</label>
  <div class="ocr-field-input-wrap">
    <input type="number" class="ocr-field-input" data-key="${key}" data-raw="${isRaw}"
      step="0.01" value="${val}" placeholder="—" />
    <span class="badge-modified hidden">수정됨</span>
    <span class="badge-ocr-warning${warningText ? "" : " hidden"}">확인</span>
  </div>
  <p class="ocr-field-warning${warningText ? "" : " hidden"}">${warningText}</p>
</div>`;
    }

    function currentFormData() {
      const final = { ...ocrOriginal, raw: { ...(ocrOriginal.raw || {}) } };
      document.querySelectorAll(".ocr-field-input[data-raw='false']").forEach(input => {
        final[input.dataset.key] = input.value === "" ? null : Number(input.value);
      });
      document.querySelectorAll(".ocr-field-input[data-raw='true']").forEach(input => {
        final.raw[input.dataset.key] = input.value === "" ? null : Number(input.value);
      });
      return final;
    }

    function updateWarnings() {
      const warnings = ocrWarningMap(currentFormData());
      document.querySelectorAll(".ocr-field-row").forEach(row => {
        const key = row.dataset.key;
        const warningText = (warnings[key] || []).join(" ");
        row.classList.toggle("is-warning", !!warningText);
        row.querySelector(".badge-ocr-warning")?.classList.toggle("hidden", !warningText);
        const message = row.querySelector(".ocr-field-warning");
        if (message) {
          message.textContent = warningText;
          message.classList.toggle("hidden", !warningText);
        }
      });

      const summary = document.getElementById("ocr-warning-summary");
      const keys = Object.keys(warnings);
      if (!summary) return warnings;
      if (!keys.length) {
        summary.classList.add("hidden");
        summary.innerHTML = "";
        return warnings;
      }
      const labels = keys.map(key => OCR_FIELD_LABELS[key] || key).join(", ");
      summary.classList.remove("hidden");
      summary.innerHTML = "<strong>확인 필요 항목</strong><span></span>";
      summary.querySelector("span").textContent = labels;
      return warnings;
    }

    function renderForm(data) {
      document.getElementById("ocr-status").classList.add("hidden");
      const formEl = document.getElementById("ocr-form");
      formEl.classList.remove("hidden");

      const raw = data.raw || {};
      const warnings = ocrWarningMap(data);

      formEl.innerHTML = `
<p class="ocr-help-text">수정한 항목은 <span class="badge-modified">수정됨</span> 표시가 나타나요</p>
<div class="ocr-warning-summary hidden" id="ocr-warning-summary"></div>

<div class="ocr-section-label">기본 체성분</div>
<div class="ocr-fields">
  ${OCR_FIELDS.map(f => fieldRow(f.key, f.label, f.unit, data[f.key], warnings, false)).join("")}
</div>

<div class="ocr-section-label">체성분 구성</div>
<div class="ocr-fields">
  ${OCR_RAW_FIELDS.map(f => fieldRow(f.key, f.label, f.unit, raw[f.key], warnings, true)).join("")}
</div>`;

      // 수정 감지
      formEl.querySelectorAll(".ocr-field-input").forEach(input => {
        input.addEventListener("input", () => {
          const key = input.dataset.key;
          const isRaw = input.dataset.raw === "true";
          const origVal = isRaw ? (ocrOriginal.raw?.[key] ?? null) : (ocrOriginal[key] ?? null);
          const newVal = input.value === "" ? null : Number(input.value);
          const badge = input.closest(".ocr-field-input-wrap").querySelector(".badge-modified");
          badge.classList.toggle("hidden", newVal === origVal || (newVal === null && origVal === null));
          updateWarnings();
        });
      });

      updateWarnings();
      document.getElementById("confirm-btn").disabled = false;
    }

    document.getElementById("confirm-btn").addEventListener("click", async () => {
      // 최상위 필드 수집
      const final = { ...ocrOriginal };
      let isEdited = false;

      document.querySelectorAll(".ocr-field-input[data-raw='false']").forEach(input => {
        const key = input.dataset.key;
        const val = input.value === "" ? null : Number(input.value);
        if (val !== (ocrOriginal[key] ?? null)) isEdited = true;
        final[key] = val;
      });

      // raw 필드 수집 (기존 raw 보존 + 수정값 반영)
      final.raw = { ...(ocrOriginal.raw || {}) };
      document.querySelectorAll(".ocr-field-input[data-raw='true']").forEach(input => {
        const key = input.dataset.key;
        const val = input.value === "" ? null : Number(input.value);
        if (val !== (ocrOriginal.raw?.[key] ?? null)) isEdited = true;
        final.raw[key] = val;
      });

      const warnings = ocrWarningMap(final);
      if (Object.keys(warnings).length > 0) {
        const labels = Object.keys(warnings).map(key => OCR_FIELD_LABELS[key] || key).join(", ");
        if (!confirm(`확인 필요 항목이 있어요: ${labels}\n수치를 확인했다면 그대로 저장할까요?`)) {
          return;
        }
      }

      State.finalData = final;
      State.isManuallyEdited = isEdited;

      const confirmBtn = document.getElementById("confirm-btn");
      confirmBtn.disabled = true;
      confirmBtn.textContent = "저장 중...";

      try {
        const { inbody_record_id } = await callFn("inbody-record-create", {
          trainer_id: State.trainer.id,
          member_id: State.member.id,
          branch: State.trainer.branch,
          image_path: State.imagePath,
          ocr: State.ocrData,
          final: State.finalData,
          is_manually_edited: State.isManuallyEdited,
        });
        State.inbodyRecordId = inbody_record_id;
        State.uiCache.historyByMember = {};
        State.uiCache.memberSearchByQuery = {};
        State.uiCache.preInputsByMember = {};
        confirmBtn.textContent = "사전정보 준비 중...";
        await ensureLastPreInputs();
        navigate("pre-input");
      } catch (e) {
        alert("저장 중 오류가 생겼어요. 다시 시도해주세요.");
        confirmBtn.disabled = false;
        confirmBtn.textContent = "확인 완료";
      }
    });

    runOcr();
  },
  unmount() {},
});
