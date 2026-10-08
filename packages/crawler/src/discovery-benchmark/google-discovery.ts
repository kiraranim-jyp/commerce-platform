import type { DiscoveredUrl, DiscoveryProvider, DiscoveryQuery, ProductIdentity } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-P5.4-C(CPO 지시, 2026-10-07) — **Google Search Grounding 은
 * 「판매 페이지 URL 발견」만 한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 파일이 돌려주는 타입은 `DiscoveredUrl[]` 하나다. `DiscoveryProvider` 계약에
 * 판정이 들어갈 자리가 **애초에 없다**(types.ts:83 주석). 그래서 Google 이
 * 「동일상품입니다」라고 답해도 그 말이 우리 판정에 닿을 경로가 구조적으로 없다 —
 * 모든 결과는 `SEARCH_CANDIDATE` 이고, SAME/SIMILAR 는 기존 MI 만 낸다.
 *
 * ── 🔴 Grounding 이 돌려주는 URL 은 «리다이렉트 주소» 다 ────────────────────
 * `groundingChunks[].web.uri` 는 실제 판매처 URL 이 아니라
 * `vertexaisearch.cloud.google.com/grounding-api-redirect/…` 형태다. 그래서
 * 이 provider 의 출력은 **그대로 크롤러에 넣을 수 없다** — 반드시 기존
 * `resolveCandidate`(리다이렉트 추적 → canonical → classifyUrlShape)를 통과해야
 * 한다. 그 순서가 P5.4-C 지시서 §5 의 파이프라인이다.
 *
 * 🔴 `title`·`snippet` 은 기록만 한다(「검색은 찾았는데 우리가 못 읽었다」와
 *    「검색도 못 찾았다」를 가르기 위해서). 어떤 판정에도 쓰지 않는다.
 * 🔴 relevance·ranking·AI 답변 텍스트는 **담는 칸이 없다**. rank 는 응답 순서일
 *    뿐이고 판정에 쓰이지 않는다.
 *
 * ── 자격증명 ────────────────────────────────────────────────────────────────
 * 🔴 키를 코드에 적지 않는다 · DB 에 넣지 않는다 · 로그에 출력하지 않는다.
 *    기존 환경변수(`GEMINI_API_KEY`)를 그대로 쓴다 — 이 저장소에 이미 있는
 *    체계다(packages/image 의 gemini.provider.ts 가 같은 이름을 쓴다).
 * 🔴 키가 없으면 빈 배열을 돌려주지 **않는다**. 「설정이 없다」와 「검색 결과가
 *    없다」를 같은 값으로 만들면 벤치마크가 거짓말을 한다 — 전용 오류로 던진다.
 */
export const GEMINI_API_KEY_ENV = "GEMINI_API_KEY";
export const GEMINI_MODEL_ENV = "GEMINI_MODEL";

/** Grounding 을 지원하는 기본 모델. 🔴 값을 코드에 고정하지 않고 env 로 덮을 수 있다. */
const DEFAULT_MODEL = "gemini-2.5-flash";
const ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const FETCH_TIMEOUT_MS = 20000;

export interface GoogleDiscoveryReadiness {
  state: "READY" | "CONFIG_MISSING";
  /** 🔴 비어 있는 환경변수 «이름» 만. 값은 절대 담지 않는다. */
  missing: string[];
}

export function googleDiscoveryReadiness(): GoogleDiscoveryReadiness {
  const key = process.env[GEMINI_API_KEY_ENV]?.trim();
  return key ? { state: "READY", missing: [] } : { state: "CONFIG_MISSING", missing: [GEMINI_API_KEY_ENV] };
}

/**
 * 🔴 「키가 없다」를 「결과가 없다」와 가르는 전용 오류. 벤치마크는 이것을
 *    `CONFIG_MISSING` 으로 집계하고 `DISCOVERY_MISS` 로 집계하지 «않는다».
 */
export class GoogleDiscoveryConfigError extends Error {
  readonly code = "CONFIG_MISSING" as const;
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`Google Discovery 미설정: ${missing.join(", ")}`);
    this.name = "GoogleDiscoveryConfigError";
    this.missing = missing;
  }
}

/** 🔴 Google API 자체가 실패한 것(4xx/5xx/네트워크)을 「못 찾았다」와 가른다. */
export class GoogleDiscoveryApiError extends Error {
  readonly code = "GOOGLE_API_FAILURE" as const;
  readonly status: number | null;
  constructor(status: number | null, detail: string) {
    super(`Google Discovery 호출 실패(${status ?? "network"}): ${detail}`);
    this.name = "GoogleDiscoveryApiError";
    this.status = status;
  }
}

/** 응답에서 이 provider 가 읽는 칸만. 나머지는 읽지 않는다. */
interface GeminiGroundingResponse {
  candidates?: {
    groundingMetadata?: {
      groundingChunks?: { web?: { uri?: string; title?: string } }[];
      groundingSupports?: { segment?: { text?: string }; groundingChunkIndices?: number[] }[];
    };
  }[];
}

/**
 * 🔴 프롬프트가 「판정」을 요구하지 않는다. 「이 상품을 판매하는 페이지를 찾아라」만
 *    말한다 — Google 에게 동일성 판단을 맡기면 우리 MI 와 역할이 겹친다(§7).
 * 🔴 모델이 무슨 문장을 쓰든 우리는 `groundingChunks` 의 URL 만 읽는다. 답변
 *    텍스트는 파싱하지 않는다 — 모델이 말을 바꿔도 결과가 흔들리지 않는다.
 */
function buildPrompt(identity: ProductIdentity, query: DiscoveryQuery): string {
  return [
    "다음 상품을 **판매하는 쇼핑몰 상품 페이지**를 최대한 많이 찾아 주세요.",
    "한국 쇼핑몰과 해외 쇼핑몰을 모두 포함해 주세요.",
    "",
    `검색어: ${query.text}`,
    identity.brand ? `브랜드: ${identity.brand}` : "",
    identity.productCode ? `품번: ${identity.productCode}` : "",
    "",
    "같은 상품인지 판단하지 마세요. 판매 페이지 주소만 찾아 주세요.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callGemini(prompt: string, apiKey: string, model: string): Promise<GeminiGroundingResponse> {
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 🔴 키는 헤더로만 보낸다 — URL 에 넣으면 로그·에러메시지에 남는다.
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    throw new GoogleDiscoveryApiError(null, error instanceof Error ? error.name : "unknown");
  }
  if (!response.ok) {
    // 🔴 본문을 그대로 메시지에 붙이지 않는다 — 응답에 요청이 echo 될 수 있다.
    throw new GoogleDiscoveryApiError(response.status, response.statusText || "non-ok");
  }
  try {
    return (await response.json()) as GeminiGroundingResponse;
  } catch {
    throw new GoogleDiscoveryApiError(response.status, "응답이 JSON 이 아니다");
  }
}

/** 🔴 `groundingChunks` 의 web.uri 만 읽는다. 모델 답변 텍스트는 보지 않는다. */
export function extractGroundingUrls(
  body: GeminiGroundingResponse,
  providerId: string,
  queryId: DiscoveryQuery["id"],
): DiscoveredUrl[] {
  const chunks = body.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const out: DiscoveredUrl[] = [];
  let rank = 0;
  for (const chunk of chunks) {
    const uri = chunk.web?.uri?.trim();
    if (!uri) continue;
    rank += 1;
    out.push({
      url: uri,
      providerId,
      queryId,
      rank,
      title: chunk.web?.title?.trim() || null,
      // 🔴 grounding 응답에는 후보별 snippet 이 없다 — 지어내지 않고 null 로 둔다.
      snippet: null,
      priceHint: null,
    });
  }
  return out;
}

export interface GoogleDiscoveryProvider extends DiscoveryProvider {
  readiness(): GoogleDiscoveryReadiness;
  /** 이 provider 가 실제로 보낸 Google 요청 수(비용 계측용). */
  requestCount(): number;
}

export function createGoogleDiscoveryProvider(options?: { model?: string }): GoogleDiscoveryProvider {
  let requests = 0;
  const providerId = "google-search-grounding";
  return {
    id: providerId,
    label: "Google AI(Search Grounding)",
    lane: "EXTERNAL",
    readiness: googleDiscoveryReadiness,
    requestCount: () => requests,
    async discover(identity, query) {
      const ready = googleDiscoveryReadiness();
      if (ready.state === "CONFIG_MISSING") throw new GoogleDiscoveryConfigError(ready.missing);
      const apiKey = process.env[GEMINI_API_KEY_ENV]!.trim();
      const model = options?.model ?? (process.env[GEMINI_MODEL_ENV]?.trim() || DEFAULT_MODEL);
      requests += 1;
      const body = await callGemini(buildPrompt(identity, query), apiKey, model);
      return extractGroundingUrls(body, providerId, query.id);
    },
  };
}
