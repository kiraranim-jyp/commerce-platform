/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-MULTI-CATEGORY-LABEL-01 — **CEO 사람 판정용 원상품·후보 비교표**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔵 CPO 선정 조합 — 원상품 **5**(Dress 2 · Jacket 2 · Trousers 1) · 후보 **22**.
 * 🔴🔴 **CTO 가 SAME/DIFFERENT 를 확정하지 않는다.** 산출물은 **판정표** 까지다.
 *
 * 🔴 §5 수집 규칙 — **그 22개 URL 만** 읽기 전용 재관측 · 기존 운영 추출기 재사용 ·
 *    신규 크롤러 **0** · 광범위 재검색 **0** · 무제한 재시도 **0** ·
 *    실패/차단/리다이렉트는 **그대로 기록** · 번역·보정·추측 **0** ·
 *    원문과 정규화 **분리**.
 * 🔴 §8 금지 — 운영 SAME 판정 변경 0 · 자동 승격 0 · 8축 완화 0 · alias 추가 0 ·
 *    DB/schema/migration/backfill 0 · 후보 저장 구조 변경 0 · 가격·등록·seller 0.
 *
 * 🔴🔴 **라이브 게이트** — `MMCL01_LIVE=1` 이 없으면 **네트워크를 쓰지 않는다**.
 *    🟢 그래서 회귀에서는 **캡처된 산출물만** 읽는다(이 트랙의 기존 방식).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import {
  extractCodeLikeSlugSegment,
  extractCodeLikeTitleToken,
  extractLabeledProductCode,
  extractUrlSlug,
} from "@commerce/shared/src/product-facts";

/**
 * 🔴🔴 **내 1차 표가 거짓을 적었고 그것을 여기서 고친다.**
 *
 * 기준 품번을 `origin_sku`(=DB 칸) + 원상품 **상세설명** 의 품번 모양으로만 모았다.
 * 🔴 그런데 Trousers 원상품은 DB sku 가 **없고** 설명이 83자라 품번이 없다 — 운영
 *    `brandModelCode` 는 **URL slug** 에서 온다(`b226ac073-…`). ⟹ 후보 설명의
 *    **`B226AC073`(정확히 그 품번)을 「다른 품번」으로 적었다** = CEO 를 오판으로 미는 거짓.
 * 🟢 그래서 **운영 owner 순서**(설명문 → 제목 → URL slug)를 그대로 불러 기준값에 넣는다.
 *    🔴 DB sku 는 그 순서에 **없다** — 따로 적는다(CPO §3-A 혼용 금지).
 */
const operationalOriginCode = (desc: string | null, title: string | null, url: string | null): string | null =>
  extractLabeledProductCode(desc) ??
  extractCodeLikeTitleToken(title) ??
  extractCodeLikeSlugSegment(extractUrlSlug(url));

const FIX = join(__dirname, "fixtures");
const DUMP = join(FIX, "mmcl01-ceo-label.json");
const LIVE = process.env.MMCL01_LIVE === "1";

/** 🔵 CPO 선정 상품군 셋 — 🔴 CTO 가 고른 것이 아니다. */
const SELECTED_GROUPS = new Set(["Dress", "Jacket", "Trousers"]);

interface Snap {
  snapshot_id: string;
  origin_brand: string | null;
  origin_sku: string | null;
  origin_title: string | null;
  origin_desc: string | null;
  shopify_type: string | null;
  source_url: string | null;
}
interface BaseRow {
  snapshot_id: string | null;
  candidate_url: string;
  candidate_domain: string | null;
  candidate_title: string | null;
  market: string | null;
  system_verdict: string | null;
  match_truth: string | null;
  price_tier: string | null;
  blockers: unknown;
  human_verdict: string | null;
}

/** 🔵 §2 — 세 식별정보의 **존재 여부 · 원문 발췌 · 일치 · 출처 · 비고**. */
type Presence = "있음" | "없음" | "확인 불가";
type Agreement = "일치" | "불일치" | "비교 불가";
type Origin = "상세설명" | "제목" | "구조화 필드" | "URL" | "-";
interface AxisCell {
  presence: Presence;
  excerpt: string | null;
  agreement: Agreement;
  source: Origin;
  note: string;
}

/** 🔴 발췌 — **원문 그대로** 자른다(번역·보정 0). 앞뒤 문맥을 같이 보여준다. */
const excerptAround = (text: string, needle: string, pad = 55): string | null => {
  const i = text.toUpperCase().indexOf(needle.toUpperCase());
  if (i < 0) return null;
  const a = Math.max(0, i - pad);
  const b = Math.min(text.length, i + needle.length + pad);
  return (a > 0 ? "…" : "") + text.slice(a, b).replace(/\s+/g, " ").trim() + (b < text.length ? "…" : "");
};

/** 🔴 인코딩 손상 — 치환문자/제어문자 비율로만 본다(복원 0). */
const damaged = (s: string | null | undefined): boolean => {
  if (!s) return false;
  /** 🔴 U+FFFD(치환문자)와 **제어문자** 를 코드포인트로만 센다 — 리터럴 제어문자 금지. */
  let bad = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0xfffd || cp <= 0x08 || (cp >= 0x0e && cp <= 0x1f)) bad += 1;
  }
  return bad > 0 && bad / s.length > 0.02;
};
/** 🔴 다국어 — 한글/가나/한자. 번역하지 않는다. */
const multilingual = (s: string | null | undefined): boolean =>
  Boolean(s && /[ㄱ-힝぀-ヿ一-鿿]/.test(s));

/** 🔴 **승인된 품번 모양 하나** — 새 패턴을 만들지 않는다(model-code-from-detail 와 같은 모양). */
const CODE_SHAPE = /\b[A-Z]{1,3}\d{2,3}[A-Z]{0,2}\d{2,4}\b/g;

/** 🔴 상품명 핵심 토큰 — **원상품 제목에서** 뽑는다(새 사전 0 · 불용어만 제거). */
const STOP = new Set(["by", "in", "the", "and", "with", "of", "for", "a", "an", "kids", "baby"]);
const nameTokens = (title: string | null): string[] =>
  (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));

describe("MMCL01 — CEO 판정용 비교표", () => {
  it(
    LIVE
      ? "L-1 🔵 **후보 22개만** 읽기 전용 재관측 — 세 식별정보 발췌를 만든다"
      : "L-1 (SKIP) 🔴 `MMCL01_LIVE=1` 없으면 네트워크를 쓰지 않는다",
    async () => {
      if (!LIVE) return;
      const base = JSON.parse(readFileSync(join(FIX, "mmse01-baseline.json"), "utf8")) as {
        bySnapshot: Snap[];
        rows: BaseRow[];
      };
      const snaps = base.bySnapshot.filter((s) => SELECTED_GROUPS.has((s.shopify_type ?? "").trim()));
      const rows = base.rows.filter((r) => r.snapshot_id != null);
      expect(snaps, "🔴 CPO 선정 원상품 수가 5 가 아니다").toHaveLength(5);

      const out: unknown[] = [];
      let httpCalls = 0;
      for (const s of snaps) {
        const cands = rows.filter((r) => r.snapshot_id === s.snapshot_id);
        const originDesc = s.origin_desc ?? "";
        const originBrand = (s.origin_brand ?? "").trim();
        const originTokens = nameTokens(s.origin_title);
        /** 🔴 원상품 품번 — DB sku 와 **별개** 로 운영 해석값도 적는다(혼용 금지 · CPO §3-A). */
        const originCodeShapes = [...new Set((originDesc.match(CODE_SHAPE) ?? []).map((x) => x.toUpperCase()))];
        /** 🟢 운영 비교축이 쓰는 값 — DB 칸과 **별개** 다. */
        const originOpCode = operationalOriginCode(s.origin_desc, s.origin_title, s.source_url);

        const candRows: unknown[] = [];
        for (const c of cands) {
          /** 🔴 **운영 추출기 그대로** — 새 수집기 0. 실패는 그대로 적는다. */
          let facts: Awaited<ReturnType<typeof factsFromProductUrl>> | null = null;
          let failure: string | null = null;
          try {
            facts = await factsFromProductUrl(c.candidate_url);
            httpCalls += facts?.httpCalls ?? 0;
          } catch (e) {
            failure = "EXCEPTION: " + String((e as Error)?.message ?? e).slice(0, 120);
          }
          const status = failure ?? facts?.status ?? "NO_RESULT";
          const f = facts?.status === "OK" ? facts.candidate?.facts ?? null : null;
          const desc = (f as { description?: string | null } | null)?.description ?? null;
          const title = (f as { title?: string | null } | null)?.title ?? c.candidate_title ?? null;
          const cBrand = (f as { brand?: string | null } | null)?.brand ?? null;
          const cCode = (f as { brandModelCode?: string | null } | null)?.brandModelCode ?? null;
          /** 🔴 상세설명 **미확보** 면 세 칸은 「확인 불가」다 — 「없음」으로 적지 않는다(CPO §2). */
          const descAvailable = typeof desc === "string" && desc.length > 0;

          const brandCell = ((): AxisCell => {
            if (!descAvailable) {
              return {
                presence: "확인 불가",
                excerpt: null,
                agreement: cBrand && originBrand ? (cBrand.toLowerCase() === originBrand.toLowerCase() ? "일치" : "불일치") : "비교 불가",
                source: cBrand ? "구조화 필드" : "-",
                note: `상세설명 미확보(${status})` + (cBrand ? ` · 구조화 브랜드 「${cBrand}」` : ""),
              };
            }
            const ex = originBrand ? excerptAround(desc!, originBrand) : null;
            return {
              presence: ex ? "있음" : "없음",
              excerpt: ex,
              agreement: ex ? "일치" : cBrand && originBrand ? (cBrand.toLowerCase() === originBrand.toLowerCase() ? "일치" : "불일치") : "비교 불가",
              source: ex ? "상세설명" : cBrand ? "구조화 필드" : "-",
              note:
                (cBrand ? `구조화 「${cBrand}」` : "구조화 브랜드 없음") +
                (damaged(desc) ? " · 🔴 인코딩 손상" : "") +
                (multilingual(desc) ? " · 다국어" : ""),
            };
          })();

          const codeCell = ((): AxisCell => {
            /**
             * 🔴 기준 품번 셋을 **합쳐** 쓴다 — ⒜ 운영 `brandModelCode`
             *    ⒝ DB sku ⒞ 원상품 설명문의 품번 모양. 🔴 ⒜ 를 빠뜨려 1차에 거짓을 적었다.
             */
            const needles = [
              ...new Set(
                [...(originOpCode ? [originOpCode] : []), ...(s.origin_sku ? [s.origin_sku] : []), ...originCodeShapes].map(
                  (x) => x.toUpperCase(),
                ),
              ),
            ];
            if (!descAvailable) {
              return {
                presence: "확인 불가",
                excerpt: null,
                agreement: cCode && needles.length > 0 ? (needles.some((n) => n.toUpperCase() === cCode.toUpperCase()) ? "일치" : "불일치") : "비교 불가",
                source: cCode ? "구조화 필드" : "-",
                note: `상세설명 미확보(${status})` + (cCode ? ` · 구조화 품번 「${cCode}」` : ""),
              };
            }
            let hit: string | null = null;
            let ex: string | null = null;
            for (const n of needles) {
              const e = excerptAround(desc!, n);
              if (e) {
                hit = n;
                ex = e;
                break;
              }
            }
            /** 🔴 후보 설명에 **다른 품번** 이 있으면 그 원문도 보여준다(CPO §7). */
            const otherCodes = [...new Set((desc!.match(CODE_SHAPE) ?? []).map((x) => x.toUpperCase()))].filter(
              (x) => !needles.some((n) => n.toUpperCase() === x),
            );
            return {
              presence: hit ? "있음" : "없음",
              excerpt: ex,
              agreement: hit ? "일치" : otherCodes.length > 0 ? "불일치" : needles.length === 0 ? "비교 불가" : "불일치",
              source: hit ? "상세설명" : cCode ? "구조화 필드" : "-",
              note:
                (cCode ? `구조화 「${cCode}」` : "구조화 품번 없음") +
                (needles.length === 0 ? " · 🔴 원상품 기준 품번 없음" : "") +
                (otherCodes.length > 0 ? ` · 🔴 다른 품번 ${otherCodes.slice(0, 3).join(", ")}` : ""),
            };
          })();

          const nameCell = ((): AxisCell => {
            const inTitle = originTokens.filter((t) => (title ?? "").toLowerCase().includes(t));
            if (!descAvailable) {
              return {
                presence: "확인 불가",
                excerpt: title ? title.slice(0, 110) : null,
                agreement: originTokens.length === 0 ? "비교 불가" : inTitle.length >= 2 ? "일치" : "불일치",
                source: title ? "제목" : "-",
                note: `상세설명 미확보(${status}) · 제목 겹침 ${inTitle.length}/${originTokens.length}`,
              };
            }
            const inDesc = originTokens.filter((t) => desc!.toLowerCase().includes(t));
            const ex = inDesc.length > 0 ? excerptAround(desc!, inDesc[0]) : null;
            return {
              presence: inDesc.length >= 2 ? "있음" : inDesc.length === 1 ? "있음" : "없음",
              excerpt: ex,
              agreement: originTokens.length === 0 ? "비교 불가" : inDesc.length >= 2 || inTitle.length >= 2 ? "일치" : "불일치",
              source: ex ? "상세설명" : title ? "제목" : "-",
              note:
                `설명 겹침 ${inDesc.length}/${originTokens.length} · 제목 겹침 ${inTitle.length}/${originTokens.length}` +
                (multilingual(title) ? " · 다국어 제목" : "") +
                (damaged(title) ? " · 🔴 인코딩 손상" : ""),
            };
          })();

          candRows.push({
            domain: c.candidate_domain,
            url: c.candidate_url,
            market: c.market ?? "미확정",
            /** 🔴 §6 — 기존 자동 판정은 **그대로 보존** 한다. */
            systemVerdict: c.system_verdict,
            matchTruth: c.match_truth,
            priceTier: c.price_tier,
            blockers: Array.isArray(c.blockers) ? c.blockers : [],
            storedHumanVerdict: c.human_verdict,
            /** 재관측 결과 */
            fetchStatus: status,
            fetchPath: facts?.status === "OK" ? facts.fetchPath ?? null : null,
            candidateBrand: cBrand,
            candidateCode: cCode,
            candidateTitle: title,
            descriptionChars: desc?.length ?? 0,
            descriptionRaw: desc,
            imageUrl: facts?.status === "OK" ? facts.candidate?.imageUrl ?? null : null,
            brand: brandCell,
            code: codeCell,
            name: nameCell,
            /** 🔴 §6 — CEO 판정란은 **비워 둔다**(CTO 가 채우지 않는다). */
            ceoVerdict: null,
            ceoNote: null,
          });
        }

        out.push({
          group: (s.shopify_type ?? "").trim(),
          snapshotId: s.snapshot_id,
          originTitle: s.origin_title,
          originUrl: s.source_url,
          originBrand: s.origin_brand,
          /** 🔴 DB SKU 와 운영 품번을 **절대 혼용하지 않는다**(CPO §3-A). */
          originDbSku: s.origin_sku,
          /** 🟢 운영 품번과 그 출처 — 🔴 DB sku 와 **혼용하지 않는다**. */
          originOpCode,
          originOpCodeSource:
            extractLabeledProductCode(s.origin_desc) != null
              ? "설명문"
              : extractCodeLikeTitleToken(s.origin_title) != null
                ? "제목"
                : originOpCode != null
                  ? "URL slug"
                  : "없음",
          originCodeShapesInDesc: originCodeShapes,
          originDescChars: originDesc.length,
          originDescRaw: originDesc,
          originBrandExcerpt: originBrand ? excerptAround(originDesc, originBrand) : null,
          originCodeExcerpt:
            s.origin_sku && originDesc ? excerptAround(originDesc, s.origin_sku) : originCodeShapes[0] ? excerptAround(originDesc, originCodeShapes[0]) : null,
          originNameTokens: originTokens,
          candidates: candRows,
        });
      }

      writeFileSync(
        join(FIX, "mmcl01-ceo-label.json"),
        JSON.stringify(
          {
            note:
              "🔴 MMCL-01 — CEO 판정용 비교표 입력. 🔴 CTO 가 SAME/DIFFERENT 를 확정하지 않았다. " +
              "🔴 ceoVerdict 는 전건 null · DB 저장 0 · 운영 판정 연결 0. " +
              "원문은 그대로(번역·보정 0) · 정규화와 분리.",
            httpCalls,
            origins: out.length,
            /** 🔴 `reduce` 초기값을 숫자로 **명시** 한다 — 안 하면 `a` 가 `unknown` 이다(typecheck 가 잡았다). */
            candidates: out.reduce<number>((a, o) => a + (o as { candidates: unknown[] }).candidates.length, 0),
            groups: [...SELECTED_GROUPS],
            rows: out,
          },
          null,
          2,
        ),
        "utf8",
      );
      /* eslint-disable no-console */
      console.log(`[MMCL01] 원상품 ${out.length} · HTTP ${httpCalls}`);
      /* eslint-enable no-console */
    },
    900_000,
  );

  it("A-1 🟢🟢 **비교표가 22개 후보를 전부 담았다** — 세 축에 실제 발췌가 있다", () => {
    if (!existsSync(DUMP)) {
      expect(LIVE, "🔴 산출물이 없다 — `MMCL01_LIVE=1` 로 한 번 돌려야 한다").toBe(true);
      return;
    }
    const d = JSON.parse(readFileSync(DUMP, "utf8")) as {
      origins: number;
      candidates: number;
      rows: {
        group: string;
        originTitle: string;
        originBrand: string | null;
        originDbSku: string | null;
        originDescChars: number;
        candidates: {
          domain: string;
          fetchStatus: string;
          descriptionChars: number;
          brand: AxisCell;
          code: AxisCell;
          name: AxisCell;
          systemVerdict: string | null;
          ceoVerdict: string | null;
        }[];
      }[];
    };
    /** 🔴 CPO 검수 기준 ① — **22개가 모두 표에 있어야 한다**. */
    expect(d.origins, "🔴 원상품 5 가 아니다").toBe(5);
    expect(d.candidates, "🔴🔴 후보 22 가 아니다 — CPO 검수 기준 미달").toBe(22);
    const all = d.rows.flatMap((r) => r.candidates);
    expect(all).toHaveLength(22);
    /** 🔴 상품군 분포 — Dress 2 · Jacket 2 · Trousers 1. */
    const byGroup = d.rows.reduce<Record<string, number>>((m, r) => {
      m[r.group] = (m[r.group] ?? 0) + 1;
      return m;
    }, {});
    expect(byGroup).toEqual({ Dress: 2, Jacket: 2, Trousers: 1 });

    for (const c of all) {
      /** 🔴 세 축이 **행마다** 있다. */
      for (const [k, cell] of [["브랜드", c.brand], ["품번", c.code], ["상품명", c.name]] as [string, AxisCell][]) {
        expect(["있음", "없음", "확인 불가"], `🔴 ${c.domain} ${k} 존재 여부 어휘가 아니다`).toContain(cell.presence);
        expect(["일치", "불일치", "비교 불가"], `🔴 ${c.domain} ${k} 일치 어휘가 아니다`).toContain(cell.agreement);
        /**
         * 🔴🔴 **CPO 검수 기준 ②** — 「있음」이면 **실제 원문 발췌** 가 있어야 한다.
         *    「브랜드 있음」만 적거나 구조화 필드 값만 복사한 것은 **완료로 인정되지 않는다**.
         */
        if (cell.presence === "있음") {
          expect(cell.excerpt, `🔴🔴 ${c.domain} ${k} 「있음」인데 발췌가 없다`).toBeTruthy();
          expect((cell.excerpt ?? "").length, `🔴 ${c.domain} ${k} 발췌가 너무 짧다`).toBeGreaterThan(8);
        }
        /** 🔴 상세설명 미확보면 **「없음」이 아니라 「확인 불가」** 다(CPO §2 명시). */
        if (c.descriptionChars === 0) {
          expect(cell.presence, `🔴 ${c.domain} ${k} — 미확보를 「없음」으로 적었다`).toBe("확인 불가");
        }
      }
      /** 🔴 §6 — CEO 판정란은 **비어 있다**(CTO 가 채우지 않았다). */
      expect(c.ceoVerdict, `🔴🔴 ${c.domain} — CTO 가 판정을 채웠다`).toBeNull();
    }
    /**
     * 🔴🔴 **1차 표가 거짓을 적었고 그 재발을 여기서 막는다.**
     *    기준 품번에 **운영 `brandModelCode`** 를 빠뜨려, 후보 설명의 **`B226AC073`
     *    (원상품 자신의 품번)** 을 「다른 품번」으로 적었다 ⟹ CEO 를 오판으로 미는 거짓.
     * 🟢 그래서 ⒜ 원상품마다 **DB sku 와 운영 품번이 따로** 있고
     *    ⒝ **「다른 품번」 비고에 원상품 자신의 품번이 등장하지 않는다** 를 단언한다.
     */
    for (const r of d.rows as unknown as {
      group: string;
      originDbSku: string | null;
      originOpCode: string | null;
      originOpCodeSource: string;
      candidates: { domain: string; code: AxisCell }[];
    }[]) {
      expect(["설명문", "제목", "URL slug", "없음"], `🔴 ${r.group} 운영 품번 출처 어휘가 아니다`).toContain(
        r.originOpCodeSource,
      );
      if (r.originOpCode == null) expect(r.originOpCodeSource).toBe("없음");
      const own = (r.originOpCode ?? "").toUpperCase();
      if (own.length === 0) continue;
      for (const c of r.candidates) {
        const other = c.code.note.includes("다른 품번") ? c.code.note.slice(c.code.note.indexOf("다른 품번")) : "";
        expect(
          other.toUpperCase(),
          `🔴🔴 ${c.domain} — 원상품 자신의 품번 ${own} 을 「다른 품번」으로 적었다`,
        ).not.toContain(own);
      }
    }
    /** 🔴 그리고 **DB sku 와 운영 품번이 갈린 실례** 가 이 묶음에 있다(혼용 금지의 근거). */
    const rows2 = d.rows as unknown as { originDbSku: string | null; originOpCode: string | null }[];
    expect(
      rows2.filter((r) => (r.originDbSku ?? "") === "" && r.originOpCode != null).length,
      "🔴 DB sku 없이 운영 품번만 있는 원상품이 사라졌다",
    ).toBe(3);

    /** 🔴 기존 자동 판정이 **보존** 돼 있다. */
    expect(all.filter((c) => c.systemVerdict != null).length, "🔴 기존 자동 판정이 사라졌다").toBeGreaterThanOrEqual(21);
  });

  it("C-1 🔴 **금지 전수 — 판정 변경·저장·광범위 수집을 하지 않았다**", () => {
    const self = readFileSync(__filename, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
    for (const banned of [
      ["compute", "MarketIntelligence"].join(""),
      ["price", "TierFromLink"].join(""),
      ["attach", "MatchTruth"].join(""),
      ["compare", "CrossSellerProducts"].join(""),
      ["candidate", "reviews"].join("_"),
      ["search", "ComparisonShops"].join(""),
      ["search", "DomesticShops"].join(""),
      ["BRAND", "_ALIASES"].join(""),
      ["SAME", "_MIN_AXES"].join(""),
    ]) {
      expect(self, `🔴 금지 경로를 끌어왔다: ${banned}`).not.toContain(banned);
    }
    /** 🟢 수집기는 **운영 추출기 하나** 다(신규 크롤러 0). */
    expect(self, "🔴 운영 추출기를 쓰지 않았다").toContain(["facts", "FromProductUrl"].join(""));
    /** 🔴 라이브는 **게이트 뒤** 에만 있다. */
    /** 🔴 **자기참조 함정 — 아홉 번째다.** 앵커 문자열을 그대로 적으면 자기를 찾는다. */
    expect(self).toContain(["process.env.MMCL01", '_LIVE === "1"'].join(""));
    expect(self, "🔴 게이트 없이 수집한다").toContain(["if (!LIVE)", " return;"].join(""));
    /** 🔴 CEO 판정을 CTO 가 채우지 않는다 — 리터럴로 잠근다. */
    expect(self).toContain(["ceoVerdict", ": null"].join(""));
    expect(self).toContain(["ceoNote", ": null"].join(""));
  });
});
