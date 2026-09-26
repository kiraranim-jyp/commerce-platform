import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultDetailBlocks } from "@commerce/listing";
import { originPickerNote } from "../LotteOnRegistrationPanel";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 F-3 — **Common 의 값을 «보여주되» 지어내지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 후보 셋을 조사하고 둘을 «구현하지 않기로» 했다. 그 판정을 여기서 고정한다 —
 * 다음 사람이 「왜 안 했지?」하고 다시 열지 않도록.
 */

const PANEL = readFileSync(join(__dirname, "..", "LotteOnRegistrationPanel.tsx"), "utf8");
const SETTINGS = readFileSync(join(__dirname, "..", "..", "..", "settings", "page.tsx"), "utf8");
const COMMON_CODES = readFileSync(
  join(__dirname, "..", "..", "..", "api", "lotteon", "common-codes", "route.ts"),
  "utf8",
);

describe("F-3-1 — 롯데ON 원산지: 보여준다, 고르지는 않는다", () => {
  it("상품 원산지를 도움말 줄에 실어 준다", () => {
    expect(originPickerNote("이탈리아")).toBe(
      "롯데ON이 정한 원산지 중에서 고릅니다. 이 상품의 원산지는 「이탈리아」입니다 — 목록에서 같은 곳을 고르세요.",
    );
    expect(PANEL).toContain("note={originPickerNote(product.countryOfOrigin.value)}");
  });

  it("값이 없으면 아무 말도 덧붙이지 않는다 — 「원산지 없음」은 이 칸의 일이 아니다", () => {
    const base = "롯데ON이 정한 원산지 중에서 고릅니다.";
    expect(originPickerNote(null)).toBe(base);
    expect(originPickerNote("   ")).toBe(base);
  });

  /* 🔴 새 DOM 부품을 만들지 않는다 — rework14-field-parity 계약.
     처음에 전용 <p> 줄을 세웠다가 그 계약에 걸려 되돌렸다. */
  it("새 부품을 만들지 않고 기존 note 한 줄만 쓴다", () => {
    expect(PANEL).not.toContain("data-product-origin-hint");
    expect(PANEL).not.toContain("function ProductOriginHint(");
  });

  /* 🔴 이것이 이 파일의 핵심이다. 「자동으로 코드까지 골라 주면 좋지 않나」는
     다음 사람이 반드시 하게 되는 생각이다. 근거가 생기기 전에는 하면 안 된다. */
  it("🔴 원산지 텍스트를 OPLC_CD 코드로 «변환» 하지 않는다", () => {
    expect(PANEL).not.toContain("resolveNaverOriginArea");
    expect(PANEL).not.toContain("COUNTRY_NAME_KO");
    /* 🔴 원산지 칸에 값을 쓰는 곳은 «셀러가 고른 값» 둘뿐이다.
       텍스트에서 코드를 유도해 써 넣는 경로가 생기면 여기서 깨진다.
       F-7 — 목록에서 고르는 쪽이 `pickAndRecheck`(고르는 즉시 재확인)로 바뀌었다.
       쓰는 «값» 은 그대로 셀러가 고른 `value` 하나뿐이다. */
    const writes = PANEL.match(/(patch|pickAndRecheck)\("codes", \{ originCode: [^}]+\}/g) ?? [];
    expect(writes).toEqual([
      'pickAndRecheck("codes", { originCode: value }',
      'patch("codes", { originCode: value }',
    ]);
  });

  /* 표시 전용이다 — 이 함수는 문자열만 돌려주고 아무것도 «쓰지» 않는다. */
  it("originPickerNote 가 폼을 건드리지 않는다", () => {
    const block = PANEL.slice(PANEL.indexOf("export function originPickerNote("));
    const body = block.slice(0, block.indexOf("\n}"));
    for (const forbidden of ["patch(", "onPick", "setForm"]) {
      expect(body).not.toContain(forbidden);
    }
  });

  it("🔴 라우트가 「매핑도 번역도 하지 않는다」를 그대로 지킨다", () => {
    expect(COMMON_CODES).toContain("매핑도 번역도 하지 않는다");
  });
});

describe("F-3-3 — 브랜드 소개: 배선은 있는데 «블록» 이 없다", () => {
  /* 🔴 hint 를 「세 커머스 모두에 들어갑니다」로 고쳤다가 되돌린 이유를 고정한다.
     배선(세 채널이 brandIntro 를 넘긴다)만 보고 판단하면 틀린다. */
  it("기본 블록 목록에 BRAND_INTRO 가 없다", () => {
    expect(defaultDetailBlocks().some((b) => b.kind === "BRAND_INTRO")).toBe(false);
  });

  it("그러므로 「저장만 됩니다」가 사실이다 — 문구를 되돌려 둔다", () => {
    expect(SETTINGS).toContain('label="브랜드 소개" hint="상세설명 템플릿 블록화(다음 작업)에서 사용 예정 — 지금은 저장만 됩니다"');
  });

  it("🔴 브랜드 대표이미지를 상품 대표이미지 자리에 넣지 않았다", () => {
    expect(PANEL).not.toContain("representativeImageUrl");
  });
});

describe("F-3-2 — 판매자 Common 칸을 만들지 않았다", () => {
  it("seller_settings 계약이 다섯 칸 그대로다", () => {
    const lib = readFileSync(join(__dirname, "..", "..", "..", "..", "lib", "seller-settings.ts"), "utf8");
    const keys = lib.slice(lib.indexOf("export const SELLER_SETTING_KEYS"));
    for (const key of [
      "manufacturer",
      "asContactNumber",
      "qualityGuarantee",
      "kcExemptionText",
      "defaultCountryOfOrigin",
    ]) {
      expect(keys.slice(0, 400)).toContain(key);
    }
    /* 🔴 소비처가 0인 채로 칸을 만들지 않는다(PIVOT-02 §10 ④). */
    expect(keys.slice(0, 400)).not.toContain("businessNumber");
    expect(keys.slice(0, 400)).not.toContain("sellerName");
  });

  it("🔴 manufacturer 는 제조사다 — 판매자로 정의하지 않는다", () => {
    expect(SETTINGS).toContain('label="제조사"');
    expect(SETTINGS).toContain("실제 상품을 제조한 사업자입니다");
    /* 🔴 hint «속성» 에서 옛 문구가 사라졌는지 본다. 주석에는 「이렇게 틀렸었다」로
       남아 있고, 그 기록까지 지우면 다음 사람이 같은 실수를 반복한다. */
    expect(SETTINGS).not.toContain('hint="판매 사업자 정보 기록용');
  });
});
