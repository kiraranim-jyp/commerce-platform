import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 C-1c — **범위 격리 다음은 «접근 차단» 이다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * C-1b 가 seller_settings 를 workspace 범위로 묶었다. 그런데 세 라우트가 인증
 * 없이 그 값을 읽고 실제 등록과 «같은» payload 를 만들고 있었다 —
 * 그 상태로 C-2 가 배송 기본값을 저장하기 시작하면, 저장한 값이 곧바로
 * 인증 없이 읽히는 길이 된다.
 *
 * 🔴 새 인증을 만들지 않았다. register 라우트가 이미 쓰는 가드 하나를 옮겨 쓴다.
 */

const API = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(API, rel), "utf8");

const GUARDED = [
  ["쿠팡 미리보기", "coupang/payload-preview/route.ts"],
  ["롯데ON 미리보기", "lotteon/payload-preview/route.ts"],
  ["등록 QA 배치", "admin/registration-qa-batch/route.ts"],
] as const;

describe("① 세 라우트가 기존 가드를 쓴다", () => {
  it.each(GUARDED)("%s 에 requireRegistrationAccess 가 있다", (_label, rel) => {
    const source = read(rel);
    expect(source).toContain('from "@/lib/auth/require-registration-access"');
    expect(source).toContain("const access = await requireRegistrationAccess(null);");
    expect(source).toContain("if (!access.ok) return access.response;");
  });

  /* 🔴 새 401/403 응답을 «설계하지» 않았다 — 가드가 만든 응답을 그대로 돌려준다. */
  it.each(GUARDED)("%s 이 자체 401/403 을 만들지 않는다", (_label, rel) => {
    const source = read(rel);
    expect(source).not.toMatch(/status:\s*401/);
    expect(source).not.toMatch(/status:\s*403/);
  });
});

describe("② 가드가 «자격증명·설정을 읽기 전» 에 선다", () => {
  it.each(GUARDED)("%s — access 검사가 loadSellerSettings 보다 앞이다", (_label, rel) => {
    const source = read(rel);
    const guard = source.indexOf("const access = await requireRegistrationAccess(null);");
    /* 🔴 «호출» 만 본다. 주석에도 이름이 나오므로 `loadSellerSettings(` 로 찾으면
       내가 쓴 설명문을 먼저 잡는다(처음에 그렇게 짜서 헛되이 실패했다). */
    const settings = source.indexOf("await loadSellerSettings(");
    expect(guard).toBeGreaterThan(-1);
    /* QA 배치·미리보기 모두 안에서 판매자 설정을 읽는다. 순서가 뒤집히면
       「막기 전에 이미 읽은」 상태가 된다. */
    if (settings > -1) expect(guard).toBeLessThan(settings);
  });

  it("롯데ON 미리보기 — 가드가 buildLotteOnContext(207 identity) 보다 앞이다", () => {
    const source = read("lotteon/payload-preview/route.ts");
    expect(source.indexOf("const access = await requireRegistrationAccess(null);")).toBeLessThan(
      source.indexOf("await buildLotteOnContext("),
    );
  });
});

describe("③ 기존 등록 라우트의 가드는 그대로다", () => {
  it.each([
    ["쿠팡 등록", "coupang/register/route.ts"],
    ["롯데ON 등록", "lotteon/register/route.ts"],
  ] as const)("%s 는 snapshotId 로 소유권까지 본다", (_label, rel) => {
    const source = read(rel);
    expect(source).toContain("requireRegistrationAccess(snapshotId)");
  });
});

describe("④ C-1b 계약을 깨지 않았다", () => {
  const LIB = readFileSync(join(API, "..", "..", "lib", "seller-settings.ts"), "utf8");

  it("라이브러리는 여전히 «범위» 만 정한다 — 차단은 라우트의 일이다", () => {
    const fn = LIB.slice(LIB.indexOf("async function resolveCurrentWorkspaceId"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    expect(body).not.toContain("NextResponse");
    expect(body).not.toContain("throw");
  });

  it("DB 오류는 레거시로 흐르지 않는다", () => {
    expect(LIB).toContain('if (mine.status !== "NOT_FOUND") return mine;');
  });

  it("🔴 레거시 행을 지우거나 backfill 하지 않는다", () => {
    expect(LIB).not.toContain(".delete()");
  });
});
