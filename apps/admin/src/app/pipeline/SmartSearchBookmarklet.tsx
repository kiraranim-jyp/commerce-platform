"use client";

import { useEffect, useRef } from "react";
import { buildBookmarkletForSnapshot } from "./supplied-url-handoff";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2D — **셀러에게 북마크릿을 «전달» 하는 최소 UI**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「**새로운 검색 UI 를 만들지 않는다**」 ·
 * 「검색 결과나 후보 URL 목록을 UI 에 보여주는 것은 **금지**」 ·
 * 「**상품별** 북마크릿이어야 한다 — 「최근 상품에 자동 연결」 같은 우회는 하지 않는다」.
 *
 * ── 🔴🔴 React 19 가 `javascript:` href 를 «교체» 한다 — 이것이 이 파일의 핵심 ──
 * ```
 * `react-dom@19.2.4` 의 `sanitizeURL`(react-dom-client.development.js:3166):
 *   isJavaScriptProtocol.test(url)
 *     ? "javascript:throw new Error('React has blocked a javascript: URL as a
 *        security precaution.')"
 * ⟹ 🔴 JSX 로 `href={bookmarklet}` 을 주면 **그 차단 코드가 북마크에 등록된다.**
 *    셀러는 등록에 성공한 것처럼 보이지만 누르면 **아무 일도 일어나지 않는다.**
 * 🟢 그래서 **마운트 후 `setAttribute`** 로 넣는다 — 그 경로는 sanitize 를 지나지 않는다.
 * 🔴 **`href` prop 을 주지 않는다** — 주면 React 가 그 속성을 관리해 되돌린다.
 * 🔴 이 사실을 계약으로 잠근다(D-1·D-2) — 다음 사람이 「단순화」하면 기능이 조용히 죽는다.
 * ```
 *
 * ── 🔴 이 컴포넌트가 «하지 않는» 것 ───────────────────────────────────────
 * ```
 * 🔴 검색을 **실행하지 않는다**(검색 UI 0 · fetch 0 · 외부 요청 0)
 * 🔴 **후보/검색 결과를 그리지 않는다**(CPO 금지) — 목록·표·행·가격 **0**
 * 🔴 MI · SAME · threshold · Price · Adapter/Registry · DB **0**
 * 🔴 **셀러 URL 입력칸을 되살리지 않는다** — 입력 요소가 **하나도 없다**
 * 🔴 `snapshotId` 가 없으면 **아무것도 렌더하지 않는다**(상품을 모르면 만들지 않는다)
 * ```
 */

/** 🟢 상품별 북마크릿 — 라벨에 상품명을 넣어 셀러가 북마크바에서 구분한다. */
export function bookmarkletLabel(productTitle: string | null | undefined): string {
  const name = (productTitle ?? "").trim();
  /** 🔴 길면 북마크바가 깨진다 — 짧게 자른다. 🔴 이름이 없으면 **지어내지 않는다**. */
  const short = name.length > 18 ? `${name.slice(0, 18)}…` : name;
  return short ? `따져 검색 · ${short}` : "따져 검색";
}

export interface SmartSearchBookmarkletProps {
  /** 🔴 현재 상품의 스냅샷. **없으면 렌더하지 않는다**(상품 혼선 금지). */
  snapshotId: string | null;
  /** 북마크 라벨용. 없어도 동작한다. */
  productTitle?: string | null;
}

export function SmartSearchBookmarklet({ snapshotId, productTitle }: SmartSearchBookmarkletProps) {
  const linkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const el = linkRef.current;
    if (!el || !snapshotId) return;
    /**
     * 🔴🔴 **여기가 React 19 sanitize 를 우회하는 유일한 자리다**(위 주석).
     * 🟢 `window.location.origin` 을 쓴다 — 배포 도메인을 코드에 박지 않는다
     *    (Production·preview·로컬이 같은 코드로 동작한다).
     */
    el.setAttribute("href", buildBookmarkletForSnapshot(window.location.origin, snapshotId));
  }, [snapshotId]);

  /** 🔴 상품(스냅샷)을 모르면 **만들지 않는다** — 「최근 상품」으로 넘겨짚지 않는다. */
  if (!snapshotId) return null;

  return (
    <section
      data-testid="smart-search-bookmarklet"
      className="rounded-lg border border-border bg-surface p-5 shadow-subtle"
    >
      <h3 className="text-sm font-semibold text-text-primary">🔎 AI 검색으로 후보 찾기</h3>
      <p className="mt-1 text-xs text-text-secondary">
        이 상품을 파는 다른 판매처를 직접 찾지 않아도 됩니다. 쓰시던 AI·검색 서비스에서 그냥
        검색하신 뒤, 아래 버튼을 한 번 누르시면 그 결과가 이 상품의 조사에 들어옵니다.
      </p>

      {/* 🔴 사용법 1·2·3 만. 검색창도, 후보 목록도 만들지 않는다. */}
      <ol className="mt-3 space-y-1 text-xs text-text-secondary">
        <li>
          <strong className="text-text-primary">1.</strong> 아래 버튼을 브라우저 <strong>북마크바로
          드래그</strong>해 등록합니다. <span className="text-text-tertiary">(한 상품에 한 번만)</span>
        </li>
        <li>
          <strong className="text-text-primary">2.</strong> 쓰시던 AI·검색 서비스에서 이 상품을
          검색합니다. <span className="text-text-tertiary">(브랜드 + 품번으로 검색하면 잘 나옵니다)</span>
        </li>
        <li>
          <strong className="text-text-primary">3.</strong> 검색 결과 화면에서 등록한 북마크를{" "}
          <strong>한 번 클릭</strong>합니다. 이 화면으로 돌아와 조사가 시작됩니다.
        </li>
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/*
          🔴🔴 `href` 를 **prop 으로 주지 않는다**(React 19 가 차단 코드로 바꾼다).
             위 effect 가 `setAttribute` 로 넣는다.
          🔴 `draggable` 을 끄지 않는다 — 드래그 등록이 이 UX 의 전부다.
          🔴 `onClick` 으로 실행시키지 않는다 — 브라우저가 페이지 안의 `javascript:`
             클릭을 CSP/정책으로 막을 수 있고, 그러면 셀러가 **고장으로 오해** 한다.
             🟢 정상 경로는 **북마크에서 실행** 하는 것이다.
        */}
        <a
          ref={linkRef}
          data-testid="smart-search-bookmarklet-link"
          draggable
          className="inline-flex cursor-grab items-center gap-2 rounded-md border border-brand bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-strong"
          onClick={(e) => {
            /**
             * 🔴 이 자리에서 실행하지 않는다. 클릭하면 **등록 방법을 알려준다** —
             *    「눌렀는데 아무 일도 없다」는 경험을 만들지 않는다.
             */
            e.preventDefault();
          }}
          title="이 버튼을 브라우저 북마크바로 드래그하세요"
        >
          <span aria-hidden>🔖</span>
          {bookmarkletLabel(productTitle)}
        </a>
        <span className="text-xs text-text-tertiary">
          ← 이 버튼을 <strong>북마크바로 드래그</strong>하세요. (클릭으로는 등록되지 않습니다)
        </span>
      </div>

      <p className="mt-3 text-xs text-text-tertiary">
        이 북마크는 <strong>이 상품 전용</strong>입니다. 다른 상품을 조사하실 때는 그 상품 화면에서
        다시 등록해 주세요.
      </p>
    </section>
  );
}
