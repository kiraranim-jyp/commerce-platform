import type { CoupangRegisteredProduct, CoupangRegisteredItem } from "./registered-baseline";
import { itemKeyOf } from "./registered-baseline";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COUPANG-UPDATE-IMPLEMENT-01 Phase 2 — **보내기 전에 「사라진 것」을 찾는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 왜 «구조상 안전한데» 가드가 필요한가.
 *
 * `applyCoupangEdits()` 는 baseline 을 복사해서 몇 칸만 덮으므로, 지금 경로에서는
 * 무언가 사라질 수 없다. 그러면 이 파일은 헛일인가? 아니다 —
 *
 *   이 가드가 막는 것은 «지금의 코드» 가 아니라 «다음의 코드» 다.
 *
 * 이 저장소에서 실제로 일어난 일이다: SmartStore 에서 Master 로 payload 를 다시
 * 만들어 PUT 했다가 값이 지워졌고, 그래서 `detectUpdateDataLoss()` 가 생겼다.
 * 쿠팡은 **공식이 전체 교체를 지시**하므로 같은 사고의 표면이 더 넓다.
 * 누군가 「Master 에서 만들어 보내면 더 깔끔한데」라고 생각하는 날, 이 가드가
 * 그 PUT 을 멈춘다.
 *
 * ── 🔴 판정 규칙 하나 ─────────────────────────────────────────────────────
 *   **baseline 에 있던 것이 outgoing 에서 사라지거나 줄면 BLOCKED.**
 * 「같은지」를 묻지 않는다. 바뀌는 것은 정상이고(그게 수정이다), 문제는 «줄어드는»
 * 것이다.
 */

export type CoupangLossReason =
  /** baseline 에 있던 칸이 outgoing 에 없다. */
  | "MISSING"
  /** 배열이 짧아졌다 — 옵션·이미지·고시는 빠지면 «삭제» 로 나간다(공식). */
  | "EMPTIED"
  /** 🔴 없던 것이 생겼다. 규제 축에서는 이것도 사고다(아래 certifications). */
  | "FABRICATED";

export interface CoupangLossRisk {
  /** payload 경로. 🔴 셀러에게 보여줄 이름이 아니라 «개발자가 찾아갈 자리» 다. */
  field: string;
  /** 셀러가 읽을 이름. */
  label: string;
  reason: CoupangLossReason;
}

/** 배열 칸을 개수로 지키는 자리 — 줄어들면 쿠팡이 「삭제」로 읽는다. */
const ITEM_ARRAY_AXES: { key: string; label: string }[] = [
  { key: "images", label: "이미지" },
  { key: "notices", label: "상품정보제공고시" },
  { key: "attributes", label: "구매옵션" },
  { key: "contents", label: "상세내용" },
  { key: "searchTags", label: "검색태그" },
];

const asArray = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null);
const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/**
 * baseline 과 outgoing 을 대조해 «잃는 것» 을 찾는다. 하나라도 나오면 PUT 하지 않는다.
 *
 * 🔴 outgoing 이 baseline 에서 파생됐는지 «묻지 않는다». 어디서 왔든 결과만 본다 —
 * 출처를 신뢰하는 가드는 출처가 바뀌는 순간 무력해진다.
 */
export function detectCoupangUpdateLoss(
  baseline: CoupangRegisteredProduct,
  outgoing: CoupangRegisteredProduct,
): CoupangLossRisk[] {
  const risks: CoupangLossRisk[] = [];

  /* ── ① 상품 레벨: baseline 에 값이 있던 칸이 통째로 빠지면 안 된다 ──────
     🔴 쿠팡이 «덧붙여 준» 칸(status·mdId·productOrigin·certifications …)이
     여기서 지켜진다. 전체 교체라 빠지면 그대로 지워진다. */
  for (const key of Object.keys(baseline)) {
    if (key === "items") continue; // 아래에서 따로, 더 엄하게 본다
    if (isBlank(baseline[key])) continue; // 원래 비어 있던 칸은 지킬 것이 없다
    if (!(key in outgoing) || outgoing[key] === undefined) {
      risks.push({ field: key, label: key, reason: "MISSING" });
    }
  }

  const baseItems = asArray(baseline.items) as CoupangRegisteredItem[] | null;
  const outItems = asArray(outgoing.items) as CoupangRegisteredItem[] | null;

  /* ── ② 옵션 배열 자체 ─────────────────────────────────────────────────── */
  if (baseItems && baseItems.length > 0) {
    if (!outItems) {
      risks.push({ field: "items", label: "옵션", reason: "MISSING" });
      return risks; // 더 볼 것이 없다
    }
    if (outItems.length < baseItems.length) {
      risks.push({ field: "items", label: "옵션", reason: "EMPTIED" });
    }
  }
  if (!baseItems || !outItems) return risks;

  /* ── ③ 옵션 «정체성» — sellerProductItemId 가 없으면 쿠팡은 «새 옵션 추가»
         로 읽는다(공식). 수정 경로에서 그 일이 일어나면 옵션이 두 배가 된다. */
  const outByKey = new Map<string, CoupangRegisteredItem>();
  for (const item of outItems) {
    const key = itemKeyOf(item);
    if (key) outByKey.set(key, item);
  }

  for (const base of baseItems) {
    const key = itemKeyOf(base);
    if (!key) continue; // baseline 에 식별자가 없으면 지킬 기준이 없다
    const out = outByKey.get(key);
    if (!out) {
      risks.push({ field: `items[${key}].sellerProductItemId`, label: "옵션 식별자", reason: "MISSING" });
      continue;
    }

    /* ── ④ 옵션 안의 배열 축 ─────────────────────────────────────────── */
    for (const axis of ITEM_ARRAY_AXES) {
      const had = asArray(base[axis.key]);
      if (!had || had.length === 0) continue;
      const has = asArray(out[axis.key]);
      if (!has) {
        risks.push({ field: `items[${key}].${axis.key}`, label: axis.label, reason: "MISSING" });
      } else if (has.length < had.length) {
        risks.push({ field: `items[${key}].${axis.key}`, label: axis.label, reason: "EMPTIED" });
      }
    }

    /* ── ⑤ 옵션 안의 스칼라 축 ───────────────────────────────────────── */
    for (const [k, label] of [
      ["itemName", "옵션명"],
      ["salePrice", "판매가"],
      ["maximumBuyCount", "재고"],
      ["vendorItemId", "옵션 ID"],
    ] as const) {
      if (!isBlank(base[k]) && isBlank(out[k])) {
        risks.push({ field: `items[${key}].${k}`, label, reason: "MISSING" });
      }
    }

    /* ── ⑥ 🔴 certifications — «채우는 것» 이 사고다 ──────────────────────
       실측: 우리 상품 5개 옵션 전부 `certifications: []` 다. 우리는 이 칸을
       코드에서 «한 번도» 쓴 적이 없다(참조 0건). 그런데 전체 교체라서, 누군가
       여기에 값을 만들어 넣으면 그대로 쿠팡에 인증 기록이 생긴다.

       🔴 KC 인증 번호를 우리가 지어내지 않는다는 것은 이 프로젝트의 고정
       원칙이다(「12313ㄹㅇ」 사건). 줄어드는 것만 막는 이 파일에서 유일하게
       «늘어나는 것» 을 막는 축이 여기다. */
    const hadCerts = asArray(base.certifications) ?? [];
    const hasCerts = asArray(out.certifications) ?? [];
    if (hasCerts.length > hadCerts.length) {
      risks.push({ field: `items[${key}].certifications`, label: "인증정보", reason: "FABRICATED" });
    } else if (hadCerts.length > hasCerts.length) {
      risks.push({ field: `items[${key}].certifications`, label: "인증정보", reason: "EMPTIED" });
    }
  }

  return risks;
}
