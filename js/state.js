// 상담 1건 진행 상태 — 화면 간 공유 데이터

const State = {
  trainer: null,       // { id, name, branch }
  member: null,        // { id, name, gender, birth_year, phone_last4, branch }
  preInputs: null,     // { exercise_purpose[], exercise_experience, pain_concerns[], member_tendency, motivation_level, exercise_frequency }
  personas: [],        // string[]
  imagePath: null,     // string (버킷 내 경로)
  ocrData: null,       // OCR 원본 JSON
  finalData: null,     // 트레이너 확정 JSON
  isManuallyEdited: false,
  inbodyRecordId: null,
  aiOutput: null,            // member-facing AI report JSON
  lastRecord: null,          // 직전 인바디 기록 요약 (재방문 표시용)
  selectedHistoryRecord: null, // 이력 상세 보기용 레코드

  reset() {
    this.trainer = null;
    this.member = null;
    this.preInputs = null;
    this.personas = [];
    this.imagePath = null;
    this.ocrData = null;
    this.finalData = null;
    this.isManuallyEdited = false;
    this.inbodyRecordId = null;
    this.aiOutput = null;
    this.lastRecord = null;
    this.selectedHistoryRecord = null;
  },
};
