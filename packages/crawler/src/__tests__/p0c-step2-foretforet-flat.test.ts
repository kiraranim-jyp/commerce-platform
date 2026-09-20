import { describe, expect, it } from "vitest";
import { extractForetforetShippingPolicy } from "../comparison-search/foretforet";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-C STEP 2(CEO 승인, 2026-09-20) — **「(고정)」을 FLAT 으로 승격한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 여기 나오는 문자열은 **전부 2026-09-20 실측 원문**이다. 지어낸 문장이
 *    하나도 없다 — 그것이 이 승격의 유일한 근거이기 때문이다.
 *
 *    uid 10278273   배송조건 : (고정)   "주문금액에 상관없이 배송비가 3,500원 청구됩니다."
 *                   입점사 블록          "… 3,500원 … 제주 및 도서산간 지역 4000원"
 *    uid 10226592   배송조건 : (조건)   "총 결제금액이 70,000원 미만시 배송비 3,000원이 …"
 *    (표본 12건에서 배송조건 라벨은 이 둘뿐이었다. 세 번째는 만들지 않는다.)
 *
 * ── 이 파일이 지키는 두 문장 ────────────────────────────────────────────────
 * ① 금액은 «alert 에서만» 읽는다. 입점사 블록에서 읽으면 「제주 4,000」이
 *    이 상품의 배송비가 된다.
 * ② 금액이 하나로 좁혀지지 않으면 FLAT 을 만들지 않는다. 금액 없는 FLAT 은
 *    저장 계층이 «배치를 통째로» 거절하게 만들어, 같이 돌던 다른 판매처
 *    가격까지 0행으로 날린다.
 */

/** 실측 HTML 의 «배송비 필드» 자리만 그대로 재현한다(태그 구조까지 실측 그대로). */
const field = (label: string, alert: string) =>
  `<p><span class="shopdetailInfoName">배송비</span>` +
  `<span class="shopdetailInfoCont"><a href="javascript:alert('${alert}');">` +
  `<span>${label}</span> <span class="fa fa-info-circle fa-lg"></span></a></p>`;

/** 입점사 배송비 블록 — ①의 상위집합. 지역 할증이 여기 더 붙는다. */
const vendor = (text: string) => `<dl><dt>입점사 배송비</dt><dd>${text}</dd></dl>`;

const FLAT_ALERT = "주문금액에 상관없이 배송비가 3,500원 청구됩니다.";
const FLAT_VENDOR = "주문금액에 상관없이 배송비가 3,500원 청구됩니다. <br>제주 및 도서산간 지역 4000원";
const COND_ALERT = "총 결제금액이 70,000원 미만시 배송비 3,000원이 청구됩니다.";

describe("① (조건) — 기존 동작이 한 글자도 바뀌지 않는다", () => {
  it("CONDITIONAL_FREE 이고 금액은 «비어 있다»", () => {
    const r = extractForetforetShippingPolicy(field("배송조건 : (조건)", COND_ALERT) + vendor(COND_ALERT));
    expect(r.status).toBe("CONDITIONAL_FREE");
    expect(r.amountKrw).toBeNull();
  });

  it("🔴 alert 에 숫자가 둘(70,000·3,000) 있어도 어느 쪽도 금액 칸에 오지 않는다", () => {
    const r = extractForetforetShippingPolicy(field("배송조건 : (조건)", COND_ALERT) + vendor(COND_ALERT));
    expect(r.amountKrw).toBeNull();
    // 조건 원문은 판매처가 쓴 그대로 남는다 — 해석하지 않는다.
    expect(r.note).toContain("70,000원 미만시");
  });
});

describe("② (고정) — FLAT 3,500 이 된다", () => {
  const r = extractForetforetShippingPolicy(field("배송조건 : (고정)", FLAT_ALERT) + vendor(FLAT_VENDOR));

  it("status 와 금액이 «함께» 온다", () => {
    expect(r.status).toBe("FLAT");
    expect(r.amountKrw).toBe(3500);
  });

  it("🔴 제주 할증 4,000 을 배송비로 적지 않는다 — 금액은 alert 에서만 읽는다", () => {
    expect(r.amountKrw).not.toBe(4000);
  });

  it("note 는 예전 그대로 상위집합(입점사 블록)이다 — 지역 할증도 근거로 남는다", () => {
    expect(r.note).toContain("3,500원");
    expect(r.note).toContain("제주 및 도서산간 지역 4000원");
  });
});

describe("③ (고정) 인데 금액이 하나로 좁혀지지 않으면 FLAT 을 만들지 않는다", () => {
  it("🔴 alert 에 숫자가 둘이면 UNREAD — 둘 중 하나를 «고르지» 않는다", () => {
    const r = extractForetforetShippingPolicy(
      field("배송조건 : (고정)", "배송비 3,500원, 제주 및 도서산간 지역 4000원") + vendor(FLAT_VENDOR),
    );
    expect(r.status).toBe("UNREAD");
    expect(r.amountKrw).toBeNull();
  });

  it("alert 에 금액이 없으면 UNREAD", () => {
    const r = extractForetforetShippingPolicy(field("배송조건 : (고정)", "배송비는 별도 안내드립니다."));
    expect(r.status).toBe("UNREAD");
    expect(r.amountKrw).toBeNull();
  });

  it("0원은 FLAT 이 아니다 — 「확인된 무료」는 FREE 의 자리이고 실측되지 않았다", () => {
    const r = extractForetforetShippingPolicy(field("배송조건 : (고정)", "배송비가 0원 청구됩니다."));
    expect(r.status).toBe("UNREAD");
    expect(r.amountKrw).toBeNull();
  });

  it("라벨이 아예 없으면 예전처럼 UNREAD", () => {
    const r = extractForetforetShippingPolicy(vendor(FLAT_VENDOR));
    expect(r.status).toBe("UNREAD");
    expect(r.amountKrw).toBeNull();
  });

  it("🔴 세 번째 라벨을 지어내지 않는다 — (무료)는 실측된 적이 없다", () => {
    const r = extractForetforetShippingPolicy(field("배송조건 : (무료)", "배송비가 0원입니다."));
    expect(r.status).toBe("UNREAD");
  });
});

describe("④ 🔴 어떤 입력에서도 «금액 없는 FLAT» 이 나오지 않는다", () => {
  /**
   * 이 한 가지가 배치 전체를 죽이는 유일한 경로다(price-observations 가 상태와
   * 금액이 모순되면 한 행도 쓰지 않는다). 타입으로 막았지만, 값으로도 확인한다.
   */
  const INPUTS = [
    field("배송조건 : (고정)", FLAT_ALERT) + vendor(FLAT_VENDOR),
    field("배송조건 : (고정)", "배송비 3,500원, 제주 4000원"),
    field("배송조건 : (고정)", "안내 없음"),
    field("배송조건 : (조건)", COND_ALERT) + vendor(COND_ALERT),
    field("배송조건 : (무료)", "무료"),
    vendor(FLAT_VENDOR),
    "",
  ];
  it.each(INPUTS.map((html, i) => [i, html]))("입력 %i", (_i, html) => {
    const r = extractForetforetShippingPolicy(html as string);
    if (r.status === "FLAT") {
      expect(typeof r.amountKrw).toBe("number");
      expect(r.amountKrw).toBeGreaterThan(0);
    } else {
      expect(r.amountKrw).toBeNull();
    }
  });
});
