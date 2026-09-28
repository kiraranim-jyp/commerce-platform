import { describe, expect, it } from "vitest";
import { COMMON_CARRIERS } from "@commerce/shared";
import { describeLotteOnCarrierMatch, resolveLotteOnCarrier } from "../carrier-match";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * STEP 3 — 공통 택배사 → 롯데ON 코드. **완전 일치만.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 아래 `LOTTEON_COURIERS` 는 «실응답» 이다. 지어낸 fixture 가 아니다 —
 * 2026-09-28 CEO 가 한 번 확보한 `GET /api/lotteon/common-codes?group=DV_CO_CD`
 * 응답 61건을 그대로 옮겼다. 그 실응답이 이 자동화의 유일한 근거다.
 *
 * 🔴 그리고 그 목록 안에 «왜 완전 일치여야 하는지» 가 들어 있다 —
 *
 *     0001 롯데택배        vs  0055 롯데택배 해외특송
 *     0002 CJ대한통운      vs  0056 CJ대한통운 국제특송
 *
 * 부분 일치를 쓰면 국내 배송이 국제특송으로 등록된다.
 */

/** 🔴 실응답 61건 전수(2026-09-28). 잘라내지 않았다 — 오매칭 후보가 들어 있어야
 *  이 검사가 의미가 있다. */
const LOTTEON_COURIERS = [
  { code: "0001", name: "롯데택배" },
  { code: "0002", name: "CJ대한통운" },
  { code: "0004", name: "우체국택배" },
  { code: "0005", name: "로젠택배" },
  { code: "0006", name: "한진택배" },
  { code: "0007", name: "ECMS Express" },
  { code: "0008", name: "DHL" },
  { code: "0010", name: "EMS" },
  { code: "0011", name: "Fedex" },
  { code: "0012", name: "GSI Express" },
  { code: "0013", name: "GSMNtoN(인로스)" },
  { code: "0017", name: "KGL네트웍스" },
  { code: "0020", name: "TNT Express" },
  { code: "0022", name: "USPS" },
  { code: "0023", name: "건영택배" },
  { code: "0024", name: "경동택배" },
  { code: "0028", name: "대신택배" },
  { code: "0033", name: "LX판토스(해외배송)" },
  { code: "0035", name: "애니트랙" },
  { code: "0041", name: "일양로지스" },
  { code: "0042", name: "GS Postbox 택배" },
  { code: "0043", name: "천일택배" },
  { code: "0044", name: "CU편의점택배" },
  { code: "0047", name: "한덱스" },
  { code: "0048", name: "한의사랑택배" },
  { code: "0049", name: "합동택배" },
  { code: "0053", name: "우리택배" },
  { code: "0054", name: "제니엘" },
  { code: "0055", name: "롯데택배 해외특송" },
  { code: "0056", name: "CJ대한통운 국제특송" },
  { code: "0060", name: "롯데칠성" },
  { code: "0061", name: "GTS로지스" },
  { code: "0063", name: "ACI Express" },
  { code: "0065", name: "LG전자(판토스)" },
  { code: "0066", name: "LTL" },
  { code: "0067", name: "더바오" },
  { code: "0068", name: "핑퐁" },
  { code: "0069", name: "카카오T당일배송" },
  { code: "0070", name: "A.C.E EXPRESS INC" },
  { code: "0071", name: "큐익스프레스" },
  { code: "0072", name: "이스트라" },
  { code: "0073", name: "두발히어로" },
  { code: "0074", name: "현대글로비스" },
  { code: "0075", name: "HY" },
  { code: "0077", name: "UPS" },
  { code: "0078", name: "SLX택배" },
  { code: "0081", name: "농협택배" },
  { code: "0086", name: "은하쉬핑" },
  { code: "0090", name: "대림통운" },
  { code: "0091", name: "LOTOS CORPORATION" },
  { code: "0098", name: "컬리넥스트마일" },
  { code: "0105", name: "팬스타국제특송(PIEX)" },
  { code: "0129", name: "딜리래빗" },
  { code: "0150", name: "발렉스 특수물류" },
  { code: "0155", name: "위니온로지스" },
  { code: "0159", name: "딜리박스" },
  { code: "0169", name: "티에스지로지스" },
  { code: "8282", name: "투데이" },
  { code: "9000", name: "자체배송" },
  { code: "9999", name: "기타택배" },
  { code: "LE_QUICK", name: "엘롯데퀵배송사" },
] as const;

/** 실응답으로 고정한 1:1 표. 🔴 코드를 «우리 표에» 박지 않고 이 검사에만 둔다. */
const EXPECTED: Record<string, string> = {
  CJGLS: "0002",
  HANJIN: "0006",
  LOTTE: "0001",
  KGB: "0005",
  EPOST: "0004",
  KDEXP: "0024",
  HDEXP: "0049",
  ILYANG: "0041",
  CHUNIL: "0043",
  DAESIN: "0028",
};

describe("① 실응답으로 고정한 10건 — 완전 일치로 이어진다", () => {
  it.each(Object.entries(EXPECTED))("%s → %s", (key, code) => {
    const match = resolveLotteOnCarrier(key, LOTTEON_COURIERS);
    expect(match.status).toBe("MATCHED");
    expect(match.status === "MATCHED" && match.code).toBe(code);
  });

  /* 🔴 저장된 «옛 쿠팡 코드» 로도 찾아야 한다 — 마이그레이션 없이 읽는 원칙. */
  it("옛 쿠팡 코드(EPOST)로 저장돼 있어도 0004 로 이어진다", () => {
    const match = resolveLotteOnCarrier("EPOST", LOTTEON_COURIERS);
    expect(match.status === "MATCHED" && match.code).toBe("0004");
  });
});

describe("② 🔴 11번째 — 완전 일치가 «아니므로» 잇지 않는다", () => {
  /*
   * 공통 이름   「GS Postbox 택배(편의점택배)」
   * 롯데ON      「GS Postbox 택배」        ← 괄호가 없다
   *
   * 괄호를 떼면 이어지지만 그 정규화는 «내가 만드는 규칙» 이다. 그리고 한 번
   * 허용하면 「롯데택배」와 「롯데택배 해외특송」 사이에서도 같은 논리를 쓰게 된다.
   */
  it("CVSNET 은 NOT_FOUND 다 — 확인 필요로 남는다", () => {
    const match = resolveLotteOnCarrier("CVSNET", LOTTEON_COURIERS);
    expect(match.status).toBe("NOT_FOUND");
    expect(describeLotteOnCarrierMatch(match)).toContain("롯데ON 택배사 매핑 확인 필요");
  });

  it("공통 11종 중 «정확히 10건» 만 이어진다", () => {
    const matched = COMMON_CARRIERS.filter(
      (c) => resolveLotteOnCarrier(c.key, LOTTEON_COURIERS).status === "MATCHED",
    );
    expect(matched).toHaveLength(10);
    expect(COMMON_CARRIERS).toHaveLength(11);
  });
});

describe("③ 🔴 오매칭 방지 — 부분 일치·유사명·첫 후보를 쓰지 않는다", () => {
  it("「롯데택배」가 «해외특송» 으로 가지 않는다", () => {
    const match = resolveLotteOnCarrier("LOTTE", LOTTEON_COURIERS);
    expect(match.status === "MATCHED" && match.code).toBe("0001");
    expect(match.status === "MATCHED" && match.name).toBe("롯데택배");
  });

  it("「CJ대한통운」이 «국제특송» 으로 가지 않는다", () => {
    const match = resolveLotteOnCarrier("CJGLS", LOTTEON_COURIERS);
    expect(match.status === "MATCHED" && match.code).toBe("0002");
  });

  /* 🔴 목록에 «해외특송만» 있을 때도 국내 이름을 그것에 붙이지 않는다. */
  it("정확한 이름이 없고 «비슷한 이름» 만 있으면 NOT_FOUND 다", () => {
    const onlyOverseas = [
      { code: "0055", name: "롯데택배 해외특송" },
      { code: "0056", name: "CJ대한통운 국제특송" },
    ];
    expect(resolveLotteOnCarrier("LOTTE", onlyOverseas).status).toBe("NOT_FOUND");
    expect(resolveLotteOnCarrier("CJGLS", onlyOverseas).status).toBe("NOT_FOUND");
  });

  it("목록이 비어 있으면 코드를 «만들지 않는다»", () => {
    expect(resolveLotteOnCarrier("EPOST", []).status).toBe("NOT_FOUND");
  });
});

describe("④ 이을 대상이 없는 경우를 «구분해서» 말한다", () => {
  it.each([[""], [null], [undefined], ["   "]])("공통 택배사가 없으면 NO_COMMON_CARRIER (%s)", (value) => {
    expect(resolveLotteOnCarrier(value as string | null, LOTTEON_COURIERS).status).toBe("NO_COMMON_CARRIER");
  });

  it("우리 표가 모르는 값이면 UNKNOWN_COMMON_CARRIER — 이름을 «추정하지 않는다»", () => {
    /* 🔴 저장된 문자열을 그대로 롯데ON 목록과 비교하면 우연히 맞을 수 있다.
       그것은 근거가 아니다 — 우리 표에 없으면 모른다고 말한다. */
    const match = resolveLotteOnCarrier("우체국택배", LOTTEON_COURIERS);
    expect(match.status).toBe("UNKNOWN_COMMON_CARRIER");
  });

  it("같은 이름이 둘 이상이면 AMBIGUOUS — 아무거나 고르지 않는다", () => {
    const duplicated = [
      { code: "0004", name: "우체국택배" },
      { code: "9004", name: "우체국택배" },
    ];
    const match = resolveLotteOnCarrier("EPOST", duplicated);
    expect(match.status).toBe("AMBIGUOUS");
    expect(match.status === "AMBIGUOUS" && match.count).toBe(2);
  });
});

describe("⑤ 🔴 셀러 문구에 코드가 «없다»", () => {
  it.each([
    [resolveLotteOnCarrier("EPOST", LOTTEON_COURIERS)],
    [resolveLotteOnCarrier("CVSNET", LOTTEON_COURIERS)],
    [resolveLotteOnCarrier("", LOTTEON_COURIERS)],
    [resolveLotteOnCarrier("우체국택배", LOTTEON_COURIERS)],
  ])("문구에 롯데ON 코드가 들어가지 않는다", (match) => {
    const sentence = describeLotteOnCarrierMatch(match);
    for (const code of ["0004", "0001", "0002", "0042", "DV_CO_CD"]) {
      expect(sentence, code).not.toContain(code);
    }
  });
});
