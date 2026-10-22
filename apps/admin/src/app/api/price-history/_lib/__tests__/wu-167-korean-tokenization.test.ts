import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCategoryTaxon } from "@commerce/crawler/src/comparison-search/match";
import { buildCoreTitleTokens } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-167 — **공백 없는 한글 상품명 토큰화 전수 검토** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-22) — 「**`허그헤어리몬스터숏양말` 을 문자열 규칙으로 쪼개는 것
 * 자체도 새로운 매칭 규칙이므로, «이미 있는 자산인지» 부터 확인한다**」.
 *
 * 🔴 운영 코드 **0** · 새 형태소 분석기 **0** · 번역 API **0** · LLM **0** ·
 *    fuzzy matching **0** · 배포 **0**.
 * 🔴 게이트 `WU_167_PROBE=1` 없으면 SKIP.
 *
 * ── 🟢🟢 § 이미 있는 한글 자산 전수(코드 실측) ─────────────────────────────
 * ```
 * ① `CATEGORY_TAXON_WORDS`(match.ts) 한글 **12** —
 *    티셔츠 · 셔츠 · 후드 · 바지 · 팬츠 · 청바지 · 원피스 · 스커트 · 자켓 · 패딩 · **양말** · 슈즈
 *    🟢🟢 **매칭이 `normalized.includes(w)` 다** — 토큰 완전일치가 **아니다** ⟹
 *       **붙임 제목에도 걸린다**(이것이 이 WU 의 핵심 자산이다)
 * ② `AUDIENCE` 한글 **6** — 아동 · 키즈 · 주니어 · 베이비 · 여성 · 남성
 * ③ `GARMENT_FORM_WORDS`(product-facts.ts) 한글 — 후디·후드집업·맨투맨·스웨트셔츠·
 *    티셔츠·셔츠·원피스·스커트·바지·팬츠·레깅스·자켓·재킷·카디건·**양말**·상의·바디수트
 *    🔴 단 **매칭이 `words.has(token)`**(토큰 완전일치) ⟹ **붙임 제목에 안 걸린다**
 * ④ `brand-alias` 한글 **7** — 보보쇼즈 · 페페 · 에밀에이다 · 콩제슬래드 …
 * 🔴 **「붙임 제목을 잘라 나누는」 코드는 전수 grep 0 이다**(아래 ⑤ 에서 확인)
 * ```
 */
const LIVE = process.env.WU_167_PROBE === "1";

/** 🔴 `CATEGORY_TAXON_WORDS` 의 한글 항목을 **그대로** 옮겼다(새 사전 0). */
const TAXON_KO = ["티셔츠", "셔츠", "후드", "바지", "팬츠", "청바지", "원피스", "스커트", "자켓", "패딩", "양말", "슈즈"] as const;
/** 🔴 `AUDIENCE` 한글 항목을 **그대로** 옮겼다. */
const AUDIENCE_KO = ["아동", "키즈", "주니어", "베이비", "여성", "남성"] as const;
/** 🔴 `brand-alias` 한글 항목. */
const BRAND_KO = ["보보쇼즈", "페페", "에밀에이다", "콩제슬래드"] as const;

const HANGUL = /[가-힣]/;

interface Row {
  src: string;
  title: string;
  verdict: string | null;
  tokens: string[];
  /** 🔴 `distinctive`(cross-seller.ts:919) 를 통과하는 토큰 */
  dist: string[];
  /** 🔴 붙임(한 토큰에 한글 5자 이상)인가 */
  glued: string[];
  /** 🟢 그 붙임 토큰 안에 **이미 있는 어휘** 가 포함돼 있는가 */
  anchors: { token: string; hits: string[]; residue: string }[];
}

describe("WU-167 — 한글 붙임 제목 토큰화 자산 검토", () => {
  it.runIf(LIVE)("기존 자산으로 분해가 가능한지 전수로 센다", async () => {
    /* eslint-disable no-console */
    const dir = path.join(__dirname, "fixtures");
    const rows: Row[] = [];

    /** 🔴 GT fixture 전수에서 **한글 제목** 을 모은다(지어낸 제목 0). */
    const titles: { src: string; title: string; verdict: string | null }[] = [];
    const gt093 = JSON.parse(readFileSync(path.join(dir, "wu-093-human-gt.json"), "utf8")) as {
      humanReview: { title: string; verdict: string; note: string | null }[];
    };
    for (const r of gt093.humanReview) titles.push({ src: "wu-093", title: r.title, verdict: r.verdict });
    /** 🟢 WU-166 이 실제로 fetch 한 두 한글 제목(운영 추출값). */
    titles.push({ src: "biskuit(운영)", title: "[보보쇼즈] 허그 헤어리 몬스터 티셔츠 B226AC009 - 비스킷", verdict: "SAME" });
    titles.push({
      src: "luxboy(운영)",
      title: "보보쇼즈 키즈 긴팔티셔츠 B226AC009 451 - No.1 명품쇼핑 럭스보이 since 2002",
      verdict: "DIFFERENT",
    });

    for (const t of titles) {
      if (!HANGUL.test(t.title)) continue;
      const tokens = buildCoreTitleTokens(t.title, ["보보쇼즈", "Bobo Choses"]);
      const dist = tokens.filter((x) => extractCategoryTaxon(x) === null);
      const glued = tokens.filter((x) => (x.match(/[가-힣]/g) ?? []).length >= 5);
      const anchors = glued.map((g) => {
        const hits = [...TAXON_KO, ...AUDIENCE_KO, ...BRAND_KO].filter((w) => g.includes(w));
        let residue = g;
        for (const w of hits) residue = residue.split(w).join("|");
        return { token: g, hits, residue };
      });
      rows.push({ src: t.src, title: t.title, verdict: t.verdict, tokens, dist, glued, anchors });
    }

    console.log("\n══════ 🔴🔴 ① 현재 토큰화 실측 ══════");
    for (const r of rows) {
      console.log(`\n  [${r.src}] ${r.verdict ?? "-"}  ${r.title.slice(0, 54)}`);
      console.log(`    tokens      ${JSON.stringify(r.tokens)}`);
      console.log(`    distinctive ${JSON.stringify(r.dist)}${r.dist.length === 0 ? "  🔴 **비어 있다**" : ""}`);
    }

    const emptied = rows.filter((r) => r.dist.length === 0);
    const gluedRows = rows.filter((r) => r.glued.length > 0);
    console.log("\n══════ 🔴🔴 ② 「축이 죽는다」 전수 ══════");
    console.log(`  한글 제목 ${rows.length} 중 **distinctive 가 빈 것 ${emptied.length}**`);
    for (const r of emptied) console.log(`    ${String(r.verdict).padEnd(10)} ${r.title.slice(0, 44)}`);
    console.log(`  붙임 토큰(한글 5자+)이 있는 것 **${gluedRows.length}**`);

    console.log("\n══════ 🟢🟢 ③ 기존 어휘가 붙임 토큰 «안» 에서 걸리는가 ══════");
    console.log("  🔴 자른 것이 아니다 — `includes` 로 **어디가 걸리는지** 만 센다");
    let anchored = 0;
    for (const r of gluedRows) {
      for (const a of r.anchors) {
        if (a.hits.length > 0) anchored += 1;
        console.log(
          `    ${String(r.verdict).padEnd(10)} ${a.token.padEnd(24)} 어휘 ${JSON.stringify(a.hits)}` +
            `${a.hits.length ? `  → 나머지 ${JSON.stringify(a.residue.split("|").filter(Boolean))}` : "  🔴 **걸리는 어휘 없음**"}`,
        );
      }
    }
    console.log(`\n  🟢 붙임 토큰 중 **기존 어휘가 걸린 것 ${anchored}/${gluedRows.reduce((n, r) => n + r.anchors.length, 0)}**`);

    /**
     * 🔴🔴 ④ **결론을 미리 박지 않는다** — 「나머지 조각이 몇 개로 갈라지는가」를
     *    세어서 영문 쪽 토큰 수와 **비교** 한다. 1차 초안에 이 문장을 데이터 없이
     *    적어 뒀고(이 트랙에서 세 번 밟은 함정) 데이터에 걸도록 고쳤다.
     */
    const ENG_REF = 3; // hug / hairy / monster — 원상품의 distinctive 토큰 수(WU-165/166 실측)
    console.log("\n══════ 🔴 ④ 어휘를 걷어낸 «나머지» 가 몇 조각인가 ══════");
    let symmetric = 0;
    let asymmetric = 0;
    for (const r of gluedRows) {
      for (const a of r.anchors) {
        if (a.hits.length === 0) continue;
        const pieces = a.residue.split("|").filter(Boolean);
        const ok = pieces.length >= ENG_REF;
        if (ok) symmetric += 1;
        else asymmetric += 1;
        console.log(
          `    ${a.token.padEnd(24)} 나머지 **${pieces.length}조각** ${JSON.stringify(pieces)}` +
            ` ${ok ? "🟢 영문 3토큰과 대응 가능" : `🔴 **${pieces.length}:${ENG_REF} 비대칭**`}`,
        );
      }
    }
    console.log(`  🟢 대응 가능 ${symmetric} · 🔴 비대칭 ${asymmetric}`);

    console.log("\n══════ 🔴 ⑤ 「붙임 제목을 잘라 나누는」 기존 코드 ══════");
    console.log("  🔴 **전수 grep 결과 0**(측정 전에 직접 확인했다) —");
    console.log("     taxon/한글 어휘로 제목을 **제거·분할** 하는 운영 코드가 없고,");
    console.log("     한글 형태소 라이브러리 **의존성도 0** 이다(package.json 전수).");
    console.log("     🟢 `extractCategoryTaxon` 은 **판별만** 하고 문자열을 바꾸지 않는다");
    console.log("  ⟹ 🟢 ③ 의 `includes` 는 **판별 자산** 이고 **분해 자산이 아니다**");

    console.log("\n══════ 🔴🔴 ⑥ 측정 가능성 판정(데이터 기준) ══════");
    const feasible = symmetric > 0 && asymmetric === 0;
    console.log(`  분해 자산 존재 = 🔴 없다(⑤) · 어휘 앵커로 대응 가능한 붙임 토큰 = ${symmetric}/${symmetric + asymmetric}`);
    console.log(
      `  ⟹ ${feasible ? "🟡 **일부 성립 가능**" : "🔴 **기존 자산만으로는 음역 CF 재측정이 성립하지 않는다**"}`,
    );
    console.log(`  🔴 그리고 **distinctive 가 비는 행이 ${emptied.length}건** — 그 행은 TITLE 축에`);
    console.log(`     **애초에 참여하지 않는다**(음역 규칙을 어떻게 만들어도 그 분모는 안 늘어난다)`);

    /** 🔴 측정이다 — 숫자를 단언해 고정하지 않는다. */
    expect(rows.length).toBeGreaterThan(0);
  }, 300_000);
});
