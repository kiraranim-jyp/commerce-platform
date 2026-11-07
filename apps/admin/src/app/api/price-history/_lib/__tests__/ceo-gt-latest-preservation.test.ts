import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CEO_BASELINE_CONFLICTS,
  CEO_LATEST_DECIDED,
  CEO_LATEST_LABELS,
  CEO_LATEST_REVIEW,
  CEO_NOTE_GROUPS,
  CEO_UNDECIDED_IDS,
} from "./ceo-gt-latest";
import { SAME05_BASELINE, SAME05_PAIRS } from "./core-same05-gt";
import { stripComments } from "../../../../pipeline/commerce/__tests__/source-text";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **CEO 최신 판단 보존 계약**(CPO 결정 ①·⑥ · 2026-11-07)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 네트워크 0 · DB 0 · 운영 코드 변경 0 · migration 0.
 *
 * CPO 가 요구한 보존 조건을 **기계로** 잠근다:
 * ```
 * ⒜ `SAME05_BASELINE` 원본을 **그대로 보존**            ⒝ 기존 GT 를 **덮어쓰지 않는다**
 * ⒞ C42 는 **기존 SAME ↔ 최신 DIFFERENT 공존**          ⒟ C50 은 **확정 분모에서 제외**
 * ⒠ Main Story 제외 정책 · 22쌍 운영 적격 분모 **불변**
 * ⒡ 원문 메모를 **항상 보존** · ⒢ **AI 가 임의로 구조화하지 않는다**
 * ```
 */

const HERE = __dirname;
const GT_FIXTURE = join(HERE, "fixtures/ceo-evidence-review-gt.json");

describe("A. 기존 기준선을 «덮어쓰지 않았다»", () => {
  it("A-1 🔴🔴 `SAME05_BASELINE` 이 한 글자도 바뀌지 않았다", () => {
    // 🔴 이 숫자는 여러 WU 의 분모다 — 최신 조서가 이것을 움직이면 과거 측정이 모두 흔들린다.
    expect(SAME05_BASELINE).toEqual({
      total: 33,
      same: 18,
      different: 9,
      uncertain: 6,
      fp: 1,
      samePrecision: "6/18",
    });
  });

  it("A-2 🔴 원본 GT fixture 의 `humanGt` 가 그대로다 — C42 는 여전히 SAME", () => {
    const raw = JSON.parse(readFileSync(join(HERE, "fixtures/wu-059-gt-facts.json"), "utf8")) as {
      candidates: Record<string, { humanGt: string }>;
    };
    // 🟢 역사 기록이다(「이전 Sprint 의 값은 역사적 측정값으로만 취급」).
    expect(raw.candidates.C42!.humanGt).toBe("SAME");
    expect(raw.candidates.C50!.humanGt).toBe("DIFFERENT");
    expect(raw.candidates.C06!.humanGt).toBe("DIFFERENT"); // 🟢 10-27 조서는 덮지 않고 «얹었다»
  });

  it("A-3 🔴 `CEO_RELABEL` 에 C42·C50 이 «없다» — 최신 조서를 기준선에 주입하지 않았다", () => {
    const src = stripComments(readFileSync(join(HERE, "core-same05-gt.ts"), "utf8").replace(/\r\n/g, "\n"));
    const at = src.indexOf("CEO_RELABEL");
    expect(at).toBeGreaterThan(0);
    const block = src.slice(at, src.indexOf("};", at));
    expect(block).toContain("C06:");
    expect(block).not.toContain("C42");
    expect(block).not.toContain("C50");
  });

  it("A-4 🔴 33쌍 분모가 그대로다 — 최신 조서가 쌍을 더하거나 빼지 않았다", () => {
    expect(SAME05_PAIRS).toHaveLength(SAME05_BASELINE.total);
    const dist = SAME05_PAIRS.reduce<Record<string, number>>((a, p) => {
      a[p.human] = (a[p.human] ?? 0) + 1;
      return a;
    }, {});
    expect(dist.SAME).toBe(SAME05_BASELINE.same);
    expect(dist.DIFFERENT).toBe(SAME05_BASELINE.different);
  });
});

describe("B. 최신 CEO 판단이 «별도 버전» 으로 산다", () => {
  it("B-1 조서 식별자와 분모", () => {
    expect(CEO_LATEST_REVIEW.review).toBe("CEO-EVIDENCE-REVIEW");
    expect(CEO_LATEST_REVIEW.receivedAt).toBe("2026-11-07");
    expect(CEO_LATEST_LABELS).toHaveLength(11);
  });

  it("B-2 🔴 기준선 충돌이 «정확히 둘» 이고 둘 다 보존된다", () => {
    expect(CEO_BASELINE_CONFLICTS).toEqual([
      { id: "C50", prior: "DIFFERENT", latest: "UNDECIDED" },
      { id: "C42", prior: "SAME", latest: "DIFFERENT" },
    ]);
    // 🔴 「최신이 이긴다」로 접지 않았다 — prior 가 **같이** 들어 있다.
    for (const c of CEO_BASELINE_CONFLICTS) expect(c.prior).not.toBe(c.latest);
  });

  it("B-3 🔴 C50 은 확정 분모에서 «빠진다»", () => {
    expect(CEO_UNDECIDED_IDS).toEqual(["C50"]);
    expect(CEO_LATEST_DECIDED).toHaveLength(10);
    expect(CEO_LATEST_DECIDED.map((l) => l.id)).not.toContain("C50");
    // 🟢 그래도 전체 목록에는 남아 있다(기록을 지우지 않는다).
    expect(CEO_LATEST_LABELS.map((l) => l.id)).toContain("C50");
  });

  it("B-4 🔴 술어는 `UNDECIDED` 하나다 — 「404 라서」를 코드가 해석하지 않는다", () => {
    const src = stripComments(readFileSync(join(HERE, "ceo-gt-latest.ts"), "utf8").replace(/\r\n/g, "\n"));
    // 🔴 사유 문자열을 조건으로 쓰면 그것이 **자동 구조화** 다(CPO 금지).
    for (const banned of ["404", "반팔", "긴팔", "취급제외", "품번코드"]) {
      expect(src).not.toContain(banned);
    }
  });
});

describe("C. 원문을 «한 글자도» 가공하지 않았다", () => {
  const raw = JSON.parse(readFileSync(GT_FIXTURE, "utf8")) as { pairs: { id: string; ceoNote: string }[] };

  it("C-1 🔴 `ceoNote` 가 fixture 와 «바이트 동일» 하다", () => {
    for (const p of raw.pairs) {
      const label = CEO_LATEST_LABELS.find((l) => l.id === p.id)!;
      expect(label.ceoNote).toBe(p.ceoNote);
    }
  });

  it("C-2 🔴🔴 `ceoAxes` 가 «전건 비어 있다» — 추론해 채우지 않았다", () => {
    // 🔴 **미입력과 UNKNOWN 은 다르다**(CPO 명시). 빈 칸을 UNKNOWN 으로 바꾸지 않는다.
    expect(CEO_LATEST_LABELS).toHaveLength(11);
    for (const l of CEO_LATEST_LABELS) expect(Object.keys(l.ceoAxes)).toHaveLength(0);
  });

  it("C-3 🔴 그룹 메모를 개별 쌍에 «분배하지 않았다» — 고유 note 는 5개다", () => {
    expect(CEO_NOTE_GROUPS).toHaveLength(5);
    // 🟢 묶음이 그대로 노출된다(쪼개는 것은 사람이 확인할 일이다).
    const sizes = CEO_NOTE_GROUPS.map((g) => g.ids.length).sort((a, b) => b - a);
    expect(sizes).toEqual([5, 2, 2, 1, 1]);
    expect(CEO_NOTE_GROUPS.reduce((n, g) => n + g.ids.length, 0)).toBe(11);
    // 🔴 가장 큰 묶음은 Main Story 다섯이고 그 결론은 **하나** 다.
    const biggest = CEO_NOTE_GROUPS.find((g) => g.ids.length === 5)!;
    // 🔴 `readonly string[]` 은 `.sort()` 가 없다(제자리 변경 메서드) — 복사해서 정렬한다.
    //    🟢 그리고 그 readonly 가 **의도** 다(계약이 원본 배열을 흔들지 못하게).
    expect([...biggest.ids].sort()).toEqual(["C19", "C20", "C22", "C25", "C42"]);
    expect(biggest.verdicts).toEqual(["DIFFERENT"]);
  });

  it("C-4 🟢 원문 메모가 비어 있지 않다 — 보존의 대상이 실재한다", () => {
    const withNote = CEO_LATEST_LABELS.filter((l) => l.ceoNote.trim().length > 0);
    expect(withNote).toHaveLength(11);
  });
});

describe("D. 운영 정책이 흔들리지 않는다", () => {
  it("D-1 🔴 Main Story 쌍 다섯이 조서에 그대로 있고 전부 DIFFERENT 다", () => {
    const ms = ["C19", "C20", "C22", "C25", "C42"];
    for (const id of ms) {
      const l = CEO_LATEST_LABELS.find((x) => x.id === id)!;
      expect(l.ceoVerdict, id).toBe("DIFFERENT");
    }
    // 🟢 C42 의 뒤집힘은 CEO 의 Main Story 결정과 **일관** 된다(그 쌍이 main-story.com 이다).
    expect(CEO_LATEST_LABELS.find((l) => l.id === "C42")!.domain).toBe("main-story.com");
  });

  it("D-1b 🔴 C06 의 «뒤집힌 이력» 이 보존된다 — 자동 차단 금지의 근거다", () => {
    /**
     * 🔴🔴 C06 은 **과거 DIFFERENT → 최신 SAME** 이다. 그 이력이 양쪽에 다 남아야 한다:
     *   `wu-059-gt-facts.json`  humanGt = **DIFFERENT**  (역사 기록 · A-2 가 단언)
     *   `CEO_RELABEL`           → **SAME**                (10-27 조서가 «얹었다»)
     * ⟹ 🔴 과거 판단으로 자동 차단하면 **이 후보가 영구히 사라진다.**
     */
    const pair = SAME05_PAIRS.find((p) => p.id === "C06")!;
    expect(pair.human).toBe("SAME");
    // 🟢 출처가 **이어 붙어** 있다 — 어느 조서가 덮었는지 추적 가능해야 한다(지우지 않았다).
    expect(pair.src).toContain("desc-review");
    expect(pair.src).not.toBe("desc-review");
  });

  it("D-3 🔴 과거 판단이 «차단» 에 쓰이지 않는다 — 금지 어휘가 0 이다", () => {
    const src = stripComments(readFileSync(join(HERE, "ceo-gt-latest.ts"), "utf8").replace(/\r\n/g, "\n"));
    // 🔴 CPO 불승인 — 검색 후보 자동 제외 · 판정 자동 차단 · 가격비교 차단.
    for (const banned of ["exclude", "block", "filterOut", "reject", "suppress", "disqualif"]) {
      expect(src.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });

  it("D-2 🔴 이 모듈은 운영 코드에서 «쓰이지 않는다» — 측정 전용이다", () => {
    const src = stripComments(readFileSync(join(HERE, "ceo-gt-latest.ts"), "utf8").replace(/\r\n/g, "\n"));
    // 🔴 운영 판정·가격·차단 경로를 import 하지 않는다(사람 판단이 그 경로로 새지 않게).
    for (const banned of ["market-intelligence", "candidate-market", "run-domestic-price-check", "candidate-review"]) {
      expect(src).not.toContain(banned);
    }
  });
});
