import { describe, expect, it } from "vitest";
import type { ProductFacts } from "@commerce/shared";
import { factsFromProductUrl } from "@commerce/crawler";
import { extractDetailModelCodes } from "@commerce/crawler/src/comparison-search/model-code-from-detail";
import { SAME05_PAIRS, type Same05Pair } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-SAME-SPRINT-04 — **Evidence Coverage 측정**(측정 only · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **matcher 개선 Sprint 가 아니다.** description 을 새 축으로 연결하지 않고,
 *    threshold · `NO_TITLE_OVERLAP` · MODEL_CODE conflict · material parser ·
 *    `priceTier` · `domesticReference` — **한 글자도 보지 않는다**(읽기 전용 관측).
 *
 * ── 🔴🔴🔴 **분모가 «둘» 이고 섞으면 측정이 틀린다** ────────────────────────────
 * ```
 * 분모 A  **저장 facts**(GT fixture)  — `description` 이 생기기 «전» 스냅샷이다
 *         ⟹ 🔴 그 칸은 **구조적으로 비어 있다**. 그 0 을 「coverage 0%」로 적으면
 *            **거짓** 이다 — 재는 대상이 아니라 **계약 버전** 의 문제다
 * 분모 B  **라이브 재수집**(`factsFromProductUrl` = 운영 owner) — 🟢 **이것이 coverage 다**
 *         ⟹ 지금 수집하면 그 칸이 채워지는가를 **운영 경로로** 본다
 * ```
 * 🔴 두 분모의 숫자를 **같은 줄에 적지 않는다**(§5-B).
 * 🔴 그리고 **URL 수와 후보 수를 혼동하지 않는다**(CPO §2).
 */

/** 🔴 `CrossSellerAxis` 어휘를 그대로 쓰지 않는다 — 이 표는 **관측** 이고 판정이 아니다. */
type Supply = "POPULATED" | "EMPTY" | "NOT_AVAILABLE";

interface EvidenceProbe {
  label: string;
  /** 🔴 계약에 칸이 **없으면** `NOT_AVAILABLE` 이다(억지로 만들지 않는다 · CPO §1). */
  read: (f: ProductFacts) => Supply;
  /** 공급 지점(코드 위치) — 「어디서 오는가」를 같이 적는다(CPO §5). */
  owner: string;
}

const str = (v: string | null | undefined): Supply => (v && v.trim() ? "POPULATED" : "EMPTY");
const arr = (v: unknown[] | null | undefined): Supply => (v && v.length > 0 ? "POPULATED" : "EMPTY");

/**
 * 🔴 CPO §1 의 11 축을 **실제 `ProductFacts` 칸에 대응** 시킨다.
 *    🔴 `COMPOSITION` 과 `OPTION/SKU` 는 **별도 칸이 없다** — 아래 주석이 근거다.
 */
const PROBES: EvidenceProbe[] = [
  { label: "TITLE", read: (f) => str(f.title), owner: "title / coreTitleTokens" },
  { label: "BRAND", read: (f) => str(f.brand), owner: "brand (brand-resolver)" },
  { label: "MODEL_CODE", read: (f) => str(f.brandModelCode), owner: "brandModelCode" },
  { label: "DESCRIPTION", read: (f) => str(f.description), owner: "🔵 description (SPRINT-03)" },
  { label: "CATEGORY/FORM", read: (f) => str(f.categoryText), owner: "categoryText" },
  { label: "COLOR", read: (f) => str(f.colorText), owner: "colorText" },
  { label: "MATERIAL", read: (f) => str(f.materialText), owner: "materialText" },
  { label: "FIT", read: (f) => str(f.fitText), owner: "fitText" },
  /**
   * 🔴 **COMPOSITION 은 `ProductFacts` 에 칸이 없다.** 소재 조성은 `compareMaterial` 이
   *    `materialText` 를 **그 자리에서 파싱** 해 쓰고 facts 에 보존되지 않는다
   *    ⟹ 「공급 여부」를 facts 에서 읽을 수 없다 ⟹ **NOT_AVAILABLE**.
   */
  { label: "COMPOSITION", read: () => "NOT_AVAILABLE", owner: "🔴 칸 없음(compareMaterial 내부 파싱)" },
  /**
   * 🔴 `sellerSku` 칸은 **있지만** matcher 가 읽지 않는다(SPRINT-01 실측 · 어휘가
   *    `cross-seller.ts` 에 **없다**). 🔴 그래서 **공급은 재고 판정 자격이 아니다** —
   *    값은 세지만 「OPTION evidence 가 쓰인다」로 적지 않는다.
   */
  { label: "OPTION/SKU", read: (f) => str(f.sellerSku), owner: "🟡 sellerSku(보존만 · matcher 미사용)" },
  /**
   * 🔴 CPO §9 — URL 존재를 「IMAGE evidence available」로 **확정하지 않는다**.
   *    이 칸은 **URL 공급**까지만 센다(로드 가능성·비교 계산은 **측정 범위 밖**).
   */
  { label: "IMAGE(URL만)", read: (f) => arr(f.imageUrls), owner: "🟡 imageUrls(공급만 · scoring 별개)" },
];

const pct = (n: number, d: number) => (d === 0 ? "—" : `${((n / d) * 100).toFixed(1)}%`);
const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
const padL = (s: string, n: number) => " ".repeat(Math.max(0, n - [...s].length)) + s;

function coverageTable(title: string, rows: ProductFacts[], note: string) {
  console.log(`\n${"═".repeat(104)}`);
  console.log(`  ${title}   (분모 = ${rows.length})`);
  console.log(`  ${note}`);
  console.log(`${"═".repeat(104)}`);
  console.log(
    `  ${pad("Evidence", 16)}${padL("분모", 6)}${padL("populated", 11)}${padL("empty", 7)}${padL("N/A", 6)}${padL("coverage", 10)}  공급 지점`,
  );
  for (const p of PROBES) {
    let pop = 0;
    let na = 0;
    for (const f of rows) {
      const s = p.read(f);
      if (s === "POPULATED") pop += 1;
      else if (s === "NOT_AVAILABLE") na += 1;
    }
    const eligible = rows.length - na;
    console.log(
      `  ${pad(p.label, 16)}${padL(String(rows.length), 6)}${padL(String(pop), 11)}` +
        `${padL(String(eligible - pop), 7)}${padL(String(na), 6)}${padL(na === rows.length ? "측정불가" : pct(pop, eligible), 10)}  ${p.owner}`,
    );
  }
}

/** 🔴 설명문에서 품번을 찾는 것은 **운영 함수** 로 한다(복제식 금지 · SPRINT-03 교훈). */
const codesIn = (s: string | null | undefined) => extractDetailModelCodes(s);

describe("CORE-SAME-SPRINT-04 — 분모 A: 저장 facts(옛 계약)", () => {
  it("[분모 A] 저장 facts 의 evidence coverage — 🔴 description 은 «구조적으로» 비어 있다", () => {
    expect(SAME05_PAIRS.length, "🔴 GT 가 비면 이 측정은 성립하지 않는다").toBeGreaterThan(0);
    const rows = SAME05_PAIRS.map((p) => p.facts);
    coverageTable(
      "분모 A — 저장 facts (GT fixture · 후보측)",
      rows,
      "🔴 이 분모는 `description` 이 생기기 «전» 스냅샷이다 ⟹ 그 칸의 0 을 coverage 0% 로 읽지 않는다",
    );

    /** 🔴🔴 **발화 단언** — 「전건 0」을 제품 사실로 적지 않기 위해 **구조를 단언** 한다. */
    const withDesc = rows.filter((f) => f.description).length;
    console.log(
      `\n  🔴 저장 facts 의 description populated = ${withDesc}/${rows.length}` +
        `  ⟹ **옛 계약이라 0 이 정상이다**(SPRINT-03 이전 스냅샷)`,
    );
    expect(withDesc, "🔴 옛 스냅샷에 description 이 있으면 분모 가정이 틀린 것이다").toBe(0);

    /** 🟢 그런데 **설명문 원문은 `materialText` 에 들어와 있다** — 그 사실을 센다. */
    const matHasCode = rows.filter((f) => codesIn(f.materialText).length > 0).length;
    console.log(
      `  🟡 참고 — 저장 facts 의 materialText 에 품번이 든 후보 = ${matHasCode}/${rows.length}` +
        `  (SPRINT-03 이 «정식 칸» 으로 옮긴 그 원문이다)`,
    );
    expect(matHasCode, "🔴 0 이면 SPRINT-02/03 의 발화 근거가 사라진다").toBeGreaterThan(0);

    /**
     * 🟢🟢 **Q4 는 «이 분모에서만» 답할 수 있다.**
     *
     * 라이브 산출(분모 B)은 보강이 **이미 적용된 뒤** 라 「보강 전 비어 있었다」를 역산할
     * 수 없다. 🟢 저장 facts 는 **보강 «전» 스냅샷** 이므로 그 비율이 여기서 나온다.
     */
    const codeBearing = rows.filter((f) => codesIn(f.materialText).length > 0);
    const single = codeBearing.filter((f) => codesIn(f.materialText).length === 1);
    const singleAndEmpty = single.filter((f) => !f.brandModelCode);
    console.log(`\n  [Q4] 보강 «전» 상태에서만 답할 수 있는 비율`);
    console.log(`     품번을 포함한 원문        ${codeBearing.length}/${rows.length}`);
    console.log(`     그중 «단일» 품번          ${single.length}/${codeBearing.length}`);
    console.log(
      `     🟢 그중 기존 MODEL_CODE 비어 있음  **${singleAndEmpty.length}**/${single.length}` +
        `  ← SPRINT-02 가 쟀던 **발화 ${singleAndEmpty.length}건** 과 같은 수여야 한다`,
    );
    /** 🔴 발화 단언 — 0 이면 SPRINT-02 결과와 모순이고 분모가 틀린 것이다. */
    expect(singleAndEmpty.length, "🔴 SPRINT-02 의 발화 3건과 대응해야 한다").toBe(3);

    /** 🔴 **발화 호스트 분포** — 「tinyapple 3건」의 대표성을 숨기지 않는다(CPO §7). */
    const hosts = new Map<string, number>();
    for (const f of singleAndEmpty) {
      const h = new URL(f.sourceUrl).hostname.replace(/^www\./, "");
      hosts.set(h, (hosts.get(h) ?? 0) + 1);
    }
    console.log(`  [Q7/§7] 발화 호스트 분포 — 🔴 전체로 일반화하지 않기 위해 센다`);
    for (const [h, n] of [...hosts.entries()].sort((a, b) => b[1] - a[1])) console.log(`     ${pad(h, 32)} ${n}`);
  });
});

/**
 * 🔵🔵 **분모 B — 라이브 재수집.** 🔴 네트워크를 쓰므로 플래그 뒤에 둔다.
 *    `CORE_SPRINT04_LIVE=1` 로만 돈다(회귀에서는 skip 되고 그것이 정상이다).
 */
const LIVE = process.env.CORE_SPRINT04_LIVE === "1";

describe.skipIf(!LIVE)("CORE-SAME-SPRINT-04 — 분모 B: 라이브 재수집(운영 owner)", () => {
  it(
    "[분모 B] 공급 경로별 description coverage + evidence matrix",
    async () => {
      /** 🔴 **URL 수와 후보 수를 가른다**(CPO §2). 중복 URL 을 먼저 접는다. */
      const byUrl = new Map<string, Same05Pair[]>();
      for (const p of SAME05_PAIRS) {
        const k = p.url;
        byUrl.set(k, [...(byUrl.get(k) ?? []), p]);
      }
      const urls = [...byUrl.keys()];
      console.log(`\n  분모 — candidate rows **${SAME05_PAIRS.length}** · unique URL **${urls.length}**`);

      interface Live {
        url: string;
        status: string;
        fetchPath: string;
        facts: ProductFacts | null;
      }
      const live: Live[] = [];
      for (const url of urls) {
        try {
          const r = await factsFromProductUrl(url);
          const anyR = r as unknown as Record<string, unknown>;
          /**
           * 🔴🔴 **칸 이름을 추측하지 않는다** — `facts` 는 최상위가 아니라
           *    **`candidate.facts`** 다(`product-url-facts.ts` 의 OK 분기 반환 모양).
           *    🔴 1차 하니스가 최상위에서 읽어 **전건 null** 이 나왔고, 그대로 적었으면
           *       「coverage 측정불가」라는 **거짓 결론** 이었다. 🟢 발화 단언이 잡았다.
           */
          const cand = anyR.candidate as Record<string, unknown> | undefined;
          live.push({
            url,
            status: String(anyR.status ?? "?"),
            fetchPath: String(anyR.fetchPath ?? cand?.fetchPath ?? "UNRESOLVED"),
            facts: (cand?.facts as ProductFacts | undefined) ?? null,
          });
        } catch (e) {
          live.push({ url, status: `THREW(${(e as Error).message.slice(0, 30)})`, fetchPath: "UNRESOLVED", facts: null });
        }
      }

      /** ── 3. 공급 경로별 coverage ──────────────────────────────────────── */
      const paths = [...new Set(live.map((l) => l.fetchPath))].sort();
      console.log(`\n${"═".repeat(104)}`);
      console.log("  [3] 공급 경로별 description coverage   🔴 URL 단위다(후보 단위가 아니다)");
      console.log(`${"═".repeat(104)}`);
      console.log(`  ${pad("공급 경로", 18)}${padL("URL", 6)}${padL("facts O", 9)}${padL("desc 있음", 11)}${padL("desc 없음", 11)}${padL("coverage", 10)}`);
      for (const p of [...paths, "전체"]) {
        const set = p === "전체" ? live : live.filter((l) => l.fetchPath === p);
        const ok = set.filter((l) => l.facts);
        const has = ok.filter((l) => l.facts?.description).length;
        console.log(
          `  ${pad(p, 18)}${padL(String(set.length), 6)}${padL(String(ok.length), 9)}` +
            `${padL(String(has), 11)}${padL(String(ok.length - has), 11)}${padL(pct(has, ok.length), 10)}`,
        );
      }

      /** 🔴 facts 를 못 만든 URL 을 **「description 없음」으로 세지 않는다**. */
      const unreadable = live.filter((l) => !l.facts);
      console.log(`\n  🔴 facts 미확보 URL = ${unreadable.length}/${live.length} ⟹ **coverage 분모에서 뺐다**(측정불가)`);
      for (const u of unreadable) console.log(`     · ${u.status.padEnd(22)} ${u.url.slice(0, 72)}`);

      /** ── 4. Evidence coverage matrix(라이브) ─────────────────────────── */
      const readable = live.filter((l) => l.facts).map((l) => l.facts as ProductFacts);
      coverageTable(
        "분모 B — 라이브 재수집 facts (운영 `factsFromProductUrl` 산출)",
        readable,
        "🟢 이것이 «지금 수집하면» 어떤 evidence 가 들어오는가다",
      );

      /** ── 6. description → 품번 3층(CPO §6) ──────────────────────────── */
      const withDesc = readable.filter((f) => f.description);
      const descWithCode = withDesc.filter((f) => codesIn(f.description).length > 0);
      const singleCode = withDesc.filter((f) => codesIn(f.description).length === 1);
      const multiCode = withDesc.filter((f) => codesIn(f.description).length > 1);
      /**
       * 🔴🔴 **역산 불가 — 이 분모에서 「보강 전 비어 있었다」를 셀 수 없다.**
       *
       * `factsFromProductUrl` 의 Shopify 분기는 **이미 `recoverModelCodeFromDetail` 을
       * 적용해** 돌려준다(SPRINT-02 배선). ⟹ 산출에서 `brandModelCode` 가 비어 있는
       * 후보는 **보강까지 실패한 것** 이고, 「보강 전 상태」는 **남아 있지 않다**.
       * 🔴 1차 하니스가 이 분모에서 `!f.brandModelCode` 를 세어 **0** 을 냈고, 그것을
       *    「발화 0」으로 적었으면 **거짓** 이다(실제로는 보강이 적용된 뒤의 0 이다).
       * 🟢 그래서 Q4 는 **분모 A(저장 facts = 보강 «전» 스냅샷)** 에서만 답할 수 있다.
       */
      const singleAndEmpty = singleCode.filter((f) => !f.brandModelCode);
      /** 🟢 대신 **상한** 을 적는다 — 설명문 품번과 산출 품번이 «일치» 하는 건수. */
      const codeAgrees = singleCode.filter((f) => codesIn(f.description)[0] === f.brandModelCode).length;
      console.log(`\n${"═".repeat(104)}`);
      console.log("  [6] description → MODEL_CODE 추출 3층   🔴 「있다」와 「추출됐다」를 가른다");
      console.log(`${"═".repeat(104)}`);
      console.log(`  ① description 있음              ${padL(String(withDesc.length), 4)} / ${readable.length}  (${pct(withDesc.length, readable.length)})`);
      console.log(`  ② 그중 품번을 «포함»            ${padL(String(descWithCode.length), 4)} / ${withDesc.length}  (${pct(descWithCode.length, withDesc.length)})`);
      console.log(`  ③ 그중 «단일» 품번(추출 가능)    ${padL(String(singleCode.length), 4)} / ${withDesc.length}  (${pct(singleCode.length, withDesc.length)})`);
      console.log(`  🔴 복수 품번(Contract C 로 포기)  ${padL(String(multiCode.length), 4)} / ${withDesc.length}`);
      console.log(
        `  🔴 ③ ∧ 산출 MODEL_CODE 비어 있음  ${padL(String(singleAndEmpty.length), 4)} / ${withDesc.length}` +
          `  ← 🔴 **「발화 분모」가 아니다**(보강이 이미 적용된 뒤의 값 · 역산 불가)`,
      );
      console.log(
        `  🟢 ③ ∧ 설명문 품번 == 산출 품번   ${padL(String(codeAgrees), 4)} / ${singleCode.length}` +
          `  ← 보강이 «적용될 수 있는» 상한(출처는 제목/slug 일 수도 있어 단정 불가)`,
      );

      /** ── 8. Evidence quality 관측(CPO §8 · 점수화 금지 · 관측만) ────── */
      const lenBucket = (n: number) => (n === 0 ? "없음" : n < 120 ? "매우 짧음(<120)" : n < 2000 ? "정상(120~2k)" : "장문(≥2k)");
      const q = new Map<string, number>();
      for (const f of readable) {
        const k = lenBucket((f.description ?? "").length);
        q.set(k, (q.get(k) ?? 0) + 1);
      }
      const markup = readable.filter((f) => /<[a-z/][^>]*>/i.test(f.description ?? "")).length;
      console.log(`\n  [8] DESCRIPTION 품질 «관측»(새 점수/판정 규칙 0)`);
      for (const [k, v] of [...q.entries()].sort()) console.log(`     ${pad(k, 20)} ${padL(String(v), 4)}`);
      console.log(`     ${pad("🔴 markup 잔존", 20)} ${padL(String(markup), 4)}  (plainText 가 태그를 걷는지의 관측)`);

      const codeQ = { none: 0, single: 0, multi: 0 };
      for (const f of readable) {
        const n = codesIn(f.description).length;
        if (n === 0) codeQ.none += 1;
        else if (n === 1) codeQ.single += 1;
        else codeQ.multi += 1;
      }
      console.log(`\n  [8] MODEL_CODE(설명문 안) 품질 «관측»`);
      console.log(`     없음 ${codeQ.none} · 단일 ${codeQ.single} · 복수 ${codeQ.multi}`);

      /** ── 7. SPRINT-02 3건의 «대표성»(CPO §7) ────────────────────────── */
      const firedHosts = new Map<string, number>();
      for (const f of readable) {
        if (!f.brandModelCode && codesIn(f.description).length === 1) {
          const h = new URL(f.sourceUrl).hostname.replace(/^www\./, "");
          firedHosts.set(h, (firedHosts.get(h) ?? 0) + 1);
        }
      }
      console.log(`\n  [7] 보강이 발화하는 **호스트 분포** — 🔴 「tinyapple 3건」을 전체로 일반화하지 않기 위해 센다`);
      if (firedHosts.size === 0) console.log("     🔴 발화 호스트 0 — 이 분모에서는 대표성을 말할 수 없다");
      for (const [h, n] of [...firedHosts.entries()].sort((a, b) => b[1] - a[1])) console.log(`     ${pad(h, 32)} ${n}`);

      /** 🔴 **발화 단언** — 라이브가 열화되면 전건 0 이 나오고 그것을 사실로 적으면 안 된다. */
      expect(readable.length, "🔴 읽힌 facts 가 0 이면 측정불가다(열화)").toBeGreaterThan(0);
      console.log(`\n  🟢 HTTP ${urls.length} 회 · 읽힌 facts ${readable.length} · 운영 변경 0`);
    },
    15 * 60 * 1000,
  );
});
