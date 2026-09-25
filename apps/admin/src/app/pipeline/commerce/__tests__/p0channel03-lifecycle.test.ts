import { describe, expect, it } from "vitest";
import {
  CHANNEL_CAPABILITY,
  blocksCreate,
  resolveLifecycle,
  type ChangeSet,
} from "../channel-lifecycle";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 PHASE F — **CREATE / UPDATE / RECREATE 판단**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 지금까지 등록은 한 가지뿐이었다 — 만들거나, 이미 있으면 건너뛰거나. 그래서
 * 상품을 고치면 갈 곳이 없었고, 재분석하면 새 snapshot 이 생겨 «또» 만들었다.
 * 한 상품이 SmartStore 외부번호 6개로 갈라진 뿌리가 그것이다.
 *
 * 🔴 이 파일이 지키는 것: 판단은 «한 곳» 에만 있고, 확인되지 않은 것을
 * 확인했다고 말하지 않는다.
 */

/* 🔴 F-6 — 아래 넷은 전부 «전수로 비교했고 카테고리도 읽었다» 는 전제다.
   그것이 아닌 경우는 ⑧ 이 따로 다룬다. 생략할 수 있게 두지 않은 이유가
   거기 있다 — 모르는 것이 조용히 「안 바뀜」이 되면 안 된다. */
const SEEN = { categoryUnknown: false, comparedEverything: true } as const;
const NO_CHANGE: ChangeSet = { fields: [], category: false, ...SEEN };
const PRICE: ChangeSet = { fields: ["salePrice"], category: false, ...SEEN };
const CATEGORY: ChangeSet = { fields: [], category: true, ...SEEN };
const BOTH: ChangeSet = { fields: ["title", "salePrice"], category: true, ...SEEN };

describe("① 아직 안 나간 상품 → CREATE", () => {
  it.each(["smartstore", "coupang", "lotteon"] as const)("%s", (id) => {
    const d = resolveLifecycle(id, false, PRICE);
    expect(d.operation).toBe("CREATE");
    expect(d.needsAttention).toBe(false);
  });

  it("바뀐 게 없어도 «처음» 이면 CREATE 다 — NOOP 이 아니다", () => {
    expect(resolveLifecycle("smartstore", false, NO_CHANGE).operation).toBe("CREATE");
  });
});

describe("② 이미 나갔는데 바뀐 게 없다 → NOOP", () => {
  it.each(["smartstore", "coupang", "lotteon"] as const)("%s — 같은 값을 다시 보내지 않는다", (id) => {
    const d = resolveLifecycle(id, true, NO_CHANGE);
    expect(d.operation).toBe("NOOP");
    expect(d.reason).toContain("달라진 것이 없습니다");
  });
});

describe("③ 일반 변경 — 채널이 할 수 있는 만큼만", () => {
  it("SmartStore: 수정 API 가 확인됐다 → UPDATE", () => {
    const d = resolveLifecycle("smartstore", true, PRICE);
    expect(d.operation).toBe("UPDATE");
    expect(d.needsAttention).toBe(false);
  });

  it("🔴 LotteON: 「apiNo 90 이 있다」는 근거가 아니다 → BLOCKED", () => {
    /* 앞선 판은 SUPPORTED 였고 근거가 「문서에 apiNo 90 이 있다」였다. 그것은
       «존재» 이지 «확인» 이 아니다(CTO 지시, 2026-09-25).
         · 90 의 이름은 「상품 수정」이 아니라 «승인 상품 수정» 이다
         · 🔴 「롯데ON 만 옵션명·옵션값 사후 수정 불가」가 문서로 확인돼 있다
         · 등록(87)과 달리 90 에는 되돌림 수단(92 판매중지) 기록이 없다
       확인되지 않은 UPDATE 를 임의로 구현하지 않는다 — 막고 «말한다». */
    const d = resolveLifecycle("lotteon", true, PRICE);
    expect(d.operation).toBe("BLOCKED");
    expect(d.reason).toContain("확인되지 않았습니다");
    expect(d.needsAttention).toBe(true);
  });

  it("🔴 Coupang: 수정 근거가 «없다» → RECREATE 가 아니라 BLOCKED", () => {
    /* 여기서 RECREATE 로 넘기면, 확인도 안 된 채로 «새 상품을 만드는» 길이
       열린다 — 그것이야말로 이번에 고치려는 중복을 다시 만드는 짓이다.
       막고 «말한다». */
    const d = resolveLifecycle("coupang", true, PRICE);
    expect(d.operation).toBe("BLOCKED");
    expect(d.reason).toContain("확인되지 않았습니다");
    expect(d.needsAttention).toBe(true);
  });
});

describe("④ 카테고리는 lifecycle 이 다르다", () => {
  it("🔴 Coupang: 공식 가이드가 «불가» 라고 명시 → RECREATE", () => {
    const d = resolveLifecycle("coupang", true, CATEGORY);
    expect(d.operation).toBe("RECREATE");
    expect(d.reason).toContain("카테고리를 바꿀 수 없습니다");
    expect(d.needsAttention).toBe(true);
  });

  it("🔴 SmartStore: 카테고리 변경 가부는 «미확인» → RECREATE 로 제안하되 그렇게 «말한다»", () => {
    /* 수정 API 가 있다는 사실이 「카테고리도 바꿀 수 있다」를 뜻하지 않는다.
       모르는 것을 가능으로 밀면 실패했을 때 셀러가 이유를 모른다. */
    const d = resolveLifecycle("smartstore", true, CATEGORY);
    expect(d.operation).toBe("RECREATE");
    expect(d.reason).toContain("아직 확인되지 않았습니다");
    expect(d.needsAttention).toBe(true);
  });

  it("LotteON 도 같은 취급 — 근거 없음", () => {
    expect(resolveLifecycle("lotteon", true, CATEGORY).operation).toBe("RECREATE");
  });

  it("🔴 카테고리가 섞이면 카테고리가 «이긴다»", () => {
    /* 가격도 같이 바뀌었다고 UPDATE 로 처리하면, 카테고리 변경이 조용히
       무시된 채 나간다. */
    expect(resolveLifecycle("smartstore", true, BOTH).operation).toBe("RECREATE");
    expect(resolveLifecycle("coupang", true, BOTH).operation).toBe("RECREATE");
  });
});

describe("⑤ 🔴 UNKNOWN 과 NOT_SUPPORTED 를 같게 다루지 않는다", () => {
  it("표에 그대로 남아 있다", () => {
    expect(CHANNEL_CAPABILITY.coupang.categoryUpdate).toBe("NOT_SUPPORTED");
    expect(CHANNEL_CAPABILITY.smartstore.categoryUpdate).toBe("UNKNOWN");
    expect(CHANNEL_CAPABILITY.lotteon.categoryUpdate).toBe("UNKNOWN");
    expect(CHANNEL_CAPABILITY.coupang.update).toBe("UNKNOWN");
    /* 🔴 「문서에 API 가 있다」로 SUPPORTED 가 되지 않는다. 세 채널 중 수정이
       «확인된» 것은 SmartStore 하나뿐이다. */
    expect(CHANNEL_CAPABILITY.lotteon.update).toBe("UNKNOWN");
    expect(CHANNEL_CAPABILITY.smartstore.update).toBe("SUPPORTED");
  });

  it("같은 RECREATE 라도 «이유가 다르다»", () => {
    const known = resolveLifecycle("coupang", true, CATEGORY).reason;
    const unknown = resolveLifecycle("smartstore", true, CATEGORY).reason;
    expect(known).not.toBe(unknown);
    expect(known).toContain("없습니다");
    expect(unknown).toContain("확인되지 않았습니다");
  });

  it("🔴 UNKNOWN 인 일반 수정은 RECREATE 가 아니다 — 축마다 안전한 쪽이 다르다", () => {
    expect(resolveLifecycle("coupang", true, PRICE).operation).toBe("BLOCKED");
    expect(resolveLifecycle("coupang", true, CATEGORY).operation).toBe("RECREATE");
  });
});

describe("⑥ 중복 방지 기준이 snapshot → ChannelProduct 로 옮겼다", () => {
  it("나가 있으면 CREATE 를 막는다", () => {
    expect(blocksCreate(true)).toBe(true);
    expect(blocksCreate(false)).toBe(false);
  });

  it("🔴 재분석으로 snapshot 이 새로 생겨도 판단이 달라지지 않는다", () => {
    /* 이 함수는 snapshot 을 «인자로 받지도» 않는다 — 구조적으로 섞일 수 없다. */
    expect(blocksCreate.length).toBe(1);
    expect(resolveLifecycle.length).toBe(3); // (commerceId, hasChannelProduct, change)
  });
});

describe("⑧ 🔴 F-6 — 「모른다」를 「안 바뀌었다」로 만들지 않는다", () => {
  /* ChangeSet 을 «만드는 곳» 이 생기면서 드러난 것: 우리 비교는 전수가 아니고
     (GET 응답 모양을 실측한 적이 없다), 카테고리는 아예 못 읽을 수 있다.
     그 두 가지를 조용히 「안 바뀜」으로 접으면 셀러의 수정이 사라진다. */

  it("🔴 카테고리를 못 읽었으면 BLOCKED — UPDATE 도 RECREATE 도 아니다", () => {
    /* UPDATE 로 밀면 카테고리 변경이 조용히 나가거나 무시되고, RECREATE 로
       밀면 새 상품이 생긴다(= 고치려던 외부번호 6개). 정하지 않고 «말한다». */
    const d = resolveLifecycle("smartstore", true, {
      fields: ["salePrice"],
      category: false,
      categoryUnknown: true,
      comparedEverything: false,
    });
    expect(d.operation).toBe("BLOCKED");
    expect(d.reason).toContain("카테고리를 확인하지 못했습니다");
    expect(d.needsAttention).toBe(true);
  });

  it("🔴 카테고리 미확인은 NOOP «보다 앞» 이다 — 못 읽고 「같다」고 말할 수 없다", () => {
    const d = resolveLifecycle("smartstore", true, {
      fields: [],
      category: false,
      categoryUnknown: true,
      comparedEverything: true,
    });
    expect(d.operation).toBe("BLOCKED");
  });

  it("🔴 부분 비교에서 차이가 없으면 NOOP 이 «아니다» — 전체를 다시 보낸다", () => {
    /* 여기서 NOOP 을 내면 비교하지 못한 축(브랜드·옵션 내용·속성)의 수정이
       조용히 사라지고 셀러는 고쳤다고 믿는다. */
    const d = resolveLifecycle("smartstore", true, {
      fields: [],
      category: false,
      categoryUnknown: false,
      comparedEverything: false,
    });
    expect(d.operation).toBe("UPDATE");
    expect(d.reason).toContain("전부 확인하지는 못해");
    expect(d.reason).not.toContain("0개");
  });

  it("전수로 봤을 때만 NOOP 이다", () => {
    expect(resolveLifecycle("smartstore", true, NO_CHANGE).operation).toBe("NOOP");
  });

  it("🔴 수정을 못 하는 채널은 부분 비교여도 UPDATE 로 새지 않는다", () => {
    /* comparedEverything:false 가 「일단 보내자」로 번역되면 안 된다 —
       채널이 할 수 있는 것은 그대로 capability 표가 정한다. */
    for (const id of ["coupang", "lotteon"] as const) {
      const d = resolveLifecycle(id, true, {
        fields: [],
        category: false,
        categoryUnknown: false,
        comparedEverything: false,
      });
      expect(d.operation).toBe("BLOCKED");
    }
  });
});

describe("⑦ 판단이 한 곳이다", () => {
  it("모든 결정에 이유가 붙는다 — 화면이 지어내지 않아도 된다", () => {
    for (const id of ["smartstore", "coupang", "lotteon"] as const) {
      for (const c of [NO_CHANGE, PRICE, CATEGORY, BOTH]) {
        for (const has of [true, false]) {
          const d = resolveLifecycle(id, has, c);
          expect(d.reason.length).toBeGreaterThan(0);
          expect(["CREATE", "UPDATE", "RECREATE", "NOOP", "BLOCKED"]).toContain(d.operation);
        }
      }
    }
  });

  it("주의가 필요한 결과만 needsAttention 이다", () => {
    expect(resolveLifecycle("smartstore", true, PRICE).needsAttention).toBe(false);
    expect(resolveLifecycle("coupang", true, CATEGORY).needsAttention).toBe(true);
    expect(resolveLifecycle("coupang", true, PRICE).needsAttention).toBe(true);
  });
});
