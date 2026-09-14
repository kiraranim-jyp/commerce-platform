"use client";

import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 2 — 판매관리(**읽기 전용**).
 *
 * 이 저장소에는 판매관리 화면·라우트·테이블이 하나도 없었다(조사 §2 —
 * 주문/배송/클레임 테이블 0개, 라우트 0개). 그래서 이 화면은 0에서 시작하되
 * **최소로** 만든다:
 *
 *  - 새 테이블을 만들지 않는다. 주문을 저장하지 않는다(영속화는 이번 범위 밖).
 *    조회 결과를 화면에 보여주는 것까지만 한다.
 *  - **지원되지 않는 Action 버튼을 만들지 않는다.** 발송 처리 · 송장 등록 ·
 *    취소/반품/교환 승인 · "환불 처리"는 전부 없다. 롯데ON에는 독립 환불 API
 *    자체가 없고(취소/반품 승인의 부수 효과), 나머지는 실제 고객 주문을
 *    되돌릴 수 없게 바꾼다.
 *  - 🔴 `210 연동완료통보`를 호출하는 경로가 이 화면에 없다. 조회가 통보를
 *    끌고 가지 않도록 HTTP 클라이언트에도 guard가 있다.
 *
 * 채널 탭에는 지금 롯데ON만 있다 — 네이버/쿠팡은 주문 조회 연동 자체가 없어서
 * "탭은 있는데 아무것도 안 나오는" 화면을 만들지 않는다(가짜 상태 표시 금지).
 */
type SalesChannel = "lotteon";
type SalesView = "orders" | "claims" | "products";

interface OrderRow {
  odNo: string | null;
  clmNo: string | null;
  odTypCd: string | null;
  odPrgsStepCd: string | null;
  dvRtrvDvsCd: string | null;
  odCmptDttm: string | null;
  spdNm: string | null;
  sitmNm: string | null;
  odrNm: string | null;
  odQty: number | null;
  slAmt: number | null;
  actualAmt: number | null;
}

interface ProductRow {
  spdNo: string | null;
  epdNo: string | null;
  spdNm: string | null;
  slStatCd: string | null;
  catAprvStatCd: string | null;
  pdInfoAprvStatCd: string | null;
  fnlAprvYn: string | null;
  regDttm: string | null;
}

const ORDER_PROGRESS_LABEL: Record<string, string> = { "11": "출고지시", "23": "회수지시" };
const ORDER_TYPE_LABEL: Record<string, string> = {
  "10": "주문",
  "20": "취소(주문취소)",
  "30": "교환",
  "31": "교환취소",
  "40": "반품",
  "41": "반품취소",
  "50": "AS",
};
const DELIVERY_DIVISION_LABEL: Record<string, string> = { DV: "배송", RTRV: "회수" };
const SALE_STATUS_LABEL: Record<string, string> = {
  SALE: "판매중",
  SOUT: "품절",
  STP: "판매중지",
  END: "판매종료",
};
const APPROVAL_LABEL: Record<string, string> = {
  APRV_WT: "승인대기",
  APRV_CMPT: "승인완료",
  GVBK: "반려",
  ADMR_TCTL: "관리자이관",
  NONE: "해당없음",
};

function todayYmd(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function formatLotteOnDttm(value: string | null): string {
  if (!value || value.length < 8) return "-";
  const y = value.slice(0, 4);
  const m = value.slice(4, 6);
  const d = value.slice(6, 8);
  const hh = value.slice(8, 10);
  const mm = value.slice(10, 12);
  return hh ? `${y}-${m}-${d} ${hh}:${mm}` : `${y}-${m}-${d}`;
}

function formatKrw(value: number | null): string {
  return value == null ? "-" : `₩${value.toLocaleString("ko-KR")}`;
}

export default function SalesPage() {
  const [channel] = useState<SalesChannel>("lotteon");
  const [view, setView] = useState<SalesView>("orders");
  const [date, setDate] = useState(todayYmd());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [claims, setClaims] = useState<{ label: string; rows: unknown[] } | null>(null);
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [claimType, setClaimType] = useState<"CANCEL" | "RETURN" | "EXCHANGE">("CANCEL");

  async function post<T>(path: string, body: unknown): Promise<T | null> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; nextAction?: string } & T;
      if (!data.ok) {
        setError([data.message, data.nextAction].filter(Boolean).join(" "));
        return null;
      }
      return data;
    } catch {
      setError("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders() {
    setOrders(null);
    const data = await post<{ orders: OrderRow[] }>("/api/lotteon/orders", { date });
    if (data) setOrders(data.orders);
  }

  async function loadClaims() {
    setClaims(null);
    const data = await post<{ claims: unknown[]; label: string }>("/api/lotteon/claims", { type: claimType, date });
    if (data) setClaims({ label: data.label, rows: data.claims });
  }

  async function loadProducts() {
    setProducts(null);
    const data = await post<{ products: ProductRow[] }>("/api/lotteon/product-status", {});
    if (data) setProducts(data.products);
  }

  return (
    <>
      <PageHeader title="판매관리" subtitle="연동된 커머스의 주문·클레임·상품 상태를 조회합니다." />
      <PageContainer size="lg" className="py-5">

      {/* 🔴 이 화면이 읽기 전용이라는 사실을 화면에서 먼저 말한다 — 셀러가
          "왜 처리 버튼이 없지?"라고 묻기 전에. */}
      <div className="mb-4 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-xs text-text-secondary">
        <p className="font-semibold text-text-primary">조회 전용 화면입니다.</p>
        <p className="mt-1">
          발송 처리 · 송장 등록 · 취소/반품/교환 승인 · 환불은 이 화면에서 할 수 없습니다.{" "}
          <b>실제 주문 처리는 롯데ON 판매자센터에서 하십시오.</b>
        </p>
        <p className="mt-1 text-text-tertiary">
          롯데ON은 &ldquo;연동완료 통보&rdquo;를 호출하는 순간 주문이 상품준비중으로 자동 전이되며 되돌릴 수 없습니다 —
          이 시스템은 그 호출을 하지 않고, 시도 자체를 코드에서 차단합니다.
        </p>
      </div>

      <Tabs
        items={[{ value: "lotteon", label: "롯데ON" }]}
        value={channel}
        onChange={() => undefined}
        className="mb-4"
      />

      <Tabs
        items={[
          { value: "orders", label: "주문 조회" },
          { value: "claims", label: "취소 · 반품 · 교환 조회" },
          { value: "products", label: "등록 상품 상태" },
        ]}
        value={view}
        onChange={(v) => setView(v as SalesView)}
        className="mb-4"
      />

      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface px-4 py-3">
        {view !== "products" && (
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            조회 날짜
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
          </label>
        )}
        {view === "claims" && (
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            클레임 유형
            <select
              value={claimType}
              onChange={(e) => setClaimType(e.target.value as typeof claimType)}
              className="rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value="CANCEL">취소</option>
              <option value="RETURN">반품</option>
              <option value="EXCHANGE">교환</option>
            </select>
          </label>
        )}
        <Button
          variant="primary"
          size="sm"
          disabled={loading}
          onClick={() => {
            if (view === "orders") void loadOrders();
            else if (view === "claims") void loadClaims();
            else void loadProducts();
          }}
        >
          {loading ? "조회 중…" : "조회"}
        </Button>
        {view !== "products" && (
          <p className="text-[11px] text-text-tertiary">
            롯데ON은 조회 기간이 <b>1일을 초과할 수 없습니다</b> — 하루 단위로만 조회합니다.
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-error/40 bg-error/5 px-4 py-3 text-sm text-error">{error}</div>
      )}

      {view === "orders" && orders && (
        <SalesTable
          emptyMessage="해당 날짜에 출고/회수지시 주문이 없습니다."
          columns={["주문번호", "상품", "구매자", "수량", "금액", "주문유형", "진행단계", "배송/회수", "주문일"]}
          rows={orders.map((order) => [
            order.odNo ?? "-",
            [order.spdNm, order.sitmNm].filter(Boolean).join(" / ") || "-",
            order.odrNm ?? "-",
            order.odQty == null ? "-" : String(order.odQty),
            formatKrw(order.actualAmt ?? order.slAmt),
            ORDER_TYPE_LABEL[order.odTypCd ?? ""] ?? order.odTypCd ?? "-",
            ORDER_PROGRESS_LABEL[order.odPrgsStepCd ?? ""] ?? order.odPrgsStepCd ?? "-",
            DELIVERY_DIVISION_LABEL[order.dvRtrvDvsCd ?? ""] ?? order.dvRtrvDvsCd ?? "-",
            formatLotteOnDttm(order.odCmptDttm),
          ])}
        />
      )}

      {view === "claims" && claims && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-semibold text-text-primary">
            {claims.label} {claims.rows.length}건
          </p>
          {claims.rows.length === 0 ? (
            <p className="text-sm text-text-tertiary">해당 날짜에 {claims.label} 건이 없습니다.</p>
          ) : (
            // 클레임 응답은 주문마다 itemList가 중첩된 구조이고 문서에 전체 필드
            // 표가 온전히 공개돼 있지 않다 — 임의로 골라 표로 만들면 빠뜨린
            // 정보를 셀러가 영영 못 본다. 원문을 그대로 보여준다.
            <pre className="max-h-[480px] overflow-auto rounded bg-background p-3 text-[11px] text-text-secondary">
              {JSON.stringify(claims.rows, null, 2)}
            </pre>
          )}
          <p className="mt-2 text-[11px] text-text-tertiary">
            승인 · 거부 · 환불은 이 화면에서 할 수 없습니다 — 롯데ON 판매자센터에서 처리하십시오.
          </p>
        </div>
      )}

      {view === "products" && products && (
        <SalesTable
          emptyMessage="최근 30일 내 등록된 상품이 없습니다."
          columns={["판매자상품번호", "업체상품번호", "상품명", "판매상태", "카테고리 승인", "상품정보 승인", "최종승인", "등록일"]}
          rows={products.map((product) => [
            product.spdNo ?? "-",
            product.epdNo ?? "-",
            product.spdNm ?? "-",
            SALE_STATUS_LABEL[product.slStatCd ?? ""] ?? product.slStatCd ?? "-",
            APPROVAL_LABEL[product.catAprvStatCd ?? ""] ?? product.catAprvStatCd ?? "-",
            APPROVAL_LABEL[product.pdInfoAprvStatCd ?? ""] ?? product.pdInfoAprvStatCd ?? "-",
            product.fnlAprvYn === "Y" ? "승인완료" : "미승인",
            formatLotteOnDttm(product.regDttm),
          ])}
          footnote="롯데ON은 카테고리 승인과 상품정보 승인 2단계를 모두 통과해야 고객 화면에 노출됩니다."
        />
      )}
      </PageContainer>
    </>
  );
}

function SalesTable({
  columns,
  rows,
  emptyMessage,
  footnote,
}: {
  columns: string[];
  rows: string[][];
  emptyMessage: string;
  footnote?: string;
}) {
  if (rows.length === 0) {
    return <div className="rounded-lg border border-border bg-surface px-4 py-6 text-sm text-text-tertiary">{emptyMessage}</div>;
  }
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-tertiary">
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-3 py-2 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-border last:border-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="whitespace-nowrap px-3 py-2 text-text-secondary">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote && <p className="border-t border-border px-3 py-2 text-[11px] text-text-tertiary">{footnote}</p>}
    </div>
  );
}
