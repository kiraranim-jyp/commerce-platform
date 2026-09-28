import { DEFAULT_KC_EXEMPTION_TEXT } from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * KC-COUPANG-02B — 과거 쿠팡 등록 증거를 **비교 결과로** 요약한다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 «하지 않는» 일이 이 파일의 정의다.
 *
 *   안 한다: payload/response 원문 노출. 한 칸도 그대로 내보내지 않는다.
 *   안 한다: 전화번호 등 연락처가 실린 고시 칸의 «값» 노출(아래 참고).
 *   안 한다: 상품명·가격·이미지 등 이 조사에 필요 없는 상품정보.
 *   안 한다: 「그래서 KC 문구가 필수다/아니다」라는 판정. 세는 것까지만 한다.
 *
 *   한다:   고시 칸의 내용을 «분류» 하고, 분류별로 쿠팡 응답을 대조한다.
 *
 * ── 🔴 왜 «값» 이 아니라 «분류» 인가 ───────────────────────────────────────
 * CPO 지시 원문: 「값 자체가 아니라 필요한 비교 결과 중심으로 보고합니다.」
 * 그리고 실제로 값을 그대로 내보내면 안 되는 칸이 있다 —
 *
 *     KNOWN_NOTICE_VALUES (build-payload.ts:1300~1304)
 *       "소비자상담 관련 전화번호"  → context.contactNumber
 *       "A/S 책임자와 전화번호"     → context.contactNumber
 *
 * 즉 고시 칸 중에는 **전화번호가 들어가는 칸**이 있다. 「고시 content 를 전부
 * 돌려준다」로 만들면 그 번호가 그대로 응답에 실린다. 그래서 값은 «KC 칸» 에
 * 대해서만, 그리고 분류로 설명되지 않을 때만(=OTHER) 잘라서 내보낸다.
 */

/**
 * 🔴 빌더의 `NOTICE_DEFAULT_CONTENT`(build-payload.ts:700)와 «같은 문자열» 이어야
 * 한다. 그쪽은 export 되어 있지 않고, 이 조사 때문에 Production 파일을 고치지
 * 않는다(CPO: 「기존 Production 등록 경로 변경 없음」). 대신 **테스트가 두 값이
 * 같은지 소스에서 직접 대조**한다 — 조용히 어긋나면 분류가 통째로 틀린다.
 */
export const NOTICE_DEFAULT_CONTENT_MIRROR = "전체 상품 상세페이지 참조";

/** 고시 칸 이름이 KC/인증 칸인가. 🔴 빌더의 `isComplianceCritical` 과 같은 규칙이다. */
const isKcFieldName = (name: string) => name.includes("인증") || name.includes("허가");

/** 연락처가 실리는 칸 — 값을 «절대» 내보내지 않는다. */
const isContactFieldName = (name: string) => /전화|연락처|휴대폰/.test(name);

/**
 * 고시 칸 내용의 분류. 🔴 값 대신 이것을 내보낸다.
 *
 *  KC_EXEMPTION_DEFAULT   "KC마크 없이 구매대행 가능한 품목"  (4dbd5eb 이후)
 *  DETAIL_PAGE_REFERENCE  "전체 상품 상세페이지 참조"          (4dbd5eb 이전 · 비KC 기본값)
 *  BLANK                  공백이거나 비어 있다                 (🔴 지금껏 생성된 적 없다고 본 경로)
 *  OTHER                  위 어느 것도 아니다                  (사람이 넣었거나 상품에서 왔다)
 */
export type NoticeContentClass =
  | "KC_EXEMPTION_DEFAULT"
  | "DETAIL_PAGE_REFERENCE"
  | "BLANK"
  | "OTHER";

export function classifyNoticeContent(content: unknown): NoticeContentClass {
  if (typeof content !== "string" || content.trim().length === 0) return "BLANK";
  if (content === DEFAULT_KC_EXEMPTION_TEXT) return "KC_EXEMPTION_DEFAULT";
  if (content === NOTICE_DEFAULT_CONTENT_MIRROR) return "DETAIL_PAGE_REFERENCE";
  return "OTHER";
}

/** `registration_attempts` 한 줄 중 «우리가 읽는» 부분. 나머지는 손대지 않는다. */
export interface AttemptRow {
  id: string;
  created_at: string;
  status: string;
  error_code: string | null;
  payload: unknown;
  response: unknown;
}

export interface KcFieldView {
  field: string;
  contentClass: NoticeContentClass;
  /** 🔴 `OTHER` 일 때만, 120자까지만. 분류로 설명되지 않는 것만 본다. */
  contentSample?: string;
}

export interface AttemptView {
  id: string;
  createdAt: string;
  status: string;
  errorCode: string | null;
  categoryCode: string | null;
  noticeCategoryName: string | null;
  /** 고시 칸이 «몇 개» 나갔는가. 값은 담지 않는다. */
  noticeFieldCount: number;
  /** 🔴 KC 칸이 하나도 없으면 빈 배열이다 — 그 자체가 답이다. */
  kcFields: KcFieldView[];
  /** 🔴 KC 가 아닌 칸 중 비어 있던 것의 «개수». 값은 담지 않는다. */
  blankNonKcFieldCount: number;
  /** 쿠팡이 뭐라고 했는가. 200자까지. */
  coupangMessage: string | null;
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const trimTo = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n)}…`);

/** payload 에서 고시 칸만 꺼낸다. 🔴 다른 칸은 읽지도 않는다. */
function noticesOf(payload: unknown): { name: string; content: unknown; category: string | null }[] {
  const items = asArray(asRecord(payload)?.items);
  const out: { name: string; content: unknown; category: string | null }[] = [];
  for (const item of items) {
    for (const n of asArray(asRecord(item)?.notices)) {
      const row = asRecord(n);
      if (!row) continue;
      out.push({
        name: String(row.noticeCategoryDetailName ?? ""),
        content: row.content,
        category: typeof row.noticeCategoryName === "string" ? row.noticeCategoryName : null,
      });
    }
  }
  return out;
}

export function toAttemptView(row: AttemptRow): AttemptView {
  const notices = noticesOf(row.payload);
  const kcFields: KcFieldView[] = [];
  let blankNonKcFieldCount = 0;

  for (const n of notices) {
    const contentClass = classifyNoticeContent(n.content);
    if (isKcFieldName(n.name)) {
      const view: KcFieldView = { field: n.name, contentClass };
      /* 🔴 분류로 설명되는 것은 값을 내보내지 않는다. 그리고 연락처 칸은
         이름이 KC 로 걸리더라도 «절대» 값을 싣지 않는다. */
      if (contentClass === "OTHER" && !isContactFieldName(n.name) && typeof n.content === "string") {
        view.contentSample = trimTo(n.content, 120);
      }
      kcFields.push(view);
    } else if (contentClass === "BLANK") {
      blankNonKcFieldCount += 1;
    }
  }

  const response = asRecord(row.response);
  const rawMessage = response?.message;

  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    errorCode: row.error_code,
    categoryCode: (() => {
      const code = asRecord(row.payload)?.displayCategoryCode;
      return code == null ? null : String(code);
    })(),
    noticeCategoryName: notices.find((n) => n.category)?.category ?? null,
    noticeFieldCount: notices.length,
    kcFields,
    blankNonKcFieldCount,
    coupangMessage: typeof rawMessage === "string" ? trimTo(rawMessage, 200) : null,
  };
}

export interface NoticeHistorySummary {
  totalAttempts: number;
  /** 🔴 KC 칸이 «실제로» 나간 시도 수. 0 이면 A/B 는 성립하지 않는다. */
  attemptsWithKcField: number;
  attemptsWithoutKcField: number;
  /** 분류 × 등록결과. 🔴 이 표가 CPO 판정표의 입력이다. */
  byClass: Record<NoticeContentClass, { total: number; submitted: number; failed: number; firstAt: string | null; lastAt: string | null }>;
  /** 고시/인증을 언급한 실패 건수. */
  failuresMentioningNotice: number;
  /** KC 아닌 칸이 빈 채 나간 시도 수. */
  attemptsWithBlankNonKcField: number;
}

const emptyBucket = () => ({ total: 0, submitted: 0, failed: 0, firstAt: null as string | null, lastAt: null as string | null });

export function summarize(views: AttemptView[]): NoticeHistorySummary {
  const byClass: NoticeHistorySummary["byClass"] = {
    KC_EXEMPTION_DEFAULT: emptyBucket(),
    DETAIL_PAGE_REFERENCE: emptyBucket(),
    BLANK: emptyBucket(),
    OTHER: emptyBucket(),
  };
  let attemptsWithKcField = 0;
  let failuresMentioningNotice = 0;
  let attemptsWithBlankNonKcField = 0;

  for (const v of views) {
    if (v.kcFields.length > 0) attemptsWithKcField += 1;
    if (v.blankNonKcFieldCount > 0) attemptsWithBlankNonKcField += 1;
    if (v.status === "FAILED" && v.coupangMessage && /고시|인증|허가/.test(v.coupangMessage)) {
      failuresMentioningNotice += 1;
    }
    /* 한 시도 안에서 같은 분류가 여러 번 나와도 «시도» 단위로 한 번만 센다 —
       칸 수로 세면 고시 칸이 많은 카테고리가 결과를 왜곡한다. */
    for (const cls of new Set(v.kcFields.map((f) => f.contentClass))) {
      const b = byClass[cls];
      b.total += 1;
      if (v.status === "SUBMITTED") b.submitted += 1;
      if (v.status === "FAILED") b.failed += 1;
      if (!b.firstAt || v.createdAt < b.firstAt) b.firstAt = v.createdAt;
      if (!b.lastAt || v.createdAt > b.lastAt) b.lastAt = v.createdAt;
    }
  }

  return {
    totalAttempts: views.length,
    attemptsWithKcField,
    attemptsWithoutKcField: views.length - attemptsWithKcField,
    byClass,
    failuresMentioningNotice,
    attemptsWithBlankNonKcField,
  };
}
