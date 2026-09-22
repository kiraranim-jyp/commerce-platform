import { describe, expect, it } from "vitest";
import { SELLER_SETTING_KEYS, pickSellerSettingFields } from "../seller-settings";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TTAEJYO-PIVOT-03 ⑤ — 설정 화면 writer 를 seller_settings 로 돌린다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 필요했나 ────────────────────────────────────────────────────────────
 * 059 로 reader 는 seller_settings 를 보게 했는데 writer 는 아직
 * coupang_seller_profiles 에만 썼다. 그래서 이런 일이 일어난다.
 *
 *     설정 화면에서 제조사를 입력한다
 *        → 「저장했습니다」 가 뜬다
 *        → 쿠팡 등록 payload 에는 «안 나간다»
 *
 * 화면과 실제가 갈라지는데 아무 신호가 없다. 그래서 두 표에 함께 쓴다.
 *
 * ── 이 파일이 지키는 것 ────────────────────────────────────────────────────
 * 🔴 «무엇을 RPC 로 넘기는가» 의 판정 하나다. DB 왕복(saveSellerSettingsDual)은
 *    여기서 검사하지 않는다 — Supabase 를 부르기 때문이다.
 *
 * 🔴 그 판정이 틀리면 조용히 망가진다. 배송 탭에서 저장했는데 판매자 정보가
 *    지워지거나(안 온 칸을 null 로 덮음), 화면에서 비웠는데 안 지워지거나
 *    (빈 문자열을 「안 왔다」로 봄). 둘 다 셀러에게는 보이지 않는다.
 *
 * 전제 — 설정 화면은 세 탭(배송·판매자·가격)이 handleSave 하나를 같이 쓴다.
 * 즉 배송만 고쳐도 판매자 칸이 같은 PATCH 에 실려 온다.
 */

describe("① 다섯 칸«만» 골라낸다", () => {
  it("판매자 다섯 칸을 전부 고른다", () => {
    const picked = pickSellerSettingFields({
      manufacturer: "제조사",
      asContactNumber: "010-0000-0000",
      qualityGuarantee: "보증",
      kcExemptionText: "KC",
      defaultCountryOfOrigin: "중국",
    });
    expect(Object.keys(picked).sort()).toEqual([...SELLER_SETTING_KEYS].sort());
  });

  it("🔴 배송·가격·상세페이지는 «절대» 딸려가지 않는다 — RPC 는 판매자 5칸만 다룬다", () => {
    const picked = pickSellerSettingFields({
      manufacturer: "제조사",
      // 아래는 전부 기존 TS 경로(updateSellerProfile)가 맡는다.
      deliveryCharge: 3000,
      returnCenterCode: "RC-1",
      defaultMarginPercent: 30,
      priceRoundingUnit: 100,
      topCommonImageEnabled: true,
      defaultDetailBlocks: [{ kind: "text" }],
      outboundLeadTimeDays: 7,
      name: "기본",
    });
    expect(picked).toEqual({ manufacturer: "제조사" });
  });

  it("아무 칸도 안 오면 빈 객체다 — 호출부가 RPC 를 «부르지 않는» 근거가 된다", () => {
    // 출고지 수정 모달처럼 배송 값만 보내는 요청이 실제로 있다.
    expect(pickSellerSettingFields({ deliveryCharge: 3000 })).toEqual({});
  });
});

describe("② 「값이 있는가」가 아니라 「키가 왔는가」", () => {
  it("🔴 빈 문자열은 «왔다» — 화면에서 비운 것은 「지워라」는 뜻이다", () => {
    // toRowFields 가 `input.X || null` 로 빈 값을 null 로 바꾼다. 값으로 걸러
    // 버리면 「지움」이 「안 건드림」이 되어 옛 값이 그대로 남는다.
    expect(pickSellerSettingFields({ manufacturer: "" })).toEqual({ manufacturer: "" });
  });

  it("🔴 명시적 null 도 «왔다»", () => {
    expect(pickSellerSettingFields({ qualityGuarantee: null })).toEqual({ qualityGuarantee: null });
  });

  it("🔴 undefined 도 키가 있으면 «왔다»로 센다 — JSON 을 거치며 사라질 값이다", () => {
    // 실제 요청은 JSON.parse 를 거쳐 오므로 undefined 값은 애초에 키째 없다.
    // 이 검사는 그 경계를 문서로 박아 둔다: 판정 기준은 값이 아니라 키다.
    expect("manufacturer" in pickSellerSettingFields({ manufacturer: undefined })).toBe(true);
  });

  it("🔴 키가 없으면 «안 왔다» — 안 온 칸은 건드리지 않는다", () => {
    // handleSave 는 `manufacturer || undefined` 로 보내고 JSON.stringify 가 그
    // 키를 지운다. 그래서 다른 탭에서 저장할 때 판매자 칸은 통째로 안 온다.
    // 이걸 null 로 덮으면 배송값 하나 고칠 때마다 판매자 정보가 사라진다.
    const body = JSON.parse(JSON.stringify({ manufacturer: undefined, deliveryCharge: 3000 }));
    expect(pickSellerSettingFields(body)).toEqual({});
  });

  it("0 이나 false 같은 falsy 값도 «왔다» — 판정에 값의 참/거짓을 섞지 않는다", () => {
    expect(pickSellerSettingFields({ manufacturer: 0 })).toEqual({ manufacturer: 0 });
  });
});

describe("③ 값을 손보지 않고 그대로 넘긴다", () => {
  it("🔴 trim 하지 않는다 — 기존 PATCH 경로가 trim 하지 않기 때문이다", () => {
    // 한쪽만 다듬으면 같은 저장에서 coupang_seller_profiles 와 seller_settings 의
    // 값이 달라진다. 두 표를 같게 두는 것이 이 작업의 전부다.
    expect(pickSellerSettingFields({ manufacturer: "  제조사  " })).toEqual({
      manufacturer: "  제조사  ",
    });
  });

  it("키 이름을 바꾸지 않는다 — snake_case 변환은 SQL 한 곳에만 있다", () => {
    const picked = pickSellerSettingFields({ asContactNumber: "010-0000-0000" });
    expect(picked).toHaveProperty("asContactNumber");
    expect(picked).not.toHaveProperty("as_contact_number");
  });
});

describe("④ 다섯 칸의 정의", () => {
  it("🔴 정확히 다섯이다 — 여섯 번째가 생기면 SQL(060)도 함께 고쳐야 한다", () => {
    expect(SELLER_SETTING_KEYS).toHaveLength(5);
    expect([...SELLER_SETTING_KEYS].sort()).toEqual([
      "asContactNumber",
      "defaultCountryOfOrigin",
      "kcExemptionText",
      "manufacturer",
      "qualityGuarantee",
    ]);
  });
});
