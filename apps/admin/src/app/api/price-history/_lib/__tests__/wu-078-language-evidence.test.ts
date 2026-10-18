import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-078 — **한국어 ↔ 영어 상품명 매칭** (측정 전용 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「`NO_TITLE_OVERLAP` 완화 ❌ · 번역 API ❌ · 외부 AI ❌ · Vision ❌ ·
 *    품번/색상 보호 완화 ❌ · market gate ❌ — 조사 → counterfactual → GO/HOLD 까지」
 * 🔴 **번역/음역 결과 자체를 truth 로 취급하지 않는다.** 독립성·안전성을 «먼저» 잰다.
 *
 * ── 🔴🔴 1차 관측이 질문을 바꿨다 ────────────────────────────────────────────
 * ```
 * `NO_TITLE_OVERLAP` 4건은 **전부 한글 제목에 라틴 품번이 그대로 있다**
 *   C07 b226ac009 · C08 b226ac009 · C15 b226ac117 · C47 b226ac117
 * 그리고 운영 `modelCode` 비교가 **exact 4/4** 다 — 품번 축은 **이미 맞고 있다.**
 * ⟹ 「언어 때문에 동일성 증거가 없다」가 **아니다.** 증거는 있고, 막는 것은 다른 축이다.
 * ```
 * 🔴 그래서 이 WU 의 진짜 질문은 하나로 좁혀진다 —
 *    **「언어 증거가 품번 «위에» 더하는 «판별력» 이 있는가」**
 *    즉 품번이 같은데 Human 이 갈리는 C08(DIFFERENT) 을 **언어가 가를 수 있는가.**
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CACHE = path.join(OUT, "wu-032-cache");
const T63 = path.join(OUT, "wu-063-table.json");
const G36 = path.join(OUT, "wu-036-3way.json");
const READY = existsSync(T63) && existsSync(G36);
const key = (u: string) => createHash("sha1").update(u).digest("hex").slice(0, 16);

/* ───────────────── 결정론적 한글 로마자화 (외부 API 0) ───────────────── */
/**
 * 🔴 한글 음절은 **산술로** 분해된다 — `(code - 0xAC00)` → 초성/중성/종성.
 *    사전도 모델도 쓰지 않는다. 🔴 그리고 이것은 **테스트 로컬 함수** 다 —
 *    운영에 넣지 않았다(CPO 구현 금지).
 */
const CHO = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const JUNG = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const JONG = ["", "k", "k", "k", "n", "n", "n", "t", "l", "l", "l", "l", "l", "l", "l", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];

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

/**
 * 🔴 외래어 표기는 모음이 흔들린다(허그/헉, 트렉/트랙). 그래서 **자음 뼈대** 로 비교한다.
 *    `eu`/`i` 삽입모음도 떨어뜨린다. 🔴 이것은 «판별 보조» 이지 truth 가 아니다.
 */


/**
 * 🔴 외래어 표기의 **일반** 규칙만 정규화한다 — 이 표본의 단어에 맞춘 규칙을
 *    넣지 않는다(N=4 에 맞춰 조정하면 과적합이다).
 *    `c→k` · `sh/sy→s` · `ch→c` · 중복자음 축약 · 어말 `eu/i` 제거.
 */
const generalize = (x: string) =>
  x
    .replace(/sy|sh/g, "s")
    .replace(/ch/g, "c")
    .replace(/c/g, "k")
    .split("").filter((c, i2, a) => c !== a[i2 - 1]).join("");

/** 🔴 영어 쪽도 **같은** 규칙을 쓴다 — 비대칭 처리는 비교를 망친다. */
const engSkeleton = (s: string) => generalize(s.toLowerCase().replace(/[^a-z]/g, "")).replace(/[aeiou]/g, "");

/**
 * 🔴 외래어 표기는 모음이 흔들린다(허그/헉 · 트렉/트랙). 그래서 **자음 뼈대** 로 비교한다.
 *    🔴 이것은 «판별 보조» 이지 truth 가 아니다.
 */
const skeleton = (s: string) => generalize(romanize(s).replace(/[^a-z]/g, "")).replace(/[aeiou]/g, "");

const STOP_KO = new Set(["키즈", "주니어", "베이비", "남아", "여아", "아동", "정품", "해외", "배송", "무료", "할인", "신상", "당일", "오늘", "특가"]);
const STOP_EN = new Set(["by", "the", "and", "for", "with", "kids", "baby", "junior", "new"]);

/**
 * 🔴 **토큰 단위 음역 대응 수** — 한글 토큰 하나가 영문 토큰 하나와 뼈대로 맞으면 1.
 *    🔴 짧은 뼈대(2자 미만)는 세지 않는다 — 우연 일치가 폭증한다.
 */
function translitHits(koTitle: string, enTitle: string): { hits: number; pairs: string[]; koTokens: number } {
  const ko = koTitle.split(/[^가-힣A-Za-z0-9]+/).filter((t) => /[가-힣]/.test(t) && t.length >= 2 && !STOP_KO.has(t));
  const en = enTitle.split(/[^A-Za-z0-9]+/).filter((t) => t.length >= 3 && !STOP_EN.has(t.toLowerCase()));
  const pairs: string[] = [];
  const used = new Set<number>();
  for (const k of ko) {
    const ks = skeleton(k);
    if (ks.length < 2) continue;
    const j = en.findIndex((e, i) => {
      if (used.has(i)) return false;
      const es = engSkeleton(e);
      if (es.length < 2) return false;
      return es.startsWith(ks) || ks.startsWith(es) || es === ks;
    });
    if (j >= 0) {
      used.add(j);
      pairs.push(`${k}~${en[j]}`);
    }
  }
  return { hits: pairs.length, pairs, koTokens: ko.length };
}

describe("WU-078 — 한국어↔영어 언어 증거 (캐시 필요)", () => {
  (READY ? it : it.skip)("① 전수 분해 · ② 음역 판별력 · ③ 안전성(파생 GT)", () => {
    type Row = { id: string; human: string; domain: string; tier: string; modelCode: string | null; blockers: unknown };
    const T = JSON.parse(readFileSync(T63, "utf8")) as Row[];
    const G = (JSON.parse(readFileSync(G36, "utf8")) as { rows: { candidateUrl: string; originTitle?: string; candidateTitle?: string }[] }).rows;

    const enrich = (r: Row) => {
      const i = Number(r.id.slice(1)) - 1;
      const g = G[i];
      const f = path.join(CACHE, `${key(g.candidateUrl)}.facts.json`);
      const j = existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as { query?: { title?: string; facts?: { brandModelCode?: string | null } }; candidate?: { title?: string } }) : null;
      const en = g.originTitle ?? "";
      const ko = j?.candidate?.title ?? g.candidateTitle ?? "";
      /**
       * 🔴 **원상품 품번 칸을 추측하지 않는다** — 이 캐시는 후보 전용이고 `query` 가 없다
       *    (내 1차 접근이 `j.query.facts.brandModelCode` 를 읽어 **전건 null** 이었다 ·
       *     이 트랙 16번째 칸 이름 오류).
       * 🟢 대신 **운영 결과** 를 쓴다 — `modelCode === "exact"` 는 `confirmBrandCodeInTitle`
       *    이 「원상품 품번이 후보 제목에 **토큰으로 그대로**」 있을 때만 성립한다.
       *    즉 그 값 자체가 「한글 제목에 라틴 품번이 있다」의 증거다.
       */
      const codeLike = /[A-Za-z][0-9]{3}[A-Za-z]{2}[0-9]{3}/.exec(ko)?.[0] ?? null;
      return { ...r, en, ko, url: g.candidateUrl, codeLike };
    };
    const rows = T.map(enrich);
    const hasNTO = (r: Row) => JSON.stringify(r.blockers ?? "").includes("NO_TITLE_OVERLAP");
    const NTO = rows.filter(hasNTO);

    console.log("\n════════ WU-078 — NO_TITLE_OVERLAP 전수 분해 ════════");
    for (const r of NTO) {
      const t = translitHits(r.ko, r.en);
      const codeInKo = r.codeLike != null;
      console.log(`\n■ ${r.id} ${r.human}  ${r.domain}  tier=${r.tier}  modelCode=${r.modelCode}`);
      console.log(`   EN  ${r.en.slice(0, 74)}`);
      console.log(`   KO  ${r.ko.slice(0, 74)}`);
      console.log(`   🔴 한글 제목의 라틴 품번: **${r.codeLike}** (운영 modelCode=${r.modelCode}) · 포함=${codeInKo}`);
      console.log(`   🟡 음역 대응 ${t.hits}/${t.koTokens}  ${JSON.stringify(t.pairs)}`);
    }

    /* ── ② 판별력 — 품번이 같은데 Human 이 갈리는 것을 언어가 가르는가 ── */
    const scored = NTO.map((r) => ({ ...r, t: translitHits(r.ko, r.en) }));
    const same = scored.filter((r) => r.human === "SAME");
    const diff = scored.filter((r) => r.human === "DIFFERENT");
    console.log(`\n ── ② 음역 판별력 (분모 SAME ${same.length} · DIFFERENT ${diff.length}) ──`);
    for (const r of scored) console.log(`   ${r.id} ${String(r.human).padEnd(10)} hits=${r.t.hits}  codeExact=${r.modelCode}`);

    /* ── ③ 안전성 — 전체 51 에서 「음역 2+ 대응」이 얼마나 흔한가 ── */
    const koRows = rows.filter((r) => /[가-힣]/.test(r.ko));
    const fire2 = koRows.filter((r) => translitHits(r.ko, r.en).hits >= 2);
    console.log(`\n ── ③ 안전성 — 한글 제목 후보 ${koRows.length}건 중 「음역 ≥2」 발화 ${fire2.length}건 ──`);
    for (const r of fire2) console.log(`   ${r.id} ${String(r.human).padEnd(10)} ${String(r.domain).padEnd(22)} hits=${translitHits(r.ko, r.en).hits}`);
    const fire2Same = fire2.filter((r) => r.human === "SAME").length;
    const fire2Diff = fire2.filter((r) => r.human === "DIFFERENT").length;
    console.log(`   ⟹ SAME ${fire2Same} · 🔴 DIFFERENT ${fire2Diff}`);

    writeFileSync(path.join(OUT, "wu-078.json"), JSON.stringify({ nto: NTO.map((r) => r.id), scored: scored.map((r) => ({ id: r.id, human: r.human, hits: r.t.hits })), fire2: fire2.map((r) => r.id) }, null, 1));

    /* ══════════════════ 🔴 계약 ══════════════════ */

    /** ① 🔴🔴 **질문이 바뀐다** — 4건 전부 한글 제목에 **라틴 품번** 이 있고 modelCode 가 exact 다. */
    expect(NTO).toHaveLength(4);
    expect(NTO.map((r) => r.id).sort()).toEqual(["C07", "C08", "C15", "C47"]);
    for (const r of NTO) {
      /** 🟢 운영이 낸 값이다 — 복제식이 아니다. */
      expect(r.modelCode).toBe("exact");
      /** 🟢 그리고 한글 제목 안에 라틴 품번 토큰이 **눈으로도** 있다. */
      expect(r.codeLike).toBeTruthy();
    }

    /**
     * ② 🟢🟢 **음역이 품번 «위에» 판별력을 더한다** — Human SAME 3건은 전부 대응이
     *    있고, 품번이 같은데 Human DIFFERENT 인 **C08 은 대응이 가장 적다.**
     */
    expect(same.every((r) => r.t.hits >= 2)).toBe(true);
    const c08 = scored.find((r) => r.id === "C08")!;
    expect(c08.human).toBe("DIFFERENT");
    expect(c08.t.hits).toBeLessThan(Math.min(...same.map((r) => r.t.hits)));

    /** ③ 🟢 발화한 3건이 **전부 SAME** 이다 — 이 표본에서 오탐 0. 🔴 분모 3 이다. */
    expect(fire2Diff).toBe(0);
    expect(fire2Same).toBe(3);

    /**
     * ④ 🔴🔴 **그런데 「회수」로 이어지지 않는다** — `NO_TITLE_OVERLAP` 을 지워도
     *    각 후보에 **다른 blocker 가 남는다.** WU-065 의 「하나만 풀면 변화 0」과 같다.
     */
    const rest = (r: (typeof scored)[number]) =>
      (Array.isArray(r.blockers) ? (r.blockers as string[]) : []).filter((b) => b !== "NO_TITLE_OVERLAP");
    console.log(`\n ── ④ NO_TITLE_OVERLAP 을 빼면 «무엇이» 남는가 ──`);
    for (const r of scored) console.log(`   ${r.id} ${String(r.human).padEnd(10)} 남은 blockers: ${JSON.stringify(rest(r))}`);
    for (const r of same) expect(rest(r).length).toBeGreaterThan(0);

    /**
     * ⑤ 🟢🟢 **음역 축의 실제 가치는 «회수» 가 아니라 «안전» 이다.**
     *    `NO_TITLE_OVERLAP` 을 풀면 blocker 가 **완전히 비는** 유일한 후보가
     *    **C08(Human DIFFERENT)** 이다. 음역 축은 바로 그것을 막는다.
     */
    expect(rest(c08)).toHaveLength(0);
    const openedWithoutNTO = scored.filter((r) => rest(r).length === 0);
    expect(openedWithoutNTO.map((r) => r.id)).toEqual(["C08"]);
    expect(openedWithoutNTO.every((r) => r.human === "DIFFERENT")).toBe(true);
    /** ⑤ 🟢 그리고 음역 축은 그 C08 을 **2 미만** 으로 남긴다(= 차단 유지). */
    expect(c08.t.hits).toBeLessThan(2);
  });
});
