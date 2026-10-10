import { type LotteOnNoticeArticleSpec } from "./notice-schema";
/* B⑥(2026-10-10) — 🔴 항목 집합·순서·필수여부는 **공통 모델** 이 정한다.
   라벨·가이드라인은 여전히 롯데ON 전사본(notice-schema.ts)에서 온다. */
import { lotteOnNoticeSpecs } from "../notice/channel-notice-adapters";

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
  /**
   * LOTTEON-FINAL-05 #2 — 판매자가 신고한 **안전인증 대상 여부**.
   *
   * 🔴 왜 고시 resolver 가 이것을 보는가: 롯데ON 에는 KC 문이 «둘» 이다.
   * `sftyAthnLst`(안전인증 목록)와 고시 항목 `0200`(KC 인증정보). 대상 아님을
   * 고른 판매자가 앞의 문만 통과하고 뒤의 문에서 다시 막히면, 화면은
   * 「고르면 된다」고 말해 놓고 실제로는 고를 수 없는 상태가 된다.
   *
   * 🔴 `undefined` 는 「대상 아님」이 아니다 — 아래에서 «EXCLUDED 일 때만» 쓴다.
   */
  safetyTarget?: "TARGET" | "EXCLUDED" | null;

  /**
   * 셀러가 «사람이 읽는 값» 으로 직접 채운 고시 항목. 키는 항목코드다.
   *
   * 🔴 셀러는 이 키(`0220` 같은 것)를 **보지 않는다** — 화면은 항목명으로 묻고
   * 코드 매핑은 우리가 한다(`notice-schema.ts` 가 code↔label 을 안다).
   * 🔴 `LOTTEON_SELLER_FILLABLE_ARTICLE_CODES` 밖의 키는 **무시된다.**
   */
  sellerArticleValues?: Readonly<Record<string, string>>;

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

/**
 * 🔴 셀러가 «직접 채울 수 있는» 고시 항목 — **화이트리스트다.**
 *
 * 왜 화이트리스트인가: 전 항목을 열면 셀러가 `0200`(KC 인증정보)에 아무 문자열이나
 * 넣을 수 있다. 이 저장소의 고정 원칙은 「KC 값을 지어내지 않는다」이고(「12313ㄹㅇ」
 * 사건), 그 원칙이 셀러 입력으로 우회되면 안 된다.
 *
 * 이 둘만 여는 근거(공식 PDF 전수 확인, `LOTTEON-CREATE-POLICY-BOUNDARY-01`):
 *   `0220` 작성 가이드라인이 14개 품목 «전부 공란» — 우리가 정할 근거가 없다
 *   `1830` 「제한이 있는 품목의 경우 반드시 기재」까지만 규정 — 없을 때는 미규정
 * 둘 다 **상품정보에서 파생할 수 없고, 셀러는 안다.**
 *
 * 🔴 항목을 더할 때는 「우리가 못 만드는가」가 아니라 **「셀러가 실제로 아는가」**
 * 를 묻는다. KC 인증번호는 셀러가 «가질 수도 있지만» 형식·진위를 우리가 못 보므로
 * 여기 넣지 않는다 — 별도 축(`sftyAthnLst`)에서 다룬다.
 */
export const LOTTEON_SELLER_FILLABLE_ARTICLE_CODES = ["0220", "1830", "0040"] as const;

/**
 * 🔴 **「상품 상세페이지 참조」로 일괄 채워도 되는 항목** — 위와 «다른 집합» 이다.
 *
 * ── 왜 갈라야 했나 (CPO 결정 ⓑ, 2026-10-06) ───────────────────────────────
 * 하나의 상수가 세 권한을 동시에 열고 있었다:
 *     ① resolveOne 이 셀러 입력값을 먼저 읽는다
 *     ② 화면이 입력칸을 그린다
 *     ③ 🔴 일괄 「상세페이지 참조」 대상이 된다
 * 그래서 `0040`(제조연월)을 ①②를 위해 더하면 ③까지 따라왔다. 그런데
 *
 *     셀러 입력 가능   ≠   상세페이지 참조 가능
 *
 * 이다. 제조연월은 **상세페이지에도 없다**(source 전수 0). 거기에 참조 문구를
 * 넣으면 실제 정보를 채우는 것이 아니라 **없는 정보를 「참조」라는 말로
 * 우회하는 것**이 된다 — 「임의 기본값 금지」를 상투어로 세탁하는 모양이다.
 *
 * ── 🔴 왜 «빼서» 만들지 않는가 ────────────────────────────────────────────
 * 공통 쪽(`notice/bulk-reference.ts`)은 `화이트리스트 − 제외` 로 만든다. 그쪽
 * 화이트리스트는 `reference-eligibility.ts` 가 **「참조로 대체해도 되는가」**
 * 를 이미 검증한 목록이라 그 방향이 안전하다.
 *
 * 여기는 다르다. `SELLER_FILLABLE` 이 검증한 것은 **「셀러가 실제로 아는가」**
 * 이고 그것은 다른 질문이다. 빼서 만들면 **나중에 더해지는 항목이 기본으로
 * 참조 가능**해진다 — 규제 값에서 안전한 기본값은 «열림» 이 아니라 «닫힘» 이다.
 * 그래서 명시적 opt-in 으로 둔다. 두 목록이 엇나가지 않게 **부분집합 불변식을
 * 테스트가 지킨다**(bulk ⊆ sellerFillable).
 */
export const LOTTEON_BULK_REFERENCE_ARTICLE_CODES = ["0220", "1830"] as const;

/**
 * LOTTEON-FINAL-05 #2 — 고시 `0200`(KC 인증정보)에 「대상 아님」을 적는 말.
 *
 * 🔴 우리가 지어낸 표현이 아니다. 같은 상품정보제공고시 화면이 「크기·체중의
 * 한계」 같은 칸에 쓰는 공식 표현이고, 스마트스토어 쪽에서 같은 자리에 이미
 * 쓰고 있다(`KIDS_CERTIFICATION_NOT_APPLICABLE`).
 *
 * 🔴 상수를 두 채널이 «공유하지» 않는다. 문자열이 같은 것은 우연이 아니라
 * 같은 법정 고시라서지만, 한쪽 채널이 표기를 바꿔야 할 때 다른 채널까지
 * 끌려가면 그것이 곧 「Commerce 가 Common 을 잡아당기는」 방향이다.
 */
export const LOTTEON_CERTIFICATION_NOT_APPLICABLE = "해당사항 없음";

export function isLotteOnSellerFillableArticle(code: string): boolean {
  return (LOTTEON_SELLER_FILLABLE_ARTICLE_CODES as readonly string[]).includes(code);
}

/** 🔴 일괄 「상세페이지 참조」 대상인가. 입력 가능 여부와 «다른 질문» 이다. */
export function isLotteOnBulkReferenceArticle(code: string): boolean {
  return (LOTTEON_BULK_REFERENCE_ARTICLE_CODES as readonly string[]).includes(code);
}

function resolveOne(spec: LotteOnNoticeArticleSpec, facts: LotteOnNoticeFacts): LotteOnNoticeFill {
  /* ══ LOTTEON-NOTICE-SELLER-CONFIRMATION-01 ═══════════════════════════════
     🔴 셀러가 넣은 값이 «있으면» 그것이 먼저다. 화이트리스트 밖은 지나간다.

     🔴 여기가 switch «앞» 이어야 한다. 뒤에 두면 0220/1830 이 자기 case 에서
     먼저 NEEDS_INPUT 을 돌려주고 셀러 값이 영원히 무시된다 — 그러면 payload 에는
     값이 가는데(build-context 의 mergeNoticeArticles 가 폼을 우선한다) 화면은
     「입력 필요」로 남는 «갈라짐» 이 생긴다. 그 갈라짐이 STEP3-FIX 의 병이다. */
  if (isLotteOnSellerFillableArticle(spec.code)) {
    const entered = clean(facts.sellerArticleValues?.[spec.code]);
    if (entered) return filled(spec, entered, "판매자 입력 · 고시 항목");
  }

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
      /* ══ LOTTEON-FINAL-05 #2 ═══════════════════════════════════════════════
         🔴 실제 인증번호가 «먼저» 다. 판매자가 번호를 적어 두었다면 선언이
         그것을 덮지 않는다(스마트스토어 resolveKidsCertificationTypeNotice 와
         같은 순서다 — 선언이 입력을 이기지 않는다).

         🔴 그리고 여기서 **판정하지 않는다.** 「이 상품은 인증 대상이 아니다」는
         따져의 판단이 아니라, 판매자가 인증 섹션에서 직접 고른 신고를 고시의
         필수 문자열로 «옮겨 적는» 것뿐이다. 그래서 EXCLUDED 일 때만 쓰고,
         미선택(undefined)은 예전 그대로 「입력 필요」로 남는다. */
      if (!clean(facts.kcCertificationNumber) && facts.safetyTarget === "EXCLUDED") {
        return filled(spec, LOTTEON_CERTIFICATION_NOT_APPLICABLE, "판매자 신고 · 인증 대상 아님");
      }
      return fromFact(
        spec,
        facts.kcCertificationNumber,
        "상품정보 · KC 인증번호",
        "KC 인증번호가 없습니다. 인증번호는 실제 인증서의 값이라 만들 수 없습니다. 이 상품이 인증 대상이 아니라면 인증 섹션에서 「인증 대상 아님」을 선택해 주세요.",
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
         문의에 넣어 두었다. 값 자체를 만들지는 않았다.
         🔴 LOTTEON-FINAL-06 — 같은 값이면 «한 번만» 적는다. 둘 다 「상품 상세페이지
         참조」로 처리된 상품이 「상품 상세페이지 참조 / 상품 상세페이지 참조」로
         나가고 있었다(중복은 우리가 만든 표기지 셀러가 적은 값이 아니다). */
      return filled(spec, [...new Set([maker, importer].filter(Boolean))].join(" / "), "상품정보 · 제조사/수입사");
    }
    case "0210": {
      const item = clean(facts.itemName);
      const model = clean(facts.modelName);
      /* 🔴 LOTTEON-FINAL-06 — 0070 과 같은 규칙: 같은 값이면 한 번만 적는다. */
      if (item && model) return filled(spec, [...new Set([item, model])].join(" / "), "상품정보 · 품명, 모델명");
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
    /* ══════════════════════════════════════════════════════════════════════
       품목 01「의류」 — 🔴 **품목 23 과 «코드가 다르다»** (P0-3, 2026-10-06)
       ══════════════════════════════════════════════════════════════════════

       CEO 보고: 테니스 의류가 `9999 상품품목항목코드 필수값 누락` 으로 막힘.
       원인은 값이 없는 것이 «아니라» 이 switch 가 품목 23 어휘로만 짜여 있던
       것이다. `notice-schema.ts` 는 품목 01 을 제대로 담고 있었고(9항목),
       resolver 가 따라가지 않아 넷이 `default:` → BLOCKED 로 떨어졌다:

           소재      의류 0010  ↔  어린이 0410「재질」
           치수      의류 0030  ↔  어린이 0780「크기, 중량」
           세탁방법  의류 0050  ↔  어린이 0800「취급방법…안전표시」
           제조연월  의류 0040  ↔  어린이 0220「동일모델의 출시년월」

       🔴 그래서 **품목 23 case 를 재사용하지 않는다.** 코드가 같은 뜻이라는
       보장이 없다 — `notice-schema.ts` 맨 위가 그 함정을 미리 적어 두었다
       (164개 코드를 40품목이 공유하지만 이름이 갈리는 것들이 실제로 있다). */
    case "0010":
      /* 품목 23 의 `0410`「재질」과 «같은 출처» 다. 코드만 다르다. */
      return fromFact(spec, facts.material, "상품정보 · 소재", "상품정보에 소재가 없습니다.");
    case "0030": {
      /* 🔴 `0780`「크기, 중량」과 **다르다.** 0780 은 공식 가이드라인이
         「섬유제품 등의 경우 치수 정보로 대체 가능」이라고 적어 두어 치수→중량
         폴백이 있다. 0030 은 항목명 자체가 「치수」다 — **중량은 치수가 아니므로
         폴백하지 않는다**(CPO 확정). 폴백을 넣으면 셀러가 확인한 적 없는
         「500g」이 치수 칸에 들어간다. */
      const sizes = (facts.sizeValues ?? []).map((value) => value.trim()).filter(Boolean);
      if (sizes.length > 0) return filled(spec, sizes.join(", "), "상품정보 · 치수(사이즈 옵션)");
      return needsInput(spec, "상품정보에 치수(사이즈 옵션)가 없습니다. 중량을 치수로 대신 적지 않습니다.");
    }
    case "0050":
      /* 🔴 `0800`「취급방법 및 취급시 주의사항, 안전표시」보다 **좁다** —
         이것은 「세탁방법」이다. `careInstructions` 가 그 자리의 값이다. */
      return fromFact(spec, facts.careInstructions, "상품정보 · 세탁방법", "상품정보에 세탁방법이 없습니다.");
    case "0040":
      /* 🔴 source 가 전수 0 이다(Master·crawler·DB·3채널). 크롤러의 시즌코드는
         `brand-resolver.ts` 가 브랜드명에서 지울 쓰레기로 쓰고 버린다.

         🔴 `0220`「동일모델의 출시년월」의 case 를 재사용하지 «않는다» —
         **만든 때 ≠ 모델이 나온 때** 다. 다른 사실이다.

         🔴 셀러 입력은 열려 있고(`LOTTEON_SELLER_FILLABLE_ARTICLE_CODES`),
         일괄 「상세페이지 참조」는 **닫혀 있다**(`LOTTEON_BULK_REFERENCE_…` 에
         없다). 상세페이지에도 제조연월이 없어서 참조가 「없는 정보를 가리키는
         것」이 되기 때문이다(CPO 결정 ⓑ). */
      return needsInput(spec, "제조연월을 입력해 주세요. 상품정보에서 찾을 수 없는 값이라 지어내지 않습니다.");
    case "0220":
      /* 🔴 시즌 코드(`SS26` 등)는 출시년월이 «아니다». 상품정보에 담을 자리도 없다
         (SOURCE_ABSENT 확정). 그래서 우리가 만들지 않고 «셀러가 넣는다» —
         공식 PDF 를 전수 확인한 결과 이 항목의 작성 가이드라인은 14개 품목
         전부 공란이라, 우리가 형식을 정할 근거도 없다. */
      return needsInput(spec, "동일모델의 출시년월을 입력해 주세요. 상품정보에서 찾을 수 없는 값이라 지어내지 않습니다.");
    case "1830":
      /* 🔴 「착용 또는 탑승용처럼 제한이 있는 품목의 경우」라는 조건부 항목이다.
         제한이 «있는지» 는 셀러가 안다. 공식 PDF 에 「해당 없을 때」 규정이 없어
         우리가 「해당없음」을 자동 생성하지 않는다 — 셀러가 적는다. */
      return needsInput(spec, "크기·체중에 제한이 있으면 그 내용을, 없으면 없다는 사실을 입력해 주세요.");
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
  /* 🔴 B⑥ — 공통 모델이 정한 항목·순서로 받는다. `null` 은 「이 품목을 모른다」
     이고, 공통 모델과 채널 전사본이 어긋난 경우도 여기로 떨어진다(fail closed).
     규제 항목을 하나 빼고 내보내는 것은 통과가 아니라 잘못된 신고다. */
  const schema = lotteOnNoticeSpecs(pdItmsCd);
  if (!schema) return { schemaKnown: false, fills: [], articles: [] };

  const fills = schema.map((spec) => resolveOne(spec, facts));
  const articles = fills
    .filter((fill): fill is Extract<LotteOnNoticeFill, { status: "FILLED" }> => fill.status === "FILLED")
    .map((fill) => ({ pdArtlCd: fill.code, pdArtlCnts: fill.value }));
  return { schemaKnown: true, fills, articles };
}
