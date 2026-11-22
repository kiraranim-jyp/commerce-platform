import { describe, expect, it } from "vitest";

import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import {
  identityIncomplete,
  REVIEW_QUEUE_EMPTY,
  REVIEW_QUEUE_HEADING,
  REVIEW_REASON_LABEL,
  selectCandidateList,
  selectReviewQueue,
} from "../mi-same-candidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-IDENTITY-REVIEW-COMPLETION-01 P0-4 — **비교목록표(검토 대기)**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 새 선택기인가** — 셀러용 `selectCandidateList` 는 `CONFLICT` · 등급 없음 ·
 *    Evidence 없는 `UNKNOWN` 을 **의도적으로 제외** 한다(2026-09-19 사고 방지).
 *    🔴 그런데 **사람이 판단해야 하는 후보가 정확히 그 제외분** 이다 ⟹ 창구가 없었다.
 * 🟢 그래서 **같은 `rows`** 에서 **다른 선택기** 로 뽑는다 — 판정 **승격 0** · 셀러 화면 **불변**.
 *
 * 🔴 **정책 변경 0** — SAME 기준 · 차단 조건 · 가격 적격성 · 등급 계산 **전부 그대로** 다.
 *    이 선택기는 **표시 범위** 이고 판정을 만들지 않는다.
 */

const r = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    domain: "x.com",
    title: "Hug Hairy Monster T-shirt",
    discoveredUrl: `https://x.com/${Math.abs(JSON.stringify(over).length)}-${over.domain ?? "d"}`,
    market: "OVERSEAS",
    soldOut: false,
    priceStatus: "VERIFIED_CURRENT",
    ...over,
  }) as GeminiTransientRow;

const q = (rows: GeminiTransientRow[], scope: "ALL" | "KR" | "OVERSEAS" = "ALL") =>
  selectReviewQueue(rows, scope).map((x) => x.row.domain);
const reasonsOf = (rows: GeminiTransientRow[], domain: string) =>
  selectReviewQueue(rows, "ALL").find((x) => x.row.domain === domain)?.reasons ?? [];

/** 🟢 판정기가 실제로 축을 본 흔적 — 기존 행들이 쓰는 모양이다. */
const FULL_REASONS = ["근거: 브랜드 Bobo Choses", "근거: 품번 B226AC009", "근거: 핵심 상품명 hug/hairy"];

describe("REVIEW-QUEUE-01 — 비교목록표", () => {
  /* ── A. 🔴🔴 누락 0 — 셀러 화면이 «버린» 후보가 반드시 선다 ─────────────── */

  it("A-1 🔴🔴 셀러 리스트에서 제외되는 CONFLICT 가 검토 대기에는 «반드시» 선다", () => {
    /**
     * 🔴🔴 **내 1차 전제가 틀렸고 코드가 맞았다. 남긴다.**
     *    `crossSellerConflicts: ["MODEL_CODE"]` 로 썼더니 셀러 리스트에 **선다** —
     *    `CANDIDATE-POSSIBLE-CONFLICT-01`(`isModelCodeOnlyReference`)이 「품번만 충돌한
     *    참고 후보」를 `POSSIBLE` 군으로 **이미 보여주기** 때문이다.
     * 🟢 그래서 **진짜 제외분**(품번 «외» 축이 같이 충돌한 행)으로 바꿨다.
     */
    const rows = [
      r({
        domain: "conflict.com",
        matchTruth: "CONFLICT",
        crossSellerConflicts: ["MODEL_CODE", "COLOR"],
        matchReasons: FULL_REASONS,
      }),
    ];
    /** 🔴 셀러 화면에서는 안 보인다(그 규칙은 그대로 둔다). */
    expect(selectCandidateList(rows, "ALL").map((x) => x.row.domain), "🟢 셀러 리스트 불변").toEqual([]);
    /** 🟢🟢 검토 대기에는 선다 — 그것이 이 WU 의 목적이다. */
    expect(q(rows), "🔴 사람이 볼 창구에서도 사라지면 안 된다").toEqual(["conflict.com"]);
    expect(reasonsOf(rows, "conflict.com")).toContain("EVIDENCE_CONFLICT");
  });

  it("A-2 🟢 등록 대상 다섯이 각각 «이유와 함께» 선다", () => {
    const rows = [
      r({ domain: "unknown.com", matchReasons: FULL_REASONS }),
      r({ domain: "hold.com", matchTruth: "TEXT_CONFIRMED", matchReasons: FULL_REASONS }),
      r({ domain: "blocked.com", matchTruth: "TEXT_CONFIRMED", crossSellerBlockers: ["BRAND_MISMATCH"], matchReasons: FULL_REASONS }),
      r({ domain: "conflict.com", matchTruth: "CONFLICT", crossSellerConflicts: ["MODEL_CODE"], matchReasons: FULL_REASONS }),
      /** 🔴 식별정보 부족 — 제목만 있고 브랜드·품번 근거가 없다. */
      r({ domain: "thin.com", matchTruth: "TEXT_CONFIRMED", matchReasons: [] }),
    ];
    expect(q(rows).sort(), "🔴 다섯 전건이 선다").toEqual(
      ["blocked.com", "conflict.com", "hold.com", "thin.com", "unknown.com"].sort(),
    );
    expect(reasonsOf(rows, "unknown.com")).toContain("UNKNOWN_VERDICT");
    expect(reasonsOf(rows, "hold.com")).toContain("HOLD_FOR_REVIEW");
    expect(reasonsOf(rows, "blocked.com")).toContain("BLOCKED");
    expect(reasonsOf(rows, "conflict.com")).toContain("EVIDENCE_CONFLICT");
    expect(reasonsOf(rows, "thin.com"), "🔴 식별정보 부족").toContain("IDENTITY_INCOMPLETE");
  });

  /* ── B. 🔴 제외 규칙 — 확정 SAME 과 «근거 없는 행» ──────────────────────── */

  it("B-1 🟢 확정 SAME 은 검토 대기에 «들지 않는다»(자동 판정이 끝났다)", () => {
    /**
     * 🔴🔴 **내 1차 단언이 뚫렸고 그 교훈을 남긴다** — 처음에는 「`EXACT_IDENTIFIER` +
     *    근거만 있는 행」으로 썼고, 변이(`tier === "SAME"` 가드 제거)가 **통과** 했다.
     *    원인은 그 행에 `reasons` 가 **하나도 생기지 않아** 두 번째 가드
     *    (`reasons.length === 0`)가 **우연히** 막은 것이다 ⟹ 첫 가드가 단독 검증되지 않았다.
     * 🟢 그래서 **확정 SAME 이면서 `reasons` 가 생기는 행**(차단축 보유)을 쓴다.
     *    🔴 그 모양은 실재한다 — §0-XM03 이 「human SAME 인데 차단축을 든 행 2건」을 기록했다.
     */
    const rows = [
      r({
        domain: "same.com",
        matchTruth: "EXACT_IDENTIFIER",
        crossSellerBlockers: ["BRAND_UNCONFIRMED"],
        matchReasons: FULL_REASONS,
      }),
      r({ domain: "hold.com", matchTruth: "TEXT_CONFIRMED", matchReasons: FULL_REASONS }),
    ];
    expect(q(rows), "🔴 확정 SAME 이 검토 대기에 들면 사람이 할 일이 늘어난다").toEqual(["hold.com"]);
  });

  it("B-2 🔴 근거가 하나도 없는 행은 넣지 않는다 — 사람이 볼 것이 없다", () => {
    /**
     * 🟢 제목·판정·충돌·차단이 전부 없으면 그것은 「검토 가치」가 아니다.
     * 🔴 단 **하나라도** 있으면 서야 한다(A-2 가 그것을 잠근다).
     */
    const nothing = r({ domain: "void.com", title: null, matchTruth: "EXACT_IDENTIFIER", matchReasons: FULL_REASONS });
    expect(q([nothing]), "🔴 확정 SAME + 근거 없음 ⟹ 제외").toEqual([]);
  });

  /* ── C. 🔴 승격 0 — 판정값을 바꾸지 않는다 ─────────────────────────────── */

  it("C-1 🔴🔴 각 행의 판정값이 «그대로» 남는다(승격 0)", () => {
    const row = r({
      domain: "hold.com",
      matchTruth: "TEXT_CONFIRMED",
      crossSellerVerdict: "PRESUMED_SAME",
      priceTier: "COMPARISON",
      crossSellerBlockers: ["BRAND_MISMATCH"],
      matchReasons: FULL_REASONS,
    });
    const picked = selectReviewQueue([row], "ALL");
    expect(picked).toHaveLength(1);
    /** 🔴 선택기가 돌려준 행이 **같은 객체** 이고 판정 칸이 한 글자도 안 바뀐다. */
    expect(picked[0].row.crossSellerVerdict).toBe("PRESUMED_SAME");
    expect(picked[0].row.matchTruth).toBe("TEXT_CONFIRMED");
    expect(picked[0].row.priceTier).toBe("COMPARISON");
    expect(picked[0].row.crossSellerBlockers).toEqual(["BRAND_MISMATCH"]);
    /** 🔴 `SAME` 으로 바꿔 적지 않는다. */
    expect(JSON.stringify(picked[0].row)).not.toContain('"crossSellerVerdict":"SAME"');
  });

  /* ── D. 🟢 전체/국내/해외 필터를 공용으로 쓴다 ─────────────────────────── */

  it("D-1 🟢 scope 가 `CandidateListScope` 와 «같은 축» 이다 — UNKNOWN 은 전체에만", () => {
    const rows = [
      r({ domain: "a.kr", market: "KR", matchTruth: "TEXT_CONFIRMED", matchReasons: FULL_REASONS }),
      r({ domain: "b.com", market: "OVERSEAS", matchTruth: "TEXT_CONFIRMED", matchReasons: FULL_REASONS }),
      r({
        domain: "c.io",
        market: "UNKNOWN" as GeminiTransientRow["market"],
        matchTruth: "TEXT_CONFIRMED",
        matchReasons: FULL_REASONS,
      }),
    ];
    expect(q(rows, "KR")).toEqual(["a.kr"]);
    expect(q(rows, "OVERSEAS")).toEqual(["b.com"]);
    /** 🟢 시장 미확정 후보가 **전체에만** 선다 — §0-XM01 의 그 축과 같은 규칙이다. */
    expect(q(rows, "ALL")).toEqual(["a.kr", "b.com", "c.io"]);
  });

  it("D-2 🔴 같은 URL 은 한 번만 — 중복 후보 관리(CPO §6)", () => {
    const base = { matchTruth: "TEXT_CONFIRMED", matchReasons: FULL_REASONS } as Partial<GeminiTransientRow>;
    const rows = [
      r({ domain: "dup.com", discoveredUrl: "https://dup.com/p/1", ...base }),
      r({ domain: "dup.com", discoveredUrl: "https://dup.com/p/1", ...base }),
    ];
    expect(q(rows), "🔴 같은 URL 이 두 번 서면 사람이 두 번 판단한다").toEqual(["dup.com"]);
  });

  /* ── E. 🟢 식별정보 부족 술어 ──────────────────────────────────────────── */

  it("E-1 🟢 브랜드·품번·상품명 중 둘 이상을 모르면 「식별정보 부족」", () => {
    expect(identityIncomplete(r({ title: null, matchReasons: [] })), "🔴 셋 다 모름").toBe(true);
    expect(identityIncomplete(r({ title: "T-shirt", matchReasons: [] })), "🔴 제목만 — 하나뿐").toBe(true);
    expect(
      identityIncomplete(r({ title: "T-shirt", matchReasons: ["근거: 브랜드 Bobo Choses"] })),
      "🟢 둘을 안다",
    ).toBe(false);
    expect(identityIncomplete(r({ title: null, matchReasons: FULL_REASONS })), "🟢 브랜드·품번을 안다").toBe(false);
  });

  /* ── F. 🔴 사람이 읽는 말 — 내부 토큰 노출 금지 ────────────────────────── */

  it("F-1 🔴 라벨에 내부 토큰(tier·matchTruth)이 노출되지 않는다", () => {
    const labels = Object.values(REVIEW_REASON_LABEL);
    expect(labels).toHaveLength(5);
    for (const l of labels) {
      for (const token of ["SAME", "PRESUMED", "SIMILAR", "UNKNOWN", "CONFLICT", "EXACT", "COMPARISON", "TRUTH"]) {
        expect(l, `🔴 「${l}」에 내부 토큰 ${token} 이 들어갔다`).not.toContain(token);
      }
    }
    expect(REVIEW_QUEUE_HEADING).toBe("검토 대기 후보");
    expect(REVIEW_QUEUE_EMPTY).toBe("검토 대기 후보가 없습니다");
    /** 🔴 「동일상품이 없습니다」로 단정하지 않는다. */
    expect(REVIEW_QUEUE_EMPTY).not.toContain("동일상품이 없습니다");
  });
});
