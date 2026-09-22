import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TTAEJYO-PIVOT-03 ⑨ 0-1 — SmartStore 의 판매자 공통값 출처를 옮긴다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 ────────────────────────────────────────────────────────────────────
 * ⑤ 는 쿠팡만 seller_settings 로 옮겼다. SmartStore 와 LotteON 은 여전히
 * coupang_seller_profiles 를 직접 읽고 있었다. 지금은 dual-write 덕에 두 표의
 * 값이 같아서 티가 안 나지만, dual-write 를 떼는 순간 채널마다 다른 제조사가
 * 나간다. ⑨ 조사에서 이걸 찾았고, 이 파일은 SmartStore 쪽 전환을 고정한다.
 *
 * ── 🔴 이번에 바꾸지 «않은» 것 ────────────────────────────────────────────
 * 폴백 순서(상품 → 브랜드 → 판매자)는 한 글자도 안 바꿨다. 판매자 단계에
 * «도달했을 때 어느 표에서 읽는가» 만 달라졌다. 순서를 같이 손대면 값이
 * 달라졌을 때 원인이 출처인지 순서인지 구분할 수 없다.
 *
 * getDefaultSellerProfile() 도 그대로 둔다. 그 함수는 28칸을 주는데 그중 5칸만
 * 판매자 공통값이고, 나머지 23칸(택배사·반품지·배송비·가격·공통이미지)은
 * «프로필마다 달라야 하는» 배송 프로필의 것이다. 치환이 아니라 출처 분리다.
 */

const SOURCE = readFileSync(join(__dirname, "../_lib/resolve-context.ts"), "utf8");

describe("① 판매자 공통 네 값은 이제 seller_settings 에서 온다", () => {
  it.each([
    ["제조사", "sellerSettings.manufacturer"],
    ["품질보증기준", "sellerSettings.qualityGuarantee"],
    ["A/S 연락처", "sellerSettings.asContactNumber"],
    ["원산지 기본값", "sellerSettings.defaultCountryOfOrigin"],
  ])("%s", (_label, expr) => {
    expect(SOURCE).toContain(expr);
  });

  it("🔴 레거시 프로필에서 네 값을 읽는 곳이 하나도 남지 않았다", () => {
    // 하나라도 남으면 같은 등록에서 두 표를 섞어 읽게 된다 — 그게 이 작업이
    // 없애려는 상태다.
    const leftovers = SOURCE.match(
      /sellerProfile\?\.(manufacturer|qualityGuarantee|asContactNumber|defaultCountryOfOrigin|kcExemptionText)/g,
    );
    expect(leftovers).toBeNull();
  });

  it("loadSellerSettings 를 실제로 부른다 — 타입만 바꾼 것이 아니다", () => {
    expect(SOURCE).toContain("loadSellerSettings()");
  });
});

describe("② 배송 프로필은 그대로 남는다", () => {
  it("🔴 getDefaultSellerProfile 을 계속 부른다 — 나머지 23칸이 여기서 온다", () => {
    expect(SOURCE).toContain("getDefaultSellerProfile()");
  });

  it.each([
    ["출고 택배사", "sellerProfile?.naverDeliveryCompanyCode"],
    ["배송비", "sellerProfile?.deliveryCharge"],
    ["반품 배송비", "sellerProfile?.returnDeliveryCharge"],
    ["상단 공통이미지", "sellerProfile?.topCommonImageUrl"],
  ])("%s 는 배송 프로필에 남아 있다", (_label, expr) => {
    expect(SOURCE).toContain(expr);
  });

  it("🔴 반품지 연락처는 «A/S 연락처가 아니다» — 이름이 비슷해서 같이 옮기기 쉽다", () => {
    // companyContactNumber 는 반품지 연락처(배송 프로필)이고 asContactNumber 는
    // A/S 연락처(판매자 공통)다. 쿠팡은 asContactNumber || companyContactNumber
    // 로 폴백까지 한다 — 두 값이 섞이면 고객에게 다른 번호가 나간다.
    expect(SOURCE).toContain("companyContactNumber: sellerProfile?.companyContactNumber");
  });
});

describe("③ 폴백 순서는 바뀌지 않았다", () => {
  it("원산지 — 상품 → 브랜드 → 판매자", () => {
    expect(SOURCE).toContain(
      "extractedCountryOfOrigin || brandProfile?.countryOfOrigin || sellerSettings.defaultCountryOfOrigin || null",
    );
  });

  it("제조사 — 브랜드 → 판매자 (상품 원문은 build-payload 가 더 앞에서 본다)", () => {
    expect(SOURCE).toContain("brandProfile?.manufacturer || sellerSettings.manufacturer || null");
  });

  it("🔴 출처 표시도 같은 조건을 그대로 읽는다 — 값과 라벨이 갈리면 안 된다", () => {
    // 값은 seller_settings 에서 오는데 라벨만 레거시를 보고 판정하면, 화면은
    // 「판매자 기본값」이라고 말하면서 다른 표의 값을 보여주게 된다.
    expect(SOURCE).toContain(
      'manufacturerSource: brandProfile?.manufacturer ? "BRAND_DEFAULT" : sellerSettings.manufacturer ? "SELLER_DEFAULT" : "NONE"',
    );
  });
});

describe("④ 빈 값의 «모양» 이 달라져도 결과가 같다", () => {
  /* 레거시는 NULL 을 빈 문자열로 바꿔서 줬고(seller-profile.ts 의 `?? \"\"`),
     seller_settings 는 null 을 그대로 준다. 게다가 프로필이 아예 없으면
     sellerProfile 자체가 null 이라 `?.` 가 undefined 를 낸다.

     🔴 세 모양이 전부 falsy 라 `||` 사슬과 삼항 truthiness 에서 같게 동작한다.
     이 파일의 여섯 지점이 전부 그 경계 위에 있어서 «순수 출처 교체» 가 된다.
     아래는 그 전제를 코드로 박아 두는 것이다 — 누군가 `?? ` 나 `!== null` 로
     바꾸면 여기서 깨진다. */
  const SHAPES = [
    ["레거시 빈 문자열", ""],
    ["canonical null", null],
    ["프로필 없음 undefined", undefined],
  ] as const;

  it.each(SHAPES)("%s 은 폴백을 통과시킨다", (_label, empty) => {
    const brand = "브랜드제조사";
    expect(brand || empty || null).toBe(brand);
    expect(empty || null).toBeNull();
  });

  it.each(SHAPES)("%s 이면 출처는 SELLER_DEFAULT 가 아니다", (_label, empty) => {
    expect(empty ? "SELLER_DEFAULT" : "NONE").toBe("NONE");
  });

  it("값이 있으면 SELLER_DEFAULT 다", () => {
    const filled: string | null | undefined = "규하맘샵";
    expect(filled ? "SELLER_DEFAULT" : "NONE").toBe("SELLER_DEFAULT");
  });
});

describe("⑤ SmartStore 가 쓰지 «않는» 것", () => {
  it("🔴 kcExemptionText 는 쿠팡 전용이다 — 없는 요구를 만들지 않는다", () => {
    // 5칸 중 SmartStore 가 쓰는 것은 넷이다. resolver 가 다섯을 다 주더라도
    // 여기서 읽지 않는다. 읽기 시작하면 그게 새 기능이고, 이번 범위가 아니다.
    expect(SOURCE).not.toContain("kcExemptionText");
  });
});
