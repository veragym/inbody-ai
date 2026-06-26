// 회원 인바디 이력 목록 화면

registerScreen("history", {
  mount(el) {
    if (!State.member || !State.trainer) { navigate("member-search"); return; }

    el.innerHTML = `
<div class="screen screen-history">
  <header class="screen-header">
    <button class="back-btn" id="back-btn">← 뒤로</button>
    <h1 class="screen-title">인바디 이력</h1>
    <p class="screen-subtitle">${State.member.name} 회원</p>
  </header>
  <div id="history-body" class="history-body">
    <div class="loading-spinner">불러오는 중...</div>
  </div>
  <div class="sticky-bottom">
    <button class="btn-primary" id="add-record-btn">+ 이력 추가</button>
  </div>
</div>`;

    document.getElementById("back-btn").addEventListener("click", () => navigate("member-search"));

    function recordToFinalData(r) {
      return {
        weight: r.final_weight,
        skeletal_muscle: r.final_skeletal_muscle,
        body_fat_mass: r.final_body_fat_mass,
        body_fat_pct: r.final_body_fat_pct,
        bmi: r.final_bmi,
        inbody_score: r.final_inbody_score,
        raw: r.final_raw_json ?? {},
      };
    }

    async function loadLastPreInputs() {
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

    async function continueRecord(r) {
      State.imagePath = null;
      State.ocrData = null;
      State.finalData = recordToFinalData(r);
      State.isManuallyEdited = false;
      State.inbodyRecordId = r.id;
      State.aiOutput = null;
      State.preInputs = null;
      State.preInputBackScreen = "history";
      await loadLastPreInputs();
      navigate("pre-input");
    }

    document.getElementById("add-record-btn").addEventListener("click", async () => {
      // 새 인바디 분석 데이터 초기화
      State.imagePath = null;
      State.ocrData = null;
      State.finalData = null;
      State.isManuallyEdited = false;
      State.inbodyRecordId = null;
      State.aiOutput = null;
      State.preInputs = null;
      State.preInputBackScreen = "history";

      // 이전 상담 데이터 조용히 불러와 촬영 후 사전입력에서 pre-fill
      await loadLastPreInputs();

      navigate("capture");
    });

    async function load() {
      const body = document.getElementById("history-body");
      try {
        const { records } = await callFn("inbody-history", {
          member_id: State.member.id,
          trainer_id: State.trainer.id,
        });

        if (!records || records.length === 0) {
          body.innerHTML = `<p class="empty-msg">아직 기록된 인바디 측정 결과가 없어요.</p>`;
          return;
        }

        body.innerHTML = records.map((r, idx) => {
          const date = new Date(r.measured_at).toLocaleDateString("ko-KR", {
            year: "numeric", month: "long", day: "numeric",
          });
          const isFirst = idx === records.length - 1;
          const hasConsult = !!r.consultation;

          return `
<div class="history-card${idx === 0 ? " history-card--latest" : ""}">
  <div class="history-card-header">
    <div class="history-date-wrap">
      <span class="history-date">${date}</span>
      ${idx === 0 ? `<span class="history-badge-latest">최근</span>` : ""}
      ${isFirst ? `<span class="history-badge-first">첫 방문</span>` : ""}
    </div>
    ${hasConsult ? `<span class="history-badge-consult">상담 완료</span>` : ""}
  </div>

  <div class="history-metrics">
    ${metricCell("체중", r.final_weight, "kg")}
    ${metricCell("골격근량", r.final_skeletal_muscle, "kg")}
    ${metricCell("체지방량", r.final_body_fat_mass, "kg")}
    ${metricCell("체지방률", r.final_body_fat_pct, "%")}
    ${metricCell("BMI", r.final_bmi, "")}
    ${metricCell("인바디점수", r.final_inbody_score, "점")}
  </div>

  ${r.diff ? buildDiffRow(r.diff) : ""}

  <div class="history-card-footer">
    <button class="btn-view-detail" data-idx="${idx}">
      ${hasConsult ? "분석 결과 보기 →" : "사전입력 후 분석"}
    </button>
    <button class="btn-view-preinfo" data-idx="${idx}" ${hasConsult ? "" : "disabled"}>
      ${hasConsult ? "사전정보" : "사전정보 없음"}
    </button>
  </div>
</div>`;
        }).join("");

        // 분석 결과 보기 버튼
        body.querySelectorAll(".btn-view-detail").forEach(btn => {
          btn.addEventListener("click", () => {
            const idx = Number(btn.dataset.idx);
            if (!records[idx]?.consultation) {
              continueRecord(records[idx]);
              return;
            }
            State.selectedHistoryRecord = records[idx];
            navigate("history-detail");
          });
        });

        body.querySelectorAll(".btn-view-preinfo").forEach(btn => {
          btn.addEventListener("click", () => {
            const idx = Number(btn.dataset.idx);
            if (!records[idx]?.consultation) {
              alert("이 기록에는 사전정보가 없어요.");
              return;
            }
            State.selectedHistoryRecord = records[idx];
            navigate("history-preinfo");
          });
        });

      } catch {
        body.innerHTML = `<p class="error-msg">이력을 불러오지 못했어요. 다시 시도해주세요.</p>`;
      }
    }

    load();
  },
  unmount() {},
});

function metricCell(label, val, unit) {
  if (val == null) return "";
  return `
<div class="history-metric">
  <span class="history-metric-label">${label}</span>
  <span class="history-metric-val inbody-num">${val}${unit}</span>
</div>`;
}

function buildDiffRow(diff) {
  const items = [
    { label: "체중", val: diff.weight, unit: "kg" },
    { label: "골격근", val: diff.skeletal_muscle, unit: "kg" },
    { label: "체지방률", val: diff.body_fat_pct, unit: "%" },
  ].filter(d => d.val != null);
  if (items.length === 0) return "";

  const chips = items.map(d => {
    const sign = d.val > 0 ? "+" : "";
    const isFat = d.label === "체지방률" || d.label === "체중";
    const isGood = isFat ? d.val < 0 : d.val > 0;
    const cls = d.val === 0 ? "diff-neutral" : (isGood ? "diff-good" : "diff-bad");
    return `<span class="diff-chip ${cls}">${d.label} ${sign}${d.val}${d.unit}</span>`;
  }).join("");

  return `<div class="history-diff">이전 대비: ${chips}</div>`;
}
