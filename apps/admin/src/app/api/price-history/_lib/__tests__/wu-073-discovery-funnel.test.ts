import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-073 — **국내 후보 발견량 / 후보 풀 완전성** (측정 전용 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「기존 데이터/로그/저장 결과만으로 · 새 AI API 금지 · MI 완화 금지 ·
 *    soft-404/listing 을 **수정하지 말고 얼마나 섞이는지만** 측정」
 *
 * ── 🔴🔴 가장 큰 발견 — `classifyUrlShape` 가 **양방향으로** 틀린다 ───────────
 * ```
 * 🔴 오통과(목록인데 PRODUCT_PAGE)   — 한국 쇼핑몰 CMS 패턴
 *    beaumonde `goods_list.php`      → **PRODUCT_PAGE**
 *    bbambam   `product_list.html`   → **PRODUCT_PAGE**
 *    donokids  `shopbrand.html`      → **PRODUCT_PAGE**
 * 🔴 오차단(상품인데 PRODUCT_PAGE 아님)
 *    SSG `item/itemView.ssg?itemId=` → **UNKNOWN_PAGE**
 * 🟢 올바른 것 — `collections/*` → LISTING_PAGE · 쿠팡 스토어/홈 → UNKNOWN_PAGE
 * ```
 * 🔴 **고치지 않았다** — WU-052 가 「URL 문자열 패턴 차단」을 금지했고 이번 범위도 측정이다.
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const key = (u: string) => createHash("sha1").update(u).digest("hex").slice(0, 16);
const NEW_GT = path.join(__dirname, "fixtures", "wu-068-new-gt.json");
const SEARCH = path.join(OUT, "mi-019a-search-result.json");
/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CPO ⒜ 판정(2026-10-31) — **corpus 가 기대 모양이 아니면 «측정불가» 다**
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일의 숫자 계약은 머신 `%TEMP%` 의 «공유 가변 산출물» 에 걸려 있다.**
 * ```
 * OUT    = %TEMP%/mi-p0-02           ← 리포 밖 · 다른 테스트가 writeFileSync 로 쓴다
 * SEARCH = OUT/mi-019a-search-result.json
 * ⟹ 리포 코드와 «무관하게» 행 수가 바뀔 수 있고, 그때 `expect(A.n).toBe(181)` 이
 *    엉뚱한 변경의 회귀처럼 FAIL 한다(실제로 `181 → 182` 로 났다)
 * ```
 * 🔴 그 `181 → 182` 는 **self-reference 와 인과가 없다**(SELF-REFERENCE-CORPUS-
 *    ROOT-CAUSE-01 조사 결론 — corpus 는 파일 읽기 한 줄에서 오고 그 축에 닿지 않는다).
 *
 * 🟢 **그래서 숫자를 고치지 않고 «게이트» 를 세운다**(CPO ⒜) —
 *    corpus 가 기대 모양이 아니면 **숫자를 단언하지 않고 SKIP** 한다.
 * 🔴 「측정불가」는 **0 도 PASS 도 아니다**(이 트랙의 §5-B 원칙 그대로).
 * 🔴 `181` 을 `182` 로 바꾸지 않았다 — 기대값은 **그 corpus 의 정의 그대로** 다.
 * 🔴 fixture 를 만들거나 지우거나 이름을 바꾸지 않았다(⒝·⒞ 는 CPO 가 제외했다).
 */
const EXPECTED_AI_URLS = 181;

/** 🟢 `A.n` 이 세는 **그 양** 을 그대로 센다 — `candidates ∪ dropped[].url` 고유 수. */
function corpusSize(): number | null {
  if (!existsSync(SEARCH)) return null;
  try {
    const s = JSON.parse(readFileSync(SEARCH, "utf8")) as {
      rows?: { candidates?: string[]; dropped?: { url: string }[] }[];
    };
    if (!Array.isArray(s.rows)) return null;
    const all = new Set<string>();
    for (const r of s.rows) {
      (r.candidates ?? []).forEach((u) => all.add(u));
      (r.dropped ?? []).forEach((d) => all.add(d.url));
    }
    return all.size;
  } catch {
    /** 🔴 깨진 산출물을 「0 건」으로 읽지 않는다 — **측정불가** 다. */
    return null;
  }
}
const CORPUS_N = corpusSize();
const READY =
  existsSync(SEARCH) &&
  existsSync(path.join(OUT, "wu-036-3way.json")) &&
  existsSync(NEW_GT) &&
  existsSync(path.join(OUT, "wu-063-table.json")) &&
  CORPUS_N === EXPECTED_AI_URLS;
if (!READY) {
  /* eslint-disable-next-line no-console */
  console.log(
    `[WU-073] 🔴 측정불가 — corpus ${CORPUS_N ?? "없음"} ≠ 기대 ${EXPECTED_AI_URLS}` +
      ` (%TEMP%/mi-p0-02 공유 산출물 · self-reference 와 무관)`,
  );
}

/** 🔴 서술용 라벨이다 — 운영 규칙이 아니다. */
const KR = (h: string) =>
  /\.kr$|\.co\.kr|kihanan|biskuit|mustit|trenbe|luxboy|donokids|kids21|coupang|naver|ssg|lfmall|croket|luksus|miniboutique|beaumonde|littleluna|wconcept|lotteon|feelway|bbambam|ocokorea/i.test(h);
const host = (u: string) => {
  try {
    return new URL(u).host;
  } catch {
    return "";
  }
};

describe("WU-073 — 후보 발견 funnel (GT 캐시 필요)", () => {
  (READY ? it : it.skip)("① 단계별 funnel · ② 후보 풀 오염", () => {
    const s = JSON.parse(readFileSync(SEARCH, "utf8")) as {
      rows: { searchId: string; model: string; candidates: string[]; dropped?: { url: string; reason: string }[] }[];
    };
    const kept = new Set<string>();
    const drop = new Map<string, string>();
    for (const r of s.rows) {
      r.candidates.forEach((u) => kept.add(u));
      for (const d of r.dropped ?? []) drop.set(d.url, d.reason);
    }
    const dropOnly = [...drop.keys()].filter((u) => !kept.has(u));
    const raw = [...new Set([...kept, ...dropOnly])];

    const gt = (JSON.parse(readFileSync(path.join(OUT, "wu-036-3way.json"), "utf8")) as { rows: { candidateUrl: string }[] }).rows;
    const nw = JSON.parse(readFileSync(NEW_GT, "utf8")) as { url: string; facts: unknown }[];
    const fetched = new Set<string>([...gt.map((r) => r.candidateUrl), ...nw.map((r) => r.url)]);
    const withFacts = new Set<string>([
      ...gt
        .map((r) => r.candidateUrl)
        .filter((u) => {
          const f = path.join(OUT, "wu-032-cache", `${key(u)}.facts.json`);
          return existsSync(f) && !!JSON.parse(readFileSync(f, "utf8")).candidate?.facts;
        }),
      ...nw.filter((r) => r.facts).map((r) => r.url),
    ]);
    const t63 = JSON.parse(readFileSync(path.join(OUT, "wu-063-table.json"), "utf8")) as {
      domain: string; price: number | null; market: string; inDomestic: boolean; tier: string;
    }[];
    const krT = t63.filter((x) => KR(x.domain));

    const cnt = (us: string[]) => ({ n: us.length, kr: us.filter((u) => KR(host(u))).length });
    const A = cnt(raw), B = cnt([...kept]), C = cnt([...fetched]), D = cnt([...withFacts]), X = cnt(dropOnly);
    const reasons: Record<string, number> = {};
    for (const u of dropOnly) reasons[drop.get(u)!] = (reasons[drop.get(u)!] ?? 0) + 1;

    console.log("\n════════ 📋 최종 표 — 국내 후보 funnel ════════");
    console.log(" 단계                     입력후보  국내   탈락(국내)   주요 원인");
    console.log(` ① AI 후보                 ${String(A.n).padStart(4)}   ${String(A.kr).padStart(3)}     —          4 모델 합산 · 중복 제거`);
    console.log(` ② URL 분류                ${String(A.n).padStart(4)}   ${String(B.kr).padStart(3)}     ${String(X.n).padStart(3)}(${X.kr})     ${JSON.stringify(reasons)}`);
    console.log(` ③ fetch 시도              ${String(B.n).padStart(4)}   ${String(C.kr).padStart(3)}     ${String(B.n - C.n).padStart(3)}(${B.kr - C.kr})     🔴 GT/worklist 선별 — **측정 범위 밖**`);
    console.log(` ④ product evidence        ${String(C.n).padStart(4)}   ${String(D.kr).padStart(3)}     ${String(C.n - D.n).padStart(3)}(${C.kr - D.kr})     🔴 soft-404 6건도 **통과**`);
    console.log(` ⑤ price evidence          ${String(krT.length).padStart(4)}   ${String(krT.filter((x) => x.price != null).length).padStart(3)}     ${String(krT.filter((x) => x.price == null).length).padStart(3)}(${krT.filter((x) => x.price == null).length})     beaumonde 구조화 0`);
    console.log(` ⑥ market KR 확정          ${String(krT.length).padStart(4)}   ${String(krT.filter((x) => x.market === "KR").length).padStart(3)}     ${String(krT.filter((x) => x.market !== "KR").length).padStart(3)}         KRW+도메인증거 없음 · 외화`);
    console.log(` ⑦ 국내 가격 버킷           ${String(krT.length).padStart(4)}   ${String(krT.filter((x) => x.inDomestic).length).padStart(3)}     ${String(krT.filter((x) => x.market === "KR" && !x.inDomestic).length).padStart(3)}         tier EXCLUDED`);
    console.log(` ⑧ 최종 EXACT              ${String(krT.filter((x) => x.inDomestic).length).padStart(4)}   ${String(krT.filter((x) => x.inDomestic && x.tier === "EXACT").length).padStart(3)}     —          삼중 잠금(WU-069)`);
    console.log(` 🔴 ③은 이 측정의 한계다 — GT 선별이지 제품 동작이 아니다. 「탈락」으로 읽지 않는다.`);

    /* ── ② 후보 풀 오염 ── */
    console.log("\n════════ 후보 풀 오염 — 운영 분류기로 ════════");
    const shapes: Record<string, number> = {};
    for (const u of kept) shapes[classifyUrlShape(u)] = (shapes[classifyUrlShape(u)] ?? 0) + 1;
    console.log(` ② 통과 ${B.n}건의 운영 shape 분포: ${JSON.stringify(shapes)}`);
    /**
     * 🔴🔴 **쿼리를 벗기고 «경로» 만 본다.** 처음에 URL 전체로 매칭했더니
     *    추적 파라미터 `?icid=MAIN.product_listmain_2` 가 걸려 **진짜 상품 페이지**
     *    2건(littleluna · miniboutique)이 「오통과」로 잘못 세어졌다.
     *    🔴 WU-007A 의 「우리 쿼리가 증거로 재활용된다」와 **같은 계열의 함정** 이다.
     */
    const CMS = /goods_list|product_list|shopbrand|\/list\./i;
    const pathOf = (u: string) => { try { return new URL(u).pathname; } catch { return u; } };
    const falsePass = [...kept].filter((u) => CMS.test(pathOf(u)) && classifyUrlShape(u) === "PRODUCT_PAGE");
    console.log(`\n 🔴 **오통과** — 한국 쇼핑몰 CMS 목록인데 PRODUCT_PAGE: **${falsePass.length}건**`);
    for (const u of falsePass) console.log(`    ${u.slice(0, 92)}`);
    const falseBlock = dropOnly.filter((u) => /itemView|goodsView|\/goods\/\d|product_detail/i.test(u));
    console.log(`\n 🔴 **오차단** — 상품 상세 패턴인데 탈락: **${falseBlock.length}건**`);
    for (const u of falseBlock) console.log(`    ${classifyUrlShape(u).padEnd(14)} ${u.slice(0, 88)}`);
    console.log(`\n 🔴 soft-404 / 홈 — CEO 가 404·홈이라 한 6건(WU-067)은 **전부 ④를 통과** 했다`);

    writeFileSync(path.join(OUT, "wu-073.json"), JSON.stringify({ A, B, C, D, X, reasons, shapes, falsePass, falseBlock }, null, 1));

    /* ══════ 🔴 계약 ══════ */
    expect(A.n).toBe(181);
    expect(A.kr).toBe(46);
    /** 🔴 ② 가 최대 손실 구간이다 — 국내 46 → 30. */
    expect(B.kr).toBe(30);
    /**
     * ══════════════════════════════════════════════════════════════════════
     * 🟢🟢 **DISCOVERY-SEARCH-PROVIDER-02 — 91 → 89 로 «줄었다»**(2026-10-27)
     * ══════════════════════════════════════════════════════════════════════
     *
     * 🔴 이 숫자가 내려간 것은 **회귀가 아니라 수정의 결과** 다 — 이 파일 머리가
     *    적어 둔 「`classifyUrlShape` 가 **양방향으로** 틀린다」의 한쪽을 고쳤다.
     *
     * 이 코퍼스(AI URL **181**)에서 분류가 바뀐 것은 **정확히 3건** 이다:
     * ```
     * 🟢 UNKNOWN → PRODUCT  answear.com/p/…-**b226ac117**-1746932  ← 우리 품번이 URL 에 있다
     * 🟢 UNKNOWN → PRODUCT  babyshop.com/…-turtledove `/p/` 340481
     * 🟡 LISTING → UNKNOWN  m.gsshop.com/section/`brandSect`/263304
     *    🔴 위 줄에서 `**p**` 뒤에 슬래시를 붙이면 `*` + `*` + `/` 가 **`*​/`** 가 되어
     *       **블록 주석이 거기서 끝난다**(이 편집에서 실제로 났고 typecheck 가 잡았다).
     *    (`brand` 가 `brandSect` 안에서 매치되던 것 · 🟢 **행동 변화 0** —
     *     `toCrawlerUrl` 은 `PRODUCT_PAGE` 가 **아닌 것을 전부** 버린다)
     * ```
     * ⟹ 🟢 **진짜 상품 2건 회수 · 행동상 손실 0.**
     */
    expect(X.n).toBe(89);
    expect(reasons.NOT_PRODUCT_PAGE).toBe(85);
    expect(reasons.SELF_REFERENCE).toBe(4);
    /** 🔴🔴 분류기가 **양방향으로** 틀린다 — 둘 다 0 이 아니다. */
    expect(falsePass).toHaveLength(5);
    expect(falseBlock.length).toBeGreaterThan(0);
    /** 🔴 한국 CMS 목록 URL 이 PRODUCT_PAGE 로 분류된다(원인 고정). */
    expect(classifyUrlShape("https://www.beaumonde.co.kr/goods/goods_list.php?page=3&brandCd=070002")).toBe("PRODUCT_PAGE");
    expect(classifyUrlShape("http://www.bbambam.com/m/product_list.html?type=M")).toBe("PRODUCT_PAGE");
    expect(classifyUrlShape("https://www.donokids.com/shop/shopbrand.html")).toBe("PRODUCT_PAGE");
    /** 🔴 그리고 SSG 의 **진짜 상품 페이지** 는 PRODUCT_PAGE 가 아니다. */
    expect(classifyUrlShape("https://shinsegaemall.ssg.com/item/itemView.ssg?itemId=1000870229361")).not.toBe("PRODUCT_PAGE");
    /** 🟢 반대로 `collections/*` 는 올바르게 LISTING 이다. */
    expect(classifyUrlShape("https://kids21.com/collections/bobo-choses-aw2026")).toBe("LISTING_PAGE");
    /** 🔴 국내 최종 EXACT 는 0 이다. */
    expect(krT.filter((x) => x.inDomestic && x.tier === "EXACT")).toHaveLength(0);
  });
});
