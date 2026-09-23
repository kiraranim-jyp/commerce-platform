import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TTAEJYO-PIVOT-03 0-4+2-B — 화면도 canonical 을 본다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 ────────────────────────────────────────────────────────────────────
 * 서버 경로(등록·미리보기·게이트)는 Phase 1 에서 전부 seller_settings 로
 * 옮겼는데 화면 세 곳은 아직 `/api/settings/coupang/profiles` 에서 판매자 칸을
 * 꺼내 `find(isDefault) ?? list[0]` 로 하나를 골랐다.
 *
 *     화면    「이 프로필의 제조사」     ← 프로필 목록에서 고른 것
 *     등록     seller_settings 의 제조사 ← 고르는 규칙 자체가 없다
 *
 * 지금은 dual-write 덕에 값이 같아 티가 안 난다. 하지만 프로필을 하나 더
 * 만들면 그 순간 화면이 빈칸을 보여주고, 셀러는 등록에 무엇이 나가는지 알 수
 * 없게 된다. PIVOT-03 의 출발점이 정확히 그 증상이었다.
 *
 * ── 🔴 이 파일이 지키는 것 ────────────────────────────────────────────────
 * ① 판매자 다섯 칸을 배송 프로필에서 읽는 곳이 화면에 하나도 없다.
 * ② 「고르는 규칙」이 판매자 값에는 붙지 않는다 — 하나뿐이라 고를 것이 없다.
 * ③ 배송값은 «여전히» 배송 프로필에서 온다. 그건 프로필마다 달라야 한다.
 * ④ 두 요약 카드가 같은 규칙을 쓴다 — 탭을 옮겼을 때 같은 상품의 제조사가
 *    달라 보이면 안 된다.
 */

const DIR = join(__dirname, "..");
const HOOK = readFileSync(join(DIR, "use-manufacturer-resolution.ts"), "utf8");
const COUPANG_CARD = readFileSync(join(DIR, "SellerProfileSummaryCard.tsx"), "utf8");
const NAVER_CARD = readFileSync(join(DIR, "NaverSellerProfileSummaryCard.tsx"), "utf8");

const ALL = [
  ["제조사 resolver 훅", HOOK],
  ["쿠팡 요약카드", COUPANG_CARD],
  ["네이버 요약카드", NAVER_CARD],
] as const;

const FIVE = ["manufacturer", "asContactNumber", "qualityGuarantee", "kcExemptionText", "defaultCountryOfOrigin"];

/** 주석을 걷어낸 «실행되는 코드» 만 남긴다.
 *
 * 🔴 「이 이름이 파일에 없다」로 검사하면 주석까지 잡힌다. 그런데 이 전환의
 * 주석에는 「예전에는 find(isDefault) 로 골랐다」는 설명이 일부러 남아 있다 —
 * 지워야 할 것이 아니라 남겨야 할 것이다. 사라져야 하는 것은 코드뿐이다. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("① 배송 프로필에서 판매자 칸을 읽는 곳이 없다", () => {
  it.each(ALL)("%s", (_label, source) => {
    const pattern = new RegExp(`profile\\??\\.(${FIVE.join("|")})`, "g");
    expect(codeOnly(source).match(pattern)).toBeNull();
  });

  it.each([
    ["쿠팡 요약카드", COUPANG_CARD],
    ["네이버 요약카드", NAVER_CARD],
  ])("%s — canonical 창구를 부른다", (_label, source) => {
    expect(source).toContain('fetch("/api/settings/seller-settings")');
  });

  it("🔴 제조사 훅은 판매자 설정을 «아예 읽지 않는다» (PIVOT NEXT-04c-2)", () => {
    /* 0-4+2-B 시점에는 이 훅도 canonical 창구를 부르는 것이 맞았다. 04c-1
       조사에서 그 단계 자체가 잘못된 semantic 임이 확인돼(거기 들어 있는 것은
       판매 사업자다) 단계가 없어졌고, 그러면 조회도 없어야 한다 — 남겨 두면
       언제든 다시 배선된다. 요약카드 두 곳은 그대로 부른다(그건 판매자
       정보를 «판매자 정보로» 보여 주는 화면이다). */
    expect(codeOnly(HOOK)).not.toContain("seller-settings");
  });
});

describe("② 「고르는 규칙」이 판매자 값에 붙지 않는다", () => {
  it("🔴 제조사 훅에서 find(isDefault) 가 사라졌다", () => {
    /* 프로필 목록에서 하나를 고르는 규칙이었다. 서버 등록 경로에는 그런
       규칙이 «존재하지 않는다» — 그래서 화면만 다른 답을 낼 수 있었다.

       🔴 주석은 검사하지 않는다. 이 파일 주석에는 「예전에는 find(isDefault)
       로 골랐다」는 설명이 남아 있고, 그건 지워야 할 것이 아니라 남겨야 할
       것이다. 사라져야 하는 것은 «실행되는 코드» 다. */
    expect(codeOnly(HOOK)).not.toContain("isDefault");
    expect(codeOnly(HOOK)).not.toContain('fetch("/api/settings/coupang/profiles")');
  });

  it("🔴 훅이 더 이상 프로필 목록 타입을 들고 있지 않다", () => {
    // 타입이 남아 있으면 「여기서 프로필을 읽는다」는 모양이 코드에 남는다.
    expect(HOOK).not.toContain("SellerProfileRow");
  });

  it.each([
    ["쿠팡 요약카드", COUPANG_CARD],
    ["네이버 요약카드", NAVER_CARD],
  ])("%s — 판매자 값을 values 에서 그대로 읽는다(고르지 않는다)", (_label, source) => {
    expect(source).toContain("sellerSettings.manufacturer");
    expect(source).toContain("sellerSettings.qualityGuarantee");
    expect(source).toContain("sellerSettings.asContactNumber");
  });
});

describe("③ 배송값은 여전히 배송 프로필에서 온다", () => {
  it.each([
    ["쿠팡 요약카드", COUPANG_CARD],
    ["네이버 요약카드", NAVER_CARD],
  ])("%s — 프로필 조회와 기본 프로필 선택이 그대로다", (_label, source) => {
    // 「기본 배송 프로필」은 여전히 옳은 개념이다. 여러 개 중 하나를 쓴다.
    expect(source).toContain('fetch("/api/settings/coupang/profiles")');
    expect(source).toContain("list.find((p) => p.isDefault) ?? list[0]");
  });

  it("쿠팡 요약카드 — 반품지·배송비·출고지가 프로필에 남아 있다", () => {
    for (const key of ["returnChargeName", "returnAddress", "outboundShippingPlaceCode"]) {
      expect(COUPANG_CARD).toContain(`profile.${key}`);
    }
  });

  it("🔴 반품지 연락처는 A/S 연락처와 다른 값이다 — 폴백 순서도 그대로", () => {
    // 이름이 비슷해 같이 옮기기 쉬운 자리다. 섞이면 고객에게 다른 번호가 나간다.
    for (const source of [COUPANG_CARD, NAVER_CARD]) {
      expect(source).toContain("sellerSettings.asContactNumber || profile.companyContactNumber");
    }
  });
});

describe("④ 두 카드가 같은 규칙을 쓴다", () => {
  it("🔴 조회가 둘 다 끝날 때까지 그리지 않는다", () => {
    // 한쪽만 먼저 그리면 「미설정」이 번쩍이고 값으로 바뀐다 — 셀러에게는
    // 설정이 사라졌다 돌아온 것처럼 보인다.
    for (const source of [COUPANG_CARD, NAVER_CARD]) {
      expect(source).toContain("profile === undefined || sellerSettings === undefined");
    }
  });

  it("🔴 판매자 설정 «조회 실패» 는 카드를 막지 않는다", () => {
    /* 프로필 조회 실패는 null 로 가서 「아직 판매자 정보가 없습니다」를 띄운다.
       판매자 설정은 빈 객체로 간다 — 배송 정보는 여전히 보여줄 수 있기
       때문이다. 여기서 카드를 통째로 막으면 관계없는 정보까지 사라진다. */
    for (const source of [COUPANG_CARD, NAVER_CARD]) {
      expect(source).toContain("setSellerSettings({})");
    }
  });

  it("두 카드가 같은 세 칸을 그린다", () => {
    for (const label of ["제조자(수입자)", "품질보증기준", "전화번호"]) {
      expect(COUPANG_CARD).toContain(label);
      expect(NAVER_CARD).toContain(label);
    }
  });
});

describe("⑤ 이번에 넘지 않은 선", () => {
  it("🔴 PUT 을 부르지 않는다 — B 는 읽기 전환이다", () => {
    for (const [, source] of ALL) {
      expect(source).not.toContain('method: "PUT"');
    }
  });

  it("🔴 설정 화면(page.tsx)은 건드리지 않았다 — C 의 일이다", () => {
    // 저장 경로와 폼 state 분리는 cardinality 변경이라 별도 단계다.
    const settingsPage = readFileSync(join(DIR, "../../settings/page.tsx"), "utf8");
    expect(settingsPage).toContain("setManufacturer(p.manufacturer)");
  });
});
