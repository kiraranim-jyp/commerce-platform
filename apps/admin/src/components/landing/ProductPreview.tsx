/**
 * LANDING-3.0 §6/§7(CPO 지시, 2026-09-08) — Landing에 넣는 제품 화면 미리보기.
 *
 * ── 왜 스크린샷이 아니라 재현인가 ──────────────────────────────────────
 * 실제 Production 화면은 로그인 뒤에 있어서 캡처할 수 없다(제품 화면을 담은
 * 이미지 파일이 저장소에 없다). §6은 "새로운 가짜 UI를 만들지 않는다"고
 * 했으므로, 없는 화면을 상상해서 그리는 대신 **실제 제품이 쓰는 어휘와 구조를
 * 그대로 옮긴 재현**을 만든다.
 *
 * 여기 쓰인 문구는 전부 실제 코드에서 가져온 것이다:
 *   - "시장 가격 경쟁력 있음"  → packages/pricing/src/market-signals.ts
 *   - "국내 최저가" / "예상 마진" → DomesticPriceIntelligencePanel.tsx
 *   - "🟢 동일상품" / "🟡 동일상품 추정" / "⚪ 유사상품" → match-display.ts
 *   - 금액 표기(₩79,000)      → lib/price-truth.ts formatMoney 규칙
 * 제품에 없는 판정 어휘를 지어내지 않는다 — Landing이 제품보다 앞서 말하면
 * 처음 들어온 사람이 기대한 화면과 실제 화면이 달라진다.
 *
 * 숫자는 예시다. 그래서 각 미리보기에 "예시 화면"이라고 명시한다(§15의
 * 허위 수치 금지 원칙 — 성과 지표가 아니라 UI 형태를 보여주는 용도다).
 *
 * 이미지가 아니라 마크업이라 client component가 필요 없고 로딩도 없다(§16).
 */

function PreviewFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      {/* 창 크롬 — 이게 앱 화면이라는 것을 한눈에 알리는 최소 장치. */}
      <div className="flex items-center gap-1.5 border-b border-border bg-background px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-error/40" />
        <span className="h-2 w-2 rounded-full bg-warning/40" />
        <span className="h-2 w-2 rounded-full bg-success/40" />
        <span className="ml-1.5 truncate text-[10px] text-text-tertiary">{label}</span>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
      <figcaption className="border-t border-border px-3 py-1.5 text-[10px] text-text-tertiary">
        예시 화면 — 실제 분석 결과는 상품에 따라 다릅니다.
      </figcaption>
    </figure>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-2.5 py-2">
      <p className="text-[10px] text-text-tertiary">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${tone ?? "text-text-primary"}`}>{value}</p>
    </div>
  );
}

/** Preview 01 — 상품 분석: 어떤 축으로 따지는지 보여준다. */
export function AnalysisPreview() {
  return (
    <PreviewFrame label="상품 분석">
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2">
          <span className="shrink-0 text-[10px] text-text-tertiary">상품 URL</span>
          <span className="truncate font-mono text-[10px] text-text-secondary">https://…/products/…</span>
        </div>
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          {["상품", "국내 시장", "가격", "수익성", "판매 판단"].map((t, i) => (
            <li
              key={t}
              className={`rounded-md border px-2 py-1.5 text-center text-[10px] font-medium ${
                i === 4 ? "border-primary/40 bg-primary-soft text-text-primary" : "border-border bg-background text-text-secondary"
              }`}
            >
              {t}
            </li>
          ))}
        </ul>
      </div>
    </PreviewFrame>
  );
}

/** Preview 02 — Market Intelligence: "그래서 팔까?"에 답하는 화면(§7). */
export function VerdictPreview() {
  return (
    <PreviewFrame label="Market Intelligence — 판매 판단">
      <div className="space-y-3">
        <div className="rounded-md border border-success/30 bg-success-soft px-3 py-2.5">
          <p className="text-xs font-semibold text-text-primary">🟢 시장 가격 경쟁력 있음</p>
          <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
            국내 동일상품보다 낮은 가격으로 등록할 여지가 있습니다.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <Stat label="국내 최저가" value="₩79,000" />
          <Stat label="해외 원가" value="₩42,000" />
          <Stat label="예상 마진" value="27%" tone="text-success" />
        </div>

        <div className="space-y-1">
          <p className="text-[10px] text-text-tertiary">국내 가격비교</p>
          {[
            { shop: "A 편집샵", price: "₩79,000", badge: "🟢 동일상품", cls: "bg-success-soft text-success" },
            { shop: "B 편집샵", price: "₩84,000", badge: "🟡 동일상품 추정", cls: "bg-warning-soft text-warning" },
            { shop: "C 편집샵", price: "₩91,000", badge: "⚪ 유사상품", cls: "bg-background text-text-tertiary" },
          ].map((r) => (
            <div
              key={r.shop}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5"
            >
              <span className="truncate text-[11px] text-text-secondary">{r.shop}</span>
              <span className="shrink-0 text-[11px] font-medium tabular-nums text-text-primary">{r.price}</span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${r.cls}`}>{r.badge}</span>
            </div>
          ))}
        </div>
      </div>
    </PreviewFrame>
  );
}

/** Preview 03 — 등록 준비: 판단 이후 단계가 실제로 있다는 것을 보여준다. */
export function ListingPreview() {
  return (
    <PreviewFrame label="등록 준비">
      <div className="space-y-2">
        <ul className="grid grid-cols-3 gap-1.5">
          {["상품정보", "옵션", "상세페이지"].map((t) => (
            <li
              key={t}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-center text-[10px] text-text-secondary"
            >
              {t}
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-1.5">
          {["스마트스토어", "쿠팡"].map((c) => (
            <div
              key={c}
              className="flex items-center justify-between rounded-md border border-border bg-background px-2.5 py-2"
            >
              <span className="text-[11px] text-text-secondary">{c}</span>
              <span className="rounded bg-success-soft px-1.5 py-0.5 text-[9px] font-medium text-success">
                준비 완료
              </span>
            </div>
          ))}
        </div>
      </div>
    </PreviewFrame>
  );
}
