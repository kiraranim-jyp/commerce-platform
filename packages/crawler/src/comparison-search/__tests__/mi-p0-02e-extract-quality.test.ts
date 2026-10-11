/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02e ① (CPO 지시, 2026-10-11) — **원본 Extract 가 «실제로» 무엇을 주는가.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 원본 3건을 실제로 받는다.
 * 🔴 **코드를 수정하지 않는다.** 이 파일은 관측만 한다(CPO 명시).
 *
 * ── 🔴 Extract owner 가 «둘» 이다. 섞지 않는다 ──────────────────────────────
 *
 *   ① `buildProductIdentityDna(CanonicalProduct)`   ← Master 배치 경로
 *      `run-domestic-price-check` 가 `input.dna` 로 받는 그것이다.
 *      🔴 **이번에 측정하지 않았다** — `CanonicalProduct` 를 DB 에서 읽어야 하고
 *         손으로 지어내면 그게 측정이 아니라 내 입력을 재는 것이 된다.
 *         사실로 적는다(아래 `notMeasured`).
 *
 *   ② `identityDnaFromFields({title,brand,sku,sourceUrl,color,material})`
 *      ← 실시간 화면 경로. `domestic-price-sources/search/route.ts:241` 이 쓴다.
 *      🔴 받는 칸이 **여섯** 뿐이다. category·image·audience·size 를 애초에
 *         받지 않으므로 그 축은 «빈 것이 정상» 이다 — 결함이 아니다.
 *
 *   ③ `factsFromProductUrl(url)`  ← Light Fetch(후보 쪽) owner. HTTP 만 쓴다.
 *      원본 URL 에도 그대로 통하므로, 「그 페이지가 실제로 주는 것」의 하한이다.
 *
 * 🔴 그래서 ②와 ③을 **같이** 재고 나란히 적는다. ②가 비었는데 ③이 값을 주면
 *    그것은 「페이지에 없다」가 아니라 **「화면 경로가 전달하지 않는다」** 다 —
 *    두 사실을 가르는 것이 이 측정의 목적이다.
 *
 * 🔴 **「값이 있다 = 성공」으로 세지 않는다**(CPO 명시). 네 상태로 가른다:
 *      PRESENT      값이 있다
 *      ABSENT       그 경로가 읽었고 값이 없다
 *      NOT_SUPPLIED 그 경로가 애초에 그 칸을 «받지 않는다»(결함이 아니다)
 *      SHAPE_GUESS  🔴 값이 있지만 «모양 추측» 으로 채워졌다(아래 참고)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { identityDnaFromFields } from "@commerce/shared";
import { factsFromProductUrl } from "../product-url-facts";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");

/** 🔴 전부 이 저장소의 실측 fixture / Production DB 근거가 있는 값이다. */
const JOBS = [
  {
    jobKey: "JOB-JE-MAINSTORY",
    title: "Bubble Sweatshirt in Grey Melange by Main Story",
    brand: "Main Story",
    sourceUrl: "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story",
    color: "Grey Melange",
    sku: undefined as string | undefined,
    knownBrandCode: "AW26MS185",
  },
  {
    jobKey: "JOB-BOBO-B226AC114",
    title: "Bobo Choses Bolder half zipped sweatshirt",
    brand: "Bobo Choses",
    sourceUrl: "https://bobochoses.com/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt",
    color: undefined,
    sku: undefined,
    knownBrandCode: "B226AC114",
  },
  {
    jobKey: "JOB-SMALLABLE-430632",
    title: "All About Monsters Washed T-shirt Organic cotton | Blue",
    brand: "Bobo Choses",
    sourceUrl:
      "https://www.smallable.com/en/product/all-about-monsters-washed-t-shirt-organic-cotton-blue-bobo-choses-430632",
    color: "Blue",
    // 🔴 Smallable «자체» 재고번호다. 브랜드 품번이 아니다(MI-P0-02c 실측).
    sku: "AAA1804532",
    knownBrandCode: null as string | null,
  },
] as const;

type State = "PRESENT" | "ABSENT" | "NOT_SUPPLIED" | "SHAPE_GUESS";

/** `identityDnaFromFields` 가 애초에 받지 않는 축. 🔴 비어도 결함이 아니다. */
const NOT_SUPPLIED_BY_FIELDS_PATH = new Set(["category", "representativeImageUrl", "imageUrls", "ageRange", "sizeRange", "audienceSignals"]);

describe.skipIf(!LIVE)("🔴 MI-P0-02e ① — 원본 Extract 실측(코드 수정 없음)", () => {
  it(
    "화면 경로 DNA 와 Light Fetch 를 나란히 재서 「없다」와 「전달 안 한다」를 가른다",
    async () => {
      const rows: Record<string, unknown>[] = [];

      for (const job of JOBS) {
        // ── ② 화면 경로 owner ──────────────────────────────────────────────
        const dna = identityDnaFromFields({
          title: job.title,
          brand: job.brand,
          sku: job.sku,
          sourceUrl: job.sourceUrl,
          color: job.color,
        });

        // ── ③ Light Fetch owner (HTTP) ────────────────────────────────────
        let light: Awaited<ReturnType<typeof factsFromProductUrl>> | null = null;
        let lightError: string | null = null;
        try {
          light = await factsFromProductUrl(job.sourceUrl);
        } catch (e) {
          lightError = e instanceof Error ? `${e.name}: ${e.message}` : "unknown";
        }
        /**
         * 🔴 `factsFromProductUrl` 은 `{status, crawlerUrl, dedupeKey, candidate,
         *    httpCalls, fetchPath}` 를 돌려주고 사실은 **`candidate.facts`** 에 있다.
         *    처음에 `light.facts` 로 읽어 전건 null 이 나왔고, 그것을 「Light Fetch 가
         *    못 준다」로 읽을 뻔했다 — 반환 모양을 확인하지 않고 칸 이름을 추측한
         *    내 결함이다([[measure-with-the-production-function]] ④ signature 확인).
         */
        const f = light?.candidate?.facts as Record<string, unknown> | undefined;

        const dnaState = (key: string, value: unknown): State => {
          if (NOT_SUPPLIED_BY_FIELDS_PATH.has(key)) return "NOT_SUPPLIED";
          if (value === null || value === undefined || value === "") return "ABSENT";
          if (Array.isArray(value) && value.length === 0) return "ABSENT";
          return "PRESENT";
        };

        /**
         * 🔴 **`brandModelCode` 는 「값이 있다」로 세면 안 된다.**
         *    `buildProductIdentityDna` 주석이 적어 뒀다 — 「sku 가 브랜드 품번
         *    «모양» 일 때만(영문+숫자 혼합) 여기 채운다」. 즉 그 칸은 모양 추측으로
         *    채워질 수 있고, Smallable 의 `AAA1804532` 는 영문+숫자다.
         *    🔴 그래서 「알려진 브랜드 품번과 같은가」를 같이 본다.
         */
        const bmc = dna.brandModelCode;
        const brandCodeState: State =
          bmc == null || bmc === ""
            ? "ABSENT"
            : job.knownBrandCode && bmc.toUpperCase() === job.knownBrandCode.toUpperCase()
              ? "PRESENT"
              : "SHAPE_GUESS";

        rows.push({
          jobKey: job.jobKey,
          sourceUrl: job.sourceUrl,
          knownBrandCode: job.knownBrandCode,
          /** ② 화면 경로 DNA — 축별 상태 */
          dna: {
            brand: { state: dnaState("brand", dna.brand.value), value: dna.brand.value, confident: dna.brand.confident },
            title: { state: dnaState("title", dna.title) },
            coreTitleTokens: { state: dnaState("coreTitleTokens", dna.coreTitleTokens), value: dna.coreTitleTokens },
            identifier: { state: dnaState("identifier", dna.identifier), value: dna.identifier },
            // 🔴 여기가 이 측정의 핵심 칸이다.
            brandModelCode: { state: brandCodeState, value: bmc },
            color: { state: dnaState("color", dna.color), value: dna.color },
            material: { state: dnaState("material", dna.material), value: dna.material },
            fit: { state: dnaState("fit", dna.fit), value: dna.fit },
            urlSlug: { state: dnaState("urlSlug", dna.urlSlug) },
            category: { state: dnaState("category", dna.category) },
            representativeImageUrl: { state: dnaState("representativeImageUrl", dna.representativeImageUrl) },
            imageUrls: { state: dnaState("imageUrls", dna.imageUrls), count: dna.imageUrls.length },
            ageRange: { state: dnaState("ageRange", dna.ageRange) },
            sizeRange: { state: dnaState("sizeRange", dna.sizeRange), count: dna.sizeRange.length },
            audienceSignals: { state: dnaState("audienceSignals", dna.audienceSignals), count: dna.audienceSignals.length },
          },
          /** ③ Light Fetch — 같은 URL 이 실제로 주는 것 */
          lightFetch: {
            error: lightError,
            status: light?.status ?? null,
            fetchPath: light?.fetchPath ?? null,
            httpCalls: light?.httpCalls ?? null,
            candidateTitle: light?.candidate?.title ?? null,
            candidatePrice: light?.candidate?.price ?? null,
            brand: f?.brand ?? null,
            title: f?.title ?? null,
            brandModelCode: f?.brandModelCode ?? null,
            sellerSku: f?.sellerSku ?? null,
            colorText: f?.colorText ?? null,
            material: f?.material ?? null,
            category: f?.category ?? null,
            imageCount: Array.isArray(f?.imageUrls) ? (f!.imageUrls as unknown[]).length : null,
            sizeRange: f?.sizeRange ?? null,
          },
        });

        const d = rows[rows.length - 1].dna as Record<string, { state: State }>;
        // eslint-disable-next-line no-console
        console.log(
          `${job.jobKey}\n` +
            `   DNA(화면경로)  brandCode=${d.brandModelCode.state}(${String(bmc)}) color=${d.color.state} material=${d.material.state} category=${d.category.state} images=${d.imageUrls.state}\n` +
            `   LightFetch     brandCode=${String(f?.brandModelCode ?? null)} sellerSku=${String(f?.sellerSku ?? null)} color=${String(f?.colorText ?? null)} images=${Array.isArray(f?.imageUrls) ? (f!.imageUrls as unknown[]).length : null}${lightError ? ` err=${lightError}` : ""}`,
        );
      }

      const report = {
        notMeasured: [
          "🔴 buildProductIdentityDna(CanonicalProduct) — Master 배치 경로. DB 가 필요해 재지 않았다.",
          "🔴 universalExtract(브라우저 경로) — 재지 않았다.",
          "→ 그래서 아래 숫자는 «화면 경로 + Light Fetch» 의 것이고, Master 경로보다 «적을» 수 있다.",
        ],
        stateVocabulary: {
          PRESENT: "값이 있고 알려진 사실과 맞는다",
          ABSENT: "그 경로가 읽었고 값이 없다",
          NOT_SUPPLIED: "그 경로가 애초에 그 칸을 받지 않는다 — 결함이 아니다",
          SHAPE_GUESS: "🔴 값이 있지만 모양 추측으로 채워졌다 — 알려진 브랜드 품번과 다르다",
        },
        rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mi-p0-02e-extract-quality.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ notMeasured: report.notMeasured }, null, 2));

      // 🔴 결과 방향을 단언하지 «않는다». 3건을 실제로 쟀다는 것만 단언한다.
      expect(rows).toHaveLength(3);
    },
    20 * 60 * 1000,
  );
});
