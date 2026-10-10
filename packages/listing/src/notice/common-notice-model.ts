import type { NoticeCategoryKind } from "./notice-category";

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 공통 고시정보 모델 — 「의미/항목/필수여부」와 「채널 코드」를 갈라 둔다
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 의미 «판정» 은 이미 `resolveNoticeCategory()` 한 곳에 있다(KIDS_APPAREL /
 * APPAREL / UNKNOWN). 없던 것은 그 의미 «안의 항목» 과 **필수여부** 를 공통으로
 * 관리하는 자리다. 지금은 세 채널이 각자 들고 있다:
 *
 *     LotteON   notice-schema.ts        품목 01(9항목) · 23(13항목) + required
 *     Naver     build-payload.ts        kids(13칸) · wear(8칸) 하드코딩
 *     Coupang   카테고리 메타 조회       항목·필수여부를 «런타임에» 받는다
 *
 * ── 🔴 이 파일이 하지 «않는» 것 ─────────────────────────────────────────────
 *
 * **payload 를 만들지 않는다.** 세 채널 builder 를 이 모델로 교체하는 것은
 * 등록 경로 셋을 동시에 바꾸는 일이고, 실등록이 STOP 인 지금은 그 변경을
 * Production 에서 증명할 방법이 없다. 증명 못 하는 payload 변경은 「먼저
 * capability 를 올리는」 바로 그 패턴이다(쿠팡에서 가드 22개가 잡은 그것).
 *
 * 그래서 이 모델은 **지금은 관측·대조용** 이다. 각 채널의 기존 매핑과 이 모델이
 * «일치하는지» 를 테스트가 전수로 대조한다(common-notice-parity.test.ts).
 * 교체는 실등록 해제 뒤에, 채널 하나씩, 그 가드를 들고 한다.
 *
 * ── 🔴 1:1 이 아닌 것을 1:1 로 적지 않는다 ──────────────────────────────────
 *
 * 공통 모델이 거짓말하기 가장 쉬운 자리가 여기다:
 *
 *     LotteON 23 `0780` = 「크기, 중량」      ← 한 칸에 둘이 들어 있다
 *     Naver   KIDS      = `size` + `weight`  ← 두 칸으로 나뉜다
 *     LotteON 23 `0210` = 「품명 및 모델명」   ← 한 칸
 *     Naver   KIDS      = `itemName` + `modelName`
 *
 * 그래서 채널 매핑은 **코드 «배열»** 을 들고, 합쳐지거나 나뉘는 사실을 `note` 에
 * 적는다. 코드 하나를 억지로 고르면 나머지 한 칸이 조용히 사라진다.
 *
 * ── 🔴 근거 없는 항목을 만들지 않는다 ───────────────────────────────────────
 *
 * 모든 항목과 매핑에 `evidence` 가 붙는다. 근거가 없으면 값을 지어내는 대신
 * `UNKNOWN` 으로 남긴다 — 규제/고시 필드에서 추론 생성은 금지다.
 */

/** 공통 «의미» 키. 🔴 채널 코드가 아니다 — 코드는 매핑이 들고 있다. */
export type NoticeSemanticKey =
  | "material"
  | "color"
  | "size"
  | "weight"
  | "sizeWeightLimit"
  | "itemAndModelName"
  | "recommendedAge"
  | "manufacturer"
  | "countryOfOrigin"
  | "careInstructions"
  | "packDate"
  | "releaseDate"
  | "qualityGuarantee"
  | "asContact"
  | "kcCertification";

/**
 * 🔴 `UNKNOWN` 이 「선택」이 아니다. 「그 채널이 필수라고 하는지 우리가 확인하지
 *    못했다」는 뜻이고, 그래서 화면은 이것을 「입력하지 않아도 된다」로 번역하면
 *    안 된다. 두 사실을 같은 칸에 적지 않기 위해 세 값으로 둔다.
 */
export type NoticeRequiredness = "REQUIRED" | "OPTIONAL" | "UNKNOWN";

export type NoticeChannel = "NAVER" | "COUPANG" | "LOTTEON";

export type ChannelNoticeMapping = {
  channel: NoticeChannel;
  /**
   * 그 채널에서 이 의미가 들어가는 자리. 🔴 **빈 배열 = 「대응하는 칸을
   * 확인하지 못했다」** 이고, 「그 채널은 이 정보를 요구하지 않는다」가 아니다.
   * 둘은 다른 사실이므로 `note` 가 어느 쪽인지 적는다.
   */
  codes: readonly string[];
  /** `null` = 채널 고유 규정을 확인하지 못했다 → 공통값을 그대로 본다. */
  required: NoticeRequiredness | null;
  evidence: string;
  note?: string;
};

export type CommonNoticeItem = {
  semanticKey: NoticeSemanticKey;
  /** 셀러가 보는 이름. 🔴 고시 표의 이름을 쓰고 우리가 짓지 않는다. */
  label: string;
  /**
   * 고시 «제도» 상 이 품목에서 필수인가.
   * 🔴 채널의 집행 강도와 다른 사실이다 — 채널이 더 느슨하면 그것은 override 다.
   */
  required: NoticeRequiredness;
  evidence: string;
  mappings: readonly ChannelNoticeMapping[];
};

export type CommonNoticeModel = {
  kind: NoticeCategoryKind;
  /** 🔴 `false` = 항목표가 준비되지 않았다. 이때 `items` 는 «빈 배열» 이고,
   *  호출부는 항목을 지어내지 말고 그 사실을 그대로 보여야 한다. */
  ready: boolean;
  /** 셀러/화면에 보여줄 한 줄. ready=false 일 때 이유가 여기 있다. */
  reason: string;
  items: readonly CommonNoticeItem[];
};

/* ── 근거 출처 ───────────────────────────────────────────────────────────────
   🔴 공통 `required` 의 유일한 근거다. 상품정보제공고시는 채널 정책이 아니라
   국내 고시이고, 우리가 실제로 확보한 전사본은 롯데ON 이 배포한 항목표다
   (`LOTTEON_NOTICE_SCHEMA_SOURCE`, 2023-01-01 개정 반영). 그 표의 「필수여부」
   열이 품목 01·23 모두 전 항목 Y 다.

   🔴 그것을 「세 채널 전부가 거부한다」로 읽지 않는다 — 채널의 집행은 별개이고,
   실제로 쿠팡은 항목별로 MANDATORY/OPTIONAL 을 따로 내려준다. 그래서 공통값과
   채널 override 를 갈라 둔다. */
const LOTTEON_TABLE = "롯데ON 배포 고시 항목표(2023-01-01 개정 반영) 「필수여부」 열 = Y";
const NAVER_BUILDER = "packages/listing/src/naver/build-payload.ts 의 productInfoProvidedNotice 칸";
const LOTTEON_SCHEMA = "packages/listing/src/lotteon/notice-schema.ts 의 pdArtlCd";
/** 🔴 쿠팡은 고정 코드가 없다 — 카테고리 메타 조회가 항목과 필수여부를 정한다. */
const COUPANG_RUNTIME =
  "쿠팡은 카테고리 메타(noticeCategoryDetailNames)가 항목명과 MANDATORY/OPTIONAL 을 런타임에 내려준다 — 고정 코드가 없다";

function coupang(note?: string): ChannelNoticeMapping {
  return { channel: "COUPANG", codes: [], required: "UNKNOWN", evidence: COUPANG_RUNTIME, note };
}

function naver(codes: readonly string[], required: NoticeRequiredness | null, note?: string): ChannelNoticeMapping {
  return { channel: "NAVER", codes, required, evidence: NAVER_BUILDER, note };
}

function lotteon(codes: readonly string[], note?: string): ChannelNoticeMapping {
  return { channel: "LOTTEON", codes, required: "REQUIRED", evidence: LOTTEON_SCHEMA, note };
}

/** 그 채널에 대응하는 칸을 확인하지 못했을 때. 🔴 「요구하지 않는다」가 아니다. */
function noSlot(channel: NoticeChannel, why: string): ChannelNoticeMapping {
  return { channel, codes: [], required: null, evidence: why, note: "대응하는 칸을 확인하지 못했다" };
}

const NAVER_ORIGIN_IS_ELSEWHERE =
  "네이버는 원산지를 고시 칸이 아니라 payload 의 originAreaCode 로 받는다 — 같은 칸이 아니다";

/* ══════════════════════════════════════════════════════════════════════════════
   APPAREL — 롯데ON 품목 01 「의류」 9항목 기준
   ══════════════════════════════════════════════════════════════════════════════ */
const APPAREL_ITEMS: readonly CommonNoticeItem[] = [
  {
    semanticKey: "material",
    label: "제품 소재",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [naver(["material"], null), lotteon(["0010"]), coupang()],
  },
  {
    semanticKey: "color",
    label: "색상",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [naver(["color"], null), lotteon(["0020"]), coupang()],
  },
  {
    semanticKey: "size",
    label: "치수",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [naver(["size"], null), lotteon(["0030"]), coupang()],
  },
  {
    semanticKey: "manufacturer",
    label: "제조자·수입자",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [naver(["manufacturer"], null), lotteon(["0070"]), coupang()],
  },
  {
    semanticKey: "countryOfOrigin",
    label: "제조국",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [noSlot("NAVER", NAVER_ORIGIN_IS_ELSEWHERE), lotteon(["0060"]), coupang()],
  },
  {
    semanticKey: "careInstructions",
    label: "세탁방법",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [
      naver(["caution"], null, "네이버는 세탁방법과 취급주의를 `caution` 한 칸으로 받는다"),
      lotteon(["0050"]),
      coupang(),
    ],
  },
  {
    semanticKey: "packDate",
    label: "제조연월",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [
      /* 🔴 여기만 네이버 override 가 «실측 근거» 를 갖는다 —
         NAVER_NOTICE_REQUIRED_CONFIRMED.packDate = true (빈 값이 거부됐다). */
      naver(["packDateText"], "REQUIRED", "실측: 빈 값이 거부됐다(NAVER_NOTICE_REQUIRED_CONFIRMED)"),
      lotteon(["0040"]),
      coupang(),
    ],
  },
  {
    semanticKey: "qualityGuarantee",
    label: "품질보증기준",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [naver(["warrantyPolicy"], null), lotteon(["0080"]), coupang()],
  },
  {
    semanticKey: "asContact",
    label: "A/S",
    required: "REQUIRED",
    /* 🔴 품목 01 의 이름은 「A/S」로 전사돼 있다. 품목 23 의 「A/S 책임자와
       전화번호」를 여기로 옮겨오지 않는다 — notice-schema.ts 가 같은 이유로
       옮기지 않았고, 항목코드는 품목마다 이름이 갈릴 수 있다. */
    evidence: `${LOTTEON_TABLE} · 이름은 품목 01 전사본 그대로`,
    mappings: [naver(["afterServiceDirector"], null), lotteon(["0090"]), coupang()],
  },
];

/* ══════════════════════════════════════════════════════════════════════════════
   KIDS_APPAREL — 롯데ON 품목 23 「어린이제품」 13항목 기준
   ══════════════════════════════════════════════════════════════════════════════ */
const KIDS_APPAREL_ITEMS: readonly CommonNoticeItem[] = [
  {
    semanticKey: "itemAndModelName",
    label: "품명 및 모델명",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [
      naver(["itemName", "modelName"], null, "네이버는 품명과 모델명을 «두 칸» 으로 받는다"),
      lotteon(["0210"], "롯데ON 은 한 칸에 둘을 함께 적는다"),
      coupang(),
    ],
  },
  {
    semanticKey: "kcCertification",
    label: "KC 인증정보",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [naver(["certificationType"], null), lotteon(["0200"]), coupang()],
  },
  {
    semanticKey: "size",
    label: "크기, 중량",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [
      naver(["size"], null),
      lotteon(["0780"], "🔴 중량과 «같은 칸» 이다 — weight 매핑도 0780 을 가리킨다"),
      coupang(),
    ],
  },
  {
    semanticKey: "weight",
    label: "중량",
    required: "REQUIRED",
    evidence: `${LOTTEON_TABLE} · 품목 23 은 크기와 중량이 한 항목(0780)이다`,
    mappings: [
      naver(["weight"], null, "네이버는 중량을 별도 칸으로 받는다"),
      lotteon(["0780"], "🔴 치수와 «같은 칸» 이다"),
      coupang(),
    ],
  },
  {
    semanticKey: "color",
    label: "색상",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [naver(["color"], null), lotteon(["0020"]), coupang()],
  },
  {
    semanticKey: "material",
    label: "재질",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [naver(["material"], null), lotteon(["0410"]), coupang()],
  },
  {
    semanticKey: "recommendedAge",
    label: "사용연령 또는 권장사용연령",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [naver(["recommendedAge"], null), lotteon(["0790"]), coupang()],
  },
  {
    semanticKey: "sizeWeightLimit",
    label: "크기ㆍ체중의 한계",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [
      /* 🔴 네이버 kids 13칸에 이 의미의 칸이 «없다». 「요구하지 않는다」고
         단정하지 않는다 — 우리가 확인한 것은 「우리 payload 에 자리가 없다」뿐이다. */
      noSlot("NAVER", "네이버 kids 칸 13개에 대응하는 자리가 확인되지 않았다"),
      lotteon(["1830"]),
      coupang(),
    ],
  },
  {
    semanticKey: "releaseDate",
    label: "동일모델의 출시년월",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [
      /* 🔴 네이버 쪽 required 는 «확인되지 않았다» — NAVER_NOTICE_REQUIRED_CONFIRMED
         가 releaseDate 를 false 로 적어 두었지만 그 파일 스스로 근거가 없다고
         적고 있다. 그래서 OPTIONAL 이 아니라 UNKNOWN 이다. */
      naver(["releaseDateText"], "UNKNOWN", "근거 미확보 — 「선택」으로 단정하지 않는다"),
      lotteon(["0220"]),
      coupang(),
    ],
  },
  {
    semanticKey: "manufacturer",
    label: "제조자, 수입자",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [naver(["manufacturer"], null), lotteon(["0070"]), coupang()],
  },
  {
    semanticKey: "countryOfOrigin",
    label: "제조국",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [noSlot("NAVER", NAVER_ORIGIN_IS_ELSEWHERE), lotteon(["0060"]), coupang()],
  },
  {
    semanticKey: "careInstructions",
    label: "취급방법 및 취급시 주의사항, 안전표시 (주의, 경고 등)",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [naver(["caution"], null), lotteon(["0800"]), coupang()],
  },
  {
    semanticKey: "qualityGuarantee",
    label: "품질보증기준",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [naver(["warrantyPolicy"], null), lotteon(["0080"]), coupang()],
  },
  {
    semanticKey: "asContact",
    label: "A/S 책임자와 전화번호",
    required: "REQUIRED",
    evidence: LOTTEON_TABLE,
    mappings: [naver(["afterServiceDirector"], null), lotteon(["0090"]), coupang()],
  },
];

/**
 * 그 의미의 공통 고시 모델.
 *
 * 🔴 `UNKNOWN` 은 항목을 «만들지 않는다». 품목을 모르면 항목표도 모르는 것이고,
 *    그때 빈 배열 + `ready:false` 를 돌려준다 — 화면이 이미 그렇게 말하고 있다
 *    (「이 고시 품목의 항목표는 아직 준비되지 않았습니다」).
 */
export function commonNoticeModelFor(kind: NoticeCategoryKind): CommonNoticeModel {
  switch (kind) {
    case "APPAREL":
      return {
        kind,
        ready: true,
        reason: "의류 고시 항목표(롯데ON 품목 01 기준) 9항목",
        items: APPAREL_ITEMS,
      };
    case "KIDS_APPAREL":
      return {
        kind,
        ready: true,
        reason: "어린이제품 고시 항목표(롯데ON 품목 23 기준) 13항목",
        items: KIDS_APPAREL_ITEMS,
      };
    default:
      return {
        kind: "UNKNOWN",
        ready: false,
        /* 🔴 그럴듯한 기본 품목으로 떨어뜨리지 않는다. 고시 품목을 잘못 고르면
           규제 필드를 틀리게 신고하는 것이고, 그건 조용히 넘길 사안이 아니다. */
        reason: "고시 품목을 판정하지 못했습니다 — 항목을 임의로 만들지 않습니다.",
        items: [],
      };
  }
}

/** 그 항목이 그 채널에서 들어가는 자리. 없으면 `undefined`(모델에 없는 의미다). */
export function channelNoticeMapping(
  kind: NoticeCategoryKind,
  semanticKey: NoticeSemanticKey,
  channel: NoticeChannel,
): ChannelNoticeMapping | undefined {
  const item = commonNoticeModelFor(kind).items.find((i) => i.semanticKey === semanticKey);
  return item?.mappings.find((m) => m.channel === channel);
}

/**
 * 그 채널에서의 필수여부.
 *
 * 🔴 **채널 override 가 공통값을 이긴다.** 그리고 override 가 없으면(`null`)
 *    공통값으로 내려간다 — 「채널이 말한 적 없다」를 「채널이 선택이라고 했다」로
 *    바꾸지 않는다. 작업지시서 B③ 이 든 예(Naver=필수 / Coupang=선택 /
 *    LotteON=필수)가 그대로 표현된다.
 */
export function noticeRequiredness(
  kind: NoticeCategoryKind,
  semanticKey: NoticeSemanticKey,
  channel: NoticeChannel,
): NoticeRequiredness {
  const model = commonNoticeModelFor(kind);
  const item = model.items.find((i) => i.semanticKey === semanticKey);
  if (!item) return "UNKNOWN";
  const mapping = item.mappings.find((m) => m.channel === channel);
  return mapping?.required ?? item.required;
}

/** 그 채널 코드 전수. parity 대조와 화면이 같은 출처를 쓰게 한다. */
export function channelNoticeCodes(kind: NoticeCategoryKind, channel: NoticeChannel): string[] {
  return commonNoticeModelFor(kind)
    .items.flatMap((item) => item.mappings.filter((m) => m.channel === channel).flatMap((m) => [...m.codes]))
    .filter((code, index, all) => all.indexOf(code) === index);
}
