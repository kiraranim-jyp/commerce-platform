import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import type { ComparisonCandidate, ComparisonQuery, MatchTruth } from "@commerce/crawler";

/**
 * MATCHING-FIX-01 Phase C/E(CEO 지시, 2026-09-16) — **저장 경로 회귀**.
 *
 * ══ 왜 이 파일이 생겼나 ══════════════════════════════════════════════════════
 * CEO 감사가 찾아낸 구멍: "저장 경로 회귀 테스트가 **없다**. B226AC042 ↔
 * B226AC043 conflict 보호(model-code.ts:75-82)가 실제 DB 에서 TEXT_CONFIRMED
 * 1.00 으로 4행 살아 있는 것을 아무 테스트도 못 잡았다."
 *
 * 판정기 단위 테스트는 그 보호가 «살아 있다»고 말한다(cross-seller-matching.test.ts).
 * 그런데 DB 에는 그 쌍이 TEXT_CONFIRMED 로 남아 있었다 — 두 문장이 동시에 참일 수
 * 있는 이유는 **판정기에 그 품번이 도달하지 못하면** 같은 보호가 발화하지 않기
 * 때문이다. 즉 이 파일이 재는 것은 「규칙이 옳은가」가 아니라
 * **「규칙이 저장되는 그 행까지 실제로 닿는가」**다.
 *
 * ══ 무엇을 진짜로 돌리는가 ═══════════════════════════════════════════════════
 * runDomesticPriceCheck(DB 에 링크를 남기는 유일한 경로)를 그대로 돌린다. 바깥
 * 경계 셋만 바꿔 끼운다 — 편집샵 검색 응답 · 가격 재조회 · 저장소.
 * matching-2.0-integration.test.ts 와 같은 방식, 같은 실측 픽스처다.
 */

const WORKSPACE_ID = "11111111-1111-1111-1111-111111111111";
const SNAPSHOT_ID = "0767b19b-0000-0000-0000-0000000000bb";
const BOBO_DOMAIN = "bobochoses.com";
const BOBO_KRW = 168000;

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../../../../packages/crawler/src/__tests__/fixtures",
);

interface StoredLink {
  id: string;
  snapshotId: string;
  sourceId: string;
  externalUrl: string;
  externalProductId: string | null;
  matchedBrand: string | null;
  matchedTitle: string | null;
  matchedModelName: string | null;
  matchedColor: string | null;
  matchType: string;
  matchConfidence: number;
  matchTruth: MatchTruth | null;
  matchReasons: string[];
  verified: boolean;
  status: "ACTIVE" | "PAUSED" | "BROKEN_LINK";
  updatedAt: string;
}

const hoisted = vi.hoisted(() => ({
  queries: [] as ComparisonQuery[],
  candidatesForSearch: [] as ComparisonCandidate[],
  storedLinks: [] as StoredLink[],
  observationBatches: [] as Array<Array<Record<string, unknown>>>,
  listDomesticPriceSources: vi.fn(),
  recordDomesticSourceCheckAttempt: vi.fn(),
}));

vi.mock("@commerce/crawler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@commerce/crawler")>();
  return {
    ...actual,
    // 검색 «응답»만 가짜다. 점수도 판정도 운영 함수가 그 자리에서 계산한다.
    searchDomesticShops: vi.fn(async (query: ComparisonQuery) => {
      hoisted.queries.push(query);
      return [
        {
          shopId: "bobo-kr",
          shopName: "Bobo Choses 공식몰",
          domain: BOBO_DOMAIN,
          status: "ok" as const,
          candidates: actual.withConfidence(query, hoisted.candidatesForSearch),
        },
      ];
    }),
    refreshDomesticProductPrice: vi.fn(async () => ({
      status: "OK" as const,
      price: { amount: BOBO_KRW, currency: "KRW" },
      salePriceKrw: null,
      originalPriceKrw: null,
      soldOut: false,
    })),
  };
});

vi.mock("../../../domestic-price-sources/_lib/domestic-price-source", () => ({
  listDomesticPriceSources: hoisted.listDomesticPriceSources,
  recordDomesticSourceCheckAttempt: hoisted.recordDomesticSourceCheckAttempt,
}));

vi.mock("../../../domestic-price-sources/_lib/domestic-product-link", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../domestic-price-sources/_lib/domestic-product-link")>();
  return {
    ...actual,
    upsertDomesticProductLink: vi.fn(async (input: Record<string, unknown>) => {
      const link: StoredLink = {
        id: `${input.snapshotId}:${input.sourceId}`,
        snapshotId: input.snapshotId as string,
        sourceId: input.sourceId as string,
        externalUrl: input.externalUrl as string,
        externalProductId: (input.externalProductId as string) ?? null,
        matchedBrand: (input.matchedBrand as string) ?? null,
        matchedTitle: (input.matchedTitle as string) ?? null,
        matchedModelName: (input.matchedModelName as string) ?? null,
        matchedColor: (input.matchedColor as string) ?? null,
        matchType: input.matchType as string,
        matchConfidence: input.matchConfidence as number,
        matchTruth: (input.matchTruth as MatchTruth) ?? null,
        matchReasons: (input.matchReasons as string[]) ?? [],
        verified: input.verified as boolean,
        status: "ACTIVE",
        updatedAt: "2026-09-16T00:00:00.000Z",
      };
      const existing = hoisted.storedLinks.findIndex((l) => l.id === link.id);
      if (existing >= 0) hoisted.storedLinks[existing] = link;
      else hoisted.storedLinks.push(link);
      return { ok: true as const, link: link as never };
    }),
    listDomesticProductLinks: vi.fn(async (snapshotId: string) =>
      hoisted.storedLinks.filter((l) => l.snapshotId === snapshotId),
    ),
  };
});

vi.mock("../price-observations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../price-observations")>();
  return {
    ...actual,
    hasObservationToday: vi.fn(async () => false),
    recordPriceObservations: vi.fn(async (observations: Array<Record<string, unknown>>) => {
      if (observations.length > 0) hoisted.observationBatches.push(observations);
      return { ok: true as const, count: observations.length };
    }),
  };
});

const { runDomesticPriceCheck } = await import("../run-domestic-price-check");
const { priceTierFromLink } = await import("../../../domestic-price-sources/_lib/domestic-product-link");
const { MATCH_JUDGE_VERSION, describeVerification, readMatchProvenance, verificationPhrase } = await import(
  "../../../domestic-price-sources/_lib/match-provenance"
);
const { productFactsFromShopifyProduct, productFactsFromSmallableHtml } = await import(
  "@commerce/crawler/src/comparison-search/seller-facts"
);
const { buildProductIdentityDna } = await import("@commerce/shared");

/* ─────────────────────────── 실측 픽스처 → 입력 ─────────────────────────── */

interface BoboFixture {
  title: string;
  handle: string;
  url: string;
  description: string;
  vendor: string;
  type: string;
  tags: string[];
  options: { name?: string; values?: string[] }[];
}

function boboFixture(code: string): BoboFixture {
  return JSON.parse(readFileSync(path.join(FIXTURES, `bobochoses-${code.toLowerCase()}.json`), "utf8")) as BoboFixture;
}

const field = <T,>(value: T, source: "ORIGINAL" | "USER_EDITED" = "ORIGINAL") => ({
  value,
  source,
  confidence: source === "USER_EDITED" ? 1 : 0.9,
});

/** 등록상품(Bobo 공식몰). 공식몰 URL 앞머리에 브랜드 품번이 그대로 들어 있어
 *  resolveBrandModelCode 가 그 조각을 읽는다 — 그게 이 테스트의 출발점이다. */
function boboProduct(code: string, opts?: { colorSource?: "ORIGINAL" | "USER_EDITED"; color?: string }): CanonicalProduct {
  const p = boboFixture(code);
  return {
    sourceUrl: `https://${BOBO_DOMAIN}${p.url}`,
    title: field(p.title),
    brand: field("Bobo Choses"),
    sku: field(""),
    modelName: field(""),
    color: field(opts?.color ?? "", opts?.colorSource ?? "ORIGINAL"),
    material: field(""),
    description: field(p.description.replace(/<[^>]+>/g, " ")),
    recommendedAge: field(""),
    images: [],
    optionGroups: p.options.map((o) => ({ name: o.name ?? "Size", values: o.values ?? [] })),
    breadcrumbPath: [p.type, ...p.tags],
  } as unknown as CanonicalProduct;
}

function boboCandidate(code: string): ComparisonCandidate {
  const p = boboFixture(code);
  return {
    title: p.title,
    url: `https://${BOBO_DOMAIN}${p.url}`,
    price: { amount: BOBO_KRW, currency: "KRW" },
    imageUrl: null,
    confidence: 0,
    priceSource: "detail",
    facts: productFactsFromShopifyProduct(
      {
        title: p.title,
        handle: p.handle,
        url: p.url,
        body: p.description,
        vendor: p.vendor,
        type: p.type,
        tags: p.tags,
        options: p.options,
      },
      BOBO_DOMAIN,
    ),
  };
}

function smallableProduct(file: string, productId: string): CanonicalProduct {
  const html = readFileSync(path.join(FIXTURES, file), "utf8");
  const facts = productFactsFromSmallableHtml(html, productId);
  if (!facts) throw new Error(`smallable 픽스처를 읽지 못했다: ${file}`);
  return {
    sourceUrl: facts.sourceUrl,
    title: field(facts.title),
    brand: field(facts.brand ?? ""),
    sku: field(facts.sellerSku ?? ""),
    modelName: field(""),
    color: field(facts.colorText ?? ""),
    material: field(""),
    description: field(facts.materialText ?? ""),
    recommendedAge: field(""),
    images: [],
    optionGroups: [{ name: "Size", values: facts.sizeLabels }],
    breadcrumbPath: facts.audienceSignals,
  } as unknown as CanonicalProduct;
}

function boboSource() {
  return {
    id: "bobo-kr",
    name: "Bobo Choses 공식몰",
    domain: BOBO_DOMAIN,
    url: `https://${BOBO_DOMAIN}`,
    currency: "KRW",
    categoryScope: [] as string[],
    priority: "P0" as const,
    collectionStrategy: "AUTO_API" as const,
    status: "ACTIVE" as const,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastCheckedAt: null,
    lastSuccessAt: null,
    source: "SYSTEM" as const,
    sourceType: "VERTICAL" as const,
    enabled: true,
    catalogEnabled: true,
    workspaceEnabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

async function runCheck(product: CanonicalProduct) {
  return runDomesticPriceCheck({
    snapshotId: SNAPSHOT_ID,
    workspaceId: WORKSPACE_ID,
    dna: buildProductIdentityDna(product),
    description: product.description?.value || undefined,
  });
}

beforeEach(() => {
  hoisted.queries.length = 0;
  hoisted.storedLinks.length = 0;
  hoisted.observationBatches.length = 0;
  hoisted.candidatesForSearch = [];
  hoisted.listDomesticPriceSources.mockReset();
  hoisted.recordDomesticSourceCheckAttempt.mockReset();
  hoisted.listDomesticPriceSources.mockResolvedValue([boboSource()]);
  hoisted.recordDomesticSourceCheckAttempt.mockResolvedValue(undefined);
});

/* ═════════ ① 🔴 저장 경로 회귀 — 품번 충돌 보호가 DB 행까지 닿는가 ═════════ */

describe("MATCHING-FIX-01 ①: B226AC042 ↔ B226AC043 이 저장까지 가면 어떻게 되나", () => {
  /**
   * 🔴 감사가 지적한 그 자리. 이 쌍은 제목이 글자 하나까지 같고 색상이 제목에
   * 없어서 텍스트로는 원리상 구분되지 않는다 — 품번만이 판별 근거다.
   */
  it("등록상품이 B226AC043 이고 검색이 B226AC042 를 물어오면, 링크 자체가 생기지 않는다", async () => {
    hoisted.candidatesForSearch = [boboCandidate("B226AC042")];
    const result = await runCheck(boboProduct("B226AC043"));

    // 어느 쪽이든 «동일상품 가격»에 들어가면 안 된다. 두 가지 중 하나여야 한다:
    //   ① 링크가 아예 안 생긴다(NOT_MATCHED)  ② 생기되 EXCLUDED 티어다
    if (result.linksCreatedOrUpdated === 0) {
      expect(hoisted.storedLinks).toHaveLength(0);
    } else {
      const link = hoisted.storedLinks[0]!;
      expect(link.matchTruth).toBe("CONFLICT");
      expect(priceTierFromLink(link)).toBe("EXCLUDED");
    }
    // 어느 경우든 이 가격은 관측으로도 저장되지 않는다.
    expect(result.pricesRecorded).toBe(0);
  });

  /**
   * 🔴 위 결과가 «우연히» 그런 게 아니라는 것. 같은 상품 자신이 후보로 오면
   * 링크가 생기고 동일상품 가격에 들어간다 — 즉 이 파이프라인은 살아 있고,
   * 위에서 막힌 것은 품번 충돌 때문이다(역방향 증명).
   */
  it("역: 같은 상품(B226AC043) 자신이 오면 링크가 생기고 EXACT 로 저장된다", async () => {
    hoisted.candidatesForSearch = [boboCandidate("B226AC043")];
    const result = await runCheck(boboProduct("B226AC043"));

    expect(result.linksCreatedOrUpdated).toBe(1);
    const link = hoisted.storedLinks[0]!;
    expect(link.matchTruth).toBe("EXACT_IDENTIFIER");
    expect(priceTierFromLink(link)).toBe("EXACT");
    expect(result.pricesRecorded).toBe(1);
  });

  /**
   * 🔴 그런데 «TEXT_CONFIRMED 1.00 이 DB 에 4행 남아 있었다»는 감사 사실은
   * 이 코드가 아니라 그 시점의 코드가 만든 것이다. 그 경로를 재현해 둔다:
   * 해외측 품번을 읽지 못하면(설명문에도 URL 앞머리에도 없다) compareModelCode 가
   * "unavailable" 이 되고, 텍스트가 very_high 면 그대로 TEXT_CONFIRMED 다.
   * 품번 충돌 보호는 «틀리지 않았다» — 비교할 품번이 없었을 뿐이다.
   */
  it("🔴 품번을 읽지 못하는 등록상품이면 같은 쌍이 TEXT_CONFIRMED 로 남는다", async () => {
    const product = boboProduct("B226AC043");
    // 설명문에서 품번을 지우고 URL 도 품번이 없는 모양으로 바꾼다(= 그 시점 데이터).
    const blind = {
      ...product,
      sourceUrl: `https://${BOBO_DOMAIN}/products/mystery-bc-half-zipped-sweatshirt`,
      description: field(""),
    } as unknown as CanonicalProduct;

    hoisted.candidatesForSearch = [boboCandidate("B226AC042")];
    await runCheck(blind);

    const link = hoisted.storedLinks[0];
    if (link) {
      expect(link.matchTruth).not.toBe("CONFLICT");
      // ← 여기가 감사가 DB 에서 본 그 모양이다. 보호가 죽은 게 아니라 닿지 못했다.
      expect(["TEXT_CONFIRMED", "SIMILAR", "STRONG_IDENTIFIER", "INSUFFICIENT_EVIDENCE"]).toContain(link.matchTruth);
    }
    // 이 테스트가 고정하는 것은 값이 아니라 «원인»이다 — 등록상품에서 품번을
    // 읽어내지 못하면 품번 축 자체가 없다.
    expect(buildProductIdentityDna(blind).brandModelCode).toBeNull();
    expect(buildProductIdentityDna(product).brandModelCode).not.toBeNull();
  });
});

/* ═════════ ② Phase C — 판정 근거가 실제로 저장되는가 ═════════ */

describe("MATCHING-FIX-01 ②: 매칭 근거가 링크 행에 적힌다", () => {
  it("matched_model_name · matched_color · external_product_id 가 더 이상 null 이 아니다", async () => {
    hoisted.candidatesForSearch = [boboCandidate("B226AC114")];
    await runCheck(smallableProduct("smallable-430701-product.html", "430701"));

    const link = hoisted.storedLinks[0]!;
    // 🔴 세 칸 모두 «판정에 쓴 값»이다. 지어낸 값이 아니다.
    expect(link.matchedModelName).toBe("B226AC114");
    expect(link.matchedColor).toBeTruthy();
    expect(link.externalProductId).toContain("b226ac114");
    // 기존 두 칸은 손대지 않았다(회귀 없음). matched_brand 는 예전처럼 후보의
    // brand 칸을 그대로 옮긴다 — 이 픽스처는 그 칸이 비어 있어 null 이 정답이다
    // (없는 값을 facts.brand 로 «대신 채우지» 않았다. 그건 이번 범위가 아니다).
    expect(link.matchedTitle).toBe(hoisted.candidatesForSearch[0]!.title);
    expect(link.matchedBrand).toBeNull();
  });

  it("판정방법과 판정기 버전이 근거에 남는다 — 판정 값 자체는 그대로다", async () => {
    hoisted.candidatesForSearch = [boboCandidate("B226AC114")];
    await runCheck(smallableProduct("smallable-430701-product.html", "430701"));

    const link = hoisted.storedLinks[0]!;
    // 판정 결과는 MATCHING-2.0-INTEGRATION-1 이 고정한 값 그대로여야 한다.
    expect(link.matchTruth).toBe("STRONG_IDENTIFIER");
    expect(link.verified).toBe(true);
    expect(priceTierFromLink(link)).toBe("EXACT");

    const provenance = readMatchProvenance(link);
    expect(provenance.judgeVersion).toBe(MATCH_JUDGE_VERSION);
    // 품번을 맞춰볼 수 없던 쌍이므로 «품번 일치»라고 적으면 거짓말이다.
    expect(provenance.method).toBe("CROSS_SELLER_AXES");
    expect(provenance.stale).toBe(false);
    // 판정에 들어간 입력이 전부 읽힌다(나중에 이 행을 다시 추측하지 않게).
    expect(link.matchReasons.some((r) => r.includes("품번증거=unavailable"))).toBe(true);
    expect(link.matchReasons.some((r) => r.includes("교차판매처=SAME"))).toBe(true);
  });

  /**
   * 🔴 CEO P1 — "DB 판정이 코드보다 4일 낡았다는 사실을 숨기지 마라."
   * backfill 은 하지 않는다. 대신 판정기 줄이 없는 행은 STALE 로 «보인다».
   */
  it("판정기 줄이 없는 과거 행은 STALE 로 구분된다 — 값을 고치지 않는다", () => {
    const legacy = { matchReasons: ["상품명 유사도 92%", "브랜드 일치"] };
    expect(readMatchProvenance(legacy).judgeVersion).toBeNull();
    expect(readMatchProvenance(legacy).method).toBeNull();
    expect(readMatchProvenance(legacy).stale).toBe(true);
  });
});

/* ═════════ ③ Phase D — verified 의 뜻을 셋으로 가른다 ═════════ */

describe("MATCHING-FIX-01 ③: verified 가 «사람의 확인»처럼 보이지 않는다", () => {
  it("엔진이 자동 확정한 행은 «사람 확인 없음»이라고 말한다", async () => {
    hoisted.candidatesForSearch = [boboCandidate("B226AC114")];
    await runCheck(smallableProduct("smallable-430701-product.html", "430701"));

    const link = hoisted.storedLinks[0]!;
    const standing = describeVerification(link);
    expect(link.verified).toBe(true); // DB 값은 그대로다
    expect(standing.autoDecided).toBe(true);
    expect(standing.identifierBacked).toBe(false); // 품번 근거가 아니었다
    expect(standing.humanConfirmed).toBe(false);
    expect(standing.humanConfirmedKnown).toBe(true); // 이 판정기가 저장한 행이라 «없다»가 사실이다

    const phrase = verificationPhrase(standing);
    expect(phrase).toContain("엔진 자동 판정");
    expect(phrase).toContain("사람 확인 없음");
    expect(phrase).not.toContain("사람이 확인함");
  });

  it("품번 근거로 확정된 행과 아닌 행을 구분해서 말한다", async () => {
    hoisted.candidatesForSearch = [boboCandidate("B226AC043")];
    await runCheck(boboProduct("B226AC043"));

    const standing = describeVerification(hoisted.storedLinks[0]!);
    expect(standing.autoDecided).toBe(true);
    expect(standing.identifierBacked).toBe(true);
    expect(verificationPhrase(standing)).toContain("품번 근거");
    expect(verificationPhrase(standing)).not.toContain("사람이 확인함");
  });

  it("옛 행은 «사람 확인 여부 기록 없음»이라고 말한다 — 없다고 단정하지 않는다", () => {
    const legacy = { matchReasons: ["브랜드 일치"], verified: true, matchTruth: "TEXT_CONFIRMED" as MatchTruth };
    const standing = describeVerification(legacy);
    expect(standing.humanConfirmed).toBe(false);
    expect(standing.humanConfirmedKnown).toBe(false);
    expect(verificationPhrase(standing)).toContain("기록 없음");
  });

  it("사람 승인 기록이 있으면 그때만 «사람이 확인함»이라고 말한다", () => {
    const confirmed = {
      matchReasons: ["브랜드 일치", "사람 확인: 관리자가 화면에서 직접 승인함 (2026-09-16T00:00:00.000Z)"],
      verified: true,
      matchTruth: "TEXT_CONFIRMED" as MatchTruth,
    };
    const standing = describeVerification(confirmed);
    expect(standing.humanConfirmed).toBe(true);
    expect(standing.humanConfirmedKnown).toBe(true);
    expect(verificationPhrase(standing)).toBe("사람이 확인함");
  });
});

/* ═════════ ④ USER_EDITED — 셀러가 고친 값이 저장 경로까지 간다 ═════════ */

describe("MATCHING-FIX-01 ④: 셀러가 고친 값(USER_EDITED)이 저장 경로 판정에 쓰인다", () => {
  it("색을 USER_EDITED 로 고치면 그 값이 DNA → 질의 → 판정까지 그대로 간다", async () => {
    hoisted.candidatesForSearch = [boboCandidate("B226AC114")];
    await runCheck(boboProduct("B226AC114", { colorSource: "USER_EDITED", color: "Heather grey" }));

    // 🔴 buildProductIdentityDna 는 .source 를 보지 않는다 — 셀러가 고친 값도
    //    크롤러가 읽어온 값과 «완전히 같은 취급»을 받는다. 그 사실을 질의에서 본다.
    expect(hoisted.queries[0]!.facts!.colorText).toBe("Heather grey");
    const link = hoisted.storedLinks[0]!;
    expect(link.matchedColor).toBeTruthy();
    expect(priceTierFromLink(link)).toBe("EXACT");
  });
});
