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

    function fieldRow(key, label, unit, value, isRaw = false) {
      const val = value !== null && value !== undefined ? value : "";
      return `
<div class="ocr-field-row" data-key="${key}" data-raw="${isRaw}">
  <label class="ocr-field-label">${label}${unit ? ` <span class="ocr-unit">(${unit})</span>` : ""}</label>
  <div class="ocr-field-input-wrap">
    <input type="number" class="ocr-field-input" data-key="${key}" data-raw="${isRaw}"
      step="0.01" value="${val}" placeholder="—" />
    <span class="badge-modified hidden">수정됨</span>
  </div>
</div>`;
    }

    function renderForm(data) {
      document.getElementById("ocr-status").classList.add("hidden");
      const formEl = document.getElementById("ocr-form");
      formEl.classList.remove("hidden");

      const raw = data.raw || {};

      formEl.innerHTML = `
<p class="ocr-help-text">수정한 항목은 <span class="badge-modified">수정됨</span> 표시가 나타나요</p>

<div class="ocr-section-label">기본 체성분</div>
<div class="ocr-fields">
  ${OCR_FIELDS.map(f => fieldRow(f.key, f.label, f.unit, data[f.key], false)).join("")}
</div>

<div class="ocr-section-label">체성분 구성</div>
<div class="ocr-fields">
  ${OCR_RAW_FIELDS.map(f => fieldRow(f.key, f.label, f.unit, raw[f.key], true)).join("")}
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
        });
      });

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
