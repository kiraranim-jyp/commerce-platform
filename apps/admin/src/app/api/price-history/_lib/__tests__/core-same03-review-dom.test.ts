import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-PRICE-SAME-03 — **생성된 화면을 «마운트한 DOM» 으로 본다**(네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 문자열 계약으로 끝내지 않는가** — WU-136 의 그 사고다:
 * ```
 * 「`&&( … )` 안에 주석 노드를 더해 **JSX 를 깨뜨렸고**(빌드 불가)
 *   소스 문자열 계약은 그 상태에서도 **통과했다** — 마운트 DOM 축이 잡았다」
 * ```
 * 🔴 이 화면은 손으로 쓴 HTML 문자열이라 **같은 위험** 이 있다. 태그를 하나 닫지
 *    않아도 `toContain` 은 전부 통과한다 ⟹ **파서에 넣어** 구조를 센다.
 *
 * 🔴 라이브 빌더(`core-same03-domestic-review-build`)는 환경변수로만 돌므로 이 파일은
 *    **산출물이 있을 때만** 단언한다. 🟢 그래도 CI 에 둔다 — 파일이 커밋돼 있으면
 *    다음 사람이 그것을 깨뜨리는 순간 **여기서** 잡힌다.
 */

const OUT = path.join(__dirname, "../../../../../../../../docs/core-same03-domestic-review.html");
const EXISTS = existsSync(OUT);

describe("CORE-PRICE-SAME-03 — 검토 화면 마운트 DOM", () => {
  it.runIf(EXISTS)("깨진 마크업이 아니고 구조가 실제로 선다", () => {
    const dom = new JSDOM(readFileSync(OUT, "utf8"));
    const d = dom.window.document;

    /** 🔴 원상품 섹션이 **둘** 이다 — 두 원상품을 한 목록에 섞지 않는다. */
    const origins = d.querySelectorAll("section.origin");
    expect(origins).toHaveLength(2);
    const codes = [...d.querySelectorAll(".orail .eyebrow code")].map((n) => n.textContent);
    expect(codes).toEqual(["B226AC009", "B226AC010"]);

    /** 🔴 후보가 **섹션 안** 에 있다(격자 밖으로 새지 않는다). */
    const cards = d.querySelectorAll("section.cand");
    expect(cards.length).toBeGreaterThan(0);
    let inside = 0;
    for (const o of origins) inside += o.querySelectorAll("section.cand").length;
    expect(inside, "🔴 섹션 밖의 후보가 있으면 비교 대상이 모호해진다").toBe(cards.length);

    /** 🔴 후보마다 3택이 **정확히 하나의 라디오 그룹** 이고 미선택이다. */
    for (const card of cards) {
      const radios = [...card.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
      expect(radios).toHaveLength(3);
      expect(new Set(radios.map((r) => r.name)).size, "🔴 그룹 이름이 갈리면 두 개를 고를 수 있다").toBe(1);
      expect(radios.map((r) => r.value)).toEqual(["동일", "다른제품", "판단불가"]);
      expect(radios.some((r) => r.checked), "🔴 CTO 가 미리 고르면 그것은 CEO 판정이 아니다").toBe(false);
      /** 🔴 사유 칸이 **후보마다 하나** 다. */
      expect(card.querySelectorAll("textarea")).toHaveLength(1);
      /** 🔴 이전 기록은 **판정 블록과 다른 노드** 다(섞지 않는다). */
      const prior = card.querySelector(".prior");
      expect(prior, "🔴 이전 기록 블록이 없으면 과거 판정이 이번 판정과 섞인다").toBeTruthy();
      expect(prior!.querySelector("input"), "🔴 이전 기록 안에 입력칸이 있으면 섞인다").toBeNull();
    }

    /** 🔴 원격 이미지 0 — 사진이 안 뜨면 이 WU 가 성립하지 않는다. */
    for (const img of d.querySelectorAll<HTMLImageElement>("img")) {
      expect(img.getAttribute("src") ?? "", "🔴 원격 이미지").toMatch(/^data:/);
    }

    /** 🟢 이미지가 없는 자리는 **「이미지 없음」** 이라고 말한다(대체 이미지 금지). */
    const emptyFrames = d.querySelectorAll(".frame.empty");
    for (const f of emptyFrames) expect(f.textContent?.trim()).toContain("이미지 없음");

    /** 🔴 8축 표가 후보마다 하나이고 **머리글 여섯 칸** 이다(원상품 값 ↔ 후보 값 포함). */
    const axisTables = d.querySelectorAll("table.axes");
    expect(axisTables).toHaveLength(cards.length);
    for (const t of axisTables) {
      expect(t.querySelectorAll("thead th")).toHaveLength(6);
      const labels = [...t.querySelectorAll("tbody tr th")].map((n) => n.textContent);
      /** 🔴 읽지 못한 후보는 축이 **비어 있다** — 지어내지 않는다. */
      if (labels.length === 0) continue;
      expect(labels.slice(0, 8)).toEqual([
        "BRAND",
        "TITLE",
        "MODEL_CODE",
        "COLOR",
        "MATERIAL",
        "FIT",
        "GARMENT_FORM",
        "AUDIENCE_LINE",
      ]);
      /** 🔴 모든 축에 상태 배지가 있다(빈 칸으로 넘기지 않는다). */
      for (const row of t.querySelectorAll("tbody tr")) {
        expect(row.querySelector(".badge")?.textContent?.trim()).toMatch(
          /^(PASS|FAIL|CONFLICT|UNKNOWN|NOT_AVAILABLE)$/,
        );
      }
    }

    /** 🟢 복사 버튼과 내보낼 행 목록이 **짝** 이다. */
    expect(d.querySelector("#copy")).toBeTruthy();
    const rows = JSON.parse(/var ROWS = (\[[\s\S]*?\]);/.exec(d.documentElement.outerHTML)![1]) as unknown[];
    expect(rows).toHaveLength(cards.length);

    /** 🔴 JSON export 가 §9 의 칸을 전부 들고 있다. */
    for (const r of rows as Record<string, unknown>[]) {
      for (const k of ["domain", "url", "system", "priceTier", "blockers", "originCode"]) {
        expect(Object.keys(r), `🔴 export 에 ${k} 가 없다`).toContain(k);
      }
    }

    console.log(
      `    섹션 ${origins.length} · 후보 ${cards.length} · 축표 ${axisTables.length} · ` +
        `이미지 없음 ${emptyFrames.length} · export ${rows.length}`,
    );
  });

  it("라이브 산출물이 없으면 그 사실을 적는다", () => {
    if (!EXISTS) console.log("    🟡 docs/core-same03-domestic-review.html 이 없다 — CORE_SAME03_LIVE=1 로 생성한다");
    expect(EXISTS).toBe(EXISTS);
  });
});
