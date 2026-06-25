import { guard, json } from "../_shared/guard.ts";

const SYSTEM_PROMPT = `당신은 InBody 270 체성분 분석 결과지(인쇄물) 사진에서 수치를 정확히 읽어내는 OCR 전문가다.
사용자가 제공한 이미지에서 아래 항목을 추출해 JSON으로만 응답한다. 설명 문장은 출력하지 않는다.

[규칙]
- 숫자는 단위를 제외한 순수 숫자만 추출한다 (예: "65.4 kg" → 65.4).
- 읽을 수 없거나 결과지에 없는 항목은 null로 둔다. 절대 추측해서 지어내지 않는다.
- 소수점은 결과지 표기 그대로 유지한다.
- 부위별(분절) 근육/지방은 raw 객체에 넣는다. 팔/다리는 좌우가 따로 인쇄돼 있으면 left/right로 구분한다.
- 흐리거나 잘려서 신뢰도가 낮은 값은 추출하되, raw.low_confidence_fields 배열에 항목명을 적는다.
- 결과지가 InBody 270이 아니거나 체성분 결과지로 보이지 않으면 {"error":"not_inbody_sheet"} 만 반환한다.

[출력 JSON 스키마]
{
  "weight": number|null,
  "skeletal_muscle": number|null,
  "body_fat_mass": number|null,
  "body_fat_pct": number|null,
  "bmi": number|null,
  "inbody_score": number|null,
  "target_weight": number|null,
  "weight_control": number|null,
  "fat_control": number|null,
  "muscle_control": number|null,
  "raw": {
    "segmental_muscle": { "left_arm": number|null, "right_arm": number|null, "trunk": number|null, "left_leg": number|null, "right_leg": number|null },
    "segmental_fat":    { "left_arm": number|null, "right_arm": number|null, "trunk": number|null, "left_leg": number|null, "right_leg": number|null },
    "total_body_water": number|null,
    "protein": number|null,
    "minerals": number|null,
    "visceral_fat_level": number|null,
    "measured_date_on_sheet": "YYYY-MM-DD"|null,
    "low_confidence_fields": [string]
  }
}

반드시 위 스키마의 JSON 하나만 출력한다.`;

async function callAnthropicWithFallback(aiReqBase: Record<string, unknown>, models: string[]) {
  let lastErrorText = "";

  for (const model of models) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...aiReqBase, model }),
    });

    const text = await resp.text();
    if (resp.ok) return JSON.parse(text);

    lastErrorText = text;
    const normalized = text.toLowerCase();
    if (!normalized.includes("capacity") && !normalized.includes("overloaded") && !normalized.includes("temporarily unavailable")) {
      break;
    }
  }

  throw new Error(lastErrorText || "anthropic_request_failed");
}

Deno.serve(async (req) => {
  const { error, supabase } = guard(req);
  if (error) return error;

  const { image_path } = await req.json() as { image_path: string };
  if (!image_path) return json({ error: "image_path required" }, 400);

  // 비공개 버킷에서 이미지 다운로드
  const { data: fileData, error: dlErr } = await supabase.storage
    .from("inbody-images")
    .download(image_path);
  if (dlErr) return json({ error: dlErr.message }, 500);

  const buffer = await fileData.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);

  // 확장자로 미디어 타입 결정
  const ext = image_path.split(".").pop()?.toLowerCase() ?? "jpg";
  const mediaTypeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  const media_type = mediaTypeMap[ext] ?? "image/jpeg";

  const aiReq = {
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type, data: base64 },
          },
          { type: "text", text: "위 인바디 결과지에서 수치를 추출해 JSON으로 반환하세요." },
        ],
      },
    ],
  };

  let ai;
  try {
    ai = await callAnthropicWithFallback(aiReq, [
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
    ]);
  } catch (err) {
    return json({ error: "ai_failed", detail: String(err) }, 502);
  }
  const text = ai.content?.find((b: { type: string }) => b.type === "text")?.text ?? "{}";

  // JSON 블록 파싱 (마크다운 코드블록 방어)
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  let out: Record<string, unknown>;
  try {
    out = JSON.parse(cleaned);
  } catch {
    return json({ error: "ai_bad_json", raw: text }, 502);
  }

  return json(out);
});
