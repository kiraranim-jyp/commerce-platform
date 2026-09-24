import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-02 ⑧(CPO 지시, 2026-09-24) — **채널 전용 값은 채널 밖으로 나가지
 * 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * SmartStore 가 Production 정상등록에 도달하면서 새 개념이 여럿 생겼다:
 *
 *   certificationTargetExcludeContent   Naver 전용 신고 구조체
 *   childCertifiedProductExclusionYn    Naver 전용
 *   kcCertifiedProductExclusionYn       Naver 전용 (TRUE/FALSE/KC_EXEMPTION_OBJECT)
 *   kcExemptionType                     Naver 전용
 *   kids.certificationType              Naver 고시 전용
 *   KcStatus · seller_compliance_confirmations   Naver 전용 상태/기록
 *
 * 🔴 이것들이 쿠팡·롯데ON 으로 «새어 나가면» 각 채널이 받지도 않는 값을 보내게
 * 되고, 더 나쁘게는 한 채널에서 한 규제 판단이 다른 채널의 판단인 것처럼
 * 보이게 된다. 세 채널은 인증을 표현하는 «방식이 전부 다르다»:
 *
 *   SmartStore  productCertificationInfos + certificationTargetExcludeContent
 *   Coupang     items[].notices[].content  (텍스트 한 칸)
 *   LotteON     sftyAthnLst                (채널 입력값)
 *
 * 그래서 「SmartStore 에서 통과한 값을 복사」하지 않는다. 이 파일이 그것을
 * 사람의 기억이 아니라 시험으로 막는다.
 */

const LISTING = join(__dirname, "../..");
const APP = join(__dirname, "../../../../../apps/admin/src/app/api");

/** Naver 전용 어휘 — 다른 채널 코드에 한 글자도 나타나면 안 된다. */
const NAVER_ONLY = [
  "smartStoreKcDeclaration",
  "certificationTargetExcludeContent",
  "childCertifiedProductExclusionYn",
  "kcCertifiedProductExclusionYn",
  "kcExemptionType",
  "resolveKidsCertificationTypeNotice",
  "KIDS_CERTIFICATION_NOT_APPLICABLE",
  "resolveKcStatus",
  "isKcStatusRegistrable",
  "seller_compliance_confirmations",
] as const;

const OTHER_CHANNEL_FILES = [
  ["coupang/build-payload.ts", join(LISTING, "coupang/build-payload.ts")],
  ["lotteon/build-payload.ts", join(LISTING, "lotteon/build-payload.ts")],
  ["api/coupang/register/route.ts", join(APP, "coupang/register/route.ts")],
  ["api/lotteon/register/route.ts", join(APP, "lotteon/register/route.ts")],
] as const;

describe("① 🔴 Naver 전용 어휘가 쿠팡·롯데ON 에 없다", () => {
  it.each(OTHER_CHANNEL_FILES)("%s", (_name, path) => {
    const src = readFileSync(path, "utf8");
    for (const word of NAVER_ONLY) {
      expect(src, `Naver 전용 값이 새어 나갔다: ${word}`).not.toContain(word);
    }
  });
});

describe("② 각 채널은 «자기» 방식으로 인증을 표현한다", () => {
  it("쿠팡 — 고시 텍스트 한 칸(items[].notices[].content)", () => {
    const src = readFileSync(join(LISTING, "coupang/build-payload.ts"), "utf8");
    expect(src).toContain("DEFAULT_KC_EXEMPTION_TEXT");
    expect(src).toContain("noticeCategoryDetailName");
    /* 쿠팡에는 구조화된 인증 필드가 «없다» — 있는 것처럼 만들지 않는다. */
    expect(src).not.toContain("productCertificationInfos");
  });

  it("롯데ON — sftyAthnLst(채널 입력값)", () => {
    const src = readFileSync(join(LISTING, "lotteon/build-payload.ts"), "utf8");
    expect(src).toContain("sftyAthnLst");
    expect(src).not.toContain("productCertificationInfos");
  });

  it("🔴 스마트스토어만 productCertificationInfos 를 쓴다", () => {
    const src = readFileSync(join(LISTING, "naver/build-payload.ts"), "utf8");
    expect(src).toContain("productCertificationInfos");
    expect(src).toContain("certificationTargetExcludeContent");
  });
});

describe("③ 🔴 Master 를 오염시키지 않았다", () => {
  const MASTER = readFileSync(join(LISTING, "../../shared/src/master-product.ts"), "utf8");

  it("채널 선언은 COMMERCE_BINDING 이지 MASTER 가 아니다", () => {
    expect(MASTER).toContain('smartStoreKcDeclaration: "COMMERCE_BINDING"');
    expect(MASTER).not.toContain('smartStoreKcDeclaration: "MASTER_FACTS"');
    expect(MASTER).not.toContain('smartStoreKcDeclaration: "MASTER_CORE"');
  });

  it("쿠팡·롯데ON 전용 선언 필드를 Master 에 «만들지 않았다»", () => {
    for (const forbidden of ["coupangKcDeclaration", "lotteOnKcDeclaration", "kcDeclaration:"]) {
      expect(MASTER).not.toContain(forbidden);
    }
  });
});
