import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveLotteOnNotice } from "../../lotteon/notice-resolve";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WIRE-05 A/S · 품질보증 — **두 필드의 결론이 서로 다르다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 품질보증 : 사다리가 없다 → 만들지 않는다 ─────────────────────────────
 *   쿠팡    coupang/build-payload.ts:1451   `sellerConfig.qualityGuarantee || undefined`
 *   네이버  naver/_lib/resolve-context.ts:219 `sellerSettings.qualityGuarantee || null`
 *   롯데ON  lotteon/_lib/build-context.ts     `commonSellerSettings.qualityGuarantee`
 *
 * 셋 다 `seller_settings.quality_guarantee` 하나를 본다. 색상·소재와 같은 결론이다.
 *
 * ── 🔴 A/S : 사다리가 «있는데» 합치면 안 된다 ────────────────────────────
 *   네이버  `sellerSettings.asContactNumber || null`                    폴백 없음
 *   롯데ON  `commonSellerSettings.asContactNumber`                       폴백 없음
 *   쿠팡    `sellerConfig.asContactNumber || sellerConfig.companyContactNumber`  ← 유일한 폴백
 *
 * 🔴 그 폴백은 «다른 개념» 으로 넘어간다. `companyContactNumber` 는 **반품지
 * 연락처**(배송 프로필)이고 A/S 연락처가 아니다.
 *
 * 그리고 네이버가 실측으로 그 경계를 이미 그었다(N-3.51, 5차 실등록) —
 *
 *     afterServiceDirector        자유 텍스트 고시 항목
 *                                 「해외 구매대행으로 A/S 불가」가 실제로 통과한다
 *     afterServiceTelephoneNumber 숫자/-/+ 만 허용하는 «엄격한 전화번호»
 *     → 「같은 소스를 재사용할 수 없다」
 *
 * 즉 A/S 는 **한 개념이 아니다.** Common 으로 올려 하나로 만들면 쿠팡의 폴백이
 * 세 채널에 퍼지고, 고객에게 A/S 번호로 «반품지 번호» 가 나간다.
 *
 * 🔴 그래서 이 파일은 「합쳐라」가 아니라 «갈라 둔 것을 지킨다».
 */

const LISTING = join(__dirname, "..", "..");
const ADMIN = join(LISTING, "..", "..", "..", "apps", "admin", "src", "app", "api");
const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
/** 🔴 주석을 벗기고 본다 — 같은 함정에 여덟 번 걸렸다. */
const codeOf = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const COUPANG = read(join(LISTING, "coupang", "build-payload.ts"));
const NAVER_CTX = read(join(ADMIN, "naver", "_lib", "resolve-context.ts"));
const LOTTEON_CTX = read(join(ADMIN, "lotteon", "_lib", "build-context.ts"));
const COMMON = read(join(LISTING, "common", "origin.ts")) + read(join(LISTING, "common", "manufacturer.ts"));

describe("① 품질보증은 «단일 출처» 다 — 세 채널이 판매자 설정 한 칸을 본다", () => {
  it("쿠팡", () => {
    expect(codeOf(COUPANG)).toContain("qualityGuarantee: sellerConfig.qualityGuarantee || undefined");
  });

  it("네이버", () => {
    expect(codeOf(NAVER_CTX)).toContain("warrantyPolicy: sellerSettings.qualityGuarantee || null");
  });

  it("롯데ON", () => {
    expect(codeOf(LOTTEON_CTX)).toContain("sellerQualityGuarantee: commonSellerSettings.qualityGuarantee");
  });

  it("🔴 품질보증 문구를 채널별로 «바꾸지» 않는다", () => {
    for (const source of [COUPANG, NAVER_CTX, LOTTEON_CTX]) {
      const code = codeOf(source);
      /* 문구를 가공하는 순간 채널마다 다른 약속이 고객에게 나간다. */
      expect(code).not.toMatch(/qualityGuarantee[^\n]*\.replace\(/);
      expect(code).not.toMatch(/qualityGuarantee[^\n]*\.slice\(/);
    }
  });
});

describe("🔴 ② A/S 의 «두 축» 이 섞이지 않는다", () => {
  it("네이버는 A/S 연락처를 고시 항목에만 쓴다", () => {
    expect(codeOf(NAVER_CTX)).toContain("afterServiceDirector: sellerSettings.asContactNumber || null");
  });

  it("🔴 네이버가 A/S 연락처를 «엄격한 전화번호» 칸으로 돌리지 않는다", () => {
    const code = codeOf(NAVER_CTX);
    /* afterServiceTelephoneNumber 는 포맷이 엄격해 같은 소스를 못 쓴다(N-3.51 실측). */
    expect(code).not.toContain("afterServiceTelephoneNumber: sellerSettings.asContactNumber");
  });

  it("롯데ON 은 폴백 없이 A/S 연락처만 본다", () => {
    expect(codeOf(LOTTEON_CTX)).toContain("sellerAsContactNumber: commonSellerSettings.asContactNumber");
    expect(codeOf(LOTTEON_CTX)).not.toContain("companyContactNumber");
  });
});

describe("🔴 ③ 쿠팡의 폴백은 «쿠팡에 남는다» — Common 으로 올리지 않는다", () => {
  it("쿠팡에는 폴백이 있다(현재 동작 그대로)", () => {
    expect(codeOf(COUPANG)).toContain("sellerConfig.asContactNumber || sellerConfig.companyContactNumber");
  });

  it("🔴 공통 폴더에 A/S 관련 export 가 «하나도 없다»", () => {
    /* 🔴 처음에는 식별자 이름(asContactNumber 등)만 찾았다. 음성 대조에서
       통과해 버렸다 — 주입한 함수가 그 이름을 «주석에만» 갖고 있었고,
       주석을 벗기는 로직이 그것을 지웠기 때문이다. 주석 제거는 거짓 양성을
       막지만, 이번에는 거짓 «음성» 을 만들었다.

       그래서 이름이 아니라 «export 자체» 를 본다. 함수명을 바꿔도 잡힌다. */
    const code = codeOf(COMMON);
    const exported = [...code.matchAll(/export\s+(?:const|function|type|interface)\s+(\w+)/g)].map((m) => m[1]);
    const asRelated = exported.filter((name) => /as_?contact|afterservice|a_?s_?contact/i.test(name));
    expect(asRelated).toEqual([]);
    /* 코드 본문에도 그 칸을 읽는 곳이 없다. */
    for (const token of ["asContactNumber", "companyContactNumber"]) {
      expect(code).not.toContain(token);
    }
  });
});

describe("🔴 ④ A/S 「업체명」을 지어내지 않는다 — 롯데ON 0090 은 막힌 채로 둔다", () => {
  const facts = { sellerAsContactNumber: "+821046458306", manufacturer: "Bobo Choses S.L." };

  it("연락처만으로는 채우지 않는다", () => {
    const fill = resolveLotteOnNotice("23", facts).fills.find((f) => f.code === "0090")!;
    expect(fill.status).toBe("BLOCKED");
  });

  it("🔴 제조사·판매자명이 «A/S 칸으로» 새어 나가지 않는다", () => {
    const articles = resolveLotteOnNotice("23", facts).articles;
    /* 🔴 범위를 0090 으로 좁힌다. 처음에 payload 전체를 훑었더니 제조자 항목
       (0070)에 «정상적으로» 실린 제조사를 유출로 잡았다 — 검사가 과했다.
       0070 에 제조사가 들어가는 것은 맞고, 0090 에 들어가면 안 되는 것이다. */
    expect(articles.find((a) => a.pdArtlCd === "0090")).toBeUndefined();
    /* 그리고 연락처는 «어느 항목에도» 실리지 않는다 — 업체명이 없으면 A/S 자체가
       나가지 않기 때문이다. */
    expect(JSON.stringify(articles)).not.toContain("+821046458306");
    /* 제조자 항목에는 제조사가 정상적으로 들어간다(이것까지 막으면 과잉이다). */
    expect(articles.find((a) => a.pdArtlCd === "0070")?.pdArtlCnts).toContain("Bobo Choses S.L.");
  });

  it("업체명 칸이 생기면 그때 채워진다 — 지금 만들지 않을 뿐이다", () => {
    const fill = resolveLotteOnNotice("23", { ...facts, sellerAsCompanyName: "따조 고객센터" }).fills.find(
      (f) => f.code === "0090",
    )!;
    expect(fill.status).toBe("FILLED");
  });
});
