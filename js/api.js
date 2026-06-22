// Edge Function 호출 래퍼 — x-tablet-key 자동 주입

async function callFn(name, body) {
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "x-tablet-key": TABLET_SECRET,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.status }));
    throw new Error(err.error || String(res.status));
  }
  return res.json();
}

// 이미지 직접 PUT 업로드 (signed upload URL 사용)
async function uploadImage(signedUrl, file) {
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  });
  if (!res.ok) throw new Error("이미지 업로드에 실패했어요. 다시 시도해주세요.");
}
