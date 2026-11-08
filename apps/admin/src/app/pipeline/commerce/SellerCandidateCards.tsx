"use client";

import { useState } from "react";
import type { GeminiTransientRow } from "./GeminiTransientCandidates";
import {
  OTHER_CANDIDATES_NOTICE,
  NO_CANDIDATE_AT_ALL,
  NO_SAME_BUT_CANDIDATES,
} from "./CandidateComparison";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SELLER-COMPARISON-UI-1 STEP 1 — **셀러용 소싱 후보 카드**(CPO 승인 2026-11-08)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「셀러 노출은 **사진 · 가격 · 원문 URL** 중심 · 국내·해외 **동일 템플릿**」.
 *
 * ── 🔴🔴 그러나 WU-091 네 조건이 그보다 «우선» 한다(CPO 명시) ─────────────────
 * ```
 * ① 기본 **접힘**                      ② 「동일상품 없음」을 **먼저** 안내
 * ③ **행마다 실제 판정 라벨**            ④ 「가격비교에 사용되지 않습니다」 명시
 * ```
 * 🔴 그 넷은 **2026-09-19 사고 재발 방지** 장치다 — 그 사고의 본질은 「보여줬다」가 아니라
 *    **「유력 후보처럼 보여줬다」**(펼쳐져 있었고 · 가격이 달려 있었고 · **판정 라벨이 없었다**).
 * ⟹ 🔴🔴 **사진+가격+URL 만 보여주는 것은 그 사고의 모양과 같다.** 그래서 라벨을 **남긴다**.
 *
 * 🟢 문구는 **기존 owner 를 그대로 import** 한다(`CandidateComparison`) — 사본 **0**.
 * 🔴 판정값을 **만들지 않는다** — `row.crossSellerVerdict ?? row.matchTruth` 를 **그대로** 적는다.
 *    긍정 판정으로 치환하지 않는다(없으면 「판정 없음」이라고 적는다).
 *    🔴 **1차에 칸 이름을 틀렸다**(`displayState`·`verdict`·`price` — 그 칸은 **없다**).
 *       🟢 타입에서 읽어 `crossSellerVerdict`·`matchTruth`·`priceAmount`/`priceCurrency` 로 고쳤다
 *       (이 트랙이 칸 이름을 **열네 번** 틀린 그 함정이다).
 * 🔴 **환산 0 · 기호 변환 0** — `priceCurrency` + `priceAmount` 를 **원문 그대로** 이어 적는다
 *    (국내는 KRW · 해외는 원문 통화. 「₩」로 바꾸거나 환산하지 않는다).
 * 🔴 **허위 값 0** — 이미지/가격/URL 이 없으면 **만들지 않고** 그 사실을 적는다.
 * 🔴 **출처 축을 잃지 않는다**(`wu-130 F-3`) — 이 카드는 **시장(국내/해외)으로만** 묶고
 *    기존 구역 넷(`TransientCandidateSections`)을 **합치거나 지우지 않는다**.
 */

/** 🔴 국내 ↔ 해외는 **같은 컴포넌트·같은 순서** 다. 다른 것은 **묶음 제목과 통화** 뿐이다. */
export const SELLER_CANDIDATES_TITLE = "🛒 소싱 후보";
export const SELLER_DOMESTIC_LABEL = "🇰🇷 국내 소싱 후보";
export const SELLER_OVERSEAS_LABEL = "🌎 해외 소싱 후보";
/** 🔴 값이 없을 때 쓰는 말 — **지어내지 않는다**는 사실을 화면이 직접 말한다. */
export const SELLER_NO_IMAGE = "이미지 없음";
export const SELLER_NO_PRICE = "가격 확인 필요";
export const SELLER_NO_URL = "상품 주소 없음";
export const SELLER_NO_VERDICT = "판정 없음";

type Row = GeminiTransientRow;

/** 🔴 시장 분류는 **행이 들고 온 값** 이다 — 여기서 다시 추정하지 않는다. */
const isDomestic = (r: Row): boolean => r.market === "KR";
const isOverseas = (r: Row): boolean => r.market === "OVERSEAS";

/** 🔴 판정 라벨 — **있는 값을 그대로**. 없으면 「판정 없음」(긍정으로 바꾸지 않는다). */
const verdictLabel = (r: Row): string =>
  (r.crossSellerVerdict ?? "").trim() || (r.matchTruth ?? "").trim() || SELLER_NO_VERDICT;

function SellerCard({ row }: { row: Row }) {
  /** 🔴 **환산 0 · 기호 변환 0** — 통화 코드와 금액을 원문 그대로 이어 적는다. */
  const price =
    row.priceAmount != null && (row.priceCurrency ?? "").trim()
      ? `${row.priceCurrency} ${row.priceAmount.toLocaleString("en-US")}`
      : "";
  const url = (row.discoveredUrl ?? "").trim();
  return (
    <li data-testid="seller-card" className="rounded border border-slate-200 bg-white p-2">
      {/* 🔴 ① 사진 — 없으면 **만들지 않고** 그 사실을 적는다. */}
      {row.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-testid="seller-card-image"
          src={row.imageUrl}
          alt=""
          className="h-24 w-full rounded object-contain"
        />
      ) : (
        <div data-testid="seller-card-image-missing" className="flex h-24 items-center justify-center rounded bg-slate-50 text-[11px] text-slate-400">
          {SELLER_NO_IMAGE}
        </div>
      )}

      {/* 🔴 ② 가격 — **원문 그대로**(환산 0). 없으면 「가격 확인 필요」. */}
      <p data-testid="seller-card-price" className="mt-1 text-sm font-semibold text-slate-900">
        {price || SELLER_NO_PRICE}
      </p>

      {/* 🔴🔴 ③ WU-091 — **행마다 실제 판정 라벨**. 이 줄을 지우면 2026-09-19 사고로 돌아간다. */}
      <p data-testid="seller-card-verdict" className="text-[11px] text-slate-500">
        {verdictLabel(row)}
      </p>

      {/* 🔴 ④ 원문 URL — 없으면 **클릭 불가능한 링크를 만들지 않는다**. */}
      {url ? (
        <a
          data-testid="seller-card-url"
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-[11px] text-sky-700 underline"
        >
          상품 페이지 열기 ↗
        </a>
      ) : (
        <span data-testid="seller-card-url-missing" className="mt-1 inline-block text-[11px] text-slate-400">
          {SELLER_NO_URL}
        </span>
      )}
    </li>
  );
}

/** 🔴 국내·해외가 **이 함수 하나** 를 쓴다 — 템플릿이 갈릴 구조가 없다. */
function MarketGroup({ market, label, rows }: { market: "DOMESTIC" | "OVERSEAS"; label: string; rows: Row[] }) {
  return (
    /** 🔴 testid 에 **표시 문구를 넣지 않는다** — 문구가 바뀌면 계약이 조용히 깨진다. */
    <div data-testid={`seller-group-${market}`}>
      <p className="text-[11px] font-semibold text-slate-700">{label}</p>
      {rows.length === 0 ? (
        /** 🔴 후보가 없으면 **빈 상태** 를 적는다 — 다른 제품으로 채우지 않는다. */
        <p data-testid="seller-group-empty" className="mt-1 text-[11px] text-slate-500">
          후보 없음
        </p>
      ) : (
        <ul className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {rows.map((r) => (
            <SellerCard key={`${label}-${r.discoveredUrl ?? r.domain}`} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function SellerCandidateCards({ rows }: { rows?: readonly Row[] | null }) {
  /** 🔴🔴 WU-091 ① — **기본 접힘**. `open` 을 붙이지 않는다(펼치면 「유력」으로 읽힌다). */
  const [open, setOpen] = useState(false);

  /** 🔴 경로가 돌지 않았으면 영역을 만들지 않는다(「후보 0」과 다른 사실이다). */
  if (!rows) return null;

  const domestic = rows.filter(isDomestic);
  const overseas = rows.filter(isOverseas);
  /** 🔴 시장이 확정되지 않은 행은 **국내/해외로 지어 넣지 않는다** — 개수만 적는다. */
  const unknownCount = rows.length - domestic.length - overseas.length;
  /** 🟢 「동일상품으로 확인된 판매처」 판단은 **행이 들고 온 값** 으로만 센다(새 판정 0). */
  const confirmed = rows.filter((r) => (r.crossSellerVerdict ?? "") === "SAME").length;

  return (
    <section data-testid="seller-candidates" className="rounded border border-slate-200 bg-white p-3">
      <h3 className="text-sm font-semibold text-slate-800">{SELLER_CANDIDATES_TITLE}</h3>

      {/* 🔴🔴 WU-091 ② — 「동일상품 없음」을 **먼저** 안내한다(후보 목록보다 위). */}
      <p data-testid="seller-candidates-headline" className="mt-1 text-[11px] text-slate-600">
        {rows.length === 0 ? NO_CANDIDATE_AT_ALL : confirmed === 0 ? NO_SAME_BUT_CANDIDATES : null}
      </p>

      {/* 🔴🔴 WU-091 ④ — 「가격비교에 사용되지 않습니다」. 기존 문구 owner 그대로. */}
      <p data-testid="seller-candidates-scope" className="mt-0.5 text-[11px] text-slate-500">
        {OTHER_CANDIDATES_NOTICE}
      </p>

      {rows.length > 0 ? (
        <>
          <button
            type="button"
            data-testid="seller-candidates-toggle"
            onClick={() => setOpen((v) => !v)}
            className="mt-1 rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600"
          >
            {open ? "후보 접기" : `후보 ${rows.length}건 보기`}
          </button>
          {open ? (
            <div data-testid="seller-candidates-body" className="mt-2 space-y-3">
              {/* 🔴 국내 ↔ 해외 **같은 컴포넌트** · 같은 순서(사진 → 가격 → 판정 → URL). */}
              <MarketGroup market="DOMESTIC" label={SELLER_DOMESTIC_LABEL} rows={domestic} />
              <MarketGroup market="OVERSEAS" label={SELLER_OVERSEAS_LABEL} rows={overseas} />
              {unknownCount > 0 ? (
                <p data-testid="seller-candidates-unknown" className="text-[11px] text-slate-400">
                  시장을 확인하지 못한 후보 {unknownCount}건은 국내·해외로 분류하지 않았습니다.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
