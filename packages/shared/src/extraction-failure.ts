import { ERROR_CODE_INFO, type ErrorCode } from "./error-codes";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MARKET-RESEARCH-ERROR-UX-01 — **외부 사이트 장애를 셀러의 말로 바꾼다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 실측(2026-10-04): Zalando 상품 URL 분석에서 화면에 이것이 그대로 떴다.
 *
 *     page.goto: Timeout 30000ms exceeded.
 *     Call log: navigating to "https://...", waiting until "domcontentloaded"
 *
 * 🔴 셀러는 `page.goto` 가 무엇인지 모른다. 그리고 이 메시지는 **거짓말까지**
 * 한다 — 「상품 페이지에 접근할 수 없습니다(재시도 불가)」로 분류되는데
 * (classifyPipelineError 가 timeout 을 몰라서 EXT001 로 떨군다), 실제로는
 * **다시 시도하면 되는 일** 이다.
 *
 * ── 🔴 무엇을 «가르는가» (CEO 지시 6) ────────────────────────────────────
 *     TIMEOUT        외부 사이트가 제때 응답하지 않았다 → 재시도하면 된다
 *     BLOCKED        접근이 차단됐다(403/401/robots) → 재시도해도 같다
 *     PARSE_FAILED   페이지는 열렸는데 상품정보를 못 읽었다 → 사이트 구조 문제
 *     UNKNOWN        위 어느 것으로도 확정할 수 없다 → 아는 척하지 않는다
 *
 * 🔴 셋을 하나의 「분석 실패」로 뭉개지 않는다. 셀러가 해야 할 일이 각각 다르다:
 * 재시도 / 포기하고 다른 상품 / 우리에게 알림.
 *
 * ── 🔴 새 시스템을 만들지 «않았다» ───────────────────────────────────────
 * 기존 `ErrorCode` 표를 그대로 쓴다. 추가한 것은 timeout 전용 코드 하나
 * (`EXT005`, `autoRetryable: true`)뿐이다 — 기존 EXT001~004 는 전부
 * `autoRetryable: false` 라서 timeout 을 담을 칸이 없었다.
 *
 * ── 🔴 timeout 값을 늘리지 «않았다» (CEO 지시 2·8) ──────────────────────
 * `universal-extractor` 는 이미 2단으로 시도한다: `networkidle` → 실패하면
 * `domcontentloaded`. CEO 가 본 메시지가 «두 번째» 것이므로 Zalando 는 30초
 * 안에 DOM 조차 못 줬다. 초를 늘리는 것은 그 사실을 바꾸지 않고 셀러를 60초
 * 더 기다리게 할 뿐이다. 그래서 **분류와 문구만** 고친다.
 */
export type ExtractionFailureKind = "TIMEOUT" | "BLOCKED" | "PARSE_FAILED" | "UNKNOWN";

export interface ExtractionFailure {
  kind: ExtractionFailureKind;
  /** 기존 표의 코드. 화면이 문의하기/보고서에 그대로 쓴다. */
  code: ErrorCode;
  /** 셀러가 읽는 한 줄. 🔴 raw 메시지를 넣지 않는다. */
  message: string;
  /** 다음에 무엇을 하면 되는가. */
  resolution: string;
  /** 「다시 시도」 버튼을 보여도 되는가. */
  retryable: boolean;
  /** 어느 사이트였는가 — URL 전체가 아니라 호스트만. */
  siteName: string | null;
}

/**
 * URL 에서 사람이 읽는 사이트 이름. 🔴 전체 URL 을 화면에 뿌리지 않는다 —
 * 쿼리스트링에 식별자가 섞여 있을 수 있고, 셀러에게 필요한 것은 「어느
 * 사이트인가」뿐이다.
 */
export function siteNameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/* 🔴 Playwright/네트워크 문구를 «패턴으로» 본다. 특정 버전 메시지에 묶으면
   라이브러리가 문구를 바꿀 때 조용히 UNKNOWN 으로 떨어진다. */
const TIMEOUT_PATTERNS = [
  "timeout",
  "timed out",
  "etimedout",
  "navigation timeout",
  "exceeded while waiting",
];
const BLOCKED_PATTERNS = [
  "403",
  "401",
  "forbidden",
  "unauthorized",
  "access denied",
  "robots",
  "blocked",
  "captcha",
  "err_connection_refused",
  "econnrefused",
];
const PARSE_PATTERNS = ["상품명을 찾을 수 없", "가격 정보를 찾을 수 없", "지원하지 않는 사이트"];

/**
 * 원본 오류 메시지를 보고 네 종류로 가른다.
 *
 * 🔴 **판단하지 못하면 UNKNOWN 이다.** 「아마 timeout 이겠지」로 몰아넣지 않는다 —
 * 그 순간 차단된 사이트를 셀러가 계속 재시도하게 만든다.
 */
export function classifyExtractionFailure(rawMessage: string, url?: string | null): ExtractionFailure {
  const lower = (rawMessage ?? "").toLowerCase();
  const siteName = siteNameFromUrl(url);
  const site = siteName ?? "해당 사이트";

  /* 🔴 차단을 «먼저» 본다. 차단된 요청이 느리게 끝나면서 timeout 문구가 함께
     붙는 경우가 있는데, 그때 재시도를 권하면 셀러가 같은 벽을 반복해 두드린다. */
  if (BLOCKED_PATTERNS.some((p) => lower.includes(p))) {
    return {
      kind: "BLOCKED",
      code: "EXT001",
      message: `${site} 가 접근을 거부했습니다.`,
      resolution: "이 사이트는 자동 분석을 막고 있습니다. 다른 상품을 시도하거나 저희에게 알려 주세요.",
      retryable: false,
      siteName,
    };
  }

  if (TIMEOUT_PATTERNS.some((p) => lower.includes(p))) {
    return {
      kind: "TIMEOUT",
      code: "EXT005",
      message: `${site} 접속 시간이 초과됐습니다.`,
      resolution: "사이트 응답이 늦어 분석을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      retryable: true,
      siteName,
    };
  }

  if (PARSE_PATTERNS.some((p) => rawMessage?.includes(p))) {
    return {
      kind: "PARSE_FAILED",
      code: "EXT004",
      message: `${site} 페이지에서 상품 정보를 읽지 못했습니다.`,
      resolution: "페이지는 열렸지만 필요한 항목을 찾지 못했습니다. 다른 상품 URL 을 시도해 주세요.",
      retryable: false,
      siteName,
    };
  }

  /* 🔴 모르면 모른다고 한다. 기존 표의 기본 문구를 쓰고 raw 를 넣지 않는다. */
  return {
    kind: "UNKNOWN",
    code: "EXT001",
    message: ERROR_CODE_INFO.EXT001.defaultMessage,
    resolution: "잠시 후 다시 시도해 주세요. 계속되면 저희에게 알려 주세요.",
    retryable: false,
    siteName,
  };
}

/**
 * 🔴 raw 기술 문구가 섞여 있는가 — 화면에 내보내기 «전» 에 거르는 자리.
 * 테스트가 이 함수로 「노출되지 않았다」를 재고, 화면 코드도 필요하면 쓴다.
 */
export function containsRawTechnicalDetail(text: string): boolean {
  const needles = [
    "page.goto",
    "Call log",
    "navigating to",
    "waitUntil",
    "domcontentloaded",
    "networkidle",
    "playwright",
    "at Object.",
    "node_modules",
  ];
  const lower = text.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}
