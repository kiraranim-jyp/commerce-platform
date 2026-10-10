import { noticeSchemaFor, type LotteOnNoticeArticleSpec } from "../lotteon/notice-schema";
import {
  channelNoticeMapping,
  commonNoticeModelFor,
  noticeRequiredness,
  type NoticeRequiredness,
  type NoticeSemanticKey,
} from "./common-notice-model";
import type { NoticeCategoryKind } from "./notice-category";

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * B⑥ — Common Notice → Channel Adapter → payload (2026-10-10, CPO 승인)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 공통 모델이 «무엇이 필요한가» 를 정하고, 채널 파일이 «어떻게 불리는가» 를
 * 공급한다. 둘의 역할을 갈라 두는 것이 이 파일의 전부다.
 *
 *     공통 모델   semanticKey · 항목 집합 · 순서 · 필수여부   ← 여기서 온다
 *     채널 파일   label · guideline (고시 표의 «그 채널» 전사본)
 *
 * ── 🔴 왜 라벨을 공통으로 올리지 않는가 ────────────────────────────────────
 *
 * 롯데ON 품목 01 의 `0090` 은 「A/S」이고 품목 23 의 같은 코드는 「A/S 책임자와
 * 전화번호」다. **같은 코드의 이름이 품목마다 다르다.** 공통 라벨 하나로 덮으면
 * 우리가 이름을 지어내는 것이 된다 — `notice-schema.ts` 가 같은 이유로 품목 23 의
 * 이름을 품목 01 로 옮기지 않았다. 그 판단을 뒤집지 않는다.
 *
 * ── 🔴 어긋나면 «닫는다» (fail closed) ──────────────────────────────────────
 *
 * 공통 모델이 요구하는 코드가 채널 전사본에 없으면 **그 항목을 건너뛰지 않고
 * 품목 전체를 「모른다」로 만든다.** 규제 항목을 하나 빼고 내보내는 것은 통과가
 * 아니라 잘못된 신고다. 화면은 이미 그 상태를 말할 줄 안다 —
 * 「이 고시 품목의 항목표는 아직 준비되지 않았습니다」.
 *
 * 🔴 그 어긋남은 애초에 배포되지 못한다(`common-notice-parity.test.ts` 가
 *    양방향 전수 대조한다). fail closed 는 그 가드가 뚫렸을 때의 마지막 방어다.
 */

/** 롯데ON 품목코드 → 공통 의미. `lotteOnNoticeItemCodeFor` 의 역방향이다. */
export function noticeKindForLotteOnItemCode(code: string | null | undefined): NoticeCategoryKind {
  if (code === "01") return "APPAREL";
  if (code === "23") return "KIDS_APPAREL";
  /* 🔴 모르는 품목을 그럴듯한 쪽으로 떨어뜨리지 않는다. */
  return "UNKNOWN";
}

export type ChannelNoticeSlot = {
  semanticKey: NoticeSemanticKey;
  /** 그 채널의 코드/칸 이름. */
  code: string;
  /** 🔴 그 채널 기준 필수여부(공통값 + 채널 override). */
  required: NoticeRequiredness;
};

/**
 * 한 채널이 그 품목에서 쓰는 칸을 **공통 모델 순서대로** 돌려준다.
 *
 * 🔴 코드가 겹치면 «첫 등장» 만 남긴다. 롯데ON 품목 23 의 `0780` 은 「크기, 중량」
 *    한 칸인데 공통 모델에서는 `size` 와 `weight` 가 그것을 공유한다 — 두 번
 *    내보내면 payload 에 같은 코드가 중복된다.
 */
function slotsFor(kind: NoticeCategoryKind, channel: "NAVER" | "LOTTEON"): ChannelNoticeSlot[] {
  const seen = new Set<string>();
  const slots: ChannelNoticeSlot[] = [];
  for (const item of commonNoticeModelFor(kind).items) {
    const mapping = channelNoticeMapping(kind, item.semanticKey, channel);
    for (const code of mapping?.codes ?? []) {
      if (seen.has(code)) continue;
      seen.add(code);
      slots.push({
        semanticKey: item.semanticKey,
        code,
        required: noticeRequiredness(kind, item.semanticKey, channel),
      });
    }
  }
  return slots;
}

export function lotteOnNoticeSlots(kind: NoticeCategoryKind): ChannelNoticeSlot[] {
  return slotsFor(kind, "LOTTEON");
}

export function naverNoticeSlots(kind: NoticeCategoryKind): ChannelNoticeSlot[] {
  return slotsFor(kind, "NAVER");
}

/* ══════════════════════════════════════════════════════════════════════════════
   ① Naver — 공통 모델이 «집합·필수여부·타입» 을, 채널이 «순서·이름» 을 정한다
   ══════════════════════════════════════════════════════════════════════════════

   🔴 순서를 공통 모델에서 가져오지 «않는다». 라벨을 공통으로 올리지 않은 것과
   같은 이유다 — 순서는 채널 표기다. 실제로 둘은 다르다:

       공통 모델 KIDS 순서   품명·KC·크기·중량·색상·재질·사용연령 …(고시 표 순서)
       네이버 payload 순서    material·color·size·manufacturer·caution …

   롯데ON 에서는 둘이 우연히 일치했지만(공통 모델을 고시 표 순서로 적었다),
   네이버는 자기 순서를 갖는다. 모델 순서로 바꾸면 payload 의 키 순서가 바뀌고,
   그것은 **「payload shape 유지」를 깨는 변경** 이다. 그래서 채널 순서를 쓴다.

   🔴 대신 **집합이 어긋나면 닫는다.** 아래 목록과 공통 모델의 네이버 코드 집합이
   양방향으로 같은지는 테스트가 전수 대조한다. */

/** 🔴 네이버 payload 의 키 «순서» 다. 기존 build-payload 의 객체 리터럴 순서를
 *  그대로 옮긴 것이고, 바꾸면 payload shape 가 바뀐다. */
const NAVER_FIELD_ORDER = {
  KIDS: [
    "material",
    "color",
    "size",
    "manufacturer",
    "caution",
    "recommendedAge",
    "warrantyPolicy",
    "afterServiceDirector",
    "itemName",
    "modelName",
    "weight",
    "certificationType",
    "releaseDateText",
  ],
  WEAR: [
    "material",
    "color",
    "size",
    "manufacturer",
    "caution",
    "warrantyPolicy",
    "afterServiceDirector",
    "packDateText",
  ],
} as const satisfies Record<"KIDS" | "WEAR", readonly string[]>;

export type NaverNoticeType = "KIDS" | "WEAR";

/**
 * 🔴 기존 `naverNoticeTypeFor()` 와 **같은** 판정이다 — UNKNOWN 은 WEAR 다.
 *
 * 그것을 「모르니까 닫는다」로 바꾸지 «않는다». 네이버 입력에는 카테고리 경로가
 * 없어서 UNKNOWN 이 흔하고, 지금 그 상품들은 일반 의류로 정상 등록되고 있다.
 * 여기서 닫으면 **돌고 있는 등록이 깨진다.** 이것은 drift 가 아니라 기록된
 * Known Unknown 이다(한 번 KIDS 로 바꿨다가 선재 테스트 7건이 잡아 되돌렸다).
 */
export function naverNoticeTypeForKind(kind: NoticeCategoryKind): NaverNoticeType {
  return kind === "KIDS_APPAREL" ? "KIDS" : "WEAR";
}

/** 그 네이버 타입이 «공통 모델에서» 어느 의미에 해당하는가. */
function modelKindForNaverType(type: NaverNoticeType): NoticeCategoryKind {
  return type === "KIDS" ? "KIDS_APPAREL" : "APPAREL";
}

/** 네이버가 그 타입에서 쓰는 칸 — 채널 순서 그대로. */
export function naverNoticeFieldOrder(type: NaverNoticeType): readonly string[] {
  return NAVER_FIELD_ORDER[type];
}

export type NaverNoticePayload =
  | { productInfoProvidedNoticeType: "KIDS"; kids: Record<string, string | undefined> }
  | { productInfoProvidedNoticeType: "WEAR"; wear: Record<string, string | undefined> };

/**
 * **네이버 고시 payload 를 조립한다.** 값 해석은 하지 않는다 — builder 가 이미
 * 해석한 값을 받아 «배치» 만 한다.
 *
 * 🔴 값 의미를 여기서 새로 만들지 않는다(지시서 ①의 「Naver builder 가 유지」):
 *    `certificationType` · `releaseDateText` · `packDateText` 등 네이버 고유
 *    해석은 전부 호출부에 남아 있고, 이 함수는 그것을 추론하거나 생성하지 않는다.
 *
 * 🔴 **fail closed** — 그 타입이 요구하는 칸이 `values` 에 «아예 없으면» 던진다.
 *    일부를 빼고 payload 를 만들면 고시 항목이 조용히 사라진다. 값이 `undefined`
 *    인 것은 정상이다(기존 `warrantyPolicy || undefined` 와 같다) — 「키가 없다」와
 *    「값이 비었다」는 다른 사실이고, 그 둘을 구별해서 전자만 막는다.
 */
export function buildNaverNoticePayload(
  kind: NoticeCategoryKind,
  values: Record<string, string | undefined>,
): NaverNoticePayload {
  const type = naverNoticeTypeForKind(kind);
  const fields = NAVER_FIELD_ORDER[type];

  const assembled: Record<string, string | undefined> = {};
  const absent: string[] = [];
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(values, field)) {
      absent.push(field);
      continue;
    }
    assembled[field] = values[field];
  }
  if (absent.length > 0) {
    /* 🔴 부분 payload 를 만들지 않는다. 이것은 프로그래밍 오류이고(호출부가
       칸을 빼먹었다), 조용히 넘기면 고시 항목이 빠진 채로 등록된다. */
    throw new Error(
      `네이버 고시 ${type} 칸이 채워지지 않았습니다: ${absent.join(", ")} — 부분 고시를 보내지 않습니다.`,
    );
  }

  return type === "KIDS"
    ? { productInfoProvidedNoticeType: "KIDS", kids: assembled }
    : { productInfoProvidedNoticeType: "WEAR", wear: assembled };
}

/** 공통 모델이 그 네이버 타입에서 요구하는 칸 — 순서가 아니라 «집합» 이다. */
export function naverNoticeFieldsFromModel(type: NaverNoticeType): string[] {
  return naverNoticeSlots(modelKindForNaverType(type)).map((slot) => slot.code);
}

/**
 * 🔴 쿠팡은 adapter 가 코드를 «만들 수 없다».
 *
 * 쿠팡은 카테고리 메타(`noticeCategoryDetailNames`)가 항목명과
 * MANDATORY/OPTIONAL 을 **런타임에** 내려준다. 고정 코드 표가 없으므로 공통
 * 모델이 코드를 들고 있지 않고, 여기서 지어내지도 않는다.
 *
 * 「지원하지 않는다」가 아니라 **「우리가 고정 매핑을 가질 수 있는 채널이
 * 아니다」** 다. 그래서 쿠팡 builder 는 지금처럼 메타 조회 결과를 쓴다.
 */
export function coupangNoticeAdapterStatus(): { fixedCodes: false; reason: string } {
  return {
    fixedCodes: false,
    reason:
      "쿠팡은 카테고리 메타(noticeCategoryDetailNames)가 항목과 필수여부를 런타임에 정한다 — 고정 코드 표가 없다.",
  };
}

/**
 * **롯데ON builder 가 쓰는 항목 명세.** 공통 모델이 집합과 순서를 정하고,
 * 라벨·가이드라인은 롯데ON 전사본에서 가져온다.
 *
 * 🔴 `null` 은 「이 품목을 모른다」다. 호출부는 항목을 지어내지 말고 그대로
 *    「준비되지 않았다」로 보여야 한다(기존 `schemaKnown:false` 와 같은 뜻).
 */
export function lotteOnNoticeSpecs(code: string | null | undefined): LotteOnNoticeArticleSpec[] | null {
  const kind = noticeKindForLotteOnItemCode(code);
  const model = commonNoticeModelFor(kind);
  if (!model.ready) return null;

  /* 채널 전사본 — label·guideline 의 출처다. 없으면 품목을 모르는 것이다. */
  const transcription = noticeSchemaFor(code);
  if (!transcription) return null;
  const byCode = new Map(transcription.map((spec) => [spec.code, spec]));

  const specs: LotteOnNoticeArticleSpec[] = [];
  for (const slot of lotteOnNoticeSlots(kind)) {
    const spec = byCode.get(slot.code);
    /* 🔴 fail closed — 규제 항목을 하나 빼고 내보내지 않는다. */
    if (!spec) return null;
    specs.push(spec);
  }
  /* 🔴 전사본에만 있고 공통 모델에 없는 코드가 있으면 그것도 어긋남이다 —
     조용히 버리면 롯데ON 이 요구하는 항목이 사라진다. */
  if (specs.length !== transcription.length) return null;
  return specs;
}
