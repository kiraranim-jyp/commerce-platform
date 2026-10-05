import { describe, expect, it } from "vitest";
import { assertCandidateBelongsToProduct, computeMasterReady, type MasterReadyInput } from "../master-ready";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT-03-B ⑦ — Master Ready 파생 계산 (CPO 지시 ⑤⑥⑦⑨⑩)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 지키는 것은 「계산이 맞는가」보다 **「하지 않기로 한 것을 하지
 * 않는가」** 다. PIVOT-02 결정 중 셋이 «부정형» 이고, 부정형은 테스트로만 남는다:
 *
 *   ⑤ 품절이어도 Selected 를 자동 해제하지 «않는다»
 *   ⑥ 새 후보가 생겨도 Selected 를 자동 변경하지 «않는다»
 *   ⑦ Master Ready 를 저장하지 «않는다» — 파생이다
 */
const base: MasterReadyInput = {
  hasProduct: true,
  candidateCount: 0,
  selectedCandidateId: null,
  registrationReadyRequiredPassed: false,
};
const at = (over: Partial<MasterReadyInput>) => computeMasterReady({ ...base, ...over });

describe("① 단계 파생 — 네 상태", () => {
  it("Product 만 있고 후보 0 → DISCOVERED", () => {
    const r = at({});
    expect(r.stage).toBe("DISCOVERED");
    expect(r.masterConfirmed).toBe(false);
    expect(r.nextAction).toContain("후보가 없습니다");
  });

  it("🔴 후보는 있는데 «고르지 않았다» → SOURCING_READY", () => {
    /* 「후보가 없어서 못 고른 것」과 「고르지 않은 것」은 셀러가 할 일이 다르다 —
       뭉개면 같은 문장이 된다. */
    const r = at({ candidateCount: 3 });
    expect(r.stage).toBe("SOURCING_READY");
    expect(r.masterConfirmed).toBe(false);
    expect(r.nextAction).toContain("고릅니다");
  });

  it("골랐지만 등록 준비 미완 → SOURCE_SELECTED · Master 확정은 true", () => {
    const r = at({ candidateCount: 3, selectedCandidateId: "c1", selectedAvailability: "IN_STOCK" });
    expect(r.stage).toBe("SOURCE_SELECTED");
    expect(r.masterConfirmed).toBe(true);
    expect(r.readyForCommerce).toBe(false);
  });

  it("골랐고 readiness 통과 → READY_FOR_COMMERCE", () => {
    const r = at({
      candidateCount: 3,
      selectedCandidateId: "c1",
      selectedAvailability: "IN_STOCK",
      registrationReadyRequiredPassed: true,
    });
    expect(r.stage).toBe("READY_FOR_COMMERCE");
    expect(r.readyForCommerce).toBe(true);
    expect(r.nextAction).toBeNull();
    expect(r.warning).toBeNull();
  });

  it("Product 가 없으면 준비됨으로 읽지 않는다 — 기존 product_id null 행", () => {
    const r = at({ hasProduct: false, candidateCount: 5, selectedCandidateId: "c1", registrationReadyRequiredPassed: true });
    expect(r.masterConfirmed).toBe(false);
    expect(r.readyForCommerce).toBe(false);
  });
});

describe("⑤ 🔴 품절이어도 Selected 를 «자동 해제하지 않는다»", () => {
  const soldOut = at({
    candidateCount: 2,
    selectedCandidateId: "c1",
    selectedAvailability: "OUT_OF_STOCK",
    registrationReadyRequiredPassed: true,
  });

  it("Master 확정이 유지된다", () => {
    expect(soldOut.masterConfirmed).toBe(true);
  });

  it("🔴 경고만 올린다 — 결정은 셀러에게 남긴다", () => {
    expect(soldOut.warning).toContain("품절");
    expect(soldOut.warning).toContain("다른 후보로 바꾸거나");
  });

  it("단계가 뒤로 돌아가지 않는다", () => {
    expect(soldOut.stage).toBe("READY_FOR_COMMERCE");
  });

  it("재고를 «모르는» 경우도 해제하지 않는다 — 모름을 품절로 읽지 않는다", () => {
    for (const availability of ["UNKNOWN", null, undefined] as const) {
      const r = at({ candidateCount: 1, selectedCandidateId: "c1", selectedAvailability: availability });
      expect(r.masterConfirmed, String(availability)).toBe(true);
      expect(r.warning, String(availability)).toContain("확인하지 못했습니다");
    }
  });

  it("INVALID(표기를 못 읽음)도 품절과 «다른» 문장이다", () => {
    const r = at({ candidateCount: 1, selectedCandidateId: "c1", selectedAvailability: "INVALID" });
    expect(r.warning).toContain("읽지 못했습니다");
    expect(r.warning).not.toContain("품절");
  });
});

describe("⑥ 🔴 새 후보가 생겨도 Selected 가 «바뀌지 않는다»", () => {
  it("후보가 3개에서 7개로 늘어도 선택과 단계가 같다", () => {
    const before = at({ candidateCount: 3, selectedCandidateId: "c2", selectedAvailability: "IN_STOCK" });
    const after = at({ candidateCount: 7, selectedCandidateId: "c2", selectedAvailability: "IN_STOCK" });
    expect(after.stage).toBe(before.stage);
    expect(after.masterConfirmed).toBe(before.masterConfirmed);
    /* 🔴 이 함수는 selectedCandidateId 를 «바꿀 수 없다» — 반환값에 없다.
       자동 변경 경로가 타입 수준에서 존재하지 않는다. */
    expect(Object.keys(after)).not.toContain("selectedCandidateId");
  });
});

describe("⑦ 🔴 파생이다 — 저장하지 않는다", () => {
  it("같은 입력이면 항상 같은 답이다 — 순수 함수", () => {
    const input: MasterReadyInput = {
      hasProduct: true,
      candidateCount: 2,
      selectedCandidateId: "c1",
      selectedAvailability: "IN_STOCK",
      registrationReadyRequiredPassed: true,
    };
    expect(computeMasterReady(input)).toEqual(computeMasterReady(input));
  });

  it("🔴 readiness 를 «다시 계산하지» 않는다 — 받은 값을 쓴다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    /* 🔴 주석을 벗긴다 — 이 파일은 결정을 설명하는 주석이 코드보다 길다. */
    const code = readFileSync(join(__dirname, "../master-ready.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    /* 판정을 두 곳에서 구현하면 화면과 서버가 다른 말을 한다(CP001 사고). */
    expect(code).not.toContain("computeChecklistReadiness");
    expect(code).not.toContain("validateNaverPayload");
    /* DB 도 네트워크도 보지 않는다. */
    expect(code).not.toContain("supabase");
    expect(code).not.toContain("fet" + "ch(");
  });

  it("🔴 DB 에 저장하는 칸을 만들지 않았다 — 075/076 에 master 칸이 없다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(__dirname, "../../../../../packages/database/prisma/migrations_manual");
    for (const file of ["075_sourcing_candidates.sql", "076_selected_candidate_same_product.sql"]) {
      const sql = readFileSync(join(dir, file), "utf8").replace(/^\s*--.*$/gm, "");
      expect(sql.toLowerCase(), file).not.toContain("master_confirmed");
      expect(sql.toLowerCase(), file).not.toContain("master_stage");
      expect(sql.toLowerCase(), file).not.toContain("ready_for_commerce");
    }
  });
});

describe("⑨ 🔴 cross-product 를 사람이 읽는 말로 거절한다", () => {
  it("다른 Product 의 후보면 거절한다", () => {
    const r = assertCandidateBelongsToProduct({ productId: "A", candidateProductId: "B" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("다른 상품의 소싱 후보는 선택할 수 없습니다.");
  });

  it("🔴 상대 Product 의 id 를 메시지에 담지 않는다 — 식별자 유출 금지", () => {
    const r = assertCandidateBelongsToProduct({ productId: "A", candidateProductId: "SECRET-B" });
    if (!r.ok) expect(r.error).not.toContain("SECRET-B");
  });

  it("후보를 못 찾은 경우와 «다른 상품의 후보» 를 구분한다", () => {
    const missing = assertCandidateBelongsToProduct({ productId: "A", candidateProductId: null });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain("찾을 수 없습니다");
  });

  it("자기 후보면 통과한다", () => {
    expect(assertCandidateBelongsToProduct({ productId: "A", candidateProductId: "A" }).ok).toBe(true);
  });
});

describe("⑩ 🔴 재분석이 선택을 깨뜨리지 않는다", () => {
  it("snapshot 이 늘어나는 것은 이 계산의 입력이 «아니다»", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const code = readFileSync(join(__dirname, "../master-ready.ts"), "utf8");
    /* 🔴 입력에 snapshot 이 없다 = 재분석이 단계를 바꿀 «경로가 없다».
       구조적으로 보장되는 것을 테스트로 못박는다. */
    const inputType = code.slice(code.indexOf("export interface MasterReadyInput"));
    const body = inputType.slice(0, inputType.indexOf("}"));
    expect(body.toLowerCase()).not.toContain("snapshot");
  });
});
