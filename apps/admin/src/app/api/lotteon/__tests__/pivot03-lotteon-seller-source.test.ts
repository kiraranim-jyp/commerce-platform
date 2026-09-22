import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveManufacturer } from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TTAEJYO-PIVOT-03 ⑨ 0-2 — LotteON 의 제조사 출처를 옮긴다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 0-1(SmartStore)과 같은 작업이고 범위는 «제조사 한 칸» 뿐이다.
 * LotteON 은 판매자 공통 다섯 중 제조사만 쓴다 — 품질보증·A/S·KC문구·원산지는
 * 읽지 않는다. 안 쓰던 것을 이번에 연결하면 그건 새 기능이다.
 *
 * ── 🔴 이 파일이 막는 것 ──────────────────────────────────────────────────
 * 이 작업에서 실제로 이름 충돌이 났다. build-context.ts 에는 이미
 * `sellerSettings`(loadLotteOnSellerSettings)가 있었는데, 뜻이 정반대다.
 *
 *     commonSellerSettings  전 채널 공통 판매자 정보(제조사 등)
 *     sellerSettings        롯데ON «전용» 번호(출고지·반품지·배송비정책)
 *
 * 뒤엣것은 다른 채널로 옮길 수 없는 값이다. 둘이 섞이면 채널 전용 번호가
 * 공통 설정으로 새어 나가거나 그 반대가 된다.
 */

const SOURCE = readFileSync(join(__dirname, "../_lib/build-context.ts"), "utf8");

describe("① 제조사는 이제 seller_settings 에서 온다", () => {
  it("공통 resolver 에 넘기는 판매자 제조사가 공통 설정에서 온다", () => {
    expect(SOURCE).toContain("sellerProfileManufacturer: commonSellerSettings.manufacturer");
  });

  it("loadSellerSettings 를 실제로 부른다", () => {
    expect(SOURCE).toContain("loadSellerSettings()");
  });

  it("🔴 레거시 프로필에서 판매자 5칸을 읽는 곳이 남지 않았다", () => {
    const leftovers = SOURCE.match(
      /sellerProfile\??\.(manufacturer|qualityGuarantee|asContactNumber|defaultCountryOfOrigin|kcExemptionText)/g,
    );
    expect(leftovers).toBeNull();
  });
});

describe("② 롯데ON 전용 설정과 «섞이지 않는다»", () => {
  it("🔴 두 이름이 실제로 다르다 — 같은 스코프에 둘 다 산다", () => {
    expect(SOURCE).toContain("const commonSellerSettings = await loadSellerSettings()");
    expect(SOURCE).toContain("const sellerSettings = await loadLotteOnSellerSettings()");
  });

  it.each([
    ["출고지 번호", "sellerSettings.outboundPlaceNo"],
    ["반품지 번호", "sellerSettings.returnPlaceNo"],
    ["배송비 정책", "sellerSettings.deliveryCostPolicyNo"],
    ["배송 권역 그룹", "sellerSettings.deliveryRegionGroupCode"],
  ])("%s 는 롯데ON 전용 설정에 그대로 남는다", (_label, expr) => {
    // 이 값들은 롯데ON API 가 발급한 번호다. 다른 채널에는 의미가 없어서
    // 공통 판매자 설정으로 올리면 안 된다.
    expect(SOURCE).toContain(expr);
  });

  it("🔴 공통 설정에서 제조사 말고 다른 «칸» 을 끌어오지 않는다", () => {
    /* LotteON 이 쓰는 것은 제조사 하나뿐이다. 다섯 칸이 다 있다고 해서
       연결하면 그건 새 기능이다.

       🔴 `failed` 는 여기서 세지 않는다 — 그건 판매자 설정의 «칸» 이 아니라
       「읽었는가」라는 조회 상태다(R6-FS). 칸과 상태를 같은 자루에 넣으면,
       상태를 읽는 것만으로 「없던 설정을 끌어다 쓴다」로 잘못 걸린다. */
    const FIELDS = ["manufacturer", "asContactNumber", "qualityGuarantee", "kcExemptionText", "defaultCountryOfOrigin"];
    const pulled = (SOURCE.match(/commonSellerSettings\.(\w+)/g) ?? [])
      .map((m) => m.replace("commonSellerSettings.", ""))
      .filter((name) => FIELDS.includes(name));
    expect([...new Set(pulled)]).toEqual(["manufacturer"]);
  });

  it("조회 실패는 «값» 이 아니라 상태로 읽는다", () => {
    // 못 읽은 것을 빈 제조사로 흘려보내면 mfcrNm 이 빈 채로 실제 등록이 나간다.
    expect(SOURCE).toContain("commonSellerSettings.failed");
  });
});

describe("③ 배송 프로필은 그대로 남는다", () => {
  it("🔴 getDefaultSellerProfile 을 계속 부른다", () => {
    expect(SOURCE).toContain("getDefaultSellerProfile()");
  });

  it("상세페이지 조립에 같은 프로필을 그대로 넘긴다", () => {
    // 셀러 설정을 한 번만 읽어서 상세페이지와 배송값이 같은 프로필을 보게
    // 한다는 기존 계약(REWORK 커머스 탭 구조 통일)을 깨지 않는다.
    expect(SOURCE).toContain("buildDetailHtml(product, sellerProfile, brandProfile)");
  });
});

describe("④ 빈 값의 모양이 달라져도 판정이 같다", () => {
  /* 🔴 SmartStore 와 경계 모양이 «다르다». 거기는 `|| null` 이었지만 여기는
     `?? null` 이었다 — 레거시에서 빈 문자열이 오면 그대로 빈 문자열로 남았다.

         레거시  sellerProfile?.manufacturer ?? null   → ""  (프로필은 있고 값이 빈 경우)
         변경    commonSellerSettings.manufacturer     → null

     그래서 경계만 보면 모양이 실제로 달라진다. 그런데 소비 지점인 공통
     resolveManufacturer() 가 clean(v) = (v ?? "").trim() 으로 정규화한 뒤
     truthiness 로 판정하므로 결과가 같다. 아래는 그 전제를 실제 함수로
     확인하는 것이다 — 주석이 아니라 호출로 고정한다. */
  it.each([
    ["레거시 빈 문자열", ""],
    ["canonical null", null],
    ["프로필 없음 undefined", undefined],
    ["공백만", "   "],
  ])("%s 이면 제조사를 못 찾은 것으로 본다", (_label, empty) => {
    expect(resolveManufacturer({ sellerProfileManufacturer: empty })).toEqual({
      value: "",
      source: "NONE",
      resolved: false,
    });
  });

  it("값이 있으면 SELLER_DEFAULT 다", () => {
    expect(resolveManufacturer({ sellerProfileManufacturer: "규하맘샵" })).toEqual({
      value: "규하맘샵",
      source: "SELLER_DEFAULT",
      resolved: true,
    });
  });
});

describe("⑤ 폴백 순서는 바뀌지 않았다", () => {
  it("🔴 브랜드가 판매자보다 앞선다", () => {
    expect(
      resolveManufacturer({
        brandProfileManufacturer: "Bobo Choses S.L.",
        sellerProfileManufacturer: "규하맘샵",
      }).source,
    ).toBe("BRAND_DEFAULT");
  });

  it("🔴 상품 원문이 둘보다 앞선다", () => {
    expect(
      resolveManufacturer({
        productInfoManufacturer: "원문제조사",
        brandProfileManufacturer: "Bobo Choses S.L.",
        sellerProfileManufacturer: "규하맘샵",
      }).source,
    ).toBe("PRODUCT_INFO");
  });

  it("판매자 기본값은 «마지막» 이다 — 앞이 다 비었을 때만 쓰인다", () => {
    expect(resolveManufacturer({ sellerProfileManufacturer: "규하맘샵" }).source).toBe("SELLER_DEFAULT");
  });
});
