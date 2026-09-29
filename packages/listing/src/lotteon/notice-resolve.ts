import { noticeSchemaFor, type LotteOnNoticeArticleSpec } from "./notice-schema";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 고시 항목을 **이미 가진 값으로** 채운다 — 만들지는 않는다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 입력은 원시값이다(`CanonicalProduct` 를 그대로 받지 않는다). 이 규칙을
 * `carrier-match.ts` 에서와 같은 이유로 지킨다 — 순수 함수여야 실응답으로
 * 테스트할 수 있고, 상품 모델이 바뀌어도 이 파일이 따라 흔들리지 않는다.
 *
 * ── 🔴 세 가지 결과를 «섞지 않는다» ──────────────────────────────────────
 *
 *   FILLED       우리가 이미 가진 값을 옮겼다.  어디서 왔는지(`from`)를 남긴다.
 *   NEEDS_INPUT  값이 «있을 수 있는데» 지금 비어 있다. 채우면 풀린다.
 *   BLOCKED      우리 구조에 자리가 없거나, 무엇을 넣어야 하는지 «규칙을 모른다».
 *                셀러가 채워도 우리가 맞는지 판단할 수 없다.
 *
 * 이 셋을 「입력 필요」 하나로 뭉치면 셀러는 풀 수 없는 칸을 계속 들여다본다.
 * 같은 혼동을 이 스프린트에서 이미 두 번 겪었다(「없다」 vs 「모른다」).
 */

export interface LotteOnNoticeFacts {
  /** 상품에서 오는 값들. 비어 있으면 빈 문자열/null 그대로 넘긴다 — 지어내지 않는다. */
  color?: string | null;
  material?: string | null;
  countryOfOrigin?: string | null;
  /**
   * 옵션에서 고른 «치수» 값들. 🔴 호출부가 고른다 — 이 파일은 옵션 구조를 모른다.
   * 공식 가이드라인이 품목 23 `0780` 에 「섬유제품 등의 경우 치수 정보로 대체
   * 가능해요」라고 적어 두었기 때문에 쓰는 것이지, 우리가 정한 대체가 아니다.
   */
  sizeValues?: readonly string[];
  weight?: string | null;
  careInstructions?: string | null;
  manufacturer?: string | null;
  importer?: string | null;
  itemName?: string | null;
  modelName?: string | null;
  /**
   * 🔴 «상품정보의 사용연령» 필드만이다. 옵션의 `6-7 Years` 를 여기로 옮기지
   * 않는다 — 그것은 사이즈 축이고, 고시의 「사용연령」과 같은 뜻이라는 근거가
   * 아직 없다(CPO 확인 대기).
   */
  recommendedAge?: string | null;
  /** 실제 KC 인증번호. 🔴 절대 만들 수 없는 값이다. */
  kcCertificationNumber?: string | null;

  /** 판매자 공통 설정(`seller_settings`) — 상품마다 다르지 않은 상수들. */
  sellerQualityGuarantee?: string | null;
  sellerAsContactNumber?: string | null;
  /** 🔴 아직 우리 어디에도 없는 값. 자리만 둔다(DB 변경은 CPO STOP 중). */
  sellerAsCompanyName?: string | null;
  /**
   * A/S «전화번호». 🔴 `sellerAsContactNumber`(안내 문구)와 다른 칸이다.
   * 둘을 한 칸으로 합치면 고시의 「전화번호」 자리에 문장이 들어간다.
   */
  sellerAsPhoneNumber?: string | null;
}

export type LotteOnNoticeFill =
  | { code: string; label: string; required: boolean; status: "FILLED"; value: string; from: string }
  | { code: string; label: string; required: boolean; status: "NEEDS_INPUT"; reason: string }
  | { code: string; label: string; required: boolean; status: "BLOCKED"; reason: string }
  /**
   * 🔴 값은 «있는데» 그 항목이 요구하는 형식이 아니다.
   *
   * `NEEDS_INPUT`(비었다)과도 `FILLED`(찼다)와도 다르다. 이 상태가 없으면
   * 「값이 있으니 자동 입력」이 「요구를 충족했다」로 읽힌다 — 실제로 롯데ON
   * `0090` 의 전화번호 자리에 «문장» 이 들어간 채 🟢 로 보인 적이 있다.
   */
  | { code: string; label: string; required: boolean; status: "INVALID"; value: string; reason: string };

export interface LotteOnNoticeResolution {
  /** 이 품목의 표를 아는가. 모르면 `false` 이고 `fills` 는 빈 배열이다. */
  schemaKnown: boolean;
  fills: LotteOnNoticeFill[];
  /** payload 의 `pdItmsArtlLst` 에 그대로 넣을 수 있는 것들. */
  articles: { pdArtlCd: string; pdArtlCnts: string }[];
}

const clean = (value: string | null | undefined): string => (value ?? "").trim();

function filled(spec: LotteOnNoticeArticleSpec, value: string, from: string): LotteOnNoticeFill {
  return { code: spec.code, label: spec.label, required: spec.required, status: "FILLED", value, from };
}
function needsInput(spec: LotteOnNoticeArticleSpec, reason: string): LotteOnNoticeFill {
  return { code: spec.code, label: spec.label, required: spec.required, status: "NEEDS_INPUT", reason };
}
function blocked(spec: LotteOnNoticeArticleSpec, reason: string): LotteOnNoticeFill {
  return { code: spec.code, label: spec.label, required: spec.required, status: "BLOCKED", reason };
}

/** 🔴 값을 «버리지 않고» 싣는다 — 셀러가 무엇을 고쳐야 하는지 화면이 보여준다. */
function invalid(spec: LotteOnNoticeArticleSpec, value: string, reason: string): LotteOnNoticeFill {
  return { code: spec.code, label: spec.label, required: spec.required, status: "INVALID", value, reason };
}

/**
 * 전화번호처럼 «생겼는가». 🔴 형식을 «만들지» 않는다 — 걸러내기만 한다.
 *
 * 근거는 네이버 실측이다(N-3.49 5차 실등록): `afterServiceTelephoneNumber` 는
 * **숫자/-/+ 만 허용**하고 자유 텍스트는 거부됐다. 롯데ON `0090` 이 요구하는
 * 형식은 [UNKNOWN] 이라, 같은 기준을 «보수적으로» 빌려 쓴다.
 *
 * 🔴 문장에서 숫자를 «추출하지 않는다»(CPO 금지). 「해외 구매대행으로 A/S 불가」는
 * 번호가 아니고, 거기서 무언가를 뽑아내면 셀러가 확인한 적 없는 번호가 나간다.
 */
export function looksLikePhoneNumber(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  /* 숫자·하이픈·플러스·공백·괄호 말고 다른 글자가 있으면 번호가 아니다. */
  if (!/^[0-9+\-() ]+$/.test(text)) return false;
  /* 기호만 있는 것도 번호가 아니다 — 최소한의 자릿수는 있어야 한다. */
  return (text.match(/[0-9]/g) ?? []).length >= 7;
}

/** 값이 있으면 채우고, 없으면 「채우면 풀린다」고 말한다. */
function fromFact(spec: LotteOnNoticeArticleSpec, value: string | null | undefined, from: string, reason: string) {
  const text = clean(value);
  return text ? filled(spec, text, from) : needsInput(spec, reason);
}

function resolveOne(spec: LotteOnNoticeArticleSpec, facts: LotteOnNoticeFacts): LotteOnNoticeFill {
  switch (spec.code) {
    case "0020":
      return fromFact(spec, facts.color, "상품정보 · 색상", "상품정보에 색상이 없습니다.");
    case "0410":
      return fromFact(spec, facts.material, "상품정보 · 소재", "상품정보에 소재가 없습니다.");
    case "0060":
      return fromFact(spec, facts.countryOfOrigin, "상품정보 · 원산지", "상품정보에 원산지가 없습니다.");
    case "0800":
      /* 🔴 항목명은 「취급방법 및 취급시 주의사항, 안전표시」다. 우리가 가진 것은
         취급방법뿐이라 «안전표시» 부분이 비어 있을 수 있다. 그래도 있는 값을
         버리지는 않는다 — 부족하면 셀러가 덧붙인다. */
      return fromFact(spec, facts.careInstructions, "상품정보 · 취급 시 주의사항", "상품정보에 취급 시 주의사항이 없습니다.");
    case "0790":
      return fromFact(
        spec,
        facts.recommendedAge,
        "상품정보 · 사용연령",
        "상품정보에 사용연령이 없습니다. 옵션의 사이즈 표기(예: 6-7 Years)를 사용연령으로 바꾸지 않습니다.",
      );
    case "0200":
      return fromFact(
        spec,
        facts.kcCertificationNumber,
        "상품정보 · KC 인증번호",
        "KC 인증번호가 없습니다. 인증번호는 실제 인증서의 값이라 만들 수 없습니다.",
      );
    case "0080":
      return fromFact(
        spec,
        facts.sellerQualityGuarantee,
        "판매자 설정 · 품질보증기준",
        "판매자 설정에 품질보증기준이 없습니다.",
      );
    case "0780": {
      /* 섬유제품은 치수로 대체 가능(공식 가이드라인). 치수가 없으면 중량을 본다. */
      const sizes = (facts.sizeValues ?? []).map((value) => value.trim()).filter(Boolean);
      if (sizes.length > 0) return filled(spec, sizes.join(", "), "상품정보 · 치수(사이즈 옵션)");
      return fromFact(spec, facts.weight, "상품정보 · 중량", "상품정보에 치수도 중량도 없습니다.");
    }
    case "0070": {
      const maker = clean(facts.manufacturer);
      const importer = clean(facts.importer);
      if (!maker && !importer) return needsInput(spec, "상품정보·판매자 설정 어디에도 제조자/수입자가 없습니다.");
      /* 🔴 구분자 ` / ` 는 «우리가 정한 표기» 다. 공식 형식이 문서에 없다 —
         문의에 넣어 두었다. 값 자체를 만들지는 않았다. */
      return filled(spec, [maker, importer].filter(Boolean).join(" / "), "상품정보 · 제조사/수입사");
    }
    case "0210": {
      const item = clean(facts.itemName);
      const model = clean(facts.modelName);
      if (item && model) return filled(spec, `${item} / ${model}`, "상품정보 · 품명, 모델명");
      /* 🔴 상품코드(SKU)를 모델명으로 «간주하지 않는다». 상품명에서 잘라 만들지도
         않는다 — N-3.44 의 결론이고 CPO 가 다시 못박았다. */
      return needsInput(
        spec,
        "상품정보에 품명 또는 모델명이 없습니다. 상품코드(SKU)를 모델명으로 대신 쓰지 않습니다.",
      );
    }
    case "0090": {
      /* 🔴 COMMON-AS-PHONE-SEPARATION-01 — 번호는 «번호 칸» 에서만 온다.
         `sellerAsContactNumber`(안내 문구)를 여기에 쓰지 않는다: 그 칸에는
         「해외 구매대행으로 A/S 불가」 같은 문장이 들어 있고(네이버 고시용으로
         실측 통과한 값이다), 그것을 전화번호 자리에 넣으면 고시가 거짓이 된다. */
      const phone = clean(facts.sellerAsPhoneNumber);
      const company = clean(facts.sellerAsCompanyName);
      if (company && phone && looksLikePhoneNumber(phone)) {
        return filled(spec, `${company} / ${phone}`, "판매자 설정 · A/S 업체명, 전화번호");
      }
      /* 🔴 값이 «있는데» 번호가 아니면 「자동 입력」이라고 말하지 않는다.
         이것이 INVALID 를 만든 이유다 — 있다고 충족된 것이 아니다. */
      if (phone && !looksLikePhoneNumber(phone)) {
        return invalid(
          spec,
          company ? `${company} / ${phone}` : phone,
          "A/S 전화번호가 번호 형식이 아닙니다. 안내 문구는 「A/S 안내」 칸에 적어주세요 — 이 항목은 «번호» 를 요구합니다.",
        );
      }
      /* 🔴 번호만으로는 「업체명과 전화번호 «모두»」를 만족하지 못한다. 그리고
         업체명을 판매자명이나 제조사로 «대신 넣지 않는다»(CPO 금지). 우리 설정에
         그 칸 자체가 없어서 셀러가 채울 수도 없다 — 그래서 BLOCKED 다. */
      return blocked(
        spec,
        phone
          ? "A/S 전화번호는 있으나 「A/S 책임 업체명」이 비어 있습니다. 고시는 업체명과 전화번호를 모두 요구합니다."
          : "판매자 설정에 A/S 책임 업체명과 전화번호가 없습니다.",
      );
    }
    case "0220":
      /* 🔴 시즌 코드(`SS26` 등)는 출시년월이 아니다. 우리 상품 모델에 이 값을
         담을 자리 자체가 없다. */
      return blocked(spec, "동일모델의 출시년월을 담을 자리가 상품정보에 없습니다. 시즌 코드를 출시년월로 바꾸지 않습니다.");
    case "1830":
      /* 🔴 「착용 또는 탑승용처럼 제한이 있는 품목의 경우」라는 조건부 항목이다.
         해당하지 않을 때 무엇을 넣어야 하는지(공란/「해당없음」)를 모른다. */
      return blocked(spec, "해당하지 않는 상품에 무엇을 적어야 하는지 기준을 확인하지 못했습니다.");
    default:
      /* 표에는 있는데 이 파일이 다루지 않는 코드. 조용히 통과시키지 않는다. */
      return blocked(spec, "이 항목을 채우는 규칙이 아직 없습니다.");
  }
}

/**
 * 품목코드와 우리가 가진 값으로 고시 항목을 푼다.
 *
 * 🔴 모르는 품목이면 `schemaKnown: false` 이고 항목을 «만들지 않는다». 빈 배열을
 * 「채울 게 없다」로 읽어 통과시키면 고시 없는 상품이 나간다.
 */
export function resolveLotteOnNotice(
  pdItmsCd: string | null | undefined,
  facts: LotteOnNoticeFacts,
): LotteOnNoticeResolution {
  const schema = noticeSchemaFor(pdItmsCd);
  if (!schema) return { schemaKnown: false, fills: [], articles: [] };

  const fills = schema.map((spec) => resolveOne(spec, facts));
  const articles = fills
    .filter((fill): fill is Extract<LotteOnNoticeFill, { status: "FILLED" }> => fill.status === "FILLED")
    .map((fill) => ({ pdArtlCd: fill.code, pdArtlCnts: fill.value }));
  return { schemaKnown: true, fills, articles };
}
