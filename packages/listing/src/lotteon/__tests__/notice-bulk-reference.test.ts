import { describe, expect, it } from "vitest";
import { DETAIL_PAGE_REFERENCE_TEXT } from "../../notice/reference-eligibility";
import { LOTTEON_SELLER_FILLABLE_ARTICLE_CODES } from "../notice-resolve";
import { planLotteOnBulkReference, planLotteOnBulkReferenceClear } from "../notice-bulk-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-NOTICE-BULK-REFERENCE-01 (CPO 승인 「E」, 2026-09-30)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 안전조건 6개를 그대로 축으로 삼는다. 가장 비싼 오답이 ①이다 —
 * 「일괄」을 「전부 덮어쓰기」로 구현하면 셀러가 어제 적어 둔 「최대 체중 20kg」이
 * 조용히 「상품 상세페이지 참조」가 된다. 클릭 하나 아끼려고 값을 잃는다.
 *
 * 🔴 fixture 를 «더럽게» 만든다 — 앞뒤 공백, 빈 문자열, 화이트리스트 밖 코드,
 * 이미 참조인 칸을 섞는다. 깨끗한 값으로 재면 이 저장소가 이미 두 번 놓친
 * 종류의 결함이 또 살아남는다.
 */

/** 1830 = 크기ㆍ체중의 한계 · 0220 = 동일모델의 출시년월 (notice-schema.ts:87-92) */
const SIZE_WEIGHT_LIMIT = "1830";
const MODEL_RELEASE = "0220";

describe("① 기존 셀러 입력값을 덮지 않는다", () => {
  it("🔴 실제 값이 있는 칸은 건드리지 않고 skipped 로 보고한다", () => {
    const plan = planLotteOnBulkReference({ [SIZE_WEIGHT_LIMIT]: "최대 체중 20kg" });
    expect(plan.next[SIZE_WEIGHT_LIMIT]).toBe("최대 체중 20kg");
    expect(plan.skipped).toContain(SIZE_WEIGHT_LIMIT);
    expect(plan.applied).not.toContain(SIZE_WEIGHT_LIMIT);
  });

  it("한 칸은 값이 있고 한 칸은 비었으면 빈 칸«만» 채운다", () => {
    const plan = planLotteOnBulkReference({ [SIZE_WEIGHT_LIMIT]: "최대 체중 20kg", [MODEL_RELEASE]: "" });
    expect(plan.next[SIZE_WEIGHT_LIMIT]).toBe("최대 체중 20kg");
    expect(plan.next[MODEL_RELEASE]).toBe(DETAIL_PAGE_REFERENCE_TEXT);
    expect(plan.applied).toEqual([MODEL_RELEASE]);
    expect(plan.skipped).toEqual([SIZE_WEIGHT_LIMIT]);
  });

  it("공백만 든 칸은 «빈 칸» 으로 본다 — 더러운 입력", () => {
    const plan = planLotteOnBulkReference({ [MODEL_RELEASE]: "   " });
    expect(plan.applied).toContain(MODEL_RELEASE);
  });

  it("🔴 원본 객체를 변형하지 않는다", () => {
    const original = { [MODEL_RELEASE]: "" };
    planLotteOnBulkReference(original);
    expect(original[MODEL_RELEASE]).toBe("");
  });
});

describe("② 허용 목록 — 0220·1830 뿐이고 0200·0060 은 제외된다", () => {
  it("화이트리스트가 두 항목 그대로다", () => {
    expect([...LOTTEON_SELLER_FILLABLE_ARTICLE_CODES]).toEqual([MODEL_RELEASE, SIZE_WEIGHT_LIMIT]);
  });

  it("🔴 KC(0200) 은 «넘겨도» 적용되지 않는다 — 이중 게이트", () => {
    /* 부르는 쪽이 실수로 0200 을 넘기는 상황을 일부러 만든다. 화면이 안 보여주니까
       안전하다는 가정에 기대지 않는다 — 규제 필드를 「상세페이지 참조」로 얼버무리면
       위반이고, 그 가드를 UI 하나에 맡길 수 없다. */
    const plan = planLotteOnBulkReference({ "0200": "" }, ["0200"]);
    expect(plan.next["0200"]).toBe("");
    expect(plan.applied).toEqual([]);
    expect(plan.skipped).toEqual([]);
  });

  it("🔴 원산지(0060) 도 적용되지 않는다", () => {
    const plan = planLotteOnBulkReference({ "0060": "" }, ["0060"]);
    expect(plan.next["0060"]).toBe("");
    expect(plan.applied).toEqual([]);
  });

  it("허용 밖 코드를 섞어 넘겨도 허용된 것만 처리한다", () => {
    const plan = planLotteOnBulkReference({ "0200": "", "0060": "", [MODEL_RELEASE]: "" }, [
      "0200",
      "0060",
      MODEL_RELEASE,
      "0780",
    ]);
    expect(plan.applied).toEqual([MODEL_RELEASE]);
    expect(plan.next["0200"]).toBe("");
    expect(plan.next["0060"]).toBe("");
    expect(plan.next["0780"]).toBeUndefined();
  });
});

describe("③ 반복 적용은 멱등이다", () => {
  it("두 번 눌러도 결과가 같고, 두 번째는 applied 가 비어 있다", () => {
    const first = planLotteOnBulkReference({});
    const second = planLotteOnBulkReference(first.next);
    expect(second.next).toEqual(first.next);
    expect(second.applied).toEqual([]);
  });

  it("이미 참조인 칸은 applied 에 들지 않는다", () => {
    const plan = planLotteOnBulkReference({ [MODEL_RELEASE]: DETAIL_PAGE_REFERENCE_TEXT });
    expect(plan.applied).toEqual([SIZE_WEIGHT_LIMIT]);
  });
});

describe("④⑤ 해제는 기존 전이 규칙을 따르고, 실제 값과 참조를 구분한다", () => {
  it("참조였던 칸만 «빈 칸» 으로 되돌린다 — 미적용 = 미입력", () => {
    const clear = planLotteOnBulkReferenceClear({
      [MODEL_RELEASE]: DETAIL_PAGE_REFERENCE_TEXT,
      [SIZE_WEIGHT_LIMIT]: DETAIL_PAGE_REFERENCE_TEXT,
    });
    expect(clear.next[MODEL_RELEASE]).toBe("");
    expect(clear.next[SIZE_WEIGHT_LIMIT]).toBe("");
    expect(clear.applied).toEqual([MODEL_RELEASE, SIZE_WEIGHT_LIMIT]);
  });

  it("🔴 셀러가 직접 적은 값은 «해제로 지워지지 않는다»", () => {
    const clear = planLotteOnBulkReferenceClear({ [SIZE_WEIGHT_LIMIT]: "최대 체중 20kg" });
    expect(clear.next[SIZE_WEIGHT_LIMIT]).toBe("최대 체중 20kg");
    expect(clear.applied).toEqual([]);
  });

  it("해제도 멱등이다", () => {
    const once = planLotteOnBulkReferenceClear({ [MODEL_RELEASE]: DETAIL_PAGE_REFERENCE_TEXT });
    const twice = planLotteOnBulkReferenceClear(once.next);
    expect(twice.applied).toEqual([]);
  });

  it("적용 → 해제 왕복이 원래 상태로 돌아온다", () => {
    const start = { [SIZE_WEIGHT_LIMIT]: "최대 체중 20kg", [MODEL_RELEASE]: "" };
    const applied = planLotteOnBulkReference(start);
    const cleared = planLotteOnBulkReferenceClear(applied.next);
    expect(cleared.next).toEqual(start);
  });
});

describe("⑥ 미확인 값을 지어내지 않는다", () => {
  it("🔴 누르지 않으면 아무 칸도 채워지지 않는다 — 함수는 계획만 돌려준다", () => {
    const values: Record<string, string> = {};
    planLotteOnBulkReference(values);
    expect(values).toEqual({});
  });

  it("🔴 참조 문구를 새로 만들지 않는다 — 공통 상수를 그대로 쓴다", () => {
    const plan = planLotteOnBulkReference({});
    for (const code of plan.applied) {
      expect(plan.next[code]).toBe(DETAIL_PAGE_REFERENCE_TEXT);
    }
    expect(DETAIL_PAGE_REFERENCE_TEXT).toBe("상품 상세페이지 참조");
  });
});
