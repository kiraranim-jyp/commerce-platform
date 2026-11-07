/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-REEVAL **Shadow 키워드 비교기** — CPO 추가 지시(2026-11-07)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이것은 운영 코드가 아니다.** `__tests__` 안에 있고 운영 어디에서도 import 되지
 *    않는다. matcher · extractor · alias · Identity · GT · DB 를 **한 글자도** 바꾸지 않는다.
 *
 * 🔴🔴 **CPO 가 금지한 것을 먼저 적는다**:
 * ```
 * ❌ 상품명·설명문을 **문자열 완전 일치(`=`)** 로 비교한다
 * ❌ 한쪽에 키워드가 없다는 이유로 **MISMATCH** 를 낸다 ⟹ `UNKNOWN` 이다
 * ❌ **키워드 일치율을 동일성 «확률» 로 환산** 한다      ⟹ 점수·확률을 만들지 않는다
 * ❌ 키워드 개수나 단순 일치율로 **SAME 을 결정** 한다
 * ❌ 근거 없는 브랜드 동의어를 연결한다
 * ```
 *
 * ── 🔵 세 단계(CPO §3) ──────────────────────────────────────────────────────
 * ```
 * ① 키워드 추출 · 정규화   원문(제목 · 설명문)에서 속성별 키워드를 분리한다
 * ② 존재 + «의미» 비교     MATCH / MISMATCH / UNKNOWN / NOT_APPLICABLE
 * ③ 종합                   🔴 이 파일은 ③을 **하지 않는다** — STEP 5 다
 * ```
 *
 * ── 🔴 동의어의 «근거» 를 등급으로 가른다(CPO §5) ───────────────────────────
 * ```
 * REGISTRY   🟢 운영 등록부에 **이미 있는** 근거 — `brand-alias.ts`(한국어 alias 4개)
 * OBSERVED   🟡 이 코퍼스 원문에서 **관측된** 짝(출처를 같이 적는다)
 * 🔴 그 둘을 한 칸에 섞지 않는다. 🔴 **운영 alias 등록부를 늘리지 않는다**(CPO 금지).
 * ```
 */

export type KeywordStatus = "MATCH" | "MISMATCH" | "UNKNOWN" | "NOT_APPLICABLE";
export type SynonymBasis = "IDENTICAL" | "NORMALIZED" | "REGISTRY" | "OBSERVED" | "NONE";

/** 🔴 CPO §2 가 정한 추출 대상. 🔴 **실제 데이터에 있는 것만** 추출한다. */
export type KeywordAxis =
  | "BRAND" | "MODEL_CODE" | "PRODUCT_TYPE" | "DESIGN" | "PRINT_PATTERN"
  | "COLOR" | "MATERIAL" | "SLEEVE_FORM" | "FIT" | "AUDIENCE" | "SIZE_OPTION";

export interface Keyword {
  axis: KeywordAxis;
  /** 🔴 **원문 그대로** — 가공하지 않는다(CPO §3 「원본 텍스트」). */
  raw: string;
  /** 추출된 키워드(원문 조각). */
  keyword: string;
  /** 정규화 키워드(비교에 쓰는 값). */
  normalized: string;
  /** 🔴 정규화·동의어 **근거**. */
  basis: SynonymBasis;
  /** 출처 필드 — TITLE / DESCRIPTION / DESCRIPTION_KO / STRUCTURED. */
  where: "TITLE" | "DESCRIPTION" | "DESCRIPTION_KO" | "STRUCTURED";
  /** 원문 내 위치(문자 offset)와 그 주변 문장. */
  offset: number;
  context: string;
}

const NFKC = (s: string) => String(s ?? "").normalize("NFKC");
const low = (s: string) => NFKC(s).toLowerCase();
/** 🟢 표기 차이 정규화 — 대소문자 · 공백 · 하이픈 · 밑줄 · 점(CPO §5). */
export const normalizeToken = (s: string): string => low(s).replace(/[\s\-_.]+/g, "");

const ctx = (hay: string, i: number, len: number): string =>
  NFKC(hay).slice(Math.max(0, i - 36), i + len + 36).replace(/\s+/g, " ").trim();

/**
 * 🟢 **브랜드 동의어 — 근거가 있는 것만**(CPO §5).
 *    🔴 운영 `brand-alias.ts` 의 한국어 alias **그 넷** 이다. 늘리지 않았다.
 *    🔴 `brand-alias.ts` 를 **import 하지 않는다** — Shadow 가 운영 등록부에 의존하면
 *       그 파일을 고칠 때 Shadow 결과가 조용히 바뀐다. 🟢 대신 **값을 베끼고 출처를 적는다**.
 */
export const BRAND_SYNONYMS: readonly { en: string; ko: string }[] = [
  { en: "Bobo Choses", ko: "보보쇼즈" },
  { en: "Pèpè", ko: "페페" },
  { en: "Emile et Ida", ko: "에밀에이다" },
  { en: "Conge Sleded", ko: "콩제슬래드" },
];

/**
 * 🟡 **OBSERVED 동의어** — 이 코퍼스 원문에서 관측된 짝만 적는다.
 * 🔴 **일반 사전이 아니다.** 운영에 넣지 않고, 늘릴 때는 **관측 출처를 같이** 적는다.
 * 🔴 CPO 예시(티셔츠↔T-shirt · 면 100%↔100% cotton · 라이트 블루↔Light blue)가 이 등급이다.
 */
const OBSERVED: readonly { axis: KeywordAxis; norm: string; forms: readonly string[] }[] = [
  { axis: "PRODUCT_TYPE", norm: "tshirt", forms: ["t-shirt", "t shirt", "tshirt", "tee", "티셔츠", "반팔티", "긴팔티"] },
  { axis: "PRODUCT_TYPE", norm: "sweatshirt", forms: ["sweatshirt", "sweat shirt", "스웨트셔츠", "맨투맨", "트레이닝 셔츠"] },
  { axis: "PRODUCT_TYPE", norm: "hoodie", forms: ["hoodie", "hooded", "후드"] },
  { axis: "PRODUCT_TYPE", norm: "cardigan", forms: ["cardigan", "가디건"] },
  { axis: "PRODUCT_TYPE", norm: "jacket", forms: ["jacket", "anorak", "자켓", "재킷", "아노락", "점퍼", "바람막이", "windbreaker"] },
  { axis: "PRODUCT_TYPE", norm: "pants", forms: ["pants", "trousers", "팬츠", "바지", "leggings", "레깅스"] },
  { axis: "PRODUCT_TYPE", norm: "dress", forms: ["dress", "원피스", "tunique", "tunic", "튜닉"] },
  { axis: "PRODUCT_TYPE", norm: "cap", forms: ["cap", "hat", "모자", "비니", "beanie"] },
  { axis: "PRODUCT_TYPE", norm: "socks", forms: ["socks", "양말"] },
  { axis: "PRODUCT_TYPE", norm: "bib", forms: ["bib", "턱받이"] },

  { axis: "COLOR", norm: "black", forms: ["black", "블랙", "검정"] },
  { axis: "COLOR", norm: "white", forms: ["white", "화이트", "흰"] },
  { axis: "COLOR", norm: "cream", forms: ["ecru", "cream", "off-white", "offwhite", "에크루", "크림", "아이보리", "ivory", "오프화이트"] },
  { axis: "COLOR", norm: "grey", forms: ["grey", "gray", "그레이", "회색", "melange", "멜란지"] },
  { axis: "COLOR", norm: "navy", forms: ["navy", "네이비"] },
  { axis: "COLOR", norm: "blue", forms: ["blue", "블루", "파랑", "라이트 블루", "light blue"] },
  { axis: "COLOR", norm: "green", forms: ["green", "그린", "초록", "khaki", "카키"] },
  { axis: "COLOR", norm: "red", forms: ["red", "레드", "빨강", "burgundy", "버건디"] },
  { axis: "COLOR", norm: "pink", forms: ["pink", "핑크", "분홍", "lavender", "라벤더"] },
  { axis: "COLOR", norm: "brown", forms: ["brown", "브라운", "갈색", "tan", "베이지", "beige", "camel"] },
  { axis: "COLOR", norm: "yellow", forms: ["yellow", "옐로", "노랑", "mustard", "머스타드"] },

  { axis: "MATERIAL", norm: "cotton", forms: ["cotton", "코튼", "면"] },
  { axis: "MATERIAL", norm: "polyester", forms: ["polyester", "폴리에스터", "폴리에스테르"] },
  { axis: "MATERIAL", norm: "wool", forms: ["wool", "울", "merino", "메리노"] },
  { axis: "MATERIAL", norm: "elastane", forms: ["elastane", "spandex", "엘라스탄", "스판"] },
  { axis: "MATERIAL", norm: "nylon", forms: ["nylon", "polyamide", "나일론", "폴리아미드"] },
  { axis: "MATERIAL", norm: "linen", forms: ["linen", "리넨", "린넨"] },
  { axis: "MATERIAL", norm: "viscose", forms: ["viscose", "rayon", "비스코스", "레이온"] },
  { axis: "MATERIAL", norm: "cashmere", forms: ["cashmere", "캐시미어"] },

  { axis: "SLEEVE_FORM", norm: "long_sleeve", forms: ["long sleeve", "long-sleeve", "longsleeve", "긴팔", "긴소매"] },
  { axis: "SLEEVE_FORM", norm: "short_sleeve", forms: ["short sleeve", "short-sleeve", "반팔", "반소매"] },

  { axis: "AUDIENCE", norm: "kids", forms: ["kids", "kid", "children", "키즈", "아동", "주니어", "junior"] },
  { axis: "AUDIENCE", norm: "baby", forms: ["baby", "베이비", "유아", "newborn", "신생아"] },
  { axis: "AUDIENCE", norm: "adult", forms: ["adult", "성인"] },

  { axis: "FIT", norm: "relaxed", forms: ["relaxed fit", "relaxed", "루즈핏", "오버사이즈", "oversized"] },
  { axis: "FIT", norm: "slim", forms: ["slim fit", "슬림핏"] },

  { axis: "PRINT_PATTERN", norm: "print", forms: ["print", "printed", "프린트", "프린팅"] },
  { axis: "PRINT_PATTERN", norm: "stripe", forms: ["stripe", "striped", "스트라이프", "줄무늬"] },
  { axis: "PRINT_PATTERN", norm: "embossed", forms: ["embossed", "엠보스", "엠보싱"] },
  { axis: "PRINT_PATTERN", norm: "allover", forms: ["all over", "all-over", "allover", "올오버"] },
];

/** 🔴 품번 «모양» — 양쪽에서 같은 규칙으로 찾는다(새 규칙이 아니라 관측된 모양이다). */
const CODE_RE = /\b[A-Z]{1,3}\d{2,3}[A-Z]{1,3}\d{2,4}\b/gi;
/**
 * 🔴 **디자인 키워드는 사전으로 만들지 않는다** — 「Hug Hairy Monster」 같은 고유 디자인명은
 *    사전에 없고, allowlist 로 하면 모르는 디자인명이 **조용히 죽는다**(WU-014 선례).
 *    🟢 그래서 **불용어를 뺀 나머지 토큰** 으로 둔다(denylist 방식).
 */
const DESIGN_STOP = new Set([
  "the", "and", "for", "with", "in", "of", "by", "a", "an", "to", "on", "de", "la", "le", "et",
  "new", "fw26", "ss26", "fw25", "ss25", "aw26", "26fw", "25fw", "collection", "official", "shop",
  "size", "color", "colour", "made", "unisex", "boys", "girls", "boy", "girl", "set", "sets",
  "아동", "유아", "키즈", "주니어", "상품", "제품", "브랜드", "색상", "소재", "사이즈", "옵션",
]);

/**
 * 🔵🔵 **동의어 연결 «전/후» 를 가르는 스위치**(CPO 조건 — 「동의어 연결 전후 결과 별도 기록」).
 * ```
 * useObserved = true   🟢 OBSERVED 사전을 쓴다(티셔츠 ↔ T-shirt · 면 ↔ cotton …)
 * useObserved = false  🔴 **정규화 후 완전 일치만** — 한국어 표현이 이어지지 않는다
 * ```
 * 🔴 두 결과를 **같은 칸에 넣지 않는다** — 그래서 측정이 「동의어가 새로 만든 MATCH」를 셀 수 있다.
 */
export interface ExtractOptions {
  useObserved?: boolean;
  /**
   * 🔵🔵 **브랜드 엔티티가 COLOR 축으로 유입되는 것을 막는다**(CPO 결정 ④ · Shadow 한정).
   * ```
   * 실측 — `folkberlin.com` 후보 설명문 「The **Gray Label** logo embroidery …」 에서
   *        `Gray` 가 **색상** 으로 추출돼 원본 `grey` 와 MATCH 가 됐다.
   *        🔴 그런데 그 상품의 실제 색상은 제목의 「''Blue Moon''」(blue) 이다.
   * ⟹ 🔴 동의어 문제가 아니라 **추출 결함** 이다(브랜드명 안의 색상 단어).
   * ```
   * 🔴 `false`(기본)면 **STEP 5 측정과 바이트 동일** 하다 — 기존 수치를 덮지 않기 위해서다.
   * 🟢 `true` 면 `B-shadow-v2` 측정이 된다(CPO 가 별도 버전으로 재라고 했다).
   */
  colorBrandGuard?: boolean;
  /**
   * 🔴🔴🔴 **단어 경계 검사** — 이것이 진짜 결함이었다(CPO ④ 를 조사하다 찾았다).
   * ```
   * 1차 구현은 `text.indexOf(form)` 만 썼다 ⟹ **부분 문자열이 그대로 걸렸다**:
   *   「embroide**red**」      → COLOR `red`
   *   「elas**tan**e」         → COLOR `brown`(tan)
   *   「**Gray** Label logo」  → COLOR `grey`      ← CPO 가 지목한 그 사례
   * 🔴 즉 `folkberlin` 의 거짓 일치는 **브랜드명 문제이기도 하지만 근본은 경계 부재** 다.
   * ```
   * 🟢 고치는 방법은 이 리포가 이미 쓰는 그 규칙이다 — **양 끝이 글자/숫자가 아니어야 한다**
   *    (`excluded-brands.ts` · `brand-alias.ts` 의 `WORDISH` 경계와 같은 축).
   * 🔴 기본값 **false** ⟹ STEP 5 산출은 **바이트 동일** 하다(기존 수치를 덮지 않는다).
   */
  wordBoundary?: boolean;
}

/**
 * 🔴 **브랜드 표지 명사** — 색상 토큰 «바로 뒤» 에 이것이 오면 그 색상은
 *    상품 색상이 아니라 **고유명사의 일부** 다(`Gray **Label**` · `Blue **Studio**`).
 * 🟢 좁게 둔다 — 넓히면 「Blue Moon」 같은 **실제 색상 표기** 를 죽인다.
 * 🔴 `moon` 같은 일반 명사를 넣지 않는다(그 길로 가면 실제 색상이 사라진다).
 */
const BRAND_MARKER_NOUNS: readonly string[] = [
  "label", "logo", "brand", "studio", "atelier", "collective", "company", "co.", "라벨", "로고",
];

/**
 * 🔵🔵🔵 **선언된 색상 자리** — 마커 사전보다 **이것이 정답이다**(실측으로 확정).
 *
 * `folkberlin.com` 후보 설명문 전문을 읽어 보니:
 * ```
 * `Gray` 가 **네 번** 나오고 **전부 브랜드/인명** 이다 —
 *    @301 「The **Gray Label** logo」 · @598 「About the Brand **Gray Label**」
 *    @703 「Founded by Emily **Gray** in 2011」  ← 🔴 **창업자 이름** · 마커가 뒤에 없다
 *    @717 「**Gray Label** is committed …」
 * 🔴 그래서 **브랜드 표지 명사 사전만으로는 @703 을 막을 수 없다**(실측 · 가드 통과).
 * 🟢🟢 그런데 그 설명문은 **「Colour: Blue Moon」** 이라고 **선언** 해 두었다.
 * ⟹ 🟢 CPO 조건(「실제 색상 Blue Moon 은 **원문 근거가 확인될 때만** 추출」)을 그대로 만족한다.
 * ```
 * 🔴 선언 자리가 있으면 **그 값만** COLOR 로 쓴다 — 산문에서 긁지 않는다.
 * 🔴 선언 자리가 없으면 기존대로 산문을 본다(없는 것을 만들지 않는다).
 */
const COLOR_LABEL_RE = /(?:colou?r|색상|컬러)\s*[:：]\s*([^\n.;|]{1,40})/i;

const findForms = (hay: string, axis: KeywordAxis, where: Keyword["where"], opts: ExtractOptions = {}): Keyword[] => {
  const useObserved = opts.useObserved !== false;
  let raw = NFKC(hay);
  /**
   * 🟢🟢 **선언된 색상 자리가 있으면 그 값만 본다**(가드 ON 일 때만 · CPO 조건 ④).
   * 🔴 그래서 「Colour: Blue Moon」 을 적어 둔 상품에서 **브랜드명·인명의 색상 단어가
   *    더 이상 들어오지 않는다**. 🔴 선언이 없으면 아무것도 바꾸지 않는다.
   */
  if (opts.colorBrandGuard === true && axis === "COLOR") {
    const m = COLOR_LABEL_RE.exec(raw);
    if (m?.[1]) raw = m[1];
  }
  const text = low(raw);
  const out: Keyword[] = [];
  for (const entry of OBSERVED) {
    if (entry.axis !== axis) continue;
    for (const form of entry.forms) {
      /** 🔴 동의어 OFF 면 **정규화값과 같은 표기만** 쓴다(= 완전 일치 축). */
      if (!useObserved && normalizeToken(form) !== entry.norm) continue;
      const f = low(form);
      let i = text.indexOf(f);
      while (i >= 0) {
        /**
         * 🔵 **COLOR 전용 가드** — 색상 토큰 «바로 뒤» 가 브랜드 표지 명사면 건너뛴다.
         * 🔴 COLOR 축에만 적용한다. 다른 축(소재·형태)에 넓히면 근거 없이 축이 죽는다.
         */
        const guarded = opts.colorBrandGuard === true && axis === "COLOR"
          && (() => {
            const after = text.slice(i + f.length, i + f.length + 14);
            const next = after.replace(/^[\s'"”’`,.\-–—()[\]]+/, "");
            return BRAND_MARKER_NOUNS.some((m) => next.startsWith(low(m)));
          })();
        /**
         * 🔴🔴 **경계 검사** — 양 끝이 글자/숫자면 그 일치는 **부분 문자열** 이다.
         *    `red` ⊂ `embroidered` · `tan` ⊂ `elastane` 가 그렇게 들어왔다.
         * 🔴 한글은 조사가 붙으므로 **뒤쪽만** 느슨하게 둔다(앞은 엄격) — `excluded-brands`
         *    의 조사 처리와 같은 축이지만 여기서는 **열거 없이** 「한글이면 허용」으로 둔다.
         *    🔴 그래서 「파란색」·「블루계열」이 살아 있고 「embroidered」는 막힌다.
         */
        const boundaryBad = opts.wordBoundary === true && (() => {
          const prev = i > 0 ? text[i - 1]! : "";
          const next = text[i + f.length] ?? "";
          const latin = /[a-z0-9]/;
          const hangul = /[가-힣]/;
          const isLatinForm = /[a-z]/.test(f);
          if (prev && (latin.test(prev) || (!isLatinForm && hangul.test(prev)))) return true;
          if (next && isLatinForm && latin.test(next)) return true;
          if (next && !isLatinForm && hangul.test(next) && f.length < 3) return true;
          return false;
        })();
        if (!guarded && !boundaryBad) {
          out.push({
            axis, raw: raw.slice(i, i + f.length), keyword: form, normalized: entry.norm,
            basis: normalizeToken(form) === entry.norm ? "NORMALIZED" : "OBSERVED",
            where, offset: i, context: ctx(raw, i, f.length),
          });
        }
        i = text.indexOf(f, i + f.length);
      }
    }
  }
  /** 🔴 같은 축·같은 정규화값은 **첫 등장만** 남긴다(같은 근거를 두 번 세지 않는다). */
  const seen = new Set<string>();
  return out.filter((k) => {
    const key = `${k.axis}|${k.normalized}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export interface ExtractInput {
  title: string | null;
  description: string | null;
  descriptionKo?: string | null;
  /** 🟢 구조화 칸(있으면 출처를 `STRUCTURED` 로 적는다). */
  brand?: string | null;
  color?: string | null;
  material?: string | null;
  code?: string | null;
}

/** ① **키워드 추출 · 정규화**. 🔴 없는 것은 **만들지 않는다**. */
export function extractKeywords(input: ExtractInput, opts: ExtractOptions = {}): Keyword[] {
  const useObserved = opts.useObserved !== false;
  const out: Keyword[] = [];
  const texts: [string, Keyword["where"]][] = [
    [input.title ?? "", "TITLE"],
    [input.description ?? "", "DESCRIPTION"],
    [input.descriptionKo ?? "", "DESCRIPTION_KO"],
  ];

  /* ── BRAND — 🟢 근거가 있는 동의어만(REGISTRY) ── */
  for (const [hay, where] of texts) {
    if (!hay) continue;
    const text = low(hay);
    for (const s of BRAND_SYNONYMS) {
      /** 🔴 동의어 OFF 면 **한글 표기를 잇지 않는다**(영문 그대로만 본다). */
      const forms = useObserved
        ? ([[s.en, "IDENTICAL"], [s.ko, "REGISTRY"]] as const)
        : ([[s.en, "IDENTICAL"]] as const);
      for (const [form, basis] of forms) {
        const i = text.indexOf(low(form));
        if (i < 0) continue;
        out.push({
          axis: "BRAND", raw: NFKC(hay).slice(i, i + form.length), keyword: form,
          normalized: normalizeToken(s.en), basis, where, offset: i, context: ctx(hay, i, form.length),
        });
      }
    }
  }
  if (input.brand) {
    const hit = BRAND_SYNONYMS.find((s) => normalizeToken(s.en) === normalizeToken(input.brand!) || normalizeToken(s.ko) === normalizeToken(input.brand!));
    /**
     * 🔴🔴 **`REGISTRY` 는 «다국어로 이어졌을 때» 만 쓴다.**
     *    1차 구현은 등록부에 **있기만 하면** `REGISTRY` 로 찍었고, 그래서 영문 `Bobo Choses`
     *    구조화 값까지 「다국어 연결」로 세어 **「발화 17쌍」이라는 거짓 숫자** 가 나왔다.
     *    🟢 실제 한글↔영문 브리지는 **2쌍** 이다(실측). ⟹ 영문 그대로면 `IDENTICAL` 이다.
     */
    const bridged = Boolean(hit) && normalizeToken(hit!.en) !== normalizeToken(input.brand);
    out.push({
      axis: "BRAND", raw: input.brand, keyword: input.brand,
      normalized: hit ? normalizeToken(hit.en) : normalizeToken(input.brand),
      basis: bridged ? "REGISTRY" : "IDENTICAL", where: "STRUCTURED", offset: 0, context: input.brand,
    });
  }

  /* ── MODEL_CODE — 🔴 별도 증거 축으로 유지한다(CPO §5) ── */
  for (const [hay, where] of texts) {
    if (!hay) continue;
    for (const m of NFKC(hay).match(CODE_RE) ?? []) {
      const i = NFKC(hay).indexOf(m);
      out.push({ axis: "MODEL_CODE", raw: m, keyword: m, normalized: normalizeToken(m), basis: "NORMALIZED", where, offset: i, context: ctx(hay, i, m.length) });
    }
  }
  if (input.code) {
    out.push({ axis: "MODEL_CODE", raw: input.code, keyword: input.code, normalized: normalizeToken(input.code), basis: "NORMALIZED", where: "STRUCTURED", offset: 0, context: input.code });
  }

  /* ── 사전 축들 ── */
  for (const axis of ["PRODUCT_TYPE", "COLOR", "MATERIAL", "SLEEVE_FORM", "AUDIENCE", "FIT", "PRINT_PATTERN"] as KeywordAxis[]) {
    for (const [hay, where] of texts) if (hay) out.push(...findForms(hay, axis, where, opts));
  }
  /** 구조화 칸도 같은 사전으로 읽는다 — 출처만 다르다. */
  if (input.color) out.push(...findForms(input.color, "COLOR", "STRUCTURED", opts));
  if (input.material) out.push(...findForms(input.material, "MATERIAL", "STRUCTURED", opts));

  /* ── DESIGN — 🔴 사전이 아니라 **불용어 제외 토큰** 이다 ── */
  const titleTokens = low(input.title ?? "").split(/[^a-z0-9가-힣]+/).filter(Boolean);
  const brandTokens = new Set(BRAND_SYNONYMS.flatMap((s) => [...low(s.en).split(/\s+/), low(s.ko)]));
  const axisForms = new Set(OBSERVED.flatMap((e) => e.forms.flatMap((f) => low(f).split(/\s+/))));
  for (const t of titleTokens) {
    if (t.length < 2 || DESIGN_STOP.has(t) || brandTokens.has(t) || axisForms.has(t)) continue;
    if (CODE_RE.test(t)) continue;
    const i = low(input.title ?? "").indexOf(t);
    out.push({ axis: "DESIGN", raw: t, keyword: t, normalized: normalizeToken(t), basis: "NORMALIZED", where: "TITLE", offset: i, context: ctx(input.title ?? "", i, t.length) });
  }

  /** 🔴 축 + 정규화값 중복 제거 — **출처는 첫 등장을 남긴다**(STRUCTURED 가 있으면 그것을 선호). */
  const best = new Map<string, Keyword>();
  for (const k of out) {
    const key = `${k.axis}|${k.normalized}`;
    const cur = best.get(key);
    if (!cur || (cur.where !== "STRUCTURED" && k.where === "STRUCTURED")) best.set(key, k);
  }
  return [...best.values()];
}

export interface AxisComparison {
  axis: KeywordAxis;
  status: KeywordStatus;
  /** 양쪽에서 **의미가 같은** 키워드. */
  matched: string[];
  /** 양쪽에 있으나 **의미가 다른** 키워드. */
  conflicting: { origin: string[]; candidate: string[] };
  /** 🔴 한쪽에만 있는 키워드 — **MISMATCH 가 아니다**. */
  onlyOrigin: string[];
  onlyCandidate: string[];
  /** 동의어 처리 내역(근거 등급 포함). */
  synonymBasis: SynonymBasis[];
  why: string;
}

/**
 * ② **존재 + 의미 비교**. 🔴 CPO 금지를 코드로 지킨다:
 *    「한쪽에만 있다」 ⟹ **UNKNOWN**(MISMATCH 아님) · 양쪽 모두 없으면 **NOT_APPLICABLE**.
 *
 * 🔴 **점수를 만들지 않는다** — 반환에 숫자 비율이 없다.
 */
export function compareAxis(axis: KeywordAxis, originKw: Keyword[], candKw: Keyword[]): AxisComparison {
  const o = originKw.filter((k) => k.axis === axis);
  const c = candKw.filter((k) => k.axis === axis);
  const on = new Set(o.map((k) => k.normalized));
  const cn = new Set(c.map((k) => k.normalized));
  const matched = [...on].filter((n) => cn.has(n));
  const onlyOrigin = [...on].filter((n) => !cn.has(n));
  const onlyCandidate = [...cn].filter((n) => !on.has(n));
  const basis = [...new Set([...o, ...c].filter((k) => matched.includes(k.normalized)).map((k) => k.basis))];

  if (!o.length && !c.length) {
    return { axis, status: "NOT_APPLICABLE", matched: [], conflicting: { origin: [], candidate: [] }, onlyOrigin: [], onlyCandidate: [], synonymBasis: [], why: "양쪽 원문에 그 속성 키워드가 없다" };
  }
  if (!o.length || !c.length) {
    return {
      axis, status: "UNKNOWN", matched: [], conflicting: { origin: [], candidate: [] },
      onlyOrigin, onlyCandidate, synonymBasis: [],
      why: `한쪽에만 있다(원본 ${o.length} · 후보 ${c.length}) — 🔴 불일치로 적지 않는다`,
    };
  }
  if (matched.length) {
    /**
     * 🔴 **같은 축에서 «다른» 값이 같이 있으면 그것도 적는다** — 예: 색상이 여러 개.
     *    🔴 그러나 `MATCH` 를 `MISMATCH` 로 바꾸지 않는다(옵션일 수 있다 · 사실만 기록).
     */
    return {
      axis, status: "MATCH", matched, conflicting: { origin: onlyOrigin, candidate: onlyCandidate },
      onlyOrigin, onlyCandidate, synonymBasis: basis,
      why: `의미가 같은 키워드 ${matched.join("/")}${onlyOrigin.length || onlyCandidate.length ? " · 🟡 같은 축에 다른 값도 있다(옵션 가능)" : ""}`,
    };
  }
  /** 양쪽에 **있는데 겹치는 값이 없다** ⟹ 의미 충돌이다. */
  return {
    axis, status: "MISMATCH", matched: [], conflicting: { origin: onlyOrigin, candidate: onlyCandidate },
    onlyOrigin, onlyCandidate, synonymBasis: [],
    why: `양쪽 모두 있으나 겹치는 값이 없다 — 원본 ${onlyOrigin.join("/")} ↔ 후보 ${onlyCandidate.join("/")}`,
  };
}

/** 🔴 CEO 다섯 증거 ↔ 키워드 축 대응(CPO §6). **새 축을 만들지 않았다**. */
export const CEO_EVIDENCE_MAP: Readonly<Record<string, readonly KeywordAxis[]>> = {
  "① 상품명 원문": ["DESIGN", "PRODUCT_TYPE", "BRAND"],
  "② 상품명": ["DESIGN", "PRODUCT_TYPE"],
  "③ 품번·모델코드": ["MODEL_CODE"],
  "④ 상세설명": ["MATERIAL", "COLOR", "PRINT_PATTERN", "SLEEVE_FORM", "FIT", "AUDIENCE"],
  "⑤ 정규화 상품명 토큰": ["DESIGN"],
};

export const ALL_AXES: readonly KeywordAxis[] = [
  "BRAND", "MODEL_CODE", "PRODUCT_TYPE", "DESIGN", "PRINT_PATTERN",
  "COLOR", "MATERIAL", "SLEEVE_FORM", "FIT", "AUDIENCE", "SIZE_OPTION",
];
