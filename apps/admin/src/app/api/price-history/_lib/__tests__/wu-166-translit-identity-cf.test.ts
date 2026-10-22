import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { factsFromProductUrl } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { extractCategoryTaxon } from "@commerce/crawler/src/comparison-search/match";
import type { ProductFacts } from "@commerce/shared";
import { buildCoreTitleTokens, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-166 — **고유 상품명 한/영 음역을 identity «보조» 증거로 쓸 수 있는가**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-22) — 「**음역 자체를 새로 구현하지 말 것.** 먼저 기존 코드/자산/
 * fixtures 에서 전수 확인한다」 · 「CF-0 / CF-1 / CF-2 를 비교하고 **CF-2 를 가장 중요한
 * 후보** 로 본다」 · 「**DIFFERENT leakage 가 발생하면 NO-GO**」.
 *
 * 🔴 운영 코드 **0** · `NO_TITLE_OVERLAP` 삭제 **0** · threshold **0** ·
 *    `MODEL_CODE` 단독 승격 **0** · 「품번 일치 = SAME」 **0** · 번역 API/LLM **0** ·
 *    fuzzy/유사도 점수 **0** · 전체 title fuzzy **0** · 배포 **0**.
 * 🔴 게이트 `WU_166_PROBE=1` 없으면 SKIP.
 *
 * ── 🟢🟢 §2 전수 확인 결과 — **음역 자산이 이미 있다**(새로 만들지 않았다) ──────
 * ```
 * 🟢 `wu-078-language-evidence.test.ts` 에 **자음 뼈대** 비교가 구현돼 있다 —
 *    `romanize`(한글 → 자모 로마자) · `generalize`(sh/sy→s · ch→c · c→k · 중복자음 축약)
 *    · `skeleton`(모음 제거) · `engSkeleton`(영문 쪽 **같은 규칙**)
 * 🔴 그 파일은 **테스트** 라 export 가 없다 ⟹ **그대로 옮겼다(사본)**.
 *    🔴 **한 글자도 바꾸지 않았다** — 이 표본에 맞춰 규칙을 조정하면 과적합이고
 *       WU-078 이 그것을 금지했다(「N=4 에 맞춰 조정하면 과적합이다」).
 * 🟢 그리고 **GT 에 실제 한/영 대응 사례가 있다** — `wu-093-human-gt.json` S1 5건.
 *    🔴🔴 그중 **3건이 human DIFFERENT** 다(양말 2 · 색상 다름 1) ⟹ CPO §4 가 요구한
 *       「동일 브랜드 + 다른 디자인」 · 「한/영 title 이 우연히 유사한 DIFFERENT」 분모다
 * ```
 */
const LIVE = process.env.WU_166_PROBE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";
const TARGET_CODE = "b226ac009";

/* ════════ 🔴 아래 네 함수는 WU-078 하니스의 «사본» 이다 — 변경 0 ════════ */
const CHO = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "c", "k", "t", "p", "h"];
const JUNG = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const JONG = ["", "g", "kk", "gs", "n", "nj", "nh", "d", "l", "lg", "lm", "lb", "ls", "lt", "lp", "lh", "m", "b", "bs", "s", "ss", "ng", "j", "c", "k", "t", "p", "h"];

function romanize(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c >= 0xac00 && c <= 0xd7a3) {
      const i = c - 0xac00;
      out += CHO[Math.floor(i / 588)] + JUNG[Math.floor((i % 588) / 28)] + JONG[i % 28];
    } else out += ch.toLowerCase();
  }
  return out;
}
const generalize = (x: string) =>
  x
    .replace(/sy|sh/g, "s")
    .replace(/ch/g, "c")
    .replace(/c/g, "k")
    .split("")
    .filter((c, i2, a) => c !== a[i2 - 1])
    .join("");
const engSkeleton = (s: string) => generalize(s.toLowerCase().replace(/[^a-z]/g, "")).replace(/[aeiou]/g, "");
const skeleton = (s: string) => generalize(romanize(s).replace(/[^a-z]/g, "")).replace(/[aeiou]/g, "");
/* ════════════════════════════════════════════════════════════════════════ */

const HANGUL = /[가-힣]/;
/** 🔴 한글 토큰은 `skeleton`, 라틴 토큰은 `engSkeleton` — **같은 규칙** 을 쓴다. */
const skelOf = (t: string) => (HANGUL.test(t) ? skeleton(t) : engSkeleton(t));

interface Cand {
  label: string;
  human: "SAME" | "DIFFERENT";
  tokens: string[];
  /** 🔴 후보 쪽에 원상품 품번이 **있는가**(title/slug 토큰에 그대로 있는가) */
  hasCode: boolean;
  src: "URL(운영 facts)" | "GT title(제목 축 전용)";
}

describe("WU-166 — 음역 identity 보조 증거 CF", () => {
  it.runIf(LIVE)("CF-0 / CF-1 / CF-2 를 비교하고 DIFFERENT 방어를 본다", async () => {
    /* eslint-disable no-console */
    const ex = await shopifySiteStrategy.extract(ORIGIN);
    expect(ex, "원상품 추출 실패").not.toBeNull();
    const product = buildCanonicalProduct(
      ORIGIN,
      ex!.productData as ExtractedProductData,
      {} as Record<string, ProductDataSource>,
      [],
    );
    const dna = buildProductIdentityDna(product);
    const of = productFactsFromIdentityDna(dna);
    const originDist = of.coreTitleTokens.filter((t) => extractCategoryTaxon(t) === null);
    const originSkel = new Set(originDist.map(skelOf).filter((s) => s.length >= 2));
    console.log("\n══════ 🔴 원상품 ══════");
    console.log(`  distinctive ${JSON.stringify(originDist)}`);
    console.log(`  자음 뼈대   ${JSON.stringify([...originSkel])}`);

    const cands: Cand[] = [];

    /* ── ⒜ 실제 URL 둘(운영 facts) ── */
    const gt112 = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "wu-112-human-gt.json"), "utf8"),
    ) as { candidates: { domain: string; url: string; verdict: string; originCode: string }[] };
    const urlRows = gt112.candidates.filter(
      (c) => c.originCode === "B226AC009" && (c.domain.includes("biskuit") || c.domain.includes("luxboy")),
    );
    for (const r of urlRows) {
      const f = await factsFromProductUrl(r.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        console.log(`  ${r.domain} 🔴 ${f.status} — 제외`);
        continue;
      }
      const cf = f.candidate.facts as ProductFacts;
      const toks = cf.coreTitleTokens.filter((t) => extractCategoryTaxon(t) === null);
      cands.push({
        label: r.domain,
        human: r.verdict as "SAME" | "DIFFERENT",
        tokens: toks,
        hasCode: toks.some((t) => t.toLowerCase() === TARGET_CODE) || r.url.toLowerCase().includes(TARGET_CODE),
        src: "URL(운영 facts)",
      });
    }

    /* ── ⒝ wu-093 S1 — 🔴 CPO §4 가 요구한 「같은 디자인명인데 DIFFERENT」 분모 ── */
    const gt093 = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "wu-093-human-gt.json"), "utf8"),
    ) as { humanReview: { sku: string; case: string; title: string; verdict: string; note: string | null }[] };
    for (const r of gt093.humanReview.filter((x) => x.case === "S1")) {
      /**
       * 🔴 이 행에는 **URL 이 없다** — 제목만 있다. 그래서 `buildCoreTitleTokens` 로
       *    **제목 축만** 만든다(브랜드를 노이즈로 준다). 🔴 색상·소재를 모르므로
       *    **운영 facts 와 동일하지 않다** — 「제목 축 전용 측정」으로 적는다.
       */
      const toks = buildCoreTitleTokens(r.title, ["보보쇼즈"]).filter((t) => extractCategoryTaxon(t) === null);
      cands.push({
        label: `${r.title.slice(0, 22)}${r.note ? `(${r.note})` : ""}`,
        human: r.verdict as "SAME" | "DIFFERENT",
        tokens: toks,
        hasCode: r.title.toLowerCase().includes(TARGET_CODE),
        src: "GT title(제목 축 전용)",
      });
    }

    /* ── CF 계산 ── */
    interface Row extends Cand {
      cf0: number;
      cf1: string[];
      cf2: boolean;
    }
    const rows: Row[] = cands.map((c) => {
      const cf0 = c.tokens.filter((t) => originDist.includes(t)).length;
      const skels = c.tokens.map(skelOf).filter((s) => s.length >= 2);
      const cf1 = [...new Set(skels.filter((s) => originSkel.has(s)))];
      return { ...c, cf0, cf1, cf2: cf1.length > 0 && c.hasCode };
    });

    console.log("\n══════ 🔴🔴 CF 비교 ══════");
    console.log(
      `  ${"후보".padEnd(26)} ${"human".padEnd(10)} ${"CF0".padStart(4)} ${"CF1".padStart(4)} ${"품번".padStart(5)} ${"CF2".padStart(5)}  음역 겹침`,
    );
    for (const r of rows) {
      console.log(
        `  ${r.label.padEnd(26)} ${r.human.padEnd(10)} ${String(r.cf0).padStart(4)} ${String(r.cf1.length).padStart(4)}` +
          ` ${(r.hasCode ? "🟢" : "🔴").padStart(4)} ${(r.cf2 ? "🟢열림" : "🔴닫힘").padStart(6)}  ${JSON.stringify(r.cf1)}`,
      );
    }

    /* ── 판정 ── */
    const blocked0 = rows.filter((r) => r.cf0 === 0);
    const cf1Open = blocked0.filter((r) => r.cf1.length > 0);
    const cf2Open = blocked0.filter((r) => r.cf2);
    const tally = (xs: Row[]) => `SAME ${xs.filter((x) => x.human === "SAME").length} · DIFFERENT ${xs.filter((x) => x.human === "DIFFERENT").length}`;

    console.log("\n══════ 🔴🔴 판정 ══════");
    console.log(`  후보 ${rows.length} · CF-0 에서 겹침 0 = **${blocked0.length}** (${tally(blocked0)})`);
    console.log(`\n  CF-1 음역 단독      → 열리는 것 **${cf1Open.length}** (${tally(cf1Open)})`);
    const cf1Leak = cf1Open.filter((r) => r.human === "DIFFERENT");
    console.log(`     🔴 **DIFFERENT leakage = ${cf1Leak.length}**  ${cf1Leak.map((r) => r.label).join(" · ")}`);
    console.log(`     판정 ${cf1Leak.length > 0 ? "🔴 **NO-GO**(CPO: leakage 발생 시 NO-GO)" : "🟡 leakage 0"}`);
    console.log(`\n  CF-2 음역 + **품번 동반** → 열리는 것 **${cf2Open.length}** (${tally(cf2Open)})`);
    const cf2Leak = cf2Open.filter((r) => r.human === "DIFFERENT");
    console.log(`     🔴 **DIFFERENT leakage = ${cf2Leak.length}**  ${cf2Leak.map((r) => r.label).join(" · ") || "(없음)"}`);
    console.log(`     판정 ${cf2Leak.length > 0 ? "🔴 **NO-GO**" : cf2Open.length > 0 ? "🟡 **회수 있음 · leakage 0** — CPO 판정 사안" : "🔴 회수 0"}`);

    /**
     * 🔴🔴 **「leakage 0」을 방어 성공으로 읽지 않기 위한 진단** — 음역 함수가
     *    실제로 **발화하는지** 를 토큰 단위로 찍는다. 1차 실행에서 겹침이 `hg`
     *    하나뿐이었고, human SAME 인 GT 제목 2건도 열리지 않았다 ⟹ 그 상태의
     *    「leakage 0」은 **방어가 아니라 «미발화»** 일 수 있다. 데이터로 가른다.
     */
    console.log("\n══════ 🔴🔴 진단 — 음역 함수가 실제로 발화하는가 ══════");
    console.log("  원상품 토큰 → 뼈대");
    for (const t of originDist) console.log(`    ${t.padEnd(10)} → ${engSkeleton(t)}`);
    const KO_PROBE = ["허그", "헤어리", "몬스터", "허그헤어리몬스터티셔츠"];
    console.log("  한글 토큰 → 뼈대 (원상품 뼈대와 일치?)");
    for (const t of KO_PROBE) {
      const s = skeleton(t);
      console.log(`    ${t.padEnd(14)} → ${s.padEnd(10)} ${originSkel.has(s) ? "🟢 일치" : "🔴 **불일치**"}`);
    }
    const fired = rows.filter((r) => r.cf1.length > 0).length;
    console.log(
      `\n  🔴 음역 매칭이 발화한 후보 = **${fired}/${rows.length}** ⟹ ` +
        `${fired <= 1 ? "🔴🔴 **거의 미발화** — 「leakage 0」을 방어 증거로 쓰지 않는다" : "🟡 발화한다"}`,
    );

    /**
     * 🔵 **CF-3 — 참고 측정 전용.** 🔴 CTO 가 채택을 제안하지 않는다.
     *
     * 위 진단에서 불일치 셋이 **전부 접두 관계** 였다(`hr`⊂`hry` · `mnst`⊂`mnstr`).
     * 🔴 「접두 일치」는 **새 규칙** 이고 CPO 가 금지한 fuzzy 에 인접하다. 🟢 그래서
     *    **채택하지 않고 숫자만** 낸다 — CPO 가 class C 의 형태를 고를 때 필요한 값이다.
     * 🔴 한쪽이 다른 쪽의 prefix 이고 **짧은 쪽이 3자 이상** 일 때만 센다
     *    (2자 뼈대는 우연 가능성이 커서 `hg` 같은 단독 신호를 배제한다).
     */
    const prefixHit = (a: string, b: string) => {
      const [s, l] = a.length <= b.length ? [a, b] : [b, a];
      return s.length >= 3 && l.startsWith(s);
    };
    const cf3 = rows.map((r) => {
      const skels = r.tokens.map(skelOf).filter((s) => s.length >= 2);
      const hits = [...new Set(skels.filter((s) => [...originSkel].some((o) => prefixHit(s, o))))];
      return { ...r, hits, open3: hits.length > 0 && r.hasCode };
    });
    console.log("\n══════ 🔵 CF-3 (참고 전용 · 자음 뼈대 **접두 일치** + 품번 동반) ══════");
    console.log("  🔴 **새 규칙** 이다 — CTO 가 채택을 제안하지 않는다. 숫자만 낸다.");
    for (const r of cf3) {
      console.log(
        `  ${r.label.padEnd(26)} ${r.human.padEnd(10)} 접두겹침 ${String(r.hits.length).padStart(2)}` +
          ` 품번 ${r.hasCode ? "🟢" : "🔴"} → ${r.open3 ? "🟢열림" : "🔴닫힘"}  ${JSON.stringify(r.hits)}`,
      );
    }
    const o3 = cf3.filter((r) => r.cf0 === 0 && r.open3);
    const leak3 = o3.filter((r) => r.human === "DIFFERENT");
    const only3 = cf3.filter((r) => r.cf0 === 0 && r.hits.length > 0 && !r.hasCode);
    console.log(
      `\n  열리는 것 **${o3.length}** (SAME ${o3.filter((r) => r.human === "SAME").length} ·` +
        ` DIFFERENT ${leak3.length}) · 🔴 **leakage ${leak3.length}**`,
    );
    console.log(
      `  🟢 **품번 동반 조건이 막아 주는 것 ${only3.length}건** — ${only3.map((r) => `${r.human}:${r.label.slice(0, 18)}`).join(" · ") || "(없음)"}`,
    );
    console.log("  🔴 그 숫자도 분모 7 · 원상품 1개다 — 「안전하다」로 쓰지 않는다.");

    console.log("\n══════ 🔴 한계(넘겨 읽지 않는다) ══════");
    console.log(`  🔴 wu-093 행은 **URL 이 없어 제목 축만** 만들었다(색상·소재 미반영) ⟹ 운영 facts 와 다르다`);
    console.log(`  🔴 분모 — URL 2 + GT 제목 ${rows.length - 2} = **${rows.length}** · 원상품 **1개**`);
    console.log(`  🔴 음역 함수는 WU-078 하니스의 **사본** 이고 **운영 코드가 아니다**`);
    console.log(`  🔴 「품번 일치 = SAME」을 만들지 않았다 — CF-2 는 **음역 «그리고» 품번** 둘을 **동시에** 요구한다`);
    console.log(`  🔴 그리고 CF-2 가 열어도 그것은 **「보조 증거」** 다 — verdict 를 직접 SAME 으로 쓰지 않는다`);

    /** 🔴 측정이다 — 숫자를 단언해 고정하지 않는다. */
    expect(rows.length).toBeGreaterThan(0);
  }, 900_000);
});
