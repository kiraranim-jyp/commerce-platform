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

/**
 * Grounding 을 지원하는 기본 모델.
 *
 * 🔴 **버전 번호를 박지 않는다.** 처음에 `gemini-2.5-flash` 를 박았다가 실측에서
 *    404 를 받았다 — 본문: "This model models/gemini-2.5-flash is no longer
 *    available to new users. Please update your code to use models/gemini-3.8-flash".
 *    Replay 38회가 전부 `API_OTHER_ERROR` 로 떨어졌고, 그 숫자를 「Google 이 못
 *    찾았다」로 읽을 수 있었다(§11 분류가 그것을 막았다).
 *
 * 🔴 그래서 **별칭** 을 쓴다. 실측(2026-10-07): `gemini-flash-latest` 200 ·
 *    groundingChunks 7건 · `gemini-3.8-flash` 도 200 · 7건. 별칭은 모델이
 *    은퇴해도 따라간다 — 버전 번호는 조용히 썩는다.
 * 🔴 그리고 이전 세션에서 적어 둔 「Gemini 2.5 = 1,500 RPD 무료」 비용 전제는
 *    **무효** 다. 그 모델을 쓸 수 없다.
 */
const DEFAULT_MODEL = "gemini-flash-latest";
const ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
/**
 * 🔴 20초로는 부족했다 — 실측(2026-10-07): 38회 중 **37회가 timeout** 이고 1회만
 *    성공했다. 원인은 thinking 토큰이다(성공 1건: thoughts 496 · total 1,234).
 *    grounding 은 검색까지 돌리므로 일반 generateContent 보다 오래 걸린다.
 * 🔴 「0 후보」로 뭉개지 않았기 때문에 이것이 timeout 이라는 것을 알 수 있었다
 *    (§11 분류). 분류가 없었다면 「Google 이 못 찾았다」로 보고됐을 것이다.
 */
const FETCH_TIMEOUT_MS = 90000;

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
  /** 🔴 비용 계측에만 쓴다 — 판정에 쓰지 않는다. 응답이 주는 값을 그대로 더한다. */
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
}

/**
 * MI-DISCOVERY-P5.4-C.2 §9 — **Google 비용을 추정하지 않고 응답에서 읽는다.**
 *
 * 🔴 `thoughtsTokenCount` 를 따로 센다. 실측(2026-10-07): prompt 515 ·
 *    candidates 641 인데 **thoughts 807** 이고 total 1,963 이다 — thinking 토큰이
 *    출력보다 많다. 「입력+출력」만 세면 원가를 절반 이하로 잘못 본다.
 */
export interface GoogleDiscoveryUsage {
  requests: number;
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
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
  /** 🔴 응답이 보고한 토큰 사용량 누적. 추정값이 아니다. */
  usage(): GoogleDiscoveryUsage;
  /** 실제로 쓴 모델 이름(기본값이 쓰였는지 확인용). */
  modelName(): string;
}

export function createGoogleDiscoveryProvider(options?: { model?: string }): GoogleDiscoveryProvider {
  const usage: GoogleDiscoveryUsage = { requests: 0, promptTokens: 0, candidatesTokens: 0, thoughtsTokens: 0, totalTokens: 0 };
  const providerId = "google-search-grounding";
  const resolveModel = () => options?.model ?? (process.env[GEMINI_MODEL_ENV]?.trim() || DEFAULT_MODEL);
  return {
    id: providerId,
    label: "Google AI(Search Grounding)",
    lane: "EXTERNAL",
    readiness: googleDiscoveryReadiness,
    requestCount: () => usage.requests,
    usage: () => ({ ...usage }),
    modelName: resolveModel,
    async discover(identity, query) {
      const ready = googleDiscoveryReadiness();
      if (ready.state === "CONFIG_MISSING") throw new GoogleDiscoveryConfigError(ready.missing);
      const apiKey = process.env[GEMINI_API_KEY_ENV]!.trim();
      usage.requests += 1;
      const body = await callGemini(buildPrompt(identity, query), apiKey, resolveModel());
      const u = body.usageMetadata;
      usage.promptTokens += u?.promptTokenCount ?? 0;
      usage.candidatesTokens += u?.candidatesTokenCount ?? 0;
      usage.thoughtsTokens += u?.thoughtsTokenCount ?? 0;
      usage.totalTokens += u?.totalTokenCount ?? 0;
      return extractGroundingUrls(body, providerId, query.id);
    },
  };
}
