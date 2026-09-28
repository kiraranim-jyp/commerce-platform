import { describe, expect, it } from "vitest";
import {
  buildCoupangCompliance,
  DEFAULT_KC_EXEMPTION_TEXT,
  type CoupangCategoryMeta,
} from "../build-payload";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * KC-COUPANG-02 — **A/B 의 두 팔이 «실제로 만들어지는가»를 먼저 잰다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시는 「기본 문구 있음 / 빈 값·없음」의 실제 API 결과 차이다. 그런데
 * 실등록을 하기 전에 먼저 답해야 하는 것이 있다 —
 *
 *     🔴 「빈 값」 팔을 우리 빌더가 «만들 수 있는가?»
 *
 * 만들 수 없다면 그 실험은 payload 기본값을 바꿔야만(=금지 항목) 돌릴 수 있고,
 * 만들 수 있다면 «어떤 경로로» 만들어지는지가 곧 실험 설계가 된다.
 *
 * 🔴 이 파일은 쿠팡 API 를 부르지 않는다. 빌더의 출력만 본다.
 *    「쿠팡이 무엇을 거부하는가」는 여기서 답하지 않는다 — 그것이 실측의 몫이다.
 */

const CONTEXT = {
  productName: "Baby Swim Cap by Bobo Choses",
  contactNumber: "010-0000-0000",
};

/** 🔴 KC 칸이 «있는» 고시 카테고리 하나. 실측 캡처가 아니라 실험 조건이다 —
 *  실제 아동의류 카테고리가 이런 모양인지는 이 저장소에 캡처된 적이 «없다». */
const META_WITH_KC: CoupangCategoryMeta = {
  attributes: [],
  noticeCategories: [
    {
      noticeCategoryName: "기타 재화",
      noticeCategoryDetailNames: [
        { noticeCategoryDetailName: "인증/허가 사항", required: "MANDATORY" },
      ],
    },
  ],
};

const kcContentOf = (meta: CoupangCategoryMeta, ctx: Record<string, unknown>) => {
  const built = buildCoupangCompliance(meta, { ...CONTEXT, ...ctx }, { optionGroups: [] });
  return built.notices.find((n) => n.noticeCategoryDetailName === "인증/허가 사항")?.content;
};

describe("① A팔 — 「기본 문구 있음」은 두 경로로 만들어진다", () => {
  it("설정이 비면 코드 기본값이 들어간다", () => {
    expect(kcContentOf(META_WITH_KC, {})).toBe(DEFAULT_KC_EXEMPTION_TEXT);
  });

  it("설정에 문구가 있으면 그것이 들어간다 — 기본값을 «덮어쓴다»", () => {
    expect(kcContentOf(META_WITH_KC, { kcExemptionText: "KC 안전확인 제12-345호" })).toBe(
      "KC 안전확인 제12-345호",
    );
  });
});

describe("🔴 ② B팔 — 「빈 값」은 코드 경로로는 만들어지지 «않는다»", () => {
  it.each([
    ["설정 없음", undefined],
    ["빈 문자열", ""],
  ])("%s 이어도 content 는 비지 않는다", (_label, kcExemptionText) => {
    const content = kcContentOf(META_WITH_KC, { kcExemptionText });
    expect(content).toBe(DEFAULT_KC_EXEMPTION_TEXT);
    expect(content?.length).toBeGreaterThan(0);
  });

  it("🔴 KC 가 아닌 고시 칸도 «자리를 비우지 않는다» — 사다리 끝이 항상 값을 낸다", () => {
    const built = buildCoupangCompliance(
      {
        attributes: [],
        noticeCategories: [
          {
            noticeCategoryName: "기타 재화",
            noticeCategoryDetailNames: [
              { noticeCategoryDetailName: "기타 추가 정보", required: "MANDATORY" },
            ],
          },
        ],
      },
      CONTEXT,
      { optionGroups: [] },
    );
    expect(built.notices).toHaveLength(1);
    expect((built.notices[0]?.content ?? "").length).toBeGreaterThan(0);
  });
});

describe("🔴 ③ 그런데 «공백만» 넣으면 빈 칸이 나간다 — 설정만으로 도달한다", () => {
  /*
   * `context.kcExemptionText || DEFAULT_KC_EXEMPTION_TEXT` 는 «truthy» 검사다.
   * "   " 는 truthy 라서 기본값으로 떨어지지 않고 그대로 실린다.
   *
   * 🔴 그리고 고시 쪽에는 구매옵션에 있는 빈 값 필터가 «없다» —
   *      attributes: .filter((r) => r.value.trim().length > 0)   ← 있다
   *      notices   : noticeResults.map(...)                       ← 없다
   *
   * 즉 판매자가 Settings 의 KC 문구 칸에 공백을 넣으면, 코드를 한 줄도 바꾸지
   * 않고 「내용이 사실상 빈 고시 칸」이 실제 쿠팡으로 나간다.
   *
   * 🔴 이것을 «버그라고 단정하지 않는다». 쿠팡이 공백을 거부하는지 받아주는지를
   * 우리는 «재 본 적이 없다». 이 테스트는 그 경로가 실재한다는 사실만 고정한다 —
   * KC-COUPANG-02 의 B팔이 코드 수정 없이 도달 가능하다는 뜻이고, 동시에
   * 판정 없이 고칠 수도 없다는 뜻이다.
   */
  it("공백 문구가 그대로 payload 에 실린다", () => {
    const content = kcContentOf(META_WITH_KC, { kcExemptionText: "   " });
    expect(content).toBe("   ");
    expect(content?.trim()).toBe("");
  });

  it("고시에는 구매옵션과 달리 빈 값 필터가 없다 — 두 경로의 «비대칭»", () => {
    const built = buildCoupangCompliance(META_WITH_KC, { ...CONTEXT, kcExemptionText: "   " }, {
      optionGroups: [],
    });
    /* 걸러졌다면 칸 자체가 사라졌을 것이다. 남아 있다 = 필터가 없다. */
    expect(built.notices).toHaveLength(1);
  });
});

describe("🔴 ④ 실측 전에 고정해 두는 사실 — 두 팔의 «차이는 한 칸뿐»이어야 한다", () => {
  it("A팔과 B팔은 content 한 칸만 다르고 나머지는 동일하다", () => {
    const a = buildCoupangCompliance(META_WITH_KC, CONTEXT, { optionGroups: [] });
    const b = buildCoupangCompliance(META_WITH_KC, { ...CONTEXT, kcExemptionText: "   " }, {
      optionGroups: [],
    });
    expect(a.notices).toHaveLength(b.notices.length);
    expect(a.notices[0].noticeCategoryName).toBe(b.notices[0].noticeCategoryName);
    expect(a.notices[0].noticeCategoryDetailName).toBe(b.notices[0].noticeCategoryDetailName);
    expect(a.notices[0].content).not.toBe(b.notices[0].content);
    /* 🔴 구매옵션이 함께 흔들리면 실측 결과를 고시 탓으로 읽을 수 없다
       (COUPANG-REAL-OPTION-01 에서 정확히 그 오진을 한 번 했다). */
    expect(a.attributes).toEqual(b.attributes);
  });
});

describe("🔴 ⑤ KC 칸이 «없는» 카테고리면 실험 자체가 성립하지 않는다", () => {
  it("MANDATORY 인증 칸이 없으면 기본 문구는 어디에도 실리지 않는다", () => {
    const built = buildCoupangCompliance(
      {
        attributes: [],
        noticeCategories: [
          {
            noticeCategoryName: "의류",
            noticeCategoryDetailNames: [
              { noticeCategoryDetailName: "인증/허가 사항", required: "OPTIONAL" },
              { noticeCategoryDetailName: "기타 추가 정보", required: "MANDATORY" },
            ],
          },
        ],
      },
      CONTEXT,
      { optionGroups: [] },
    );
    expect(built.notices.some((n) => n.content === DEFAULT_KC_EXEMPTION_TEXT)).toBe(false);
  });

  it("🔴 그래서 실측의 «첫 단계» 는 실제 아동의류 카테고리의 고시 스키마 조회다", () => {
    /* 이 저장소에는 그 응답이 캡처된 적이 없다 — 있는 것은 테스트용 스텁뿐이다.
       스키마를 모르면 A/B 를 돌려도 「그 칸이 애초에 없었다」와
       「문구가 상관없었다」를 구별할 수 없다. */
    expect(META_WITH_KC.noticeCategories[0].noticeCategoryDetailNames[0].required).toBe("MANDATORY");
  });
});
