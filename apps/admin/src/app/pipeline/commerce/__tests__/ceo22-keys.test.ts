import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { reviewKey } from "../../../api/price-history/_lib/candidate-review";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-CEO-JUDGMENT-HISTORY-01 — **URL 키는 «운영 owner» 가 만든다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **적재 스크립트가 키 규칙을 다시 구현하면 안 된다.** 운영 `reviewKey` 는
 *    `canonicalizeProductUrl`(= **식별 파라미터 보존**)인데, 내 1차 스크립트는 쿼리를
 *    **전부 지웠다** ⟹ `shopdetail.html?branduid=…` 같은 후보의 키가 **달라진다**
 *    ⟹ 저장 키와 조회 키가 갈라져 **이력을 못 찾는다**(083 주석이 경고한 그 함정).
 * 🟢 그래서 이 계약이 **운영 함수로** 키를 만들어 파일로 내보내고, 스크립트는 **읽기만** 한다.
 * 🔴 이 파일은 테스트이자 **생성기** 다 — 키 규칙이 바뀌면 이 계약이 먼저 FAIL 한다.
 */
const BASE = join(__dirname, "baselines");

interface Restored {
  total: number;
  rows: { url: string; snapshotId: string; ceoVerdict: string; basis: string }[];
}

describe("MI-CJH-01 — CEO 22건 URL 키 생성(운영 owner)", () => {
  it("K-1 🔵🔵 **운영 `reviewKey` 로 22건 키를 만들어 내보낸다**", () => {
    const d = JSON.parse(readFileSync(join(BASE, "ceo22-restored.json"), "utf8")) as Restored;
    expect(d.total, "🔴 복원표가 22 가 아니다").toBe(22);
    const map: Record<string, string> = {};
    for (const r of d.rows) map[r.url] = reviewKey(r.url);
    /** 🔴 키가 **22개 전부 고유** 해야 한다 — 겹치면 두 판단이 한 쌍으로 합쳐진다. */
    expect(new Set(Object.values(map)).size, "🔴🔴 URL 키가 겹친다").toBe(22);
    /** 🔴 **식별 파라미터가 보존되는지** 직접 본다(쿼리를 전부 지우는 구현이면 FAIL). */
    const withQuery = d.rows.filter((r) => r.url.includes("?"));
    expect(withQuery.length, "🔴 쿼리 있는 후보가 사라졌다 — 이 단언의 전제가 깨졌다").toBeGreaterThan(0);
    for (const r of withQuery) {
      const q = new URL(r.url).searchParams;
      const ident = [...q.keys()].filter((k) => !k.startsWith("_"));
      if (ident.length === 0) continue;
      expect(
        map[r.url],
        `🔴🔴 식별 파라미터가 키에서 사라졌다(규칙 owner 불일치): ${r.url}`,
      ).toContain(ident[0].toLowerCase());
    }
    writeFileSync(
      join(BASE, "ceo22-keys.json"),
      JSON.stringify(
        {
          note: "MI-CJH-01 — 운영 reviewKey(canonicalizeProductUrl) 로 생성한 URL 키. 적재 스크립트는 이 파일을 읽기만 한다(규칙 owner 하나).",
          generatedBy: "ceo22-keys.test.ts",
          total: Object.keys(map).length,
          keys: map,
        },
        null,
        2,
      ) + "\n",
    );
    expect(Object.keys(map)).toHaveLength(22);
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 H — **이력 저장 규칙이 코드에 살아 있다**(MI-CJH-01 · CPO §3)
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 DB 실측은 보고서에 있다(테스트 환경에는 service-role 자격이 없다) ⟹ 이 블록은
   *    **규칙이 코드에서 사라지지 않는 것** 을 잠근다.
   */
  describe("H — 이력 규칙", () => {
    const SRC = readFileSync(
      join(__dirname, "..", "..", "..", "api", "price-history", "_lib", "ceo-judgment.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, "");

    it("H-1 🔵🔵 **멱등 — 같은 판정이면 새 버전을 만들지 않는다**", () => {
      /**
       * 🔴🔴 이 규칙은 **뒤집힌 것** 이다 — 전까지 「같은 내용도 새 버전」(CPO 결정 Ⓘ)이었고
       *    CPO 가 2026-11-24 에 **멱등을 요구** 했다. 🔴 되돌아가면 FAIL 한다.
       */
      expect(SRC, "🔴🔴 멱등 분기가 없다 — 재제출이 중복 버전을 만든다").toContain(
        "prev.verdict === input.humanVerdict",
      );
      /** 🔴 비교 축은 **판정값 하나** 다 — reviewer/시각을 넣으면 멱등이 깨진다. */
      expect(SRC, "🔴 멱등 비교에 시각을 넣었다").not.toContain("prev.reviewedAt ===");
    });

    it("H-2 🔴 **과거 이력을 수정하지 않는다** — UPDATE 가 없다", () => {
      /**
       * 🔴 **개행을 포함한 리터럴을 쓰지 않는다** — 그 문자열이 소스에 그대로 들어가
       *    파일을 깨뜨린 적이 있다(이 세션에서 세 번). 🟢 줄 단위로 본다.
       */
      const updatesHistory = SRC.split(/\r?\n/).some(
        (l, i, arr) =>
          l.includes('.from("ceo_judgments")') &&
          (arr[i + 1] ?? "").trimStart().startsWith(".update("),
      );
      expect(updatesHistory, "🔴🔴 이력 표에 UPDATE 를 쓴다 — 과거 판단이 덮인다").toBe(false);
      expect(SRC).not.toContain(".update({ human_verdict");
      /** 🟢 새 버전은 **insert** 다. */
      expect(SRC).toContain('.from("ceo_judgments")');
      expect(SRC).toContain(".insert({");
    });

    it("H-3 🔵 **version 은 직전 최신 +1 이고 supersedes_id 로 잇는다**", () => {
      expect(SRC).toContain("version: (prev?.version ?? 0) + 1");
      expect(SRC).toContain("supersedes_id: prev?.id ?? null");
    });

    it("H-4 🔴 **범위 축이 필수다** — 조회가 스냅샷으로 묶인다(workspace 격리)", () => {
      const fn = SRC.slice(SRC.indexOf("export async function listCeoJudgments"));
      const body = fn.slice(0, 1200);
      expect(body, "🔴🔴 스냅샷 축 없이 조회한다 — 다른 workspace 판단이 섞인다").toContain(
        "snapshot_id",
      );
    });

    it("H-5 🔴 **23505 만 재시도한다** — 다른 오류를 재시도로 덮지 않는다", () => {
      expect(SRC).toContain('=== "23505"');
      /** 🔴 무한 재시도 금지 — 두 번째 시도까지만 있다. */
      expect(SRC).toContain("const second = await attempt();");
      expect(SRC, "🔴 세 번째 시도가 생겼다").not.toContain("const third = await attempt();");
    });
  });
});
