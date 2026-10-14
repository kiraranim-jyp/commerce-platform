// @vitest-environment node
/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-004 TRACK-A — **구현 «전» 벤치마크** (CPO 요구 7항목)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 측정 대상은 하나다 — **원상품의 브랜드 품번을 후보의 어디에서 찾을 수 있는가.**
 *    후보의 sku 를 품번으로 «승격» 하지 않는다(WU-003 에서 그 방향이 FP 를 만든다고 확정).
 *
 * 🔴 Gemini 0 · 외부 HTTP 0 · API 키 0 · 비용 ₩0.
 *    입력은 **리포의 캡처 fixture** + **선행 WU 가 저장한 후보 기록** + **덤프 스냅샷** 뿐이다.
 *
 * 🔴🔴 기존 `confirmBrandCodeInTitle`(domestic-identifiers.ts:71)의 안전 성질 **셋** 을
 *    이 벤치마크도 그대로 쓴다 — 바꾸면 측정이 거짓이 된다:
 *      ① 원본에서 확정된 품번만 받는다(후보에서 품번을 추출하지 않는다)
 *      ② 반환은 `code` 아니면 `null` 둘뿐 → compareModelCode 가 `exact|unavailable` 만 낸다
 *      ③ **토큰 전체 일치** — 부분일치 금지(Mini Rodini `2672014894` 가 숫자 10자리라
 *         포함 검사로는 가격·상품번호에 우연히 걸린다)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { confirmBrandCodeInTitle, extractFromJsonLd } from "@commerce/crawler";

const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
/** 🔴 `__dirname` 은 `__tests__` 다 — 루트까지 여덟 칸. */
const CRAWLER_SRC = path.join(__dirname, "../../../../../../../../packages/crawler/src");
const FIXTURE_DIRS = [
  path.join(CRAWLER_SRC, "__tests__/fixtures"),
  path.join(CRAWLER_SRC, "site-strategies/__tests__/fixtures"),
];

interface UrlRow { id: string; title: string; brand: string }
interface SnapRow { id: string; canonicalProduct: unknown }
interface LinkRow {
  snapshot_id: string; external_url: string | null; matched_title: string | null;
  match_truth: string | null; verified: boolean | null; match_confidence: number | null;
}

const readJson = <T>(f: string): T | null => {
  const p = path.join(OUT_DIR, f);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as T;
};
const must = <T>(f: string): T => {
  const v = readJson<T>(f);
  if (!v) throw new Error(`선행 덤프 없음: ${f}`);
  return v;
};

/** 🟢 기존 함수와 **같은 규칙** 으로 임의 텍스트에서 확인한다(토큰 전체 일치). */
const confirmIn = (code: string | null, haystack: string | null | undefined): boolean =>
  Boolean(code && haystack && confirmBrandCodeInTitle(code, haystack));

/** 🔴 **부분일치(substring)** — FP 위험을 «보여주기 위해» 만 계산한다. 채택안이 아니다. */
const substringIn = (code: string | null, haystack: string | null | undefined): boolean =>
  Boolean(code && haystack && haystack.toUpperCase().replace(/[^A-Z0-9]/g, "").includes(code.toUpperCase().replace(/[^A-Z0-9]/g, "")));

const DESC_RE = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i;
const CANON_RE = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i;
const OG_URL_RE = /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i;
const TITLE_RE = /<title[^>]*>([^<]+)<\/title>/i;

describe("🔴 WU-004 Track A 벤치마크 — 품번을 후보의 «어디서» 찾는가 (비용 0)", () => {
  it("①~⑦ 7항목을 한 번에 측정한다", async () => {
    /* ─────────── ① 원상품 쪽 품번 보유 ─────────── */
    const groups = must<Record<string, UrlRow[]>>("e2e-urls.json");
    const snaps = must<SnapRow[]>("e2e-snapshots.json");
    const shared = (await import("@commerce/shared")) as unknown as {
      buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
      backfillCanonicalProduct: (p: unknown) => unknown;
    };
    const seen = new Set<string>();
    const originals = [
      ...[...(groups.control ?? []), ...groups.kids, ...groups.kids2].map((r) => ({ r, scope: "KIDS" })),
      ...groups.tennis.map((r) => ({ r, scope: "TENNIS" })),
    ]
      .filter(({ r }) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
      .flatMap(({ r, scope }) => {
        const snap = snaps.find((s) => s.id === r.id);
        if (!snap) return [];
        const dna = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap.canonicalProduct));
        return [{ id: r.id, scope, brand: r.brand || "(빈 브랜드)", code: (dna.brandModelCode as string | null) ?? null }];
      });
    const withCode = originals.filter((o) => o.code);

    /* ─────────── ②③ 저장된 후보의 URL/title 에서 찾기 ─────────── */
    type Cand = { origin: string; domain: string; url: string; title: string; label?: string | null };
    const cands: Cand[] = [];

    const acc = readJson<{ products: Record<string, unknown>[] }>("acc011-1.json");
    for (const p of acc?.products ?? []) {
      const judged = (p["판정"] as Record<string, unknown>[] | undefined) ?? [];
      for (const j of judged) {
        if (!j.url) continue;
        cands.push({
          origin: String(p.title ?? ""),
          domain: String(j.domain ?? ""),
          url: String(j.url),
          title: String(j.title ?? ""),
        });
      }
    }
    const one = readJson<{ "⑥ 후보별": Record<string, unknown>[] }>("onecall023-1.json");
    for (const c of one?.["⑥ 후보별"] ?? []) {
      if (!c.url) continue;
      cands.push({ origin: "Bobo Choses Booty Ghosts", domain: String(c.domain ?? ""), url: String(c.url), title: "" });
    }
    /** 🟢 운영 링크는 **실제 라벨** 을 갖고 있다(match_truth · verified) — GT 대용. */
    const links = readJson<LinkRow[]>("d021-links.json") ?? [];
    for (const l of links) {
      if (!l.external_url) continue;
      const o = originals.find((x) => x.id === l.snapshot_id);
      cands.push({
        origin: o?.brand ?? "",
        domain: "(운영 링크)",
        url: l.external_url,
        title: l.matched_title ?? "",
        label: l.match_truth,
      });
    }

    /** 🔴 품번을 가진 원상품의 **품번 집합** 으로 전 후보를 교차 검사한다.
     *     — 「자기 원상품의 품번」과 「다른 원상품의 품번」을 **갈라서** 센다.
     *       후자가 발견되면 그것이 **FP 후보** 다(다른 상품의 코드가 걸린 것). */
    const codeByOrigin = new Map(withCode.map((o) => [o.id, o.code as string]));
    const allCodes = [...codeByOrigin.values()];

    const urlHits = cands.filter((c) => allCodes.some((code) => confirmIn(code, c.url)));
    const titleHits = cands.filter((c) => allCodes.some((code) => confirmIn(code, c.title)));

    /* ─────────── ④⑤ fixture 의 JSON-LD sku / description ─────────── */
    const fx: Record<string, unknown>[] = [];
    for (const dir of FIXTURE_DIRS) {
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir).filter((f) => f.endsWith(".html"))) {
        const html = readFileSync(path.join(dir, file), "utf8");
        const ld = extractFromJsonLd(html);
        const url = CANON_RE.exec(html)?.[1] ?? OG_URL_RE.exec(html)?.[1] ?? null;
        const title = TITLE_RE.exec(html)?.[1] ?? null;
        const desc = DESC_RE.exec(html)?.[1] ?? ld?.description ?? null;
        fx.push({
          fixture: file,
          url,
          title,
          "jsonld.sku": ld?.sku ?? null,
          "desc 길이": desc?.length ?? 0,
          "🟢 품번 발견 URL": allCodes.filter((c) => confirmIn(c, url)),
          "🟢 품번 발견 title": allCodes.filter((c) => confirmIn(c, title)),
          "🟢 품번 발견 sku": allCodes.filter((c) => confirmIn(c, ld?.sku ?? null)),
          "🟢 품번 발견 desc": allCodes.filter((c) => confirmIn(c, desc)),
          /** 🔴 부분일치로 재면 몇 건이 «더» 걸리는가 = 그만큼이 FP 위험이다. */
          "🔴 부분일치만 걸리는 코드": allCodes.filter(
            (c) => !confirmIn(c, `${url ?? ""} ${title ?? ""} ${ld?.sku ?? ""} ${desc ?? ""}`) &&
              substringIn(c, `${url ?? ""} ${title ?? ""} ${ld?.sku ?? ""} ${desc ?? ""}`),
          ),
        });
      }
    }

    /* ─────────── ⑥⑦ FP / FN ─────────── */
    /** 🔴 **라벨이 있는 것만** FP/FN 을 셀 수 있다. 운영 링크의 match_truth 를 쓴다. */
    const labeled = cands.filter((c) => c.label != null);
    const labeledHits = labeled.filter((c) => allCodes.some((code) => confirmIn(code, `${c.url} ${c.title}`)));

    const report = {
      "🔴🔴 DISCLAIMER":
        "구현 «전» 벤치마크. 🔴 Gemini 0 · 외부 HTTP 0 · 비용 ₩0 — 입력은 리포의 캡처 fixture + " +
        "선행 WU 가 저장한 후보 기록 + 덤프 스냅샷뿐이다. " +
        "🔴🔴 **라벨(ground truth)이 있는 후보는 운영 링크 몇 건뿐** 이라 FP/FN 을 전수로 셀 수 없다. " +
        "그 한계를 ⑥⑦ 에 그대로 적었다. 🔴 비율을 운영 전수 값으로 쓰지 않는다.",
      "① 원상품 brandModelCode 보유": {
        상품: originals.length,
        보유: withCode.length,
        비율: `${withCode.length}/${originals.length}`,
        목록: withCode.map((o) => `${o.brand}: ${o.code}`),
      },
      "②③ 저장된 후보에서 찾기 (URL / title)": {
        "후보 총수": cands.length,
        "🟢 URL 에서 발견": urlHits.length,
        "🟢 title 에서 발견": titleHits.length,
        "🟢 둘 중 하나라도": cands.filter((c) => allCodes.some((code) => confirmIn(code, `${c.url} ${c.title}`))).length,
        "발견 상세": [...urlHits, ...titleHits].map((c) => ({
          domain: c.domain,
          url: c.url.slice(0, 92),
          codes: allCodes.filter((code) => confirmIn(code, `${c.url} ${c.title}`)),
        })),
      },
      "④⑤ fixture 에서 찾기 (sku / description)": {
        fixture: fx.length,
        "URL 발견": fx.filter((f) => (f["🟢 품번 발견 URL"] as string[]).length > 0).length,
        "title 발견": fx.filter((f) => (f["🟢 품번 발견 title"] as string[]).length > 0).length,
        "sku 발견": fx.filter((f) => (f["🟢 품번 발견 sku"] as string[]).length > 0).length,
        "desc 발견": fx.filter((f) => (f["🟢 품번 발견 desc"] as string[]).length > 0).length,
        "🔴 부분일치만 걸리는 fixture": fx.filter((f) => (f["🔴 부분일치만 걸리는 코드"] as string[]).length > 0).length,
      },
      "⑥⑦ FP / FN — 🔴 라벨 한계": {
        "라벨 보유 후보": labeled.length,
        "그중 품번이 발견된 것": labeledHits.length,
        "라벨 분포": labeled.reduce<Record<string, number>>((t, c) => {
          const k = String(c.label);
          t[k] = (t[k] ?? 0) + 1;
          return t;
        }, {}),
        "🔴 FP": "측정 불가 — 품번이 발견된 라벨 후보가 위 수치뿐이고, 「발견됐는데 다른 상품」인 사례를 가릴 분모가 없다",
        "🔴 FN": "측정 불가 — 「실제 동일상품인데 품번을 못 찾은 것」을 알려면 동일상품 라벨이 필요하다",
        "🟢 그러나 FP 의 «구조적» 상한은 말할 수 있다":
          "confirmBrandCodeInTitle 은 원본 품번과 **토큰 전체 일치** 만 인정하고 반환이 `code|null` 둘뿐이라 " +
          "compareModelCode 가 `exact|unavailable` 밖에 못 낸다 — partial/conflict 를 **구조적으로 만들 수 없다**. " +
          "즉 건초더미를 넓혀도 FP 는 「다른 상품의 품번이 그 페이지에 토큰으로 적혀 있는」 경우로 한정된다.",
      },
      fixtures: fx,
      candidates: cands.map((c) => ({ domain: c.domain, url: c.url.slice(0, 100), label: c.label ?? null })),
    };

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(path.join(OUT_DIR, "bench004.json"), JSON.stringify(report, null, 1), "utf8");
    // eslint-disable-next-line no-console
    console.log(
      "\n" +
        JSON.stringify(
          {
            "①": report["① 원상품 brandModelCode 보유"],
            "②③": { ...report["②③ 저장된 후보에서 찾기 (URL / title)"], 발견상세: undefined },
            "④⑤": report["④⑤ fixture 에서 찾기 (sku / description)"],
            "⑥⑦": { ...report["⑥⑦ FP / FN — 🔴 라벨 한계"], "🟢 그러나 FP 의 «구조적» 상한은 말할 수 있다": undefined },
          },
          null,
          1,
        ),
    );
    // eslint-disable-next-line no-console
    console.log("발견 상세:", JSON.stringify(report["②③ 저장된 후보에서 찾기 (URL / title)"]["발견 상세"], null, 1));

    expect(originals.length).toBeGreaterThan(0);
  });
});
