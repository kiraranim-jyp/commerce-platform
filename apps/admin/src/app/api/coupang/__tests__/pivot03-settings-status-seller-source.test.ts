import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TTAEJYO-PIVOT-03 Phase 1 — 설정 체크리스트의 판매자 세 칸 출처를 옮긴다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 ────────────────────────────────────────────────────────────────────
 * getCoupangSettingsStatus() 는 «등록 화면의 게이트» 와 설정 페이지가 같이 쓰는
 * 판정이다. 세 채널의 payload 는 이미 seller_settings 를 보는데 이 판정만
 * 배송 프로필을 보고 있었다. 그러면 조용히 틀린다 —
 *
 *     체크리스트  「제조자(수입자) 미입력」          ← 레거시를 보고
 *     실제 payload  manufacturer = "규하맘샵"        ← canonical 에서 나감
 *
 * 지금은 dual-write 덕에 둘이 같아 티가 안 나지만, 그 다리를 떼면 갈라진다.
 *
 * ── 🔴 이 파일이 지키는 것 ────────────────────────────────────────────────
 * 「출처만 바뀌고 판정·라벨·순서는 그대로」 하나다. 체크리스트는 셀러가 무엇을
 * 더 채워야 하는지 말해 주는 화면이라, 한 줄이라도 늘거나 줄면 셀러가 다른
 * 행동을 한다.
 */

const SOURCE = readFileSync(join(__dirname, "../_lib/settings-status.ts"), "utf8");

describe("① 판매자 세 칸은 seller_settings 에서 읽는다", () => {
  it("loadSellerSettings 를 실제로 부른다", () => {
    expect(SOURCE).toContain("await loadSellerSettings()");
  });

  it("세 칸이 판매자 설정 목록에 있다", () => {
    const block = SOURCE.slice(
      SOURCE.indexOf("RECOMMENDED_SELLER_SETTING_FIELDS"),
      SOURCE.indexOf("export async function"),
    );
    expect(block).toContain('{ key: "manufacturer", label: "제조자(수입자)" }');
    expect(block).toContain('{ key: "qualityGuarantee", label: "품질보증기준" }');
    expect(block).toContain('{ key: "asContactNumber", label: "A/S 연락처" }');
  });

  it("🔴 배송 프로필 목록에서는 빠졌다 — 두 곳에서 읽으면 갈라진다", () => {
    const block = SOURCE.slice(
      SOURCE.indexOf("RECOMMENDED_PROFILE_FIELDS"),
      SOURCE.indexOf("RECOMMENDED_SELLER_SETTING_FIELDS"),
    );
    for (const key of ["manufacturer", "qualityGuarantee", "asContactNumber"]) {
      expect(block).not.toContain(`"${key}"`);
    }
  });
});

describe("② 배송 프로필 쪽은 한 칸도 안 움직였다", () => {
  it.each([
    ["택배사", "deliveryCompanyCode"],
    ["반품지", "returnCenterCode"],
    ["반품지명", "returnChargeName"],
    ["반품지 연락처", "companyContactNumber"],
    ["반품지 우편번호", "returnZipCode"],
    ["반품지 주소", "returnAddress"],
  ])("필수 — %s", (label, key) => {
    expect(SOURCE).toContain(`{ key: "${key}", label: "${label}" }`);
  });

  it.each([
    ["배송비", "deliveryCharge"],
    ["반품배송비", "returnDeliveryCharge"],
    ["교환배송비", "exchangeDeliveryCharge"],
  ])("권장 — %s 는 배송 프로필에 남아 있다", (label, key) => {
    expect(SOURCE).toContain(`{ key: "${key}", label: "${label}" }`);
  });

  it("출고지 판정도 그대로다", () => {
    expect(SOURCE).toContain('if (profile.outboundShippingPlaceCode == null) missing.push("출고지")');
  });

  it("🔴 반품지 연락처는 A/S 연락처와 다른 값이다 — 필수 목록에 그대로 있다", () => {
    // companyContactNumber(반품지 연락처)는 배송 프로필, asContactNumber(A/S
    // 연락처)는 판매자 공통이다. 라벨이 비슷해 같이 옮기기 쉽다.
    expect(SOURCE).toContain('{ key: "companyContactNumber", label: "반품지 연락처" }');
  });
});

describe("③ 판정 자체는 바뀌지 않았다", () => {
  it("비었으면 권장에 넣는다 — 같은 조건, 같은 배열", () => {
    expect(SOURCE).toContain("if (!sellerSettings[field.key]) recommended.push(field.label)");
    expect(SOURCE).toContain("if (!profile[field.key]) recommended.push(field.label)");
  });

  it("🔴 missing 에는 넣지 않는다 — 등록 가능성 퍼센트가 움직이면 안 된다", () => {
    /* 권장 항목은 「등록 가능성」 계산에 들어가지 않는다(필수만 반영). 세 칸이
       missing 으로 새면 어제 100%였던 상품이 오늘 미달로 보인다.

       missing 으로 가는 자리는 다섯이고 전부 계정이나 «배송» 값이다:
       API 키 · Wing 계정 · 배송 프로필 · 필수 프로필 필드 루프 · 출고지. */
    expect(SOURCE.match(/missing\.push\(/g) ?? []).toHaveLength(5);
    // 판매자 설정 루프의 본문은 recommended 로만 간다.
    const loop = SOURCE.slice(SOURCE.indexOf("for (const field of RECOMMENDED_SELLER_SETTING_FIELDS)"));
    expect(loop.slice(0, 160)).toContain("recommended.push(field.label)");
    expect(loop.slice(0, 160)).not.toContain("missing.push");
  });

  it("🔴 판정 위치가 프로필 분기 «안» 에 그대로 있다", () => {
    /* 밖으로 빼면 「프로필이 없을 때」 출력이 달라진다 — 지금은 권장 목록이
       비지만, 빼면 세 줄이 뜬다. 그건 reader 교체가 아니라 cardinality
       변경이고 0-4+2 의 일이다. 여기서 같이 바꾸면 Phase 1 이 무엇을
       바꿨는지 알 수 없게 된다. */
    const elseBranch = SOURCE.slice(SOURCE.indexOf("} else {"), SOURCE.indexOf("return {"));
    expect(elseBranch).toContain("RECOMMENDED_SELLER_SETTING_FIELDS");
  });

  it("라벨 순서가 그대로다 — 체크리스트 줄이 움직이지 않는다", () => {
    const order = ["배송비", "반품배송비", "교환배송비", "제조자(수입자)", "품질보증기준", "A/S 연락처"];
    const positions = order.map((label) => SOURCE.indexOf(`label: "${label}"`));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
