import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractCodeLikeTitleToken, extractLabeledProductCode } from "@commerce/shared";
import {
  compareModelCode,
  confirmBrandCodeInEvidence,
  productFactsFromListing,
} from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CANDIDATE-CODE-PARITY-01 — **「후보 제목 품번 배선」을 «하지 않은» 이유**
 *        (CPO 승인 ① 을 구현하다 되돌렸다 · 2026-11-06 · 운영 변경 **0**)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일은 구현이 아니라 «판정 근거» 다.** CPO 가 ①(후보 제목 품번 추출 배선)을
 *    승인했고 CTO 가 구현했으나, **승인 조건이 구조적으로 충족되지 않아 되돌렸다.**
 *
 * ── 왜 되돌렸는가(실측) ─────────────────────────────────────────────────────
 * ```
 * 배선하면 국내 편집샵 후보의 **판매처 상품코드가 품번으로 승격된다**
 *   실측 FP — 포레포레 `BB26KSSSTC142311` → brandModelCode (기대 null)
 * 🔴 그 피해가 «둘» 이고 둘째가 결정적이다(seller-facts.ts:315-320 주석 원문):
 *   ⒜ `compareModelCode` 가 **없는 충돌을 지어낸다**(recall 손실)
 *   ⒝ 🔴🔴 `slugCarriesCode` 가 걸리면 **근거 없는 SAME 이 만들어진다**(false SAME)
 * ⟹ CPO 승인 조건 「판매처 자체 SKU 를 제조사 품번으로 잘못 승격하지 않음」 **위반**
 * 🔴 그리고 골든 계약 2건이 FAIL 했다 — `domestic-facts-pipeline` ·
 *    `identifier-safety`(포레포레 골든 쌍 STRONG_IDENTIFIER).
 * ```
 * 🔴 **모양으로는 가를 수 없다** — `B226AC114`(브랜드) 와 `AAA1804922`(Smallable 자체)는
 *    글자 구성이 사실상 같다(product-identity-dna.ts:152 가 실측으로 적어 뒀다).
 *
 * ── 🟢 그럴 필요가 «없다» — 그 일을 하는 축이 이미 있다 ──────────────────────
 * ```
 * confirmBrandCodeInEvidence(**원본 품번**, {title, url, sku})
 *   → 원본의 그 품번이 후보 증거에 있는지만 «확인» 한다
 *   ⟹ 판매처 자체코드는 원본 품번과 같을 수 없으므로 **승격이 구조적으로 불가능** 하다
 * 실측 4/4 정확 · FP 0 (아래 B 군)
 * ```
 * 🔴🔴 **그래서 「기존 MI 가 품번을 놓쳤다」는 정확한 표현이 아니다** —
 *    **추출 축**(`brandModelCode`)은 비어 있었지만 **확인 축** 은 그 품번을 잡는다.
 *    🔴 두 축을 한 숫자로 섞어 읽은 것이 1차 보고의 오류였다.
 */

const SELLER = join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/seller-facts.ts");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const SELLER_RAW = readFileSync(SELLER, "utf8");
/** 🔴 소스 검사는 **주석을 벗기고** 한다(이 저장소에서 여덟 번 걸린 함정). */
const SELLER_CODE = strip(SELLER_RAW);

/* ═════════ A. 추출 «능력» 은 있다 — 그러나 그것이 배선 근거는 아니다 ════════ */

/** 🟢 전부 CORE-DESC 검수 코퍼스(2026-10-27)의 **실제 원문** 이다 — 지어내지 않았다. */
const CASES = [
  { id: "C27 beaumonde(한글 제목 · 끝에 품번)", text: "보보쇼즈 26FW 아동 긴팔 티셔츠 Booty Ghosts T-shirt B226AC010", want: "B226AC010" },
  { id: "C22 donokids(#접두 · 대괄호)", text: "[[메인스토리] Bubble Sweatshirt _Conker Stripe #AW26MS185]", want: "AW26MS185" },
  { id: "S1-6 tinyapple(REF: · 라벨 아님)", text: "Tinyapple | FW26 Bobo Choses | Booty Ghosts T-shirt REF: B226AC141", want: "B226AC141" },
  { id: "S1-5 junioredition(Product code)", text: "Colour - Light Blue. 100% Organic Cotton. Product code B226AC141 AW26 Made in Portugal.", want: "B226AC141" },
] as const;

describe("CANDIDATE-CODE-PARITY-01 A — 토큰 추출 능력(관측)", () => {
  it("A-1 🟢 토큰식은 네 사례 **전부** 를 읽는다", () => {
    for (const c of CASES) expect(extractCodeLikeTitleToken(c.text), `🔴 ${c.id}`).toBe(c.want);
  });

  /** 🔴 라벨식이 1/4 라는 사실이 「배선하면 좋겠다」로 읽히기 쉬운 자리다 — B 군이 그것을 막는다. */
  it("A-2 🟡 라벨식 단독은 **1/4** 만 읽는다(`REF:` 는 라벨이 아니다)", () => {
    const hit = CASES.filter((c) => extractLabeledProductCode(c.text) === c.want);
    expect(hit).toHaveLength(1);
  });
});

/* ═════════ B. 🟢 그 일은 «확인 축» 이 이미 한다 — FP 0 ══════════════════════ */

describe("CANDIDATE-CODE-PARITY-01 B — confirmBrandCodeInEvidence 가 이미 잡는다", () => {
  it("B-1 🟢 C27·C22 의 품번을 **원본 기준으로** 확인한다", () => {
    expect(
      confirmBrandCodeInEvidence("B226AC010", {
        title: "보보쇼즈 26FW 아동 긴팔 티셔츠 Booty Ghosts T-shirt B226AC010",
        url: "https://beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021",
      }),
    ).toBe("B226AC010");
    expect(
      confirmBrandCodeInEvidence("AW26MS185", {
        title: "[[메인스토리] Bubble Sweatshirt _Conker Stripe #AW26MS185]",
        url: "https://donokids.com/p/1",
      }),
    ).toBe("AW26MS185");
  });

  it("B-2 🟢 다른 품번(S1-6 `B226AC141`)은 **확인하지 않는다**", () => {
    expect(
      confirmBrandCodeInEvidence("B226AC010", {
        title: "Tinyapple | FW26 Bobo Choses | Booty Ghosts T-shirt REF: B226AC141",
      }),
    ).toBeNull();
  });

  /** 🟢🟢 **이 단언이 배선보다 나은 이유다** — 판매처 코드를 승격할 길이 없다. */
  it("B-3 🟢🟢 판매처 자체 코드는 **승격되지 않는다**(구조적 불가)", () => {
    expect(
      confirmBrandCodeInEvidence("B226AC010", { title: "[포레포레] 보보쇼즈 스웨트셔츠 BB26KSSOCI008BLU" }),
    ).toBeNull();
  });
});

/* ═════════ C. 🔴 배선을 «하지 않았다» — 그 상태를 잠근다 ═══════════════════ */

describe("CANDIDATE-CODE-PARITY-01 C — 운영은 그대로다(배선 0)", () => {
  /**
   * 🔴 이 단언들이 **되돌림의 증거** 다. 다음 세션이 배선을 다시 넣으면 **FAIL 로 뒤집히고**
   *    그때는 위 A·B 와 골든 계약 둘을 **같이** 들고 CPO 판정을 받아야 한다.
   */
  it("C-1 🔴 PLAIN_HTML 후보 품번은 여전히 **하드코딩 null** 이다", () => {
    const at = SELLER_CODE.indexOf("export function productFactsFromListing");
    const body = SELLER_CODE.slice(at, SELLER_CODE.indexOf("\n}", at));
    expect(body).toContain("brandModelCode: null");
    expect(body, "🔴 제목 토큰 축이 열렸다 — 판매처 SKU 승격 위험을 먼저 닫아야 한다")
      .not.toContain("extractCodeLikeTitleToken");
  });

  it("C-2 🔴 Shopify 후보 품번 체인은 **라벨 → slug 둘** 이다", () => {
    expect(SELLER_CODE).toContain(
      "brandModelCode: extractLabeledProductCode(description) ?? extractCodeLikeSlugSegment(slug)",
    );
  });

  it("C-3 🔴 `extractCodeLikeTitleToken` 은 후보 어댑터에 **import 되지 않았다**", () => {
    expect(SELLER_CODE).not.toContain("extractCodeLikeTitleToken");
  });

  /**
   * 🔴🔴 되돌림의 **진짜 이유** 를 계약으로 적어 둔다 — 「모양으로 가를 수 없다」와
   *    「그래서 false SAME 경로가 열린다」. 🔴 이것이 없으면 다음 사람이 A-1 만 보고
   *    「능력이 있는데 왜 안 쓰나」로 되돌아온다.
   */
  it("C-4 🔴 판매처 코드와 브랜드 품번은 **모양으로 구별되지 않는다**", () => {
    /** 🔴 둘 다 토큰 규칙을 통과한다 — 그래서 승격은 안전하지 않다. */
    expect(extractCodeLikeTitleToken("Bobo Choses Tee AAA1804922")).toBe("AAA1804922");
    expect(extractCodeLikeTitleToken("[포레포레] 스웨트셔츠 BB26KSSSTC142311")).toBe("BB26KSSSTC142311");
    /** 🟡 충돌 방향은 안전하지만 그것이 **전부가 아니다**(slugCarriesCode 경로). */
    expect(compareModelCode("B226AC010", "AAA1804922")).toBe("conflict");
    /**
     * 🔴 이 위험 기록은 **주석** 이다(seller-facts.ts:319 「slugCarriesCode가 우연히
     *    걸리면 반대로 근거 없는 SAME이 만들어진다」) ⟹ **원문** 으로 본다.
     *    🟢 주석 제거판(`SELLER_CODE`)으로 보면 사라져 이 단언이 거짓이 된다 — 실제로 걸렸다.
     */
    expect(SELLER_RAW, "🔴 slug→품번 경로의 false SAME 위험 기록이 사라졌다").toContain("slugCarriesCode");
  });

  it("C-5 🟢 그래도 Evidence 층은 출처를 갈라 보존한다(계약 P2 · 비교 입력 아님)", () => {
    const ev = strip(
      readFileSync(
        join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/product-evidence.ts"),
        "utf8",
      ),
    );
    expect(ev).toContain('b.add("MODEL_CODE", "TITLE"');
    expect(ev).toContain('b.add("MODEL_CODE", "DESCRIPTION"');
  });

  /** 🟢 대조 — 목록 경로가 **지금도** 품번을 만들지 않는다(운영 함수 직접 호출). */
  it("C-6 🟢 운영 함수 산출로 확인한다 — PLAIN_HTML 후보 품번 null", () => {
    const f = productFactsFromListing({
      title: "보보쇼즈 26FW 아동 긴팔 티셔츠 Booty Ghosts T-shirt B226AC010",
      url: "https://beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021",
    });
    expect(f.brandModelCode).toBeNull();
  });
});
