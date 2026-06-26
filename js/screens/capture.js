// ⑤ 인바디 결과지 촬영/업로드 화면

registerScreen("capture", {
  mount(el) {
    if (!State.member) { navigate("member-search"); return; }

    el.innerHTML = `
<div class="screen screen-capture">
  <header class="screen-header">
    <button class="back-btn" id="back-btn">← 뒤로</button>
    <h1 class="screen-title">결과지 업로드</h1>
    <p class="screen-subtitle">${State.member.name} 회원 · 인바디 270 결과지</p>
  </header>

  <div class="capture-body">

    <!-- 선택 전: 업로드 존 -->
    <div class="upload-zone" id="upload-zone">
      <div class="upload-zone-icon">↑</div>
      <p class="upload-zone-title">결과지 사진을 선택해주세요</p>
      <p class="upload-zone-tip">선명하게 찍힌 사진일수록 인식률이 높아요</p>
      <div class="upload-buttons">
        <label class="btn-primary upload-btn" for="camera-input">
          📷 카메라로 촬영
          <input type="file" id="camera-input" accept="image/*" capture="environment" class="hidden-file-input" />
        </label>
        <label class="btn-secondary upload-btn" for="gallery-input">
          갤러리 / 파일 선택
          <input type="file" id="gallery-input" accept="image/jpeg,image/png,image/webp" class="hidden-file-input" />
        </label>
      </div>
    </div>

    <!-- 선택 후: 미리보기 -->
    <div class="preview-zone hidden" id="preview-zone">
      <img id="preview-img" class="preview-full-img" alt="인바디 결과지 미리보기" />
      <div class="preview-actions">
        <button class="btn-secondary reselect-btn" id="reselect-btn">다시 선택</button>
      </div>
    </div>

  </div>

  <div class="sticky-bottom">
    <button class="btn-primary" id="next-btn" disabled>OCR 인식 시작</button>
  </div>
</div>`;

    document.getElementById("back-btn").addEventListener("click", () => navigate(State.preInputBackScreen || "history"));

    let selectedFile = null;

    function handleFile(file) {
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        alert("사진 파일이 너무 커요 (최대 10MB). 다시 선택해주세요.");
        return;
      }
      selectedFile = file;

      const reader = new FileReader();
      reader.onload = e => {
        document.getElementById("preview-img").src = e.target.result;
        document.getElementById("upload-zone").classList.add("hidden");
        document.getElementById("preview-zone").classList.remove("hidden");
        document.getElementById("next-btn").disabled = false;
      };
      reader.readAsDataURL(file);
    }

    document.getElementById("camera-input").addEventListener("change", e => handleFile(e.target.files[0]));
    document.getElementById("gallery-input").addEventListener("change", e => handleFile(e.target.files[0]));

    document.getElementById("reselect-btn").addEventListener("click", () => {
      selectedFile = null;
      document.getElementById("preview-zone").classList.add("hidden");
      document.getElementById("upload-zone").classList.remove("hidden");
      document.getElementById("next-btn").disabled = true;
    });

    document.getElementById("next-btn").addEventListener("click", async () => {
      if (!selectedFile) return;
      const nextBtn = document.getElementById("next-btn");
      nextBtn.disabled = true;
      nextBtn.textContent = "업로드 중...";

      try {
        const { image_path, signed_upload_url } = await callFn("inbody-image-upload-url", {
          trainer_id: State.trainer.id,
          member_id: State.member.id,
        });
        await uploadImage(signed_upload_url, selectedFile);
        State.imagePath = image_path;
        navigate("ocr-confirm");
      } catch (e) {
        alert(e.message || "업로드 중 오류가 생겼어요. 다시 시도해주세요.");
        nextBtn.disabled = false;
        nextBtn.textContent = "OCR 인식 시작";
      }
    });
  },
  unmount() {},
});
