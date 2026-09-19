/**
 * P0-A.29-B(CEO 승인 ㉮, 2026-09-19) — Vision 을 «판정기» 가 아니라 «관측 데이터
 * 수집기» 로 붙인다.
 *
 * 🔴 이 모듈이 내는 값은 **어떤 판정에도 입력으로 들어가지 않는다.** priceTierFromLink
 *    는 여전히 match_truth·verified 만 읽고, deriveMatchTruth 는 이 점수를 모른다.
 *    여기서 하는 일은 점수와 «그 점수를 재현하는 데 필요한 것» 을 남기는 것뿐이다.
 *
 * ── 왜 이 모듈이 crawler 가 아니라 여기 있는가 ──────────────────────────────
 * compareCrossSellerProducts 는 순수 함수다(fetch 가 한 줄도 없다). 같은 입력에
 * 늘 같은 답이 나와야 테스트가 고정되기 때문이고, 그 성질을 깨지 않으려면
 * 네트워크를 쓰는 쪽이 호출부에 있어야 한다 — image-evidence.ts 가 같은 이유로
 * crawler 안에 있으면서도 판정기 «밖» 에 있는 것과 같은 자리다.
 *
 * ── 실측 근거(P0-A.20~29) ───────────────────────────────────────────────────
 *   등급 프롬프트 · MEDIA_RESOLUTION_LOW · 이미지 2장
 *   브랜드 2개 259쌍에서 FP 0 · FN 0
 *   이미지 장당 입력 ≈258tok · 출력 쌍당 ≈15tok · latency 중앙 2.1~2.8초
 *   🔴 「자기보고 confidence」는 120건 중 116건이 1.0 이라 버렸다 — 변별력이 없다.
 *      점수를 «등급» 으로 물어야 갈린다.
 */
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** 🔴 점수는 프롬프트에 종속이다. 프롬프트를 고치면 이 값을 «반드시» 올려야
 *  과거 점수와 새 점수를 섞어 임계값을 긋는 일이 생기지 않는다. */
export const VISION_PROMPT_VERSION = "grade-v1";
const VISION_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
const MEDIA_RESOLUTION = "MEDIA_RESOLUTION_LOW";
const IMAGE_FETCH_TIMEOUT_MS = 8000;
const API_TIMEOUT_MS = 20000;

/**
 * 🔴 「동일한가」가 아니라 «얼마나 같아 보이는가» 를 묻는다. 이분법으로 물으면
 *    모델이 자기 confidence 를 늘 1.0 으로 주고(실측), 그러면 경계를 그을 수 없다.
 *    구간 설명을 함께 줘야 점수가 실제로 퍼진다(실측: SAME 최저 95 · DIFF 최고 15).
 */
const PROMPT = `Two product photos from different retailers.
Rate how likely they are THE SAME product (same style AND same colorway).
Different colorway of same style = NOT same. Similar style, different product = NOT same.
Score 0-100. Use the full range: 0-20 clearly different, 21-50 probably different,
51-79 uncertain, 80-100 clearly same.
JSON only: {"score":0-100,"reason":"<6 words"}`;

export interface VisionEvidence {
  model: string;
  promptVersion: string;
  mediaResolution: string;
  score: number;
  reason: string | null;
  imageRefs: string[];
  checkedAt: string;
}

/** 캐시 조회 결과. `null` 이면 "이 쌍을 Vision 으로 본 적이 없다" 이다. */
export async function findCachedVisionEvidence(
  snapshotId: string,
  sourceId: string,
  imageRefs: string[],
): Promise<VisionEvidence | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("domestic_product_links")
    .select("vision_model, vision_prompt_version, vision_media_resolution, vision_score, vision_reason, vision_image_refs, vision_checked_at")
    .eq("snapshot_id", snapshotId)
    .eq("source_id", sourceId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  if (row.vision_score == null) return null;

  /* 🔴 URL 문자열 하나만 믿지 않는다(CEO 지시). 캐시가 유효하려면 세 가지가 같아야 한다:
       · 프롬프트 판(점수의 뜻이 바뀐다)
       · 모델(같은 프롬프트라도 모델이 다르면 다른 척도다)
       · 비교에 실제로 쓴 이미지(상품이 사진을 갈아끼우면 다시 봐야 한다)
     하나라도 다르면 «캐시 없음» 으로 보고 새로 부른다. */
  if (row.vision_prompt_version !== VISION_PROMPT_VERSION) return null;
  if (row.vision_model !== VISION_MODEL) return null;
  const cachedRefs = (row.vision_image_refs as string[] | null) ?? [];
  if (cachedRefs.length !== imageRefs.length || cachedRefs.some((v, i) => v !== imageRefs[i])) return null;

  return {
    model: String(row.vision_model),
    promptVersion: String(row.vision_prompt_version),
    mediaResolution: String(row.vision_media_resolution ?? MEDIA_RESOLUTION),
    score: Number(row.vision_score),
    reason: (row.vision_reason as string | null) ?? null,
    imageRefs: cachedRefs,
    checkedAt: String(row.vision_checked_at),
  };
}

async function fetchAsInlineData(url: string): Promise<{ mime_type: string; data: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return { mime_type: res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg", data: buffer.toString("base64") };
  } catch {
    return null;
  }
}

/**
 * 이미지 두 장을 Vision 에 넘겨 0~100 등급을 받는다.
 *
 * 🔴 실패하면 **null** 이다. 절대 점수를 지어내지 않고, 호출부도 이것을 「같다」로
 *    읽으면 안 된다 — 이 모듈이 조용히 0 이나 100 을 돌려주면 그 순간 실패가
 *    판정이 된다.
 */
export async function runVisionEvidence(
  foreignImageUrl: string | null | undefined,
  domesticImageUrl: string | null | undefined,
): Promise<VisionEvidence | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !foreignImageUrl || !domesticImageUrl) return null;

  const [a, b] = await Promise.all([fetchAsInlineData(foreignImageUrl), fetchAsInlineData(domesticImageUrl)]);
  if (!a || !b) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }, { inline_data: a }, { inline_data: b }] }],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 256,
            /* 🔴 thinking 을 끄지 않으면 출력 예산을 생각이 다 먹고 답이 빈다
               (실측: 40쌍 전부 빈 응답 · thoughtsTokenCount 만 쌓임). */
            thinkingConfig: { thinkingBudget: 0 },
            mediaResolution: MEDIA_RESOLUTION,
          },
        }),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as { score?: unknown; reason?: unknown };
    const score = Number(parsed.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) return null;
    return {
      model: VISION_MODEL,
      promptVersion: VISION_PROMPT_VERSION,
      mediaResolution: MEDIA_RESOLUTION,
      score: Math.round(score),
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : null,
      imageRefs: [foreignImageUrl, domesticImageUrl],
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
