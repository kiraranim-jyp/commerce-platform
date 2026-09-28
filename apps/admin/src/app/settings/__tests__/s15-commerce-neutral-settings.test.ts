import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 장기 스프린트 S-15 — **설정 화면은 Commerce 이름을 «박지» 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 실화면에서 나온 것들이다.
 *
 *     「쿠팡/스마트스토어 판매에 필요한 정보를 관리합니다」  ← 롯데ON 이 빠졌다
 *     「✓ 쿠팡 등록에 필요한 설정이 모두 준비되어 있습니다」 ← 쿠팡 특정
 *     [플랫폼 지원 현황] 탭                                ← 고정 목록
 *     [커머스 계정 관리] 안의 «배송 정보» 블록              ← 계정은 연결만
 *
 * 🔴 Commerce 를 20~30개 이상으로 늘리는 것이 목표다. 문구에 채널 이름을 박으면
 * 채널이 하나 늘 때마다 문장을 고쳐야 하고, 지금도 롯데ON 이 빠져 있어 그
 * 문장들은 **이미 사실이 아니었다**.
 */

const SETTINGS = readFileSync(join(__dirname, "..", "page.tsx"), "utf8").replace(/\r\n/g, "\n");
const LOTTEON_BLOCK = readFileSync(join(__dirname, "..", "LotteOnSellerFixedSettings.tsx"), "utf8").replace(
  /\r\n/g,
  "\n",
);

/** 주석은 «왜 지웠는지» 를 설명하느라 옛 문구를 그대로 인용한다 — 코드만 본다. */
const code = (source: string) =>
  source.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("① 안내 문구에 Commerce 이름이 없다", () => {
  it("부제가 채널을 열거하지 않는다", () => {
    expect(code(SETTINGS)).not.toContain("쿠팡/스마트스토어 판매에 필요한");
    expect(SETTINGS).toContain("상품 판매에 필요한 공통 정보를 관리합니다.");
  });

  /* ══ P0-a(CPO 승인, 2026-09-28) — 이 배너의 «주어» 를 박았다 ════════════════
     S-15 가 지킨 것은 「Commerce 이름을 문구에 박지 않는다」였고 그것은 그대로다.
     그런데 문구가 「상품 등록에 필요한 설정이 모두 준비되어 있습니다」여서
     «주어가 없었다» — 이 배너가 재는 것은 «판매자 설정» 이고, 상품 화면 우측의
     「등록 준비 상태」가 재는 것은 «그 상품의 필수 필드» 다.

     주어가 다른데 둘 다 「준비」라고 말해서, 설정을 끝낸 셀러가 상품 화면에서
     막히면 「준비됐다는데 왜 등록을 못 하지」가 된다(CEO 실화면).
     🔴 S-15 때도 이 문장이 롯데ON 을 빼놓고 「모두」라 해서 «사실이 아니었다» —
     같은 자리에서 두 번째다. */
  it("준비 배너가 «판매자 설정» 을 잰다고 말한다 — Commerce 이름은 여전히 없다", () => {
    expect(code(SETTINGS)).not.toContain("쿠팡 등록에 필요한 설정이");
    /* 🔴 「상품 등록에 필요한 설정」이라는 주어 없는 문장을 쓰지 않는다. */
    expect(code(SETTINGS)).not.toContain("상품 등록에 필요한 설정이 모두 준비되어 있습니다.");
    expect(SETTINGS).toContain("판매자 설정이 준비되었습니다");
    /* 상품별 준비 상태는 «다른 화면» 이라고 그 자리에서 말한다. */
    expect(SETTINGS).toContain("상품별 등록 준비 상태는 각 커머스 탭에서 확인합니다");
  });
});

describe("② [플랫폼 지원 현황] 탭이 «셀러 화면» 에 없다", () => {
  it("탭 목록에 없다", () => {
    expect(code(SETTINGS)).not.toContain('label: "플랫폼 지원 현황"');
  });

  it("탭 키에도 없다 — 죽은 분기를 남기지 않았다", () => {
    expect(code(SETTINGS)).not.toContain('"platformStatus"');
  });

  /* 🔴 컴포넌트까지 지우지는 않았다. 개발자용으로 다시 쓸 수 있고, 지우면
     되살릴 때 다시 만들어야 한다 — 없앤 것은 «셀러 화면의 탭» 하나다. */
  it("컴포넌트 자체는 남아 있다", () => {
    expect(SETTINGS).toContain("function PlatformStatusSection");
  });
});

describe("③ 🔴 [커머스 계정 관리] 는 «연결» 만 다룬다", () => {
  it("계정 카드 안에 「배송 정보」 제목이 없다", () => {
    expect(code(LOTTEON_BLOCK)).not.toContain(">배송 정보<");
  });

  /* 길은 남긴다 — 없애 버리면 셀러가 배송 설정을 어디서 하는지 모른다. */
  it("배송 프로필로 가는 길은 남아 있다", () => {
    expect(LOTTEON_BLOCK).toContain("배송 프로필 관리");
    expect(LOTTEON_BLOCK).toContain("onGoToShippingProfile");
  });

  /* C-2 때 「아직 저장되지 않습니다 · 상품마다 선택합니다」로 적어 둔 문장은
     067 과 S-8/9 로 사실이 바뀌었다 — 옛 사실을 화면에 남기지 않는다. */
  it("「상품마다 선택합니다」가 남아 있지 않다", () => {
    expect(code(LOTTEON_BLOCK)).not.toContain("상품마다 선택합니다");
  });
});
