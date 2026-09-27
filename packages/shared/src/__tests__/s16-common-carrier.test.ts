import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMON_CARRIERS, commonCarrierName, findCommonCarrier } from "../common-carrier";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 장기 스프린트 S-16 — **택배사는 하나다. 채널이 각자 읽는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 설정 화면에 택배사 칸이 «둘» 이었다 — 「택배사 (Coupang)」 「택배사 (SmartStore)」.
 * 둘 다 같은 사실을 말하는데 셀러가 두 번 골랐다.
 *
 * 🔴 Commerce 를 20~30개로 늘리는 것이 목표다. 그대로 두면 «택배사 30칸» 이
 * 된다 — 셀러 부담이 Commerce 수만큼 «늘어난다». 만들려는 것과 정반대다.
 */

describe("① 셀러는 하나를 고르고 채널이 각자 읽는다", () => {
  it("우체국택배 하나가 두 채널 값을 «동시에» 갖는다", () => {
    const epost = findCommonCarrier("EPOST")!;
    expect(epost.name).toBe("우체국택배");
    expect(epost.coupang).toBe("EPOST");
    expect(epost.smartstore).toBe("우체국택배");
  });

  /* 🔴 네이버는 출고 택배사 «조회 API 가 없다»(확인됨). 그래서 코드가 아니라
     사람이 읽는 이름이 그대로 간다 — 그 사실을 표가 그대로 담는다. */
  it("스마트스토어 값은 «코드가 아니라 이름» 이다", () => {
    for (const c of COMMON_CARRIERS) {
      expect(c.smartstore, c.key).not.toMatch(/^[A-Z]+$/);
    }
  });

  it("이미 저장된 쿠팡 코드로도 찾힌다 — migration 없이 읽는다", () => {
    expect(findCommonCarrier("CJGLS")?.name).toBe("CJ대한통운");
  });
});

describe("② 🔴 롯데ON 코드를 «지어내지 않는다»", () => {
  /* 89(DV_CO_CD) 실응답을 본 적이 없다. 이름이 같다고 코드가 같다고 볼 근거가
     없다 — 그 값은 셀러가 목록에서 고른 것만 쓴다(S-8/9 · migration 067). */
  it("표에 롯데ON 칸이 아예 없다", () => {
    for (const c of COMMON_CARRIERS) {
      expect(Object.keys(c).sort()).toEqual(["coupang", "key", "name", "smartstore"]);
    }
  });
});

describe("③ 모르면 코드를 «보여주지 않는다» (S-19 와 같은 규칙)", () => {
  it("아는 값은 이름으로", () => {
    expect(commonCarrierName("EPOST")).toBe("우체국택배");
  });

  it("모르는 값은 「택배사 확인 필요」 — 코드가 아니다", () => {
    expect(commonCarrierName("ZZZ_UNKNOWN")).toBe("택배사 확인 필요");
    expect(commonCarrierName("ZZZ_UNKNOWN")).not.toContain("ZZZ");
  });

  it("고른 적이 없으면 빈 칸 — 겁주지 않는다", () => {
    expect(commonCarrierName(null)).toBe("");
    expect(commonCarrierName("  ")).toBe("");
  });
});

describe("④ 설정 화면에 택배사 칸이 «하나» 다", () => {
  const SETTINGS = readFileSync(
    join(__dirname, "..", "..", "..", "..", "apps", "admin", "src", "app", "settings", "page.tsx"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  /* 주석이 옛 라벨을 인용하므로 코드만 본다. */
  const code = SETTINGS.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

  it("채널 이름이 붙은 택배사 칸이 없다", () => {
    expect(code).not.toContain('label="택배사 (Coupang)"');
    expect(code).not.toContain('label="택배사 (SmartStore)"');
  });

  it("「기본 택배사」 하나가 있다", () => {
    expect(code).toContain('label="기본 택배사"');
  });

  /* 🔴 한쪽만 바뀌면 화면은 하나인데 채널마다 다른 택배사로 등록된다. */
  it("고르면 두 채널 값을 «동시에» 쓴다", () => {
    expect(code).toContain("onDeliveryCompanyCodeChange(carrier?.coupang");
    expect(code).toContain("onNaverDeliveryCompanyCodeChange(carrier?.smartstore");
  });
});
