import { describe, expect, it } from "vitest";
import { EMPTY_SELLER_SETTINGS, hasAnySellerSetting, type SellerSettings } from "../seller-settings";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TTAEJYO-PIVOT-03 — 판매자 공통 설정 분리
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 분리하나 (PIVOT-01 실측) ────────────────────────────────────────────
 * 판매자 정보 다섯(제조사·A/S·품질보증·KC문구·원산지 기본)이 `coupang_seller_profiles`
 * 에 들어 있었다. 그 표는 «배송 프로필» 이고 여러 개를 갖는다(name + is_default).
 *
 *     배송 프로필을 하나 더 만든다
 *        → 판매자 정보가 «빈 채로» 새로 생긴다
 *        → 그 프로필을 기본으로 바꾸면 판매자 정보가 «사라진다»
 *
 * 가설이 아니다. 실측 시점 DB 에 그 빈 행이 이미 2개 있었다.
 *
 *     is_default=true   A/S·품질보증·KC문구·원산지기본 있음 · manufacturer 는 null
 *     is_default=false  전부 null
 *     is_default=false  전부 null
 *
 * ── 이 파일이 지키는 것 ────────────────────────────────────────────────────
 * 🔴 「값이 하나라도 있는가」의 판정 하나다. 그 판정이 호환층의 스위치이기
 *    때문에, 뒤집히면 전환 도중 쿠팡 실등록이 빈 값으로 나간다 — 그게 회귀다.
 *
 * 🔴 DB 왕복이 필요한 부분(loadSellerSettings/saveSellerSettings)은 여기서
 *    검사하지 않는다. Supabase 를 부르기 때문이다. 순수 판정만 고정한다.
 */

const of = (over: Partial<SellerSettings>): SellerSettings => ({ ...EMPTY_SELLER_SETTINGS, ...over });

describe("① 설정이 «있다» 고 말할 수 있는 조건", () => {
  it("🔴 전부 null 이면 «없다» — 빈 행을 「설정이 있다」로 읽으면 호환층이 영영 안 돈다", () => {
    expect(hasAnySellerSetting(EMPTY_SELLER_SETTINGS)).toBe(false);
  });

  it.each([
    ["manufacturer"],
    ["asContactNumber"],
    ["qualityGuarantee"],
    ["kcExemptionText"],
    ["defaultCountryOfOrigin"],
  ])("하나만 있어도 «있다» — %s", (key) => {
    expect(hasAnySellerSetting(of({ [key]: "값" } as Partial<SellerSettings>))).toBe(true);
  });

  it("🔴 빈 문자열은 «없는 것» 이다 — 화면에서 비운 값이 설정을 가로막으면 안 된다", () => {
    expect(hasAnySellerSetting(of({ qualityGuarantee: "" }))).toBe(false);
  });

  it("🔴 공백만 있는 값도 «없는 것» 이다", () => {
    expect(hasAnySellerSetting(of({ manufacturer: "   " }))).toBe(false);
  });

  it("실측 모양 그대로 — manufacturer 만 null 이고 나머지가 있으면 «있다»", () => {
    // is_default=true 행의 실제 모양이다. manufacturer 는 비어 있었다.
    const real = of({
      asContactNumber: "해외 구매대행으로 A/S 불가",
      qualityGuarantee: "상품 상세페이지에 기재된 품질보증기준 및 소비자분쟁해결기준에 따릅니다.",
      kcExemptionText: "KC인증 어린이제품 공급자적합성확인",
      defaultCountryOfOrigin: "상세설명 참조",
    });
    expect(hasAnySellerSetting(real)).toBe(true);
    // 🔴 그리고 manufacturer 는 «여전히 null 이어야» 한다. 값을 지어내지 않는다 —
    //    「제조사 미입력」은 쿠팡 등록의 1위 블로커였고, 아무 값이나 채우면 그
    //    경고가 조용히 사라진다.
    expect(real.manufacturer).toBeNull();
  });
});

describe("② 빈 설정의 모양", () => {
  it("🔴 EMPTY 는 다섯 칸이 전부 null 이다 — 빈 문자열이 아니다", () => {
    expect(EMPTY_SELLER_SETTINGS).toEqual({
      manufacturer: null,
      asContactNumber: null,
      qualityGuarantee: null,
      kcExemptionText: null,
      defaultCountryOfOrigin: null,
    });
  });

  it("다섯 칸뿐이다 — 배송/가격이 섞여 들어오면 이 검사가 잡는다", () => {
    expect(Object.keys(EMPTY_SELLER_SETTINGS).sort()).toEqual(
      ["asContactNumber", "defaultCountryOfOrigin", "kcExemptionText", "manufacturer", "qualityGuarantee"],
    );
  });
});
