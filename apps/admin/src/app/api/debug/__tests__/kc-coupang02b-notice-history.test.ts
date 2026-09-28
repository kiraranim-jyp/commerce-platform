import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_KC_EXEMPTION_TEXT } from "@commerce/listing";
import {
  classifyNoticeContent,
  NOTICE_DEFAULT_CONTENT_MIRROR,
  summarize,
  toAttemptView,
  type AttemptRow,
} from "../coupang-notice-history/summarize";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * KC-COUPANG-02B — **이 통로가 «내보내지 않아야 할 것»을 내보내지 않는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 파일이 재는 것은 「요약이 예쁜가」가 아니라 —
 *
 *   ① 빌더의 상수와 분류 기준이 «어긋나지 않는가» (어긋나면 분류가 통째로 틀린다)
 *   ② 전화번호가 «새지 않는가»
 *   ③ payload/response 원문이 «새지 않는가»
 *   ④ 라우트에 쓰기가 «없는가»
 */

const DIR = join(__dirname, "..", "coupang-notice-history");
const ROUTE = readFileSync(join(DIR, "route.ts"), "utf8").replace(/\r\n/g, "\n");
const SUMMARIZE = readFileSync(join(DIR, "summarize.ts"), "utf8").replace(/\r\n/g, "\n");
/** 🔴 주석을 벗기고 본다 — 이 저장소에서 같은 함정에 여덟 번 걸렸다. */
const codeOf = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const BUILDER = readFileSync(
  join(__dirname, "..", "..", "..", "..", "..", "..", "..", "packages", "listing", "src", "coupang", "build-payload.ts"),
  "utf8",
);

const notice = (name: string, content: unknown) => ({
  noticeCategoryName: "기타 재화",
  noticeCategoryDetailName: name,
  content,
});

const row = (over: Partial<AttemptRow> & { notices?: unknown[] } = {}): AttemptRow => ({
  id: over.id ?? "a1",
  created_at: over.created_at ?? "2026-08-01T00:00:00Z",
  status: over.status ?? "SUBMITTED",
  error_code: over.error_code ?? null,
  payload: over.payload ?? { displayCategoryCode: 70346, items: [{ notices: over.notices ?? [] }] },
  response: over.response ?? null,
});

describe("🔴 ① 빌더 상수와 어긋나면 분류가 통째로 틀린다", () => {
  it("거울 상수가 빌더의 NOTICE_DEFAULT_CONTENT 와 «글자까지» 같다", () => {
    const m = BUILDER.match(/const NOTICE_DEFAULT_CONTENT = "([^"]+)";/);
    expect(m).not.toBeNull();
    expect(NOTICE_DEFAULT_CONTENT_MIRROR).toBe(m![1]);
  });

  it("KC 기본값은 빌더에서 «직접 import» 한다 — 두 벌로 두지 않는다", () => {
    expect(codeOf(SUMMARIZE)).toContain('import { DEFAULT_KC_EXEMPTION_TEXT } from "@commerce/listing"');
  });

  it("네 분류가 실제 값에 대해 맞다", () => {
    expect(classifyNoticeContent(DEFAULT_KC_EXEMPTION_TEXT)).toBe("KC_EXEMPTION_DEFAULT");
    expect(classifyNoticeContent(NOTICE_DEFAULT_CONTENT_MIRROR)).toBe("DETAIL_PAGE_REFERENCE");
    expect(classifyNoticeContent("KC 안전확인 제12-345호")).toBe("OTHER");
  });

  it.each([["빈 문자열", ""], ["공백만", "   "], ["없음", undefined], ["null", null]])(
    "%s 은 BLANK 다 — 🔴 공백을 「값 있음」으로 세지 않는다",
    (_l, v) => expect(classifyNoticeContent(v)).toBe("BLANK"),
  );
});

describe("🔴 ② 전화번호가 새지 않는다", () => {
  it("연락처 고시 칸은 값도 분류도 밖으로 나가지 않는다", () => {
    const v = toAttemptView(row({ notices: [notice("소비자상담 관련 전화번호", "010-1234-5678")] }));
    expect(JSON.stringify(v)).not.toContain("010-1234-5678");
    expect(v.kcFields).toHaveLength(0);
  });

  it("🔴 이름에 「인증」이 붙은 연락처 칸이어도 값을 싣지 않는다", () => {
    /* 억지스러워 보이지만 이름은 쿠팡이 정한다 — 우리가 고를 수 없다. */
    const v = toAttemptView(row({ notices: [notice("인증 담당자 전화번호", "010-9999-0000")] }));
    expect(v.kcFields).toHaveLength(1);
    expect(v.kcFields[0].contentSample).toBeUndefined();
    expect(JSON.stringify(v)).not.toContain("010-9999-0000");
  });

  it("분류로 설명되는 KC 값은 샘플을 싣지 않는다 — 필요 없는 노출을 만들지 않는다", () => {
    const v = toAttemptView(row({ notices: [notice("인증/허가 사항", DEFAULT_KC_EXEMPTION_TEXT)] }));
    expect(v.kcFields[0].contentClass).toBe("KC_EXEMPTION_DEFAULT");
    expect(v.kcFields[0].contentSample).toBeUndefined();
  });

  it("설명되지 않는 KC 값만 «잘라서» 싣는다", () => {
    const long = "가".repeat(300);
    const v = toAttemptView(row({ notices: [notice("인증/허가 사항", long)] }));
    expect(v.kcFields[0].contentSample!.length).toBeLessThanOrEqual(121);
  });
});

describe("🔴 ③ payload/response 원문이 새지 않는다", () => {
  it("고시가 아닌 payload 칸은 결과에 없다", () => {
    const v = toAttemptView(
      row({
        payload: {
          displayCategoryCode: 70346,
          sellerProductName: "Bobo Choses Swim Cap",
          returnAddress: "서울시 어딘가 123",
          vendorUserId: "secret-user",
          items: [{ notices: [notice("인증/허가 사항", DEFAULT_KC_EXEMPTION_TEXT)] }],
        },
      }),
    );
    const s = JSON.stringify(v);
    for (const leak of ["Bobo Choses Swim Cap", "서울시 어딘가 123", "secret-user"]) {
      expect(s).not.toContain(leak);
    }
    expect(v.categoryCode).toBe("70346");
  });

  it("response 는 message 만, 200자까지", () => {
    const v = toAttemptView(row({ response: { code: "ERROR", message: "나".repeat(400), data: { secret: 1 } } }));
    expect(v.coupangMessage!.length).toBeLessThanOrEqual(201);
    expect(JSON.stringify(v)).not.toContain("secret");
  });

  it("🔴 비KC 칸이 비어 있어도 «개수» 만 센다 — 값을 담지 않는다", () => {
    const v = toAttemptView(row({ notices: [notice("기타 추가 정보", "  "), notice("품명", "")] }));
    expect(v.blankNonKcFieldCount).toBe(2);
    expect(v.noticeFieldCount).toBe(2);
    expect(v.kcFields).toHaveLength(0);
  });
});

describe("④ 요약이 CPO 판정표의 입력을 만든다", () => {
  const views = [
    toAttemptView(row({ id: "a", created_at: "2026-07-30T00:00:00Z", status: "SUBMITTED", notices: [notice("인증/허가 사항", NOTICE_DEFAULT_CONTENT_MIRROR)] })),
    toAttemptView(row({ id: "b", created_at: "2026-08-10T00:00:00Z", status: "SUBMITTED", notices: [notice("인증/허가 사항", DEFAULT_KC_EXEMPTION_TEXT)] })),
    toAttemptView(row({ id: "c", created_at: "2026-08-11T00:00:00Z", status: "FAILED", error_code: "API005", response: { message: "고시정보 입력해야 합니다" }, notices: [notice("인증/허가 사항", DEFAULT_KC_EXEMPTION_TEXT)] })),
    toAttemptView(row({ id: "d", created_at: "2026-09-01T00:00:00Z", status: "SUBMITTED", notices: [notice("기타 추가 정보", NOTICE_DEFAULT_CONTENT_MIRROR)] })),
  ];
  const s = summarize(views);

  it("KC 칸이 «있는/없는» 시도를 가른다 — 0 이면 A/B 가 성립하지 않는다", () => {
    expect(s.attemptsWithKcField).toBe(3);
    expect(s.attemptsWithoutKcField).toBe(1);
  });

  it("두 문구를 결과별로 대조한다", () => {
    expect(s.byClass.DETAIL_PAGE_REFERENCE).toMatchObject({ total: 1, submitted: 1, failed: 0 });
    expect(s.byClass.KC_EXEMPTION_DEFAULT).toMatchObject({ total: 2, submitted: 1, failed: 1 });
  });

  it("고시를 언급한 실패를 센다", () => {
    expect(s.failuresMentioningNotice).toBe(1);
  });

  it("🔴 한 시도에 같은 분류가 여러 칸이어도 «시도 단위» 로 한 번만 센다", () => {
    const dup = toAttemptView(
      row({ notices: [notice("인증/허가 사항", DEFAULT_KC_EXEMPTION_TEXT), notice("인증 사항", DEFAULT_KC_EXEMPTION_TEXT)] }),
    );
    expect(summarize([dup]).byClass.KC_EXEMPTION_DEFAULT.total).toBe(1);
  });

  it("처음/마지막 시각을 남긴다 — 4dbd5eb 경계와 대조할 수 있어야 한다", () => {
    expect(s.byClass.DETAIL_PAGE_REFERENCE.firstAt).toBe("2026-07-30T00:00:00Z");
    expect(s.byClass.KC_EXEMPTION_DEFAULT.lastAt).toBe("2026-08-11T00:00:00Z");
  });
});

describe("🔴 ⑤ 라우트는 읽기 전용이고 fail-closed 다", () => {
  const code = codeOf(ROUTE);

  it("GET 말고는 핸들러가 없다", () => {
    expect(code).toContain("export async function GET");
    for (const verb of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(code).not.toMatch(new RegExp(`export\\s+(async\\s+)?function\\s+${verb}`));
    }
  });

  it("쓰기 쿼리가 한 줄도 없다", () => {
    for (const write of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc("]) {
      expect(code).not.toContain(write);
    }
  });

  it("쿠팡 시도만 읽는다", () => {
    expect(code).toContain('.eq("platform", "coupang")');
  });

  it('🔴 select("*") 를 쓰지 않는다 — 칸이 늘면 조용히 샌다', () => {
    expect(code).not.toContain('select("*")');
    expect(code).toContain('.select("id, created_at, status, error_code, payload, response")');
  });

  it("토큰 설정이 없으면 404, 토큰이 틀리면 401 — 둘 다 «열리지 않는다»", () => {
    expect(code).toContain("if (!expected) return \"NOT_CONFIGURED\"");
    expect(code).toContain('status: 404');
    expect(code).toContain('status: 401');
  });

  it("🔴 토큰을 코드에 적지 않는다", () => {
    expect(code).toContain("process.env.DEBUG_COUPANG_PROBE_TOKEN");
    expect(code).not.toMatch(/DEBUG_COUPANG_PROBE_TOKEN\s*=\s*["'][^"']+["']/);
  });

  it("🔴 service role 키를 직접 만지지 않는다 — 기존 구조만 쓴다", () => {
    expect(code).toContain("getSupabaseAdmin()");
    expect(code).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("응답에 payload/response 를 그대로 싣지 않는다", () => {
    expect(code).toContain("NextResponse.json({ summary: summarize(views), attempts: views })");
    expect(code).not.toMatch(/json\(\{[^}]*\bpayload\b/);
  });
});
