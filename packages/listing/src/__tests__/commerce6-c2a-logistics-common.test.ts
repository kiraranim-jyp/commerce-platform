import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMMON_LOGISTICS_CONCEPTS,
  LOTTEON_ONLY_DELIVERY_VALUES,
  describeLotteOnSellerSettings,
  describeUnresolvedBinding,
  findCommonLogisticsConcept,
  promotableCommonLogistics,
  type CommerceChannel,
} from "../index";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 C-2A — **배송/물류 Common 은 «코드를 저장하는 자리» 가 아니다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * C-2 는 「우체국택배를 기본값으로 저장하자」였다. 저장소를 찾다가 먼저 확인한
 * 것: **채널이 목록을 주는 값은 세 채널 어디서도 저장하지 않는다.** 네이버는
 * 주소록과 반품택배사를 조회해서 «역할로» 고르고, 쿠팡은 출고지를 조회해서
 * «원산지 국가로» 고른다. 우리 DB 에 채널 코드가 들어 있는 칸은 전부 목록 API 가
 * 없어서 생긴 예외다.
 *
 * 그래서 이 표가 고정하는 것은 값이 아니라 **해석 방법** 이다.
 */

const CHANNELS: CommerceChannel[] = ["SMARTSTORE", "COUPANG", "LOTTEON"];

describe("① 표가 «전수» 이고 빈 칸이 없다", () => {
  it("여덟 개 개념이 세 채널 칸을 모두 갖는다", () => {
    expect(COMMON_LOGISTICS_CONCEPTS).toHaveLength(8);
    for (const concept of COMMON_LOGISTICS_CONCEPTS) {
      for (const channel of CHANNELS) {
        const binding = concept.bindings[channel];
        expect(binding, `${concept.key}/${channel}`).toBeTruthy();
        /* 🔴 근거 없는 칸을 만들지 않는다 — 어디를 보고 적었는지가 항상 있다. */
        expect(binding.evidence.length, `${concept.key}/${channel}`).toBeGreaterThan(0);
      }
    }
  });

  it("키가 중복되지 않는다", () => {
    const keys = COMMON_LOGISTICS_CONCEPTS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("② 🔴 채널이 목록을 주면 payload 필드가 있고, 없으면 «없다»고 말한다", () => {
  it("CHANNEL_LIST 는 목록 출처와 payload 필드를 둘 다 갖는다", () => {
    for (const concept of COMMON_LOGISTICS_CONCEPTS) {
      for (const channel of CHANNELS) {
        const binding = concept.bindings[channel];
        if (binding.strategy !== "CHANNEL_LIST") continue;
        expect(binding.listSource, `${concept.key}/${channel}`).toBeTruthy();
        expect(binding.payloadField, `${concept.key}/${channel}`).toBeTruthy();
      }
    }
  });

  it("NOT_APPLICABLE 은 payload 필드를 갖지 않는다 — 없는 필드를 지어내지 않는다", () => {
    for (const concept of COMMON_LOGISTICS_CONCEPTS) {
      for (const channel of CHANNELS) {
        const binding = concept.bindings[channel];
        if (binding.strategy !== "NOT_APPLICABLE") continue;
        expect(binding.payloadField, `${concept.key}/${channel}`).toBeNull();
      }
    }
  });
});

describe("③ 🔴 채널 발급 ID 는 Common 값이 «될 수 없다»", () => {
  /* CPO B 항 — DV_CO_CD / DV_RGSPR_GRP_CD 같은 값 자체를 Common 으로 올리면
     그 순간 Common 이 한 채널의 코드체계가 된다. */
  it("출고지·반품지는 PROMOTE 가 아니라 ROLE_ONLY 다", () => {
    expect(findCommonLogisticsConcept("OUTBOUND_PLACE")!.promotion).toBe("ROLE_ONLY");
    expect(findCommonLogisticsConcept("RETURN_PLACE")!.promotion).toBe("ROLE_ONLY");
  });

  it("Common 이 값을 갖는 것은 «이름·금액·일수» 뿐이다", () => {
    for (const concept of promotableCommonLogistics()) {
      expect(["NAMED_VALUE", "AMOUNT", "DAYS"], concept.key).toContain(concept.meaning);
    }
  });

  /* 🔴 이 파일 어디에도 실제 코드 «값» 이 없다. 89 응답을 못 봤으므로 추정하지
     않는다 — 문자열이 아니라 소스 전문을 본다(주석에 적어 두는 것도 금지). */
  it("소스에 롯데ON 코드값이나 Production 식별자가 없다", () => {
    const source = readFileSync(join(__dirname, "..", "common", "logistics.ts"), "utf8");
    expect(source).not.toMatch(/4279402|4279403/);
    /* `DV_CO_CD` 는 «목록 출처» 로만 나온다 — 그 그룹의 코드값은 없다. */
    expect(source).not.toMatch(/cd\s*[:=]\s*["'][0-9]{4}["']/);
  });
});

describe("④ 🔴 이번 조사에서 뒤집힌 «거짓 문장» 두 개", () => {
  const byLabel = Object.fromEntries(LOTTEON_ONLY_DELIVERY_VALUES.map((r) => [r.label, r]));

  /* 예전 문장: 「쿠팡·스마트스토어는 반품 택배사를 구분하지 않습니다」
     사실: 스마트스토어는 목록 API 까지 있고 PRIMARY 를 고른다. */
  it("반품 택배사 — 스마트스토어는 «구분한다»", () => {
    const smartstore = findCommonLogisticsConcept("RETURN_CARRIER")!.bindings.SMARTSTORE;
    expect(smartstore.strategy).toBe("CHANNEL_LIST");
    expect(byLabel["반품 택배사"].note).not.toContain("스마트스토어는 반품 택배사를 구분하지 않");
    expect(byLabel["반품 택배사"].note).toContain("스마트스토어");
  });

  /* 예전 문장: 「쿠팡·스마트스토어도 이 값을 쓰지 않습니다」
     사실: 쿠팡은 쓴다 — 셀러에게 묻지 않고 상수로 보낸다. */
  it("배송 가능 지역 — 쿠팡은 «상수로» 보내고 있다", () => {
    expect(findCommonLogisticsConcept("REMOTE_AREA")!.bindings.COUPANG.strategy).toBe("CONSTANT");
    expect(byLabel["배송 가능 지역"].note).toContain("쿠팡");
  });

  it("출고 소요일은 스마트스토어 payload 에 «없다»", () => {
    expect(findCommonLogisticsConcept("OUTBOUND_LEAD_DAYS")!.bindings.SMARTSTORE.strategy).toBe(
      "NOT_APPLICABLE",
    );
  });
});

describe("⑤ binding 미확정은 «추정» 이 아니라 «어디서 해결하는지» 로 말한다", () => {
  it("채널 목록이 있으면 고르라고 한다 — 코드를 적으라고 하지 않는다", () => {
    const unresolved = describeUnresolvedBinding("CARRIER", "LOTTEON", "우체국택배")!;
    expect(unresolved.meaningValue).toBe("우체국택배");
    expect(unresolved.resolveHint).toContain("골라");
    /* 🔴 「코드를 입력하세요」가 결론이 되는 것을 금지한다(CPO F-7 재확인). */
    expect(unresolved.resolveHint).not.toContain("입력");
  });

  it("그 채널에 개념이 없으면 «부족» 이라고 하지 않는다", () => {
    expect(describeUnresolvedBinding("RETURN_CARRIER", "COUPANG", "우체국택배")).toBeNull();
    /* 상수로 나가는 값도 셀러가 해결할 것이 아니다. */
    expect(describeUnresolvedBinding("REMOTE_AREA", "COUPANG", "전국")).toBeNull();
  });

  it("확인되지 않은 것은 «모른다»고 말한다 — 지어내지 않는다", () => {
    const unresolved = describeUnresolvedBinding("DISPATCH_CUTOFF", "LOTTEON", "17시")!;
    expect(unresolved.resolveHint).toContain("확인되지 않");
  });
});

describe("⑥ 🔴 셀러가 보는 표에 Commerce 내부 필드명이 없다 — F-7 이 놓쳤던 자리", () => {
  const PANEL = readFileSync(
    join(__dirname, "..", "..", "..", "..", "apps", "admin", "src", "app", "pipeline", "commerce", "LotteOnRegistrationPanel.tsx"),
    "utf8",
  );

  it("판정표가 라벨 옆에 lotteOnField 를 그리지 않는다", () => {
    /* 예전에는 `→ {row.lotteOnField}` 를 찍어 셀러가 owhpNo·hdcCd·dvCstPolNo 를
       그대로 봤다. 데이터에는 남기되 화면에서는 뺀다. */
    expect(PANEL).not.toContain("→ {row.lotteOnField}");
  });

  it("라벨이 코드가 아니라 의미다", () => {
    const labels = describeLotteOnSellerSettings(null).map((r) => r.label);
    for (const label of labels) {
      expect(label, label).not.toMatch(/[A-Za-z]{3,}/);
    }
    expect(labels).toContain("배송 가능 지역");
    expect(labels).toContain("반품 택배사");
  });

  it("셀러가 읽는 note 에 코드그룹 이름이 없다", () => {
    for (const row of describeLotteOnSellerSettings(null)) {
      expect(row.note, row.label).not.toContain("DV_CO_CD");
      expect(row.note, row.label).not.toContain("DV_RGSPR_GRP_CD");
      expect(row.note, row.label).not.toContain("OPLC_CD");
    }
  });
});
