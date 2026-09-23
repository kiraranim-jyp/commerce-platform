import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { latestAttemptByPlatform, type LastAttemptRow } from "../../../api/snapshots/_lib/attempts-summary";
import { registrationNote } from "../CommerceSelector";
import { LOTTEON_COMMERCE_ID } from "../commerce-registry";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-06-B(CPO 승인, 2026-09-23) — **Master 가 「이 상품이 어디에 올라가 있나」를 안다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * N-06-A 조사 결과가 이 작업의 근거다: 등록 사실을 기억하는 곳은
 * `registration_attempts` 하나뿐이고, 화면 state 넷은 전부 세션 한정이라
 * 새로고침하면 방금 등록한 상품도 「미등록」으로 보였다.
 *
 * 🔴 새 테이블도 새 컬럼도 만들지 않았다. 이미 쌓여 있는 이력을 읽는 경로
 * 하나를 냈을 뿐이다.
 */

const row = (over: Partial<LastAttemptRow> & { platform: string; created_at: string }): LastAttemptRow => ({
  snapshot_id: "s1",
  status: "SUBMITTED",
  external_product_id: null,
  error_code: null,
  ...over,
});

describe("① 채널별 «마지막 시도» 를 고른다", () => {
  /* 🔴 정렬 전제: created_at 내림차순. 기존 aggregateAttemptRows 와 같은 규칙이다. */
  const rows: LastAttemptRow[] = [
    row({ platform: "coupang", created_at: "2026-09-22T05:32:00Z", status: "FAILED", error_code: "CP001" }),
    row({ platform: "coupang", created_at: "2026-09-22T03:32:00Z", external_product_id: "1234" }),
    row({ platform: "smartstore", created_at: "2026-09-21T10:00:00Z", external_product_id: "13664004406" }),
  ];

  it("채널마다 가장 최근 한 건만 남는다", () => {
    const last = latestAttemptByPlatform(rows);
    expect(Object.keys(last).sort()).toEqual(["coupang", "smartstore"]);
    expect(last.coupang.status).toBe("FAILED");
    expect(last.coupang.errorCode).toBe("CP001");
    expect(last.smartstore.externalProductId).toBe("13664004406");
  });

  it("🔴 이력이 없는 채널은 키 자체가 «없다» — 없는 사실을 만들지 않는다", () => {
    expect(latestAttemptByPlatform(rows)[LOTTEON_COMMERCE_ID]).toBeUndefined();
    expect(latestAttemptByPlatform([])).toEqual({});
  });

  it("🔴 롯데ON 도 그대로 집계된다 — DB 의 platform 은 처음부터 채널 중립이다", () => {
    const last = latestAttemptByPlatform([
      row({ platform: LOTTEON_COMMERCE_ID, created_at: "2026-09-22T07:50:00Z", status: "FAILED" }),
    ]);
    expect(last[LOTTEON_COMMERCE_ID].status).toBe("FAILED");
  });
});

describe("② 화면 문구 — 선택과 등록은 «다른 축» 이다", () => {
  it("이력이 없으면 미등록이라고만 말한다", () => {
    expect(registrationNote(undefined)).toBe("○ 미등록");
  });

  it("성공은 시각과 상품번호까지 적는다", () => {
    const note = registrationNote({
      status: "SUBMITTED",
      at: "2026-09-22T05:32:00Z",
      externalProductId: "13664004406",
      errorCode: null,
    });
    expect(note).toContain("✓ 등록됨");
    expect(note).toContain("상품번호 13664004406");
    expect(note).toMatch(/2026-09-22 \d{2}:\d{2}/);
  });

  it("상품번호가 없으면 «지어내지 않는다»", () => {
    const note = registrationNote({ status: "SUBMITTED", at: "2026-09-22T05:32:00Z", externalProductId: null, errorCode: null });
    expect(note).toContain("✓ 등록됨");
    expect(note).not.toContain("상품번호");
  });

  it("실패는 마지막 실패라고 말하고 사유를 적는다", () => {
    const note = registrationNote({ status: "FAILED", at: "2026-09-22T07:50:00Z", externalProductId: null, errorCode: "CP001" });
    expect(note).toContain("✕ 최근 등록 실패");
    expect(note).toContain("CP001");
  });
});

/** 주석을 걷어낸 «실행되는 코드» 만. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const WORKSPACE = codeOnly(readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8"));
const ROUTE = codeOnly(
  readFileSync(join(__dirname, "../../../api/snapshots/[id]/attempts/route.ts"), "utf8"),
);

describe("③ 🔴 롯데ON 은 «부를 때만» 확인한다 (CPO 확정 ㉯)", () => {
  it("선택되지 않았으면 preview 를 부르지 않는다 — 코드가 먼저 선택을 확인한다", () => {
    const fn = WORKSPACE.slice(
      WORKSPACE.indexOf("async function checkSelectedReadiness()"),
      WORKSPACE.indexOf("const [multiConfirmOpen"),
    );
    expect(fn).toContain("if (!selectedCommerces.includes(LOTTEON_COMMERCE_ID)) return;");
    // 그 검사가 fetch «앞» 에 있다.
    expect(fn.indexOf("selectedCommerces.includes(LOTTEON_COMMERCE_ID)")).toBeLessThan(
      fn.indexOf("/api/lotteon/payload-preview"),
    );
  });

  it("🔴 화면을 열자마자 도는 자동 호출이 없다", () => {
    // payload-preview 를 부르는 곳은 이 함수 하나뿐이다(효과/타이머에서 부르지 않는다).
    const calls = WORKSPACE.match(/\/api\/lotteon\/payload-preview/g) ?? [];
    expect(calls).toHaveLength(1);
  });

  it("[등록 준비 확인] 이 그 함수를 부른다", () => {
    expect(WORKSPACE).toContain("void checkSelectedReadiness();");
  });

  it("🔴 판정을 새로 만들지 않는다 — 롯데ON 탭이 쓰는 그 함수를 그대로 쓴다", () => {
    expect(WORKSPACE).toContain("computeLotteOnRegistrationReadiness(validation)");
    expect(WORKSPACE).toContain("buildLotteOnMissingInfo(validation).length");
  });
});

describe("④ 이력 조회 경로", () => {
  it("🔴 소유권을 먼저 확인한다 — 남의 상품번호를 id 만으로 읽을 수 없다", () => {
    expect(ROUTE).toContain("const auth = await requireUser();");
    expect(ROUTE).toContain("getSnapshotRaw(id, auth.user.workspaceId)");
    expect(ROUTE.indexOf("getSnapshotRaw")).toBeLessThan(ROUTE.indexOf("registration_attempts"));
    // 남의 것이면 403 이 아니라 404 — 존재 확인 도구가 되지 않게.
    expect(ROUTE).toContain("status: 404");
  });

  it("🔴 조회 실패를 «이력 없음» 으로 내려보내지 않는다", () => {
    expect(ROUTE).toContain("status: 503");
  });

  it("새 저장소를 만들지 않았다 — 기존 테이블만 읽는다", () => {
    expect(ROUTE).toContain('.from("registration_attempts")');
    for (const forbidden of ["insert(", "update(", "delete(", "upsert("]) {
      expect(ROUTE, `읽기 전용이어야 한다: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("등록이 끝나면 이력을 다시 읽는다(단독 · 롯데ON 공통)", () => {
    const calls = WORKSPACE.match(/void refreshAttempts\(\);/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("⑤ 저장 구조는 그대로다", () => {
  it("snapshot workspace 타입에 새 칸을 만들지 않았다", () => {
    const types = readFileSync(join(__dirname, "../../../api/snapshots/_lib/types.ts"), "utf8");
    for (const forbidden of ["lastAttempts", "registrationStatus", "commerceStatus"]) {
      expect(types).not.toContain(forbidden);
    }
  });

  it("선택 상태는 여전히 저장하지 않는다(CPO 확정 ㉮)", () => {
    const page = readFileSync(join(__dirname, "../../page.tsx"), "utf8");
    expect(page).not.toContain("selectedCommerces");
  });
});
