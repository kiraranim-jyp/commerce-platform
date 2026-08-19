const CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR",
  "$": "USD",
  "£": "GBP",
  kr: "SEK",
};

export type PriceValidity = "VALID" | "MISSING" | "INVALID" | "UNRESOLVED";

export interface ResolvedSourcePrice {
  validity: PriceValidity;
  amount: number | null;
  currency: string | null;
  /** validity가 INVALID일 때만 채운다 — 원본 텍스트는 있었지만 숫자를 뽑아내지
   * 못했거나 값이 0 이하인 경우, 그 원문을 그대로 보존해서 UI가 "이 텍스트를
   * 찾았지만 가격으로 인식하지 못했습니다"라고 보여줄 수 있게 한다(값을
   * 지어내지 않는다). */
  rawText?: string;
}

function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** N-3.54 STEP3(CPO 지시: "29,00 €"→29 EUR가 정확해야 한다) — 유럽식 소수점
 * 콤마("29,00")를 천단위 구분자로 오인해 2900으로 파싱하던 버그를 고친다.
 * 콤마 뒤에 정확히 2자리 숫자로 끝나는 경우만 소수점으로 취급하고(그 앞의
 * 점은 천단위 구분자로 제거), 그 외(콤마 뒤 3자리 등 미국식 천단위
 * 구분자 — "1,234.56")는 기존처럼 콤마만 제거한다. */
function parseLocaleAwareNumber(text: string): number | undefined {
  const trimmed = text.trim();
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(trimmed)) {
    const n = Number(trimmed.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  }
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * N-3.54(CPO 지시: "원본 가격을 못 읽었으면 가격을 계산하지 말고, 계산했으면
 * 그 가격의 근거가 무엇인지 보여줘야 한다") — 원본 사이트에서 뽑아온 가격
 * 원시값(숫자/문자열/null)과 명시적 통화 코드를 받아 4단계로 분류한다:
 * VALID(정상) / MISSING(값 자체가 없음) / INVALID(값은 있었지만 숫자로 인식
 * 불가하거나 0 이하) / UNRESOLVED(값·통화는 정상이지만 환율을 못 구해 KRW
 * 환산이 불가능). packages/crawler(원본 파싱)와 canonical-product.ts
 * (CanonicalProduct 조립), PriceEditor.tsx(등록 게이트)가 전부 이 함수
 * 하나로만 판정한다 — "이 카테고리/사이트는 봐줘도 된다"는 예외를 이 함수
 * 안에 만들지 않는다.
 */
export function resolveSourcePrice(
  raw: number | string | null | undefined,
  explicitCurrency: string | null | undefined,
  fx: { rateAvailable: boolean } = { rateAvailable: true },
): ResolvedSourcePrice {
  if (raw == null) return { validity: "MISSING", amount: null, currency: null };

  let amount: number | undefined;
  let currency = explicitCurrency?.toUpperCase() || undefined;
  let rawText: string | undefined;

  if (typeof raw === "number") {
    amount = Number.isFinite(raw) ? roundAmount(raw) : undefined;
  } else {
    const trimmed = raw.trim();
    if (!trimmed) return { validity: "MISSING", amount: null, currency: null };
    rawText = trimmed;
    const numMatch = /[\d.,]+/.exec(trimmed);
    if (numMatch) {
      const parsed = parseLocaleAwareNumber(numMatch[0]);
      amount = parsed != null ? roundAmount(parsed) : undefined;
    }
    if (!currency) {
      for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
        if (trimmed.includes(symbol)) {
          currency = code;
          break;
        }
      }
    }
    if (!currency) {
      const codeMatch = /\b([A-Z]{3})\b/.exec(trimmed);
      currency = codeMatch?.[1];
    }
  }

  if (amount == null || !Number.isFinite(amount)) {
    return { validity: "INVALID", amount: null, currency: currency ?? null, rawText };
  }
  if (!currency) {
    return { validity: "MISSING", amount, currency: null, rawText };
  }
  if (amount <= 0) {
    return { validity: "INVALID", amount, currency, rawText };
  }
  if (!fx.rateAvailable) {
    return { validity: "UNRESOLVED", amount, currency, rawText };
  }
  return { validity: "VALID", amount, currency, rawText };
}
