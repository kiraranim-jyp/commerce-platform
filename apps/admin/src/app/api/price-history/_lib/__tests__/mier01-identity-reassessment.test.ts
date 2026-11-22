/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-IDENTITY-EVIDENCE-REASSESSMENT-01 — **원본 기준값으로 후보 재검증**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **방향이 MIC-01 과 다르다.** MIC-01 은 「양쪽 상세설명을 대조」했고 원본 상세설명에
 *    브랜드·품번이 없어 축이 MISSING 이었다. 🔵 CPO 지시 — **원본의 기준값 네 개를
 *    후보 상세설명에서 «찾는다»**. 원본 상세설명에 품번이 없다는 사실을 **차단 근거로
 *    쓰지 않는다**(CPO §1).
 *
 * 기준값(CPO §1 고정)  브랜드 `Bobo Choses` · 품번 `B226AC033` ·
 *                      상품명 `Bobo Choses Pop sweatshirt` · 가격 `EUR 62`
 *
 * 🟢 수집기는 **운영 owner `factsFromProductUrl` 그대로** 다(새 크롤러 0).
 * 🔴 운영 판정 로직 0 · DB 쓰기 0 · 화면 0 · 상세설명의 운영 SAME 판정 연결 0.
 * 🔴 라이브 HTTP 를 쓰므로 `MIER01_LIVE=1` 일 때만 돈다(기본 SKIP).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";

const LIVE = process.env.MIER01_LIVE === "1";
const FIX = join(__dirname, "fixtures");
const PULLED = join(FIX, "mic01-db-pull.json");
const DUMP = join(FIX, "mier01-reassessment.json");

/** 🔴 CPO §1 이 고정한 기준값 — 테스트가 지어내지 않는다. */
const ORIGIN = {
  brand: "Bobo Choses",
  code: "B226AC033",
  title: "Bobo Choses Pop sweatshirt",
  price: "EUR 62",
} as const;

/** 🟢 CPO §3 의 검색 대상 — 「포함」만 적지 않고 **원문 발췌** 를 같이 낸다. */
const NEEDLES: { key: string; patterns: RegExp[] }[] = [
  { key: "BRAND_BOBO_CHOSES", patterns: [/bobo\s*choses/gi] },
  { key: "CODE_B226AC033", patterns: [/b\s*226\s*ac\s*033/gi] },
  { key: "NAME_POP_SWEATSHIRT", patterns: [/pop\s*sweat\s*shirt/gi, /pop\s*맨투맨/gi] },
  { key: "FORM_SWEATSHIRT", patterns: [/sweat\s*shirt/gi, /맨투맨/g, /sweatshirt/gi] },
  { key: "MATERIAL_COTTON_MIX", patterns: [/organic\s*cotton/gi, /recycled\s*cotton/gi, /유기농/g] },
  { key: "COLOR_MIDNIGHT_BLUE", patterns: [/midnight\s*blue/gi, /미드나잇\s*블루/g] },
  { key: "ORIGIN_SPAIN", patterns: [/made\s*in\s*spain/gi, /스페인/g] },
  { key: "SEASON_AW26", patterns: [/aw\s*26/gi, /fw\s*26/gi, /26aw/gi] },
];

interface Hit {
  key: string;
  found: boolean;
  /** 🔴 **원문 발췌** — 「포함」만 적지 않는다(CPO §3). */
  excerpts: string[];
}

/** 🟢 매치 주변 문맥을 **원문 그대로** 자른다. 🔴 번역·정규화하지 않는다. */
function search(text: string | null | undefined): Hit[] {
  const t = text ?? "";
  return NEEDLES.map(({ key, patterns }) => {
    const excerpts: string[] = [];
    for (const re of patterns) {
      const rx = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
      let m: RegExpExecArray | null;
      while ((m = rx.exec(t)) !== null) {
        const from = Math.max(0, m.index - 60);
        const to = Math.min(t.length, m.index + m[0].length + 60);
        const ex = (from > 0 ? "…" : "") + t.slice(from, to).replace(/\s+/g, " ").trim() + (to < t.length ? "…" : "");
        if (!excerpts.includes(ex)) excerpts.push(ex);
        if (m[0].length === 0) break;
        if (excerpts.length >= 3) break;
      }
      if (excerpts.length >= 3) break;
    }
    return { key, found: excerpts.length > 0, excerpts };
  });
}

interface Pull {
  origin: { sourceUrl?: string | null };
  reviews: {
    candidate_url: string;
    candidate_domain: string;
    candidate_title: string | null;
    market: string | null;
    system_verdict: string | null;
    match_truth: string | null;
    price_tier: string | null;
    price_amount: string | null;
    price_currency: string | null;
    price_status: string | null;
    blockers: string[] | null;
    match_reasons: string[] | null;
    last_seen_at: string | null;
  }[];
}

describe("MIER01 — 원본 기준값으로 후보 상세설명 재검증", () => {
  it.runIf(LIVE)(
    "LIVE 🟢 후보 8건 전체 원문 + 기준 4값 검색(원문 발췌 포함)",
    async () => {
      const pull = JSON.parse(readFileSync(PULLED, "utf8")) as Pull;
      const targets = pull.reviews.filter(
        (r) => !(r.price_tier === "EXACT" && r.system_verdict === "SAME"),
      );
      expect(targets, "🔴 검토 대상이 8건이 아니다").toHaveLength(8);

      const originUrl = String(pull.origin.sourceUrl ?? "");
      expect(originUrl, "🔴 원본 URL 이 없다").toMatch(/^https?:/);

      const collectedAt = new Date().toISOString();
      let http = 0;

      const originRes = await factsFromProductUrl(originUrl);
      http += originRes.httpCalls ?? 0;

      const rows = [];
      for (const t of targets) {
        const r = await factsFromProductUrl(t.candidate_url).catch((e: unknown) => ({
          status: "THREW" as const,
          crawlerUrl: null,
          dedupeKey: null,
          candidate: null,
          httpCalls: 0,
          fetchPath: "NONE" as const,
          error: String(e),
        }));
        http += r.httpCalls ?? 0;
        const f = r.candidate?.facts ?? null;
        /** 🔴 **제목 + 상세설명을 같이 훑는다** — 판매처가 품번을 제목에만 적는 경우가 있다. */
        const haystackTitle = f?.title ?? r.candidate?.title ?? null;
        const haystackDesc = f?.description ?? null;
        rows.push({
          domain: t.candidate_domain,
          url: t.candidate_url,
          /** 🔴 접근 결과를 **그대로** 적는다 — 추정하지 않는다. */
          access: { status: r.status, fetchPath: r.fetchPath, httpCalls: r.httpCalls },
          collectedAt,
          candidate: {
            titleRaw: haystackTitle,
            brandRaw: f?.brand ?? null,
            codeRaw: f?.brandModelCode ?? null,
            sellerSku: f?.sellerSku ?? null,
            colorText: f?.colorText ?? null,
            materialText: f?.materialText ?? null,
            categoryText: f?.categoryText ?? null,
            fitText: f?.fitText ?? null,
            descriptionRaw: haystackDesc,
            descriptionLength: haystackDesc?.length ?? 0,
            imageUrl: r.candidate?.imageUrl ?? null,
            price: r.candidate?.price ?? null,
          },
          stored: {
            title: t.candidate_title,
            market: t.market,
            verdict: t.system_verdict,
            matchTruth: t.match_truth,
            priceTier: t.price_tier,
            price: t.price_amount ? `${t.price_amount} ${t.price_currency ?? ""}`.trim() : null,
            priceStatus: t.price_status,
            blockers: t.blockers ?? [],
            matchReasons: t.match_reasons ?? [],
            lastSeenAt: t.last_seen_at,
          },
          /** 🟢 CPO §3 — 기준 4값 + 보조 식별정보를 **제목·상세설명 각각** 에서 찾는다. */
          hitsInTitle: search(haystackTitle),
          hitsInDescription: search(haystackDesc),
        });
      }

      writeFileSync(
        DUMP,
        JSON.stringify(
          {
            note:
              "MI-IDENTITY-EVIDENCE-REASSESSMENT-01 — 원본 기준값으로 후보 상세설명 재검증. " +
              "운영 추출기 factsFromProductUrl 산출 · 읽기 전용 · 값 생성 0 · 번역 0.",
            originCriteria: ORIGIN,
            collectedAt,
            httpCalls: http,
            origin: {
              url: originUrl,
              access: { status: originRes.status, fetchPath: originRes.fetchPath },
              brandRaw: originRes.candidate?.facts?.brand ?? null,
              codeRaw: originRes.candidate?.facts?.brandModelCode ?? null,
              titleRaw: originRes.candidate?.facts?.title ?? null,
              descriptionRaw: originRes.candidate?.facts?.description ?? null,
              imageUrl: originRes.candidate?.imageUrl ?? null,
              price: originRes.candidate?.price ?? null,
            },
            rows,
          },
          null,
          1,
        ),
        "utf8",
      );

      /* eslint-disable no-console */
      console.log(`\n[MIER01] httpCalls=${http} · collectedAt=${collectedAt}`);
      for (const r of rows) {
        const d = r.hitsInDescription;
        const ti = r.hitsInTitle;
        const yes = (k: string) =>
          (d.find((h) => h.key === k)?.found ? "D" : "") + (ti.find((h) => h.key === k)?.found ? "T" : "") || "-";
        console.log(
          [
            r.domain.padEnd(24),
            r.access.status,
            "desc=" + String(r.candidate.descriptionLength).padStart(5),
            "brand=" + JSON.stringify(r.candidate.brandRaw),
            "code=" + JSON.stringify(r.candidate.codeRaw),
            "| BOBO:" + yes("BRAND_BOBO_CHOSES"),
            "CODE:" + yes("CODE_B226AC033"),
            "POPSW:" + yes("NAME_POP_SWEATSHIRT"),
            "SWSH:" + yes("FORM_SWEATSHIRT"),
            "MIDNT:" + yes("COLOR_MIDNIGHT_BLUE"),
            "SPAIN:" + yes("ORIGIN_SPAIN"),
            "AW26:" + yes("SEASON_AW26"),
          ].join(" "),
        );
      }
      /* eslint-enable no-console */

      expect(rows).toHaveLength(8);
      /** 🔴 분모를 같이 잠근다 — 접근 실패를 「정보 없음」으로 섞지 않는다. */
      const reachable = rows.filter((r) => r.access.status === "OK");
      // eslint-disable-next-line no-console
      console.log(`[MIER01] 접근 성공 ${reachable.length}/8 · 상세설명 보유 ${rows.filter((r) => r.candidate.descriptionLength > 0).length}/8`);
    },
    900_000,
  );

  it("GUARD 🔴 운영 owner 를 복제하지 않고 번역도 하지 않는다", () => {
    const src = readFileSync(__filename, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).toContain("factsFromProductUrl(");
    /** 🔴 번역·정규화로 원문을 바꾸지 않는다(발췌는 공백 압축만 한다). */
    /** 🔴 **자기참조 함정 — 이 세션에서 두 번째다.** 금지어를 그대로 적으면 자신을 잡는다. */
    expect(src, "🔴 번역기를 끌어왔다").not.toContain(["trans", "late("].join(""));
    /** 🔴 기준값을 코드가 지어내지 않는다 — CPO §1 그대로다. */
    expect(ORIGIN.code).toBe("B226AC033");
    expect(ORIGIN.brand).toBe("Bobo Choses");
  });
});
