import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12 후속 — **연결이 «없어도» 이미 나가 있을 수 있다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * F-12 준비 중 발견한 구멍이다. 세 register 라우트는 중복을 `channel_products`
 * 하나로만 막고 있었다. 그런데 연결이 «없는데» 마켓에는 있는 상품이 실재한다:
 *
 *   ① 기존 381 snapshot — product_id 가 NULL 이라 연결을 «가질 수 없다».
 *      🔴 13713593585 가 바로 이 경우다(063 이전 등록).
 *   ② 연결 기록 유실 — 등록은 성공했는데 ChannelProduct insert 가 실패.
 *
 * 그 상태로 등록을 부르면 라우트가 「안 나가 있다」고 읽어 **CREATE 로
 * 내려간다** — 외부번호 6개가 만들어진 경로 그대로다.
 *
 * 🔴 화면(F-10 ATTEMPT_ONLY)은 이미 막고 있었다. 그러나 서버는 이력을 «읽지도
 * 않았다» — 마지막 방어선이 화면에만 있으면 그것은 방어선이 아니다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const HERE = __dirname;
const LIB = codeOnly(readFileSync(join(HERE, "../snapshots/_lib/attempts-summary.ts"), "utf8"));
const ROUTES = {
  smartstore: codeOnly(readFileSync(join(HERE, "../smartstore/register/route.ts"), "utf8")),
  coupang: codeOnly(readFileSync(join(HERE, "../coupang/register/route.ts"), "utf8")),
  lotteon: codeOnly(readFileSync(join(HERE, "../lotteon/register/route.ts"), "utf8")),
};

/**
 * 🔴 «이 함수 본문만» 잘라 본다.
 *
 * 파일 끝까지 자르면 뒤에 있는 `getAttemptsSummaryBySnapshot`(목록 화면용,
 * `.order()` 로 최신순 정렬한다)까지 딸려 들어와 검사가 엉뚱한 곳을 본다 —
 * 이 세션에서 같은 실수를 세 번째로 했다. 경계를 «이름으로» 박는다.
 */
function priorSuccessFn(): string {
  const start = LIB.indexOf("export async function hasPriorSuccessfulAttempt");
  const end = LIB.indexOf("export async function getAttemptsSummaryBySnapshot");
  expect(start, "hasPriorSuccessfulAttempt 를 찾지 못했다").toBeGreaterThan(-1);
  expect(end, "경계로 쓸 다음 함수를 찾지 못했다").toBeGreaterThan(start);
  return LIB.slice(start, end);
}

describe("① 🔴 세 채널 «전부» 이 빗장을 단다", () => {
  it.each(Object.entries(ROUTES))("%s", (_name, src) => {
    /* 한 채널만 빠뜨리는 것이 이 스프린트의 반복된 실수다 — 전수로 고정한다. */
    expect(src).toContain("await hasPriorSuccessfulAttempt(");
  });

  it.each(["smartstore", "coupang"] as const)("%s — 채널 이름을 «자기 것» 으로 넘긴다", (channel) => {
    /* 복붙하면서 채널 문자열만 안 고치면, 쿠팡이 스마트스토어 이력을 보고
       막거나 그 반대가 된다 — 조용히 틀리는 종류의 버그다. */
    expect(ROUTES[channel]).toContain(`hasPriorSuccessfulAttempt(snapshotId, "${channel}")`);
  });

  it("lotteon — 상수로 넘긴다", () => {
    expect(ROUTES.lotteon).toContain("hasPriorSuccessfulAttempt(snapshotId, LOTTEON_PLATFORM_KEY)");
  });
});

describe("② 🔴 빗장이 «CREATE 호출 앞» 이다", () => {
  it("smartstore — POST /v2/products 앞", () => {
    const iGuard = ROUTES.smartstore.indexOf("await hasPriorSuccessfulAttempt(");
    const iCreate = ROUTES.smartstore.indexOf("path: CREATE_PRODUCT_PATH");
    expect(iGuard).toBeGreaterThan(-1);
    expect(iGuard).toBeLessThan(iCreate);
  });

  it("coupang — POST seller-products 앞", () => {
    const iGuard = ROUTES.coupang.indexOf("await hasPriorSuccessfulAttempt(");
    const iCreate = ROUTES.coupang.indexOf("path: CREATE_PRODUCT_PATH");
    expect(iGuard).toBeGreaterThan(-1);
    expect(iGuard).toBeLessThan(iCreate);
  });

  it("lotteon — 87 상품등록 앞", () => {
    const iGuard = ROUTES.lotteon.indexOf("await hasPriorSuccessfulAttempt(");
    const iCreate = ROUTES.lotteon.indexOf("LOTTEON_WRITE_PATHS.productRegistration");
    expect(iGuard).toBeGreaterThan(-1);
    expect(iGuard).toBeLessThan(iCreate);
  });
});

describe("③ 🔴 확인하지 «못한» 경우도 막는다", () => {
  /* 🔴 「true·null 은 막고 false 만 지나간다」는 판정 자체는 F-12a 에서
     resolveCreateGate() 한 곳으로 옮겼고, 표로 검증한다
     (p0channel03-f12a-create-gate.test.ts). 여기서 소스 문자열로 또 보면
     판정이 두 곳에서 검사되고, 리팩터 때 한쪽만 고쳐져 조용히 약해진다.
     이 파일은 «이력을 읽는 쪽»(lib)의 계약만 지킨다. */

  it("조회 실패를 「성공한 적 없다」로 내려보내지 않는다", () => {
    const fn = priorSuccessFn();
    expect(fn).toContain("return null;");
    /* 🔴 error 분기에서 false 를 내면 그것이 바로 위험한 쪽이다. */
    const errorBranch = fn.slice(fn.indexOf("if (error) {"), fn.indexOf("return (data?.length"));
    expect(errorBranch).toContain("return null;");
    expect(errorBranch).not.toContain("return false;");
  });

  it("🔴 「마지막 시도」가 아니라 «한 번이라도 성공» 을 본다", () => {
    const fn = priorSuccessFn();
    expect(fn).toContain('.eq("status", "SUBMITTED")');
    /* 최신 한 건만 보면 「성공 뒤 실패」가 「미등록」으로 읽힌다 —
       상품은 이미 마켓에 있는데. 정렬해서 첫 행을 보는 방식이 아니어야 한다. */
    expect(fn).not.toContain('.order(');
  });
});

describe("④ 🔴 RECREATE 면 이력을 «조회하지도» 않는다", () => {
  it.each(["smartstore", "coupang"] as const)("%s — 막지 않을 것을 확인하려고 DB 를 때리지 않는다", (channel) => {
    /* RECREATE 는 게이트를 지나가는 것이 이미 정해져 있다. 그런데도 이력을
       읽으면 쓸데없는 쿼리가 매번 나가고, 그 쿼리가 실패하면 «지나갈 것» 이
       막힐 수도 있다(null 이 막는 쪽이므로). 아예 묻지 않는다. */
    expect(ROUTES[channel]).toContain(
      'plannedOperation === "RECREATE" ? false : await hasPriorSuccessfulAttempt(',
    );
  });
});

describe("⑤ 🔴 막은 것을 «했다» 고 적지 않는다", () => {
  it.each(Object.entries(ROUTES))("%s — 차단 응답에 operation 을 싣지 않는다", (_name, src) => {
    const guardStart = src.indexOf("await hasPriorSuccessfulAttempt(");
    const guardEnd = src.indexOf("}", src.indexOf("return NextResponse.json", guardStart));
    const guard = src.slice(guardStart, guardEnd);
    /* lifecycle 인자는 객체 리터럴로 넘어간다 — 그 형태가 없어야 한다. */
    expect(/logRegistrationAttempt\([^;]*\{/.test(guard)).toBe(false);
  });
});

describe("⑥ 상태의 근거는 여전히 ChannelProduct 다", () => {
  it("🔴 이력은 «막는 쪽으로만» 쓰인다 — 등록됨을 «만들지» 않는다", () => {
    /* hasPriorSuccessfulAttempt 의 결과가 existing/plannedOperation 을 바꾸는
       데 쓰이면 이력이 상태가 된다. 오직 차단 분기에서만 읽혀야 한다. */
    for (const src of Object.values(ROUTES)) {
      expect(src).not.toContain("existing = priorSuccess");
      expect(src).not.toContain("plannedOperation = priorSuccess");
    }
  });

  it("공통 저장소는 여전히 이력을 건드리지 않는다", () => {
    const store = codeOnly(readFileSync(join(HERE, "../_lib/channel-product.ts"), "utf8"));
    expect(store).not.toContain("registration_attempts");
  });
});
