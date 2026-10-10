import { describe, expect, it } from "vitest";

import {
  buildNaverNoticePayload,
  coupangNoticeAdapterStatus,
  naverNoticeFieldOrder,
  naverNoticeFieldsFromModel,
  naverNoticeTypeForKind,
  lotteOnNoticeSlots,
  lotteOnNoticeSpecs,
  naverNoticeSlots,
  noticeKindForLotteOnItemCode,
} from "../channel-notice-adapters";
import { noticeSchemaFor } from "../../lotteon/notice-schema";
import { resolveLotteOnNotice } from "../../lotteon/notice-resolve";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B⑥ — builder 가 공통 모델에서 항목을 받아 가는가 (2026-10-10, CPO 승인)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 교체의 전제는 하나다: **payload 가 바뀌지 않는다.** 그래서 이 파일이 보는
 *    것은 「공통 모델이 내는 항목·순서가 롯데ON 전사본과 «한 칸도» 다르지 않은가」다.
 *    집합만 같고 순서가 다르면 payload 의 `pdItmsArtlLst` 순서가 바뀐다.
 *
 * 🔴 그리고 어긋날 때 **부분 고시를 내보내지 않는다**(fail closed). 규제 항목을
 *    하나 빼고 통과시키는 것은 통과가 아니라 잘못된 신고다.
 */

describe("① 품목코드 ↔ 공통 의미", () => {
  it("01=의류 · 23=어린이제품", () => {
    expect(noticeKindForLotteOnItemCode("01")).toBe("APPAREL");
    expect(noticeKindForLotteOnItemCode("23")).toBe("KIDS_APPAREL");
  });

  it("🔴 모르는 품목을 그럴듯한 쪽으로 떨어뜨리지 않는다", () => {
    for (const code of ["99", "02", "", " 01", null, undefined]) {
      expect(noticeKindForLotteOnItemCode(code)).toBe("UNKNOWN");
    }
  });
});

describe("② 🔴 공통 모델이 내는 항목·순서가 전사본과 «정확히» 같다", () => {
  it.each([["01"], ["23"]])("품목 %s — 코드 순서가 한 칸도 다르지 않다", (code) => {
    const fromModel = lotteOnNoticeSpecs(code);
    const transcription = noticeSchemaFor(code);
    expect(fromModel).not.toBeNull();
    /* 🔴 집합이 아니라 «배열» 로 비교한다 — 순서가 payload 순서다. */
    expect(fromModel?.map((s) => s.code)).toEqual(transcription?.map((s) => s.code));
  });

  it("🔴 라벨·가이드라인은 전사본 그대로 온다 — 공통 모델이 이름을 덮지 않는다", () => {
    const specs = lotteOnNoticeSpecs("23");
    const transcription = noticeSchemaFor("23");
    expect(specs).toEqual(transcription);
    /* 품목 01 의 `0090` 은 「A/S」이고 23 은 「A/S 책임자와 전화번호」다.
       같은 코드의 이름이 품목마다 다르다 — 그 사실이 보존돼야 한다. */
    expect(lotteOnNoticeSpecs("01")?.find((s) => s.code === "0090")?.label).toBe("A/S");
    expect(specs?.find((s) => s.code === "0090")?.label).toBe("A/S 책임자와 전화번호");
  });

  it("🔴 같은 코드를 두 의미가 공유해도 한 번만 나온다 — 0780(크기, 중량)", () => {
    const codes = lotteOnNoticeSpecs("23")?.map((s) => s.code) ?? [];
    expect(codes.filter((c) => c === "0780")).toHaveLength(1);
    /* 중복이 생기면 payload 에 같은 pdArtlCd 가 두 번 들어간다. */
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("모르는 품목은 null 이다 — 항목을 지어내지 않는다", () => {
    expect(lotteOnNoticeSpecs("99")).toBeNull();
    expect(lotteOnNoticeSpecs(null)).toBeNull();
    expect(lotteOnNoticeSpecs(undefined)).toBeNull();
  });
});

describe("③ slot 은 필수여부를 «그 채널 기준» 으로 들고 온다", () => {
  it("롯데ON 은 전 항목 필수다 (전사본의 「필수여부」 열 = Y)", () => {
    const slots = lotteOnNoticeSlots("KIDS_APPAREL");
    expect(slots).toHaveLength(13);
    expect(slots.every((s) => s.required === "REQUIRED")).toBe(true);
  });

  it("🔴 네이버는 같은 의미에서 다른 답을 낸다 — 세 값이 뭉개지지 않는다", () => {
    const naver = naverNoticeSlots("KIDS_APPAREL");
    const releaseDate = naver.find((s) => s.semanticKey === "releaseDate");
    expect(releaseDate?.required).toBe("UNKNOWN");
    /* 대조군 — 롯데ON 의 같은 의미는 REQUIRED 다. */
    expect(
      lotteOnNoticeSlots("KIDS_APPAREL").find((s) => s.semanticKey === "releaseDate")?.required,
    ).toBe("REQUIRED");
  });

  it("네이버 칸 수는 kids 13 · wear 8 이다", () => {
    expect(naverNoticeSlots("KIDS_APPAREL")).toHaveLength(13);
    expect(naverNoticeSlots("APPAREL")).toHaveLength(8);
  });

  it("UNKNOWN 품목은 slot 이 하나도 없다", () => {
    expect(lotteOnNoticeSlots("UNKNOWN")).toEqual([]);
    expect(naverNoticeSlots("UNKNOWN")).toEqual([]);
  });
});

describe("③-b 🔴 Naver — 집합은 공통 모델, 순서는 채널 (①)", () => {
  /**
   * 🔴 「payload shape 유지」를 «순서까지» 못박는다. `toEqual` 은 키 순서를 보지
   *    않으므로 기존 92건은 순서가 뒤집혀도 통과한다. 그래서 여기서 직접 센다.
   *
   * 🔴 순서는 **채널** 이 정한다 — 공통 모델 순서(고시 표 순서)와 «다르다».
   *    라벨을 공통으로 올리지 않은 것과 같은 이유다.
   */
  it.each([
    ["KIDS" as const, 13],
    ["WEAR" as const, 8],
  ])("%s 칸 집합이 공통 모델과 «양방향» 으로 같다 (칸 %d개)", (type, count) => {
    const fromChannel = [...naverNoticeFieldOrder(type)];
    const fromModel = naverNoticeFieldsFromModel(type);
    expect(fromChannel).toHaveLength(count);
    expect(fromChannel.filter((f) => !fromModel.includes(f))).toEqual([]);
    expect(fromModel.filter((f) => !fromChannel.includes(f))).toEqual([]);
  });

  /**
   * 🔴 **독립 기준이다.** B⑥ 교체 «전» 의 build-payload.ts 객체 리터럴 순서를
   *    그대로 전사한 것이고, adapter 상수를 참조하지 «않는다».
   *
   *    처음에는 기대값도 `naverNoticeFieldOrder()` 로 적었다 — 순환 테스트였고,
   *    음성 대조에서 KIDS 순서를 뒤집었는데 **걸리지 않았다**(양쪽이 같이
   *    바뀌니까). 순서를 지키려는 가드가 순서를 하나도 지키지 못하고 있었다.
   *    그래서 숫자를 손으로 박는다 — 이 배열이 「payload shape」의 정의다.
   */
  const SHAPE_BEFORE_B6 = {
    KIDS: [
      "material",
      "color",
      "size",
      "manufacturer",
      "caution",
      "recommendedAge",
      "warrantyPolicy",
      "afterServiceDirector",
      "itemName",
      "modelName",
      "weight",
      "certificationType",
      "releaseDateText",
    ],
    WEAR: [
      "material",
      "color",
      "size",
      "manufacturer",
      "caution",
      "warrantyPolicy",
      "afterServiceDirector",
      "packDateText",
    ],
  } as const;

  it("🔴 조립된 payload 의 키 «순서» 가 교체 «전» 과 한 칸도 다르지 않다", () => {
    const values = Object.fromEntries(
      [...SHAPE_BEFORE_B6.KIDS, ...SHAPE_BEFORE_B6.WEAR].map((f) => [f, `v-${f}`]),
    );
    const kids = buildNaverNoticePayload("KIDS_APPAREL", values);
    expect(kids.productInfoProvidedNoticeType).toBe("KIDS");
    expect(Object.keys("kids" in kids ? kids.kids : {})).toEqual([...SHAPE_BEFORE_B6.KIDS]);

    const wear = buildNaverNoticePayload("APPAREL", values);
    expect(Object.keys("wear" in wear ? wear.wear : {})).toEqual([...SHAPE_BEFORE_B6.WEAR]);
  });

  it("adapter 상수도 그 순서와 같다 (상수를 건드리면 둘 다 떨어진다)", () => {
    expect([...naverNoticeFieldOrder("KIDS")]).toEqual([...SHAPE_BEFORE_B6.KIDS]);
    expect([...naverNoticeFieldOrder("WEAR")]).toEqual([...SHAPE_BEFORE_B6.WEAR]);
  });

  it("🔴 UNKNOWN 은 WEAR 다 — 「모르니까 닫는다」로 바꾸지 않았다", () => {
    /* 네이버 입력에는 카테고리 경로가 없어 UNKNOWN 이 흔하고, 그 상품들은 지금
       일반 의류로 정상 등록된다. 여기서 닫으면 돌고 있는 등록이 깨진다 —
       한 번 KIDS 로 바꿨다가 선재 테스트 7건이 잡아 되돌린 기록이 있다. */
    expect(naverNoticeTypeForKind("UNKNOWN")).toBe("WEAR");
    const payload = buildNaverNoticePayload(
      "UNKNOWN",
      Object.fromEntries(naverNoticeFieldOrder("WEAR").map((f) => [f, "v"])),
    );
    expect(payload.productInfoProvidedNoticeType).toBe("WEAR");
  });

  it("🔴 값이 undefined 인 것은 정상이다 — 「키가 없다」와 구별한다", () => {
    const values = Object.fromEntries(naverNoticeFieldOrder("WEAR").map((f) => [f, undefined]));
    const payload = buildNaverNoticePayload("APPAREL", values);
    /* 기존 `warrantyPolicy || undefined` 와 같은 상태다 — 키는 있고 값이 비었다. */
    expect(Object.keys("wear" in payload ? payload.wear : {})).toEqual([...naverNoticeFieldOrder("WEAR")]);
  });

  it("🔴 칸이 «아예 빠지면» 부분 payload 를 만들지 않고 던진다 (fail closed)", () => {
    const values = Object.fromEntries(
      naverNoticeFieldOrder("WEAR")
        .filter((f) => f !== "packDateText")
        .map((f) => [f, "v"]),
    );
    expect(() => buildNaverNoticePayload("APPAREL", values)).toThrow(/packDateText/);
    expect(() => buildNaverNoticePayload("APPAREL", values)).toThrow(/부분 고시/);
  });
});

describe("④ 🔴 쿠팡은 adapter 가 코드를 만들지 않는다", () => {
  it("고정 코드가 없다는 사실을 그대로 말한다 — 「지원 안 함」이 아니다", () => {
    const status = coupangNoticeAdapterStatus();
    expect(status.fixedCodes).toBe(false);
    expect(status.reason).toContain("런타임");
    expect(status.reason).toContain("noticeCategoryDetailNames");
  });
});

describe("⑤ builder 동작이 바뀌지 않았다 (무회귀)", () => {
  it("🔴 모르는 품목은 여전히 schemaKnown:false 이고 항목이 비어 있다", () => {
    const resolution = resolveLotteOnNotice("99", {} as never);
    expect(resolution.schemaKnown).toBe(false);
    expect(resolution.fills).toEqual([]);
    expect(resolution.articles).toEqual([]);
  });

  it("🔴 아는 품목은 전사본과 «같은 수·같은 순서» 의 항목을 돌린다", () => {
    /* 🔴 fixture 를 «비워서» 만든다 — 값이 없는 상태가 실제 상품의 출발점이고,
       깨끗한 값으로 재면 공란 처리를 놓친다. 여기서 보는 것은 값이 아니라
       「항목 집합과 순서」다. */
    const resolution = resolveLotteOnNotice("23", {} as never);
    expect(resolution.schemaKnown).toBe(true);
    expect(resolution.fills.map((f) => f.code)).toEqual(noticeSchemaFor("23")?.map((s) => s.code));
  });
});
