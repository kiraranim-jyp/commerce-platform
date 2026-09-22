import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TTAEJYO-PIVOT-03 ⑨ 0-3 — QA 배치가 Production 과 «같은» 판매자 정보를 본다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 ────────────────────────────────────────────────────────────────────
 * ⑤ 에서 쿠팡 Production 을 seller_settings 로 옮기면서 QA 배치는 그대로 뒀다.
 * 그 순간부터 둘이 «다른 표» 를 읽었다.
 *
 *     Production  loadSellerSettings()       → seller_settings
 *     QA 배치      getDefaultSellerProfile()  → coupang_seller_profiles
 *
 * 지금은 dual-write 덕에 값이 같아서 티가 안 난다. 하지만 QA 배치는 「Production
 * 과 같은 조립을 한다」는 «전제로» 쓰는 도구다 — 그 전제가 깨져 있으면 QA 가
 * 통과시킨 것이 실제로는 통과가 아니다. dual-write 를 떼면 바로 드러난다.
 *
 * ── 🔴 이 파일이 지키는 것 ────────────────────────────────────────────────
 * 「QA 와 Production 이 판매자 다섯 칸에 대해 같은 식을 쓴다」 하나다.
 * 그래서 한쪽만 읽지 않고 «두 파일을 나란히» 읽어서 비교한다. 한쪽을 고치고
 * 다른 쪽을 잊으면 여기서 깨진다 — 그게 이번에 실제로 일어났던 일이다.
 *
 * ── 이번에 맞추지 «않은» 것 (CEO 승인, 별도 QA parity 트랙) ───────────────
 * detailBlocks · brandProfile.brandIntro 는 QA 와 Production 이 다르다.
 * 판매자 설정과 무관한 기존 차이라 이번에 섞지 않는다 — 섞으면 QA 결과가
 * 달라졌을 때 원인이 둘이 된다.
 */

const API = join(__dirname, "../..");
const QA = readFileSync(join(API, "admin/registration-qa-batch/route.ts"), "utf8");
const PROD = readFileSync(join(API, "coupang/register/route.ts"), "utf8");

const FIVE = [
  "manufacturer",
  "asContactNumber",
  "qualityGuarantee",
  "defaultCountryOfOrigin",
  "kcExemptionText",
] as const;

describe("① QA 와 Production 이 «같은 식» 을 쓴다", () => {
  it.each(FIVE)("%s — 두 파일에 같은 줄이 있다", (field) => {
    const line = `${field}: sellerSettings.${field} ?? ""`;
    expect(QA).toContain(line);
    expect(PROD).toContain(line);
  });

  it("🔴 다섯 칸이 전부다 — 한 줄이라도 빠지면 그 칸만 두 표가 갈라진다", () => {
    const pick = (src: string) => (src.match(/\w+: sellerSettings\.\w+ \?\? ""/g) ?? []).sort();
    expect(pick(QA)).toHaveLength(5);
    expect(pick(QA)).toEqual(pick(PROD));
  });
});

describe("② QA 가 레거시를 더 이상 읽지 않는다", () => {
  it("🔴 배송 프로필에서 판매자 5칸을 읽는 곳이 남지 않았다", () => {
    const leftovers = QA.match(
      /sellerProfile\??\.(manufacturer|asContactNumber|qualityGuarantee|defaultCountryOfOrigin|kcExemptionText)/g,
    );
    expect(leftovers).toBeNull();
  });

  it("loadSellerSettings 를 실제로 부른다", () => {
    expect(QA).toContain("await loadSellerSettings()");
  });
});

describe("③ 조회는 «배치 한 번» 에 한 번뿐이다", () => {
  it("🔴 루프 밖에서 한 번만 부른다 — 30건 × DB 왕복이 되면 안 된다", () => {
    expect(QA.match(/await loadSellerSettings\(\)/g) ?? []).toHaveLength(1);
  });

  it("🔴 runOne 안에서 부르지 않는다 — 인자로 받는다", () => {
    // 안에서 부르면 왕복이 30배가 될 뿐 아니라, 배치 도중 설정이 바뀌면
    // 앞뒤 상품이 «다른 판매자 정보» 로 검사된다. 그러면 결과를 비교할 수 없다.
    const runOne = QA.slice(QA.indexOf("async function runOne"), QA.indexOf("export async function POST"));
    expect(runOne).not.toContain("loadSellerSettings(");
    expect(runOne).toContain("sellerSettings: Awaited<ReturnType<typeof loadSellerSettings>>");
  });

  it("배치 루프가 이미 읽은 값을 그대로 넘긴다", () => {
    expect(QA).toContain(
      "runOne(item, credentials, vendorUserId, sellerProfile, sellerSettings, descriptionTemplate)",
    );
  });
});

describe("④ 판매자 5칸 «외» 는 배송 프로필에 그대로 있다", () => {
  it("🔴 getDefaultSellerProfile 을 계속 부른다 — 23칸이 여기서 온다", () => {
    expect(QA).toContain("await getDefaultSellerProfile()");
  });

  it.each([
    ["택배사", "sellerProfile.deliveryCompanyCode"],
    ["반품지 코드", "sellerProfile.returnCenterCode"],
    ["반품지 연락처", "sellerProfile.companyContactNumber"],
    ["배송비", "sellerProfile.deliveryCharge"],
    ["출고 소요일", "sellerProfile.outboundLeadTimeDays"],
    ["출고지", "sellerProfile.outboundShippingPlaceCode"],
    ["상단 공통이미지", "sellerProfile.topCommonImageUrl"],
    ["하단 공통이미지", "sellerProfile.bottomCommonImageUrl"],
  ])("%s 는 배송 프로필에 남아 있다", (_label, expr) => {
    expect(QA).toContain(expr);
  });

  it("🔴 반품지 연락처는 A/S 연락처와 «다른 값» 이다", () => {
    // 이름이 비슷해서 같이 옮기기 쉽다. 쿠팡은 asContactNumber ||
    // companyContactNumber 로 폴백까지 한다 — 섞이면 고객에게 다른 번호가 나간다.
    expect(QA).toContain("companyContactNumber: sellerProfile.companyContactNumber");
    expect(PROD).toContain("companyContactNumber: sellerProfile.companyContactNumber");
  });
});

describe("⑤ 공유 로직은 건드리지 않았다", () => {
  it.each([
    ["payload 빌더", "buildCoupangPayload"],
    ["compliance 판정", "buildComplianceReport"],
    ["출고지 선택", "selectOutboundShippingPlace"],
    ["카테고리 메타", "fetchCategoryMeta"],
    ["브랜드", "resolveBrand"],
  ])("%s 는 여전히 양쪽이 같은 것을 쓴다", (_label, symbol) => {
    expect(QA).toContain(symbol);
    expect(PROD).toContain(symbol);
  });
});

describe("⑥ 이번에 «맞추지 않은» 차이 — 별도 트랙", () => {
  /* 🔴 이 검사들은 「같아야 한다」가 아니라 「지금 다르다」를 기록한다.
     CEO 가 0-3 에서 제외를 승인했다(QA parity 별도 트랙). 나중에 누군가
     맞추면 여기가 깨지고, 그때 이 주석을 읽고 트랙이 닫혔는지 확인하면 된다.
     무언가를 막는 검사가 아니라 «알고 남겨 둔 것» 이라는 표시다. */
  it("detailBlocks — Production 만 넘긴다", () => {
    expect(PROD).toContain("detailBlocks");
    expect(QA).not.toContain("detailBlocks");
  });

  it("brandIntro — Production 만 넘긴다", () => {
    expect(PROD).toContain("brandIntro");
    expect(QA).not.toContain("brandIntro");
  });
});
