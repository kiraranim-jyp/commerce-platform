/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 IDENTITY-GT-EVIDENCE-MASTER-REVIEW-01 Step 4 — **필드 지도 + 분류 전용 reader**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴🔴 **이 파일은 «분류 전용» 이다. 운영 Identity 에 절대 들어가지 않는다.**
 *    여기 있는 reader 들은 「사이트가 그 필드를 **말하는가**」만 판정한다 —
 *    그 값이 `ProductFacts` 로 들어가거나 비교 축이 되는 경로는 **없다**.
 *    🔴 계약이 그 경계를 잠근다(운영 파일이 이 모듈을 import 하면 FAIL).
 *
 * ── 🔴 왜 reader 를 따로 두는가 ────────────────────────────────────────────
 * Step 4 의 질문은 「`null` 이 **사이트에 없어서** 인가 **못 가져와서** 인가」다.
 * 운영 추출기만으로는 그 둘을 **가를 수 없다**(둘 다 `null` 이다).
 * 🔴 그래서 원문을 다시 읽는데, **운영 추출기를 고치는 것이 아니다** —
 *    고치면 그것이 CPO §7 이 금지한 「새 점수축 추가」가 된다.
 *
 * ── 🔴🔴 실측된 구조 — 「조사 필드」와 「수집 칸」은 1:1 이 아니다 ──────────
 * ```
 * EvidenceSource          = TITLE | DESCRIPTION | IMAGE   🔴 **구조화 데이터가 없다**
 * IDENTITY_EVIDENCE_AXES  = BRAND · MODEL_CODE · PRODUCT_NAME · FORM · COLOR · MATERIAL
 * PROBE_EVIDENCE_AXES     = FIT · COMPOSITION · SET · OPTION_SKU · IMAGE
 *                           🔴 「추출했다고 matcher axis 로 승격하지 않는다」(그 파일 주석)
 * ```
 * 🔴🔴 **그러나 `evidence` 축과 `ProductFacts` 칸은 «다른 owner» 다** — 이름이 같아서
 *    혼동하기 쉽다. `ProductEvidence["FIT"]` 은 관측 전용이지만
 *    **`ProductFacts.fitText` 는 `compareFit`(cross-seller.ts:673)이 읽어 blocker `FIT`
 *    을 낸다**. ⟹ Step 3 의 `SAME-FN blockers: FIT 4` 는 **계약 위반이 아니다**.
 *
 * 🔴 **Season · Collection 은 `ProductFacts` 에 칸이 없고 evidence 축에도 없다**
 *    ⟹ 사이트에 있어도 **구조적으로 `A` 가 될 수 없다**(= `B` 로 떨어진다).
 *    🟢 그것이 「crawler missing ↔ site missing」을 가르라는 CPO §6-⑦ 의 답 재료다.
 */

/* ─────────────────────── 조사 필드 ↔ 수집 칸 지도 ─────────────────────── */

/** 🔴 CPO §1 의 조사 필드. 🔴 이름을 추측하지 않았다 — 운영 타입에서 읽었다. */
export type Step4Field =
  | "brand"
  | "modelCode"
  | "title"
  | "description"
  | "category"
  | "color"
  | "material"
  | "composition"
  | "fit"
  | "size"
  | "age"
  | "audience"
  | "season"
  | "collection"
  | "sellerSku"
  | "image"
  | "price";

export interface FieldMapEntry {
  field: Step4Field;
  /** `ProductFacts` 의 실제 칸. 🔴 `null` 이면 **수집 칸이 아예 없다**. */
  factsKey: string | null;
  /** 그 값이 **비교(판정)에 들어가는가**. */
  comparedBy: string | null;
  note: string;
}

/**
 * 🔴🔴 이 표가 Step 4 의 전제다. 🔴 `factsKey: null` 인 필드는 **A 가 불가능** 하다 —
 *    그 사실을 모르고 「사이트에 없다(C)」로 적으면 CPO §2 의 그 금지를 어긴다.
 */
export const FIELD_MAP: readonly FieldMapEntry[] = [
  { field: "brand", factsKey: "brand", comparedBy: "compareBrand(BRAND_*)", note: "🟢 판정 입력" },
  { field: "modelCode", factsKey: "brandModelCode", comparedBy: "compareModelCode(MODEL_CODE*)", note: "🟢 판정 입력 · 삼중 잠금" },
  { field: "title", factsKey: "title / coreTitleTokens", comparedBy: "제목 겹침(NO_TITLE_OVERLAP)", note: "🟢 판정 입력" },
  { field: "description", factsKey: "description", comparedBy: null, note: "🟡 evidence 출처로만 쓰인다(판정 입력 아님)" },
  { field: "category", factsKey: "categoryText", comparedBy: "GARMENT_FORM", note: "🟢 판정 입력" },
  { field: "color", factsKey: "colorText", comparedBy: "compareColor(COLOR*)", note: "🔴 제목 화이트리스트 유래(WU-064)" },
  { field: "material", factsKey: "materialText", comparedBy: "compareMaterial(MATERIAL)", note: "🟢 판정 입력" },
  { field: "composition", factsKey: null, comparedBy: "COMPOSITION conflict", note: "🔴 **저장 칸 없음** — 제목에서 즉석 추출(COMPOSITION_PATTERN)" },
  { field: "fit", factsKey: "fitText", comparedBy: "compareFit(FIT)", note: "🔴 evidence 축은 관측 전용인데 **이 칸은 비교된다**" },
  { field: "size", factsKey: "sizeLabels", comparedBy: "SIZE_SYSTEM(비차단)", note: "🟡 단독으로 SAME 을 막지 않는다(WU-045)" },
  { field: "age", factsKey: "ageRangeText", comparedBy: "AGE / AUDIENCE_LINE", note: "🟢 판정 입력" },
  { field: "audience", factsKey: "audienceSignals", comparedBy: "AUDIENCE_LINE", note: "🟢 판정 입력" },
  { field: "season", factsKey: null, comparedBy: null, note: "🔴🔴 **칸도 축도 없다** — A 불가(사이트에 있으면 B)" },
  { field: "collection", factsKey: null, comparedBy: null, note: "🔴🔴 **칸도 축도 없다** — A 불가(사이트에 있으면 B)" },
  { field: "sellerSku", factsKey: "sellerSku", comparedBy: "sameSellerDistinctListing 등", note: "🟡 식별자로 승격되는 경로가 따로 있다" },
  { field: "image", factsKey: "imageUrls", comparedBy: null, note: "🔴 관측 전용(IMAGE 축 · 비교 입력 아님)" },
  { field: "price", factsKey: "(candidate.price — facts 밖)", comparedBy: "가격 축(판정 아님)", note: "🔴 Identity 판정 입력이 **아니다**" },
] as const;

/* ───────────────────────── A/B/C/D 상태 ───────────────────────── */

export type EvidenceState =
  /** 사이트에 있고 운영이 **수집했다**. */
  | "A_PRESENT_AND_COLLECTED"
  /** 🔴 사이트에는 **있는데** 운영이 못 가져왔다. */
  | "B_PRESENT_BUT_NOT_COLLECTED"
  /** 상품 페이지를 **확인했고** 그 필드가 사이트에 없다. */
  | "C_NOT_PRESENT_ON_SITE"
  /** 🔴 페이지 접근/구조 문제로 **존재 여부 자체를 확인할 수 없다**(0 이 아니다). */
  | "D_UNAVAILABLE_TO_CRAWLER";

/* ─────────────── 분류 전용 site-presence reader (구조화 우선) ─────────────── */

const lower = (s: string) => s.toLowerCase();

/** JSON-LD 블록 전수를 꺼낸다. 🔴 파싱 실패는 **무시하지 않고 건너뛴다**(세면 거짓이 된다). */
export function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      /* 🔴 깨진 블록은 «없는 것» 으로 두지 않고 그냥 넘긴다 — 아래에서 D 로 잡힌다 */
    }
  }
  return out;
}

/** JSON-LD 그래프를 평탄화해 `@type` 이 Product 인 노드만 돌려준다. */
export function jsonLdProducts(html: string): Record<string, unknown>[] {
  const flat: Record<string, unknown>[] = [];
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    const t = o["@type"];
    const types = Array.isArray(t) ? t.map(String) : t ? [String(t)] : [];
    if (types.some((x) => lower(x) === "product")) flat.push(o);
    if (o["@graph"]) walk(o["@graph"]);
  };
  jsonLdBlocks(html).forEach(walk);
  return flat;
}

const metaContent = (html: string, re: RegExp): string | null => {
  const m = re.exec(html);
  return m ? m[1].trim() || null : null;
};

/** `<meta property="og:x" content="...">` 과 역순 속성 둘 다 본다. */
export function ogValue(html: string, prop: string): string | null {
  const p = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    metaContent(html, new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']*)["']`, "i")) ??
    metaContent(html, new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${p}["']`, "i"))
  );
}

/** microdata `itemprop` 값(content 속성 또는 태그 본문). */
export function microValue(html: string, prop: string): string | null {
  const p = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    metaContent(html, new RegExp(`itemprop=["']${p}["'][^>]*content=["']([^"']*)["']`, "i")) ??
    metaContent(html, new RegExp(`itemprop=["']${p}["'][^>]*>([^<]{1,160})<`, "i"))
  );
}

/**
 * 🔴 **텍스트 패턴은 구조화 데이터가 «없을 때만» 쓴다.** 그리고 쓸 때는
 *    「어느 패턴이 맞았는지」를 같이 돌려준다 — 그러지 않으면 B 가 왜 B 인지 못 적는다.
 */
export const TEXT_PATTERNS: Record<string, RegExp> = {
  /** 「100% cotton」 「cotton 95% elastane 5%」 「면 100%」 */
  composition: /(\d{1,3}\s*%\s*[a-z가-힣]{3,20}|[a-z가-힣]{3,20}\s*\d{1,3}\s*%)/i,
  /** 「3-4Y」 「24M」 「2-3 years」 「12-18 months」 */
  age: /(\b\d{1,2}\s*-\s*\d{1,2}\s*(y|yr|years?|m|months?)\b|\b\d{1,2}\s*(y|yr|years?|m|months?)\b)/i,
  /** 「AW26」 「SS25」 「FW24」 — 🔴 품번 접두와 겹칠 수 있어 단어 경계를 요구한다 */
  season: /\b(aw|ss|fw|pe)\s?\d{2}\b/i,
  /** 「regular fit」 「oversized」 「slim」 「relaxed」 */
  fit: /\b(regular fit|oversized|slim fit|relaxed fit|loose fit|straight fit|boxy)\b/i,
  /** 「kids」 「baby」 「woman」 「newborn」 */
  audience: /\b(kids?|baby|babies|newborn|toddler|woman|women|men|unisex|주니어|아동|유아|여성|남성)\b/i,
};

export interface SitePresence {
  present: boolean;
  /** 🔴 **무엇이 그것을 증명했는가.** 비어 있으면 `present` 를 true 로 적지 않는다. */
  via: string | null;
}

const hit = (v: unknown, via: string): SitePresence | null => {
  if (v == null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  if (Array.isArray(v) && v.length === 0) return null;
  if (typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const name = o.name ?? o["@id"] ?? o.value;
    if (name == null || String(name).trim() === "") return null;
  }
  return { present: true, via };
};

export interface RawPage {
  /** Shopify `/products/{handle}.json` 본문(있으면). */
  shopify: Record<string, unknown> | null;
  /** HTML 본문(있으면). */
  html: string | null;
  /** 🔴 둘 다 없으면 **전 필드 D** 다. */
  reachable: boolean;
  note: string;
}

/**
 * 🔴🔴 필드별 **사이트 존재 여부**. 🔴 모르면 `present:false` 가 아니라 `via:null` 로
 *    돌려주고 **호출부가 `C` 와 `D` 를 가른다**(여기서 단정하지 않는다).
 */
export function sitePresence(field: Step4Field, page: RawPage): SitePresence {
  if (!page.reachable) return { present: false, via: null };
  const sp = page.shopify ?? {};
  const html = page.html ?? "";
  const ld = html ? jsonLdProducts(html) : [];
  const ldFirst = (k: string) => {
    for (const p of ld) if (p[k] != null) return p[k];
    return null;
  };
  const variants = Array.isArray(sp.variants) ? (sp.variants as Record<string, unknown>[]) : [];
  const options = Array.isArray(sp.options) ? (sp.options as Record<string, unknown>[]) : [];
  const optionValues = (name: RegExp): string[] => {
    for (const o of options) if (name.test(String(o.name ?? ""))) return (o.values as string[] | undefined) ?? [];
    return [];
  };
  const text = [String(sp.title ?? ""), String(sp.body_html ?? ""), html].join("\n");
  const byPattern = (key: string, via: string): SitePresence | null => {
    const re = TEXT_PATTERNS[key];
    if (!re) return null;
    const m = re.exec(text);
    return m ? { present: true, via: `${via}:"${m[0].slice(0, 40)}"` } : null;
  };

  switch (field) {
    case "brand":
      return (
        hit(sp.vendor, "shopify.vendor") ??
        hit(ldFirst("brand"), "jsonld.brand") ??
        hit(microValue(html, "brand"), "microdata.brand") ??
        hit(ogValue(html, "og:brand"), "og:brand") ?? { present: false, via: null }
      );
    case "modelCode":
      return (
        hit(ldFirst("mpn"), "jsonld.mpn") ??
        hit(ldFirst("gtin13") ?? ldFirst("gtin") ?? ldFirst("gtin12"), "jsonld.gtin") ??
        hit(microValue(html, "mpn"), "microdata.mpn") ?? { present: false, via: null }
      );
    case "title":
      return (
        hit(sp.title, "shopify.title") ??
        hit(ldFirst("name"), "jsonld.name") ??
        hit(ogValue(html, "og:title"), "og:title") ?? { present: false, via: null }
      );
    case "description":
      return (
        hit(sp.body_html, "shopify.body_html") ??
        hit(ldFirst("description"), "jsonld.description") ??
        hit(ogValue(html, "og:description"), "og:description") ?? { present: false, via: null }
      );
    case "category":
      return (
        hit(sp.product_type, "shopify.product_type") ??
        hit(ldFirst("category"), "jsonld.category") ??
        hit(microValue(html, "category"), "microdata.category") ?? { present: false, via: null }
      );
    case "color":
      return (
        hit(optionValues(/colou?r|색상|컬러/i), "shopify.options.color") ??
        hit(ldFirst("color"), "jsonld.color") ??
        hit(microValue(html, "color"), "microdata.color") ?? { present: false, via: null }
      );
    case "material":
      return (
        hit(ldFirst("material"), "jsonld.material") ??
        hit(microValue(html, "material"), "microdata.material") ?? { present: false, via: null }
      );
    case "composition":
      return byPattern("composition", "text") ?? { present: false, via: null };
    case "fit":
      return byPattern("fit", "text") ?? { present: false, via: null };
    case "size":
      return (
        hit(optionValues(/size|사이즈|크기/i), "shopify.options.size") ??
        hit(ldFirst("size"), "jsonld.size") ?? { present: false, via: null }
      );
    case "age":
      return byPattern("age", "text") ?? { present: false, via: null };
    case "audience":
      return hit(ldFirst("audience"), "jsonld.audience") ?? byPattern("audience", "text") ?? { present: false, via: null };
    case "season":
      return byPattern("season", "text") ?? { present: false, via: null };
    case "collection":
      return (
        hit(sp.tags, "shopify.tags") ??
        hit(ldFirst("isPartOf"), "jsonld.isPartOf") ?? { present: false, via: null }
      );
    case "sellerSku":
      return (
        hit(variants.find((v) => v.sku)?.sku, "shopify.variants.sku") ??
        hit(ldFirst("sku"), "jsonld.sku") ??
        hit(microValue(html, "sku"), "microdata.sku") ?? { present: false, via: null }
      );
    case "image":
      return (
        hit(sp.images, "shopify.images") ??
        hit(ldFirst("image"), "jsonld.image") ??
        hit(ogValue(html, "og:image"), "og:image") ?? { present: false, via: null }
      );
    case "price": {
      /** 🔴 **통화 없는 금액을 「있다」로 적지 않는다** — 통화 가드와 같은 성질이다. */
      const vp = variants.find((v) => v.price && v.price_currency);
      if (vp) return { present: true, via: "shopify.variants.price+currency" };
      for (const p of ld) {
        const offers = p.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
        const arr = Array.isArray(offers) ? offers : offers ? [offers] : [];
        for (const o of arr) if (o.price != null && o.priceCurrency != null) return { present: true, via: "jsonld.offers.price+currency" };
      }
      if (ogValue(html, "og:price:amount") && ogValue(html, "og:price:currency")) {
        return { present: true, via: "og:price+currency" };
      }
      return { present: false, via: null };
    }
    default:
      return { present: false, via: null };
  }
}

/**
 * 🔴🔴 **A/B/C/D 를 가르는 유일한 자리.** `null` 을 `C` 로 **추정하지 않는다** —
 *    페이지를 못 읽었으면 `D` 다(CPO §2 의 그 금지).
 */
export function classify(collected: boolean, page: RawPage, presence: SitePresence): EvidenceState {
  if (collected) return "A_PRESENT_AND_COLLECTED";
  if (!page.reachable) return "D_UNAVAILABLE_TO_CRAWLER";
  if (presence.present) return "B_PRESENT_BUT_NOT_COLLECTED";
  return "C_NOT_PRESENT_ON_SITE";
}
