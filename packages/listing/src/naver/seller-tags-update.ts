import { keywordDedupeKey } from "@commerce/content";
import type { NaverSellerTag } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P2(CPO 결정, 2026-10-09) — **UPDATE 에서 네이버 태그를 «지우지» 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 확정: 「UPDATE 도 보존 정책 · 기존 태그를 임의 삭제하지 않음 · sellerTags
 * 를 생략해서 네이버 기존 태그가 삭제되는 상황 방지 · CREATE/UPDATE 모두 동일한
 * `기존 태그 + 사용자/AI 태그 → dedupe` · 사용자가 상품정보에서 «명시적으로»
 * 삭제한 경우에만 삭제 의도로 인정」.
 *
 * ── 🔴 왜 그냥 보낼 수 없는가 ─────────────────────────────────────────────
 * 네이버 공식 기술지원(#1650): **`seoInfo` 는 빈 값 또는 `null` 이면 기존 내용을
 * «제거» 한다.** `detailContent` 처럼 「생략 = 보존」이 아니다. 그래서 UPDATE 에서
 * 이 축은 둘 중 하나다 —
 *
 *   보낸다      우리가 만든 목록으로 «전체 교체»
 *   안 보낸다   네이버가 기존 태그를 «지운다»
 *
 * 🔴 「안 건드리면 그대로」인 축이 아니다. 그래서 보존하려면 **GET 에서 읽은
 *    채널 태그를 우리 목록에 합쳐서 보내야 한다.**
 *
 * ── 🔴 중복 판정은 «새로 만들지 않는다» ───────────────────────────────────
 * `keywordDedupeKey`(packages/content/src/merge-keywords.ts) 를 그대로 쓴다 —
 * 상품정보 태그 칸과 AI 병합이 쓰는 그 규칙이다. 두 벌을 만들면 화면에서 하나로
 * 보이던 태그가 payload 에서 둘이 된다.
 * 🔴 그 규칙이 한글/영문을 합치지 «않는» 것도 그대로 따른다("원피스" ≠ "dress").
 *
 * ── 🔴 code 를 만들지 않는다 ──────────────────────────────────────────────
 * 채널에서 읽은 태그에 `code` 가 있어도 **버린다**. code/text 불일치는 요청
 * «전체» 를 실패시키고(공식 스펙), 우리는 그 쌍이 지금도 유효한지 확인할 방법이
 * 없다 — 추천 태그 조회 API 를 부르지 않는다. 직접 입력 태그는 code 를 생략하는
 * 것이 공식 사용법이다(기술지원 #1867).
 */

/** 이번 UPDATE 에서 `sellerTags` 를 어떻게 할지. 🔴 「모른다」를 숨기지 않는다. */
export type SellerTagsUpdateDecision =
  /** 이 목록으로 보낸다. */
  | { action: "SEND"; tags: NaverSellerTag[]; preservedFromChannel: string[]; added: string[]; reason: string }
  /** 셀러가 «명시적으로» 비웠다 — 삭제 의도를 그대로 전달한다. */
  | { action: "CLEAR"; reason: string }
  /**
   * 🔴 보내도 지우고 안 보내도 지운다 — 어느 쪽도 안전하지 않다. 호출부가
   * 멈추거나 셀러에게 묻는다. 값을 모르는 채로 규제·검색 데이터를 밀지 않는다.
   */
  | { action: "UNKNOWN"; reason: string };

function clean(list: readonly string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list ?? []) {
    const tag = (raw ?? "").replace(/\s+/g, " ").trim();
    if (!tag) continue;
    const key = keywordDedupeKey(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/**
 * @param ourTags      상품정보의 태그(`product.keywords.value`). 화면이 보여 주는 그 값.
 * @param channelTags  GET 으로 읽은 «지금 등록된» 태그. 🔴 `undefined` 는 「읽지
 *   못했다」이고 `[]` 는 「읽었는데 없었다」다. 둘을 섞으면 안 된다 — 앞은 우리
 *   가정이 틀렸다는 뜻이고 뒤는 실제 데이터다(이 저장소가 스냅샷 전반에서
 *   지키는 구분이다).
 * @param sellerEditedTags 셀러가 이번에 태그를 «직접 고쳤는가». preserve 경로의
 *   `editedFields.includes("keywords")` 가 그 신호다. 🔴 이것이 삭제 의도를
 *   가르는 유일한 축이다 — 목록이 비었다는 사실만으로는 「지우려 했다」와
 *   「원래 없었다」를 구별할 수 없다.
 */
export function resolveUpdateSellerTags(input: {
  ourTags: readonly string[];
  channelTags: readonly string[] | undefined;
  sellerEditedTags: boolean;
}): SellerTagsUpdateDecision {
  const ours = clean(input.ourTags);
  const channel = input.channelTags === undefined ? undefined : clean(input.channelTags);

  /* ── ① 셀러가 직접 고쳤다 — 그 목록이 «최종값» 이다 ─────────────────────
     CPO: 「상품정보의 태그가 최종 사용자 편집값」. 셀러가 화면에서 지운 태그를
     채널에서 되살려 오면 「지웠는데 그대로」가 된다 — 상세설명에서 겪은 그 사고의
     반대 방향이다. */
  if (input.sellerEditedTags) {
    if (ours.length === 0) {
      return {
        action: "CLEAR",
        reason: "셀러가 상품정보에서 태그를 모두 비웠습니다 — 삭제 의도로 전달합니다.",
      };
    }
    return {
      action: "SEND",
      tags: ours.map((text) => ({ text })),
      preservedFromChannel: [],
      added: ours,
      reason: "셀러가 상품정보에서 고친 태그를 그대로 보냅니다.",
    };
  }

  /* ── ② 셀러가 안 고쳤다 — 채널 값을 «지키는» 것이 기본이다 ───────────── */
  if (channel === undefined) {
    /* 🔴 읽지 못했다. 보내면 우리 목록으로 교체되고, 안 보내면 지워진다.
       둘 다 셀러의 태그를 잃는다 — 그래서 모른다고 말한다. */
    return {
      action: "UNKNOWN",
      reason:
        "지금 등록된 태그를 조회하지 못했습니다 — 보내면 교체되고 보내지 않으면 삭제되므로, 이 축은 수정에서 제외합니다.",
    };
  }

  /* 🔴 채널이 앞이다. 셀러가 센터에서 넣어 둔 순서를 우리 태그가 밀어내지 않는다
     (mergeKeywords 가 기존을 앞에 두는 것과 같은 규칙). */
  const merged = clean([...channel, ...ours]);
  if (merged.length === 0) {
    /* 양쪽 다 비었다 — 보낼 것이 없고 지울 것도 없다. */
    return { action: "UNKNOWN", reason: "태그가 양쪽 모두 없습니다 — 이 축은 수정에서 제외합니다." };
  }
  const channelKeys = new Set(channel.map(keywordDedupeKey));
  return {
    action: "SEND",
    tags: merged.map((text) => ({ text })),
    preservedFromChannel: channel,
    added: merged.filter((tag) => !channelKeys.has(keywordDedupeKey(tag))),
    reason:
      channel.length > 0
        ? `지금 등록된 태그 ${channel.length}개를 유지하고 상품정보 태그를 더합니다.`
        : "지금 등록된 태그가 없어 상품정보 태그를 보냅니다.",
  };
}
