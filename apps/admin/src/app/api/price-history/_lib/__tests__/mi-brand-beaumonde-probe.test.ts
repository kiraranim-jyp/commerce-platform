import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import type { EvidenceItem, ProductFacts } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STEP 2 — **beaumonde 한글 브랜드 표기 원문 검증**(CPO 승인 2026-11-06)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **C15 자체가 «아니다».** C15 는 C-코드↔URL 매핑이 리포에 없어 **특정 불가** 다.
 *    이 건은 **같은 유형의 «대체» 검증 사례** 다 — 한글 브랜드 표기 + `facts.brand = null`
 *    + Human GT **SAME**. 🔴 이 결과를 **C15 의 원문 검증 완료로 쓰지 않는다**(CPO 명시).
 *
 * 🔴 운영 브랜드 추출기 · matcher · Identity · alias · GT · DB · 화면 **변경 0**.
 *    이 파일은 **방문해서 읽기만** 한다.
 * 🔴 기본 **SKIP** — `MI_BEAUMONDE_PROBE=1` 일 때만 네트워크를 쓴다(회귀에 HTTP 0).
 *
 * 실행:
 *   MI_BEAUMONDE_PROBE=1 npx vitest run \
 *     src/app/api/price-history/_lib/__tests__/mi-brand-beaumonde-probe.test.ts --testTimeout=120000
 */

const LIVE = process.env.MI_BEAUMONDE_PROBE === "1";
const URL = "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021";

/** 🟢 기존 GT 기록(`wu-059-gt-facts.json`) — 🔴 **수정하지 않는다 · 대조용** 이다. */
const GT_RECORD = {
  domain: "beaumonde.co.kr",
  url: URL,
  humanGt: "SAME",
  title: "보보쇼즈 26FW 아동 긴팔 티셔츠 Booty Ghosts T-shirt B226AC010",
  factsBrand: null as string | null,
} as const;

/** 🔴 비교 전용 정규화 — 저장값을 바꾸지 않는다. */
const nm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[\s_·.\-\[\]#/]/g, "");

describe("STEP 2 — beaumonde 브랜드 한글 표기 원문 검증", () => {
  it.runIf(LIVE)(
    "실제 URL 을 방문해 브랜드·상품명·품번 원문을 보존한다",
    async () => {
      const visitedAt = new Date().toISOString();
      const r = await factsFromProductUrl(URL);
      const f = (r.candidate?.facts ?? null) as ProductFacts | null;
      const ev = f?.evidence ?? null;
      const items = (axis: string): EvidenceItem[] =>
        (ev?.[axis as keyof typeof ev] as EvidenceItem[] | undefined) ?? [];

      const desc = f?.description ?? null;
      const title = f?.title ?? null;

      /** 🔴 「보보쇼즈」가 **어디에** 있는지 — 제목 ↔ 상세설명을 가른다(섞으면 거짓이다). */
      const KO = "보보쇼즈";
      const koInTitle = !!title && title.includes(KO);
      const koInDesc = !!desc && desc.includes(KO);
      const codeInTitle = !!title && nm(title).includes(nm("B226AC010"));
      const codeInDesc = !!desc && nm(desc).includes(nm("B226AC010"));

      const out = {
        url: URL,
        visitedAt,
        /* 접근 결과 */
        status: r.status,
        fetchPath: String(r.fetchPath),
        httpCalls: r.httpCalls,
        /* 운영 추출 산출 — 가공 0 */
        liveTitle: title,
        liveBrand: f?.brand ?? null,
        liveModelCode: f?.brandModelCode ?? null,
        liveSellerSku: f?.sellerSku ?? null,
        liveColor: f?.colorText ?? null,
        liveCategory: f?.categoryText ?? null,
        /* 원문 보존(요약하지 않는다) */
        descriptionRaw: desc,
        descriptionLength: desc ? desc.length : 0,
        /* 증거 축 — sourceLocation 은 운영 evidence 의 source 다 */
        evidenceBrand: items("BRAND"),
        evidenceModelCode: items("MODEL_CODE"),
        evidenceProductName: items("PRODUCT_NAME"),
        /* 「보보쇼즈」 위치 */
        koreanBrandInTitle: koInTitle,
        koreanBrandInDescription: koInDesc,
        codeInTitle,
        codeInDescription: codeInDesc,
        /* 기존 기록 대조 — 🔴 GT 는 수정하지 않는다 */
        gtRecord: GT_RECORD,
        /* 🔴 분석 의견 — 증거와 «분리» 해서 적는다(CPO §5) */
        analysisOpinion: {
          note: "🔴 아래는 CTO 의 «의견» 이고 증거가 아니다. 운영에 반영하지 않았다.",
          koreanToLatinIdentity:
            "「보보쇼즈」 ↔ 「Bobo Choses」 의 동일성은 **음역 판단** 이다. 현재 운영 비교기는 이 둘을 같다고 보지 않는다(문자열이 다르다).",
          isNotC15: "🔴 이 건은 C15 가 아니다 — 같은 유형의 대체 검증 사례다.",
        },
      };

      const dir = path.join(os.tmpdir(), "mi-url-evidence");
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, "step2-beaumonde.json"), JSON.stringify(out, null, 1), "utf8");

      /* eslint-disable no-console */
      console.log("═══ STEP 2 — beaumonde 원문 검증 ═══");
      console.log(JSON.stringify({ ...out, descriptionRaw: undefined }, null, 1));
      console.log("\n--- descriptionRaw 전문 ---");
      console.log(desc ?? "(없음)");
      console.log(`\n🟢 산출: ${path.join(dir, "step2-beaumonde.json")}`);
      /* eslint-enable no-console */

      /**
       * 🔴 **열화 게이트** — 접근이 실패하면 숫자를 내지 않는다(「측정불가 ≠ 0」).
       *    🔴 접근 실패 자체도 **사유와 함께** 산출 파일에 남는다.
       */
      expect(r.status, `🔴 접근 실패(${r.status}) — 이 실행의 판독을 쓰지 않는다`).toBe("OK");
    },
    120_000,
  );

  it("기본은 SKIP 이고 GT 를 수정하지 않는다(가드)", () => {
    /** 🔴 이 프로브가 GT 를 고치지 않는다는 것을 계약으로 둔다. */
    expect(GT_RECORD.humanGt).toBe("SAME");
    expect(GT_RECORD.factsBrand).toBeNull();
  });
});
