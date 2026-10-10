"use client";

import { useCallback, useEffect, useState } from "react";

import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/StatusBadge";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * EGRESS ⑤ — 셀러가 CTO 없이 프록시를 전환하는 화면 (2026-10-10)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 이 화면이 필요한가 ─────────────────────────────────────────────────
 * 2026-10-10, 세 채널(스마트스토어·쿠팡·롯데ON)의 연결 확인이 «동시에» 실패했다.
 * 셋의 유일한 공통 경로가 아웃바운드 프록시다. 그런데 그때 전환 수단은
 * `OUTBOUND_PROXY` env 뿐이었고, env 는 **재배포 전까지 반영되지 않는다**(실측).
 * 즉 셀러는 CTO 를 기다리는 수밖에 없었다. 이 화면이 그 대기를 없앤다.
 *
 * ── 🔴 화면에 올리지 않는 것 ──────────────────────────────────────────────
 *
 *     프록시 URL · 사용자명/비밀번호 · host · port · Tinyproxy
 *
 * 🔴 **Tinyproxy 는 provider 가 아니다.** OCI 안에서 도는 구성요소이고, 셀러가
 *    고르는 것은 `OCI` 와 `FIXIE` 둘뿐이다(CPO 명시). 내부 구성요소 이름을
 *    선택지로 올리면 셀러가 고를 수 없는 것을 고르려 하게 된다.
 *
 * ── 🔴 「연결 테스트」와 「전환」은 다른 버튼이다 ──────────────────────────
 *
 *     연결 테스트  재기만 한다. 선택값은 바뀌지 않는다.
 *     전환         재고 «성공했을 때만» 저장한다. 실패하면 기존 설정이 남는다.
 *
 * 둘을 한 버튼으로 묶으면 「눌렀더니 바뀌어 있었다」가 된다. 장애 중에 그
 * 모호함은 그대로 비용이다.
 *
 * ── 🔴 「포트 열림」을 「정상」으로 표시하지 않는다 ────────────────────────
 * 그래서 상태를 세 단계로 «펼쳐» 보여준다 — TCP / CONNECT / 외부요청.
 * 2026-10-10 의 양상이 정확히 `TCP OK + CONNECT 무응답` 이었고, 단계를 합쳐
 * 보여주는 화면은 그것을 정상으로 말했을 것이다.
 */

type StageVerdict = "PASS" | "REFUSED" | "TIMEOUT" | "ERROR" | "SKIPPED" | "NOT_CONFIGURED";
type HealthVerdict = "NORMAL" | "DEGRADED" | "DOWN" | "NOT_CONFIGURED";
type Provider = "OCI" | "FIXIE";

type Stage = { verdict: StageVerdict; elapsedMs: number | null; detail: string | null };

type ProviderView = {
  provider: Provider;
  configured: boolean;
  health: HealthVerdict | null;
  measuredAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
};

type HistoryRow = {
  id: string;
  createdAt: string;
  provider: Provider;
  connectResult: string | null;
  outboundResult: string | null;
  elapsedMs: number | null;
  switchedFrom: string | null;
  switchCommitted: boolean | null;
  source: string;
  detail: string | null;
};

type EgressState = {
  ok: boolean;
  currentProvider: string;
  selectedProvider: Provider | null;
  decidedBy: "DB" | "ENV";
  store: "READY" | "NOT_MIGRATED" | "UNAVAILABLE";
  storeReason: string | null;
  availableProviders: ProviderView[];
  lastCheck: string | null;
  recentHistory: HistoryRow[];
};

type Report = {
  provider: Provider;
  health: HealthVerdict;
  tcp: Stage;
  connect: Stage;
  outbound: Stage;
  outboundIp: string | null;
  totalElapsedMs: number;
  checkedAt: string;
};

type ActionResult = {
  ok: boolean;
  switched?: boolean;
  error?: string;
  report?: Report;
};

/** 🔴 상태를 「정상 / 그 외」로 뭉개지 않는다 — 조치가 다르다. */
const HEALTH_META: Record<HealthVerdict, { status: StatusBadgeStatus; label: string }> = {
  NORMAL: { status: "success", label: "정상" },
  DEGRADED: { status: "warning", label: "연결은 되지만 외부 요청 실패" },
  DOWN: { status: "error", label: "연결 실패" },
  NOT_CONFIGURED: { status: "neutral", label: "주소 미등록" },
};

const STAGE_LABEL: Record<StageVerdict, string> = {
  PASS: "통과",
  REFUSED: "거절",
  TIMEOUT: "무응답",
  ERROR: "오류",
  /* 🔴 「실행되지 않았다」를 「실패」로 쓰지 않는다. 앞 단계가 막히면 뒤는
     애초에 돌지 않았고, 그 둘은 다른 사실이다. */
  SKIPPED: "미실행",
  NOT_CONFIGURED: "미설정",
};

/**
 * 🔴 **응답의 «모양» 을 믿지 않는다.** (2026-10-10, 전수 회귀가 잡은 결함)
 *
 * 처음 구현에서 `state.ok` 만 보고 `state.availableProviders.find(...)` 를 했다.
 * 그러자 설정 화면의 다른 테스트 12건이 떨어졌다 — 그 테스트의 fetch 스텁이
 * 관심 없는 엔드포인트에 「빈 설정 객체」(`ok:true` 뿐)를 돌려주기 때문이다.
 * 그런데 그건 테스트 사정이 아니라 **실제로 일어나는 상황** 이다:
 *
 *     배포 시차로 옛 모양의 응답이 올 때
 *     오류 봉투가 `ok` 를 싣고 올 때
 *     프록시/로그인 페이지가 HTML 을 돌려줄 때
 *
 * 그때 이 컴포넌트가 던지면 «설정 화면 전체» 가 죽는다. 내 섹션 하나가 아니라
 * 커머스 계정·배송·판매자 정보까지 같이 사라진다 — 교환 비율이 성립하지 않는다.
 *
 * 🔴 그래서 모양이 맞지 않으면 «모양을 흉내 내지 않고» null 로 떨어뜨린다.
 *    화면은 「불러오지 못했습니다」를 그리고 넘어간다 — 이 리포의 기존 규약
 *    (`/api/platform-status` 가 같은 방식이다)과 같은 처리다.
 */
function parseState(raw: unknown): EgressState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.ok !== true) return null;
  /* 이 둘이 없으면 이 화면이 할 말이 없다 — 「정상」으로 꾸미지 않는다. */
  if (!Array.isArray(o.availableProviders)) return null;
  if (typeof o.currentProvider !== "string") return null;
  return {
    ok: true,
    currentProvider: o.currentProvider,
    selectedProvider: (o.selectedProvider as Provider | null) ?? null,
    decidedBy: o.decidedBy === "DB" ? "DB" : "ENV",
    store:
      o.store === "READY" || o.store === "NOT_MIGRATED" || o.store === "UNAVAILABLE"
        ? o.store
        : "UNAVAILABLE",
    storeReason: typeof o.storeReason === "string" ? o.storeReason : null,
    availableProviders: o.availableProviders as ProviderView[],
    lastCheck: typeof o.lastCheck === "string" ? o.lastCheck : null,
    /* 🔴 이력이 배열이 아니면 «빈 이력» 이다 — 없는 행을 지어내지 않는다. */
    recentHistory: Array.isArray(o.recentHistory) ? (o.recentHistory as HistoryRow[]) : [],
  };
}

function formatWhen(iso: string | null): string {
  if (!iso) return "확인한 적 없음";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "확인한 적 없음";
  return date.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "medium" });
}

function formatElapsed(ms: number | null): string {
  if (ms === null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}초` : `${ms}ms`;
}

export function EgressSection() {
  const [state, setState] = useState<EgressState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/egress");
      setState(parseState(await res.json()));
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  const run = useCallback(
    async (action: "test" | "switch", provider: Provider | null) => {
      setBusy(`${action}:${provider ?? "ENV"}`);
      setResult(null);
      try {
        const res = await fetch("/api/settings/egress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, provider }),
        });
        setResult((await res.json()) as ActionResult);
      } catch {
        setResult({ ok: false, error: "요청을 보내지 못했습니다 — 잠시 후 다시 시도해 주세요." });
      } finally {
        setBusy(null);
        await load();
      }
    },
    [load],
  );

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-surface px-4 py-3" data-egress-section="loading">
        <p className="text-sm text-text-tertiary">아웃바운드 연결 상태를 불러오는 중…</p>
      </div>
    );
  }

  if (!state?.ok) {
    return (
      <div className="rounded-lg border border-border bg-surface px-4 py-3" data-egress-section="unavailable">
        <p className="text-sm text-error">아웃바운드 연결 설정을 불러오지 못했습니다.</p>
      </div>
    );
  }

  const current = state.currentProvider;
  /* 🔴 조회를 «한 번» 만 한다. 같은 lookup 을 두 군데서 하면 한쪽만 고쳐져
     라벨과 색이 서로 다른 말을 하게 된다. 모르는 provider 이름이 와도
     NOT_CONFIGURED 로 떨어지고 던지지 않는다. */
  const currentHealth = state.availableProviders.find((p) => p.provider === current)?.health ?? null;
  const currentMeta = HEALTH_META[currentHealth ?? "NOT_CONFIGURED"] ?? HEALTH_META.NOT_CONFIGURED;

  return (
    <div className="space-y-3" data-egress-section="true">
      <div className="rounded-lg border border-border bg-surface px-4 py-3">
        <p className="mb-1 text-xs font-semibold text-text-secondary">현재 연결</p>
        <div className="flex flex-wrap items-center gap-2" data-egress-current={current}>
          <span className="text-sm font-semibold text-text-primary">{current}</span>
          <StatusBadge
            status={current === "NONE" ? "neutral" : currentMeta.status}
            label={current === "NONE" ? "프록시 없이 직접 연결" : currentMeta.label}
            caption={`(마지막 확인: ${formatWhen(state.lastCheck)})`}
          />
        </div>
        <p className="mt-2 text-[11px] text-text-tertiary">
          {/* 🔴 「전환이 반영됐는가」를 셀러가 알 수 있어야 한다 — 선택이 저장돼
              있는 상태와 배포 환경설정을 따르는 상태는 다른 사실이다. */}
          {state.decidedBy === "DB"
            ? "이 화면에서 고른 설정을 따르고 있습니다."
            : "선택한 설정이 없어 배포 환경설정을 따르고 있습니다."}
          {state.store === "NOT_MIGRATED" && " 저장 공간이 아직 준비되지 않아 전환을 저장할 수 없습니다."}
          {state.store === "UNAVAILABLE" && " 저장 공간을 읽지 못했습니다."}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface px-4 py-3">
        <p className="mb-1 text-xs font-semibold text-text-secondary">연결 방식 선택</p>
        <p className="mb-3 text-[11px] text-text-tertiary">
          {/* 🔴 자동 전환이 아니라는 것을 화면이 먼저 말한다 — 기대와 동작이
              어긋나면 장애 중에 셀러가 「왜 안 바뀌나」를 기다리게 된다. */}
          연결이 실패해도 자동으로 바뀌지 않습니다. 「전환」을 누르면 실제로 외부 요청이
          나가는지 확인한 뒤, 성공했을 때만 적용합니다.
        </p>

        <div className="space-y-2">
          {state.availableProviders.map((view) => {
            const meta = HEALTH_META[view.health ?? "NOT_CONFIGURED"];
            const isCurrent = view.provider === current;
            const isSelected = view.provider === state.selectedProvider;
            return (
              <div
                key={view.provider}
                className="rounded-lg border border-border px-3 py-2"
                data-egress-provider={view.provider}
                data-egress-provider-current={isCurrent ? "true" : "false"}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{view.provider}</span>
                    {isCurrent && (
                      <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-[10px] text-text-secondary">
                        사용 중
                      </span>
                    )}
                    {isSelected && !isCurrent && (
                      <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-[10px] text-text-secondary">
                        선택됨
                      </span>
                    )}
                    <StatusBadge
                      status={view.health === null ? "needsCheck" : meta.status}
                      label={view.health === null ? "확인 필요" : meta.label}
                      caption={`(마지막 확인: ${formatWhen(view.measuredAt)})`}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-1 text-xs text-text-secondary disabled:opacity-50"
                      disabled={busy !== null || !view.configured}
                      onClick={() => void run("test", view.provider)}
                      data-egress-test={view.provider}
                    >
                      {busy === `test:${view.provider}` ? "확인 중…" : "연결 테스트"}
                    </button>
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-1 text-xs font-semibold text-text-primary disabled:opacity-50"
                      disabled={busy !== null || !view.configured || isSelected}
                      onClick={() => void run("switch", view.provider)}
                      data-egress-switch={view.provider}
                    >
                      {busy === `switch:${view.provider}` ? "전환 중…" : "전환"}
                    </button>
                  </div>
                </div>
                {!view.configured && (
                  <p className="mt-1 text-[11px] text-text-tertiary">
                    {/* 🔴 「주소가 없다」를 「고장났다」로 말하지 않는다. */}
                    이 방식의 주소가 등록되어 있지 않아 선택할 수 없습니다.
                  </p>
                )}
                {view.lastError && (
                  <p className="mt-1 text-[11px] text-error" data-egress-last-error={view.provider}>
                    마지막 실패: {view.lastError}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {state.selectedProvider !== null && (
          <button
            type="button"
            className="mt-3 rounded border border-border px-2 py-1 text-xs text-text-secondary disabled:opacity-50"
            disabled={busy !== null}
            onClick={() => void run("switch", null)}
            data-egress-revert="true"
          >
            {busy === "switch:ENV" ? "되돌리는 중…" : "배포 환경설정으로 되돌리기"}
          </button>
        )}
      </div>

      {result && (
        <div
          className="rounded-lg border border-border bg-surface px-4 py-3"
          data-egress-result={result.ok ? "ok" : "failed"}
        >
          <p className={`text-sm ${result.ok ? "text-success" : "text-error"}`}>
            {result.ok
              ? result.switched
                ? "전환했습니다 — 실제 외부 요청까지 확인했습니다."
                : "연결을 확인했습니다. (설정은 바뀌지 않았습니다)"
              : (result.error ?? "확인에 실패했습니다.")}
          </p>
          {result.report && (
            <table className="mt-2 w-full text-left text-[11px]" data-egress-stages="true">
              <tbody>
                {(
                  [
                    ["TCP 연결", result.report.tcp],
                    ["터널 연결", result.report.connect],
                    ["외부 요청", result.report.outbound],
                  ] as const
                ).map(([label, stage]) => (
                  <tr key={label} data-egress-stage={label}>
                    <th scope="row" className="py-0.5 pr-3 font-normal text-text-tertiary">
                      {label}
                    </th>
                    <td className="py-0.5 pr-3 text-text-primary">{STAGE_LABEL[stage.verdict]}</td>
                    <td className="py-0.5 text-text-tertiary">{formatElapsed(stage.elapsedMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface px-4 py-3">
        <p className="mb-2 text-xs font-semibold text-text-secondary">연결 이력</p>
        {state.recentHistory.length === 0 ? (
          <p className="text-[11px] text-text-tertiary" data-egress-history="empty">
            {/* 🔴 「이력이 없다」를 「이상 없다」로 쓰지 않는다. */}
            기록된 이력이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]" data-egress-history="true">
              <thead>
                <tr className="text-text-tertiary">
                  <th scope="col" className="py-1 pr-3 font-normal">시간</th>
                  <th scope="col" className="py-1 pr-3 font-normal">방식</th>
                  <th scope="col" className="py-1 pr-3 font-normal">터널</th>
                  <th scope="col" className="py-1 pr-3 font-normal">외부요청</th>
                  <th scope="col" className="py-1 pr-3 font-normal">소요</th>
                  <th scope="col" className="py-1 font-normal">전환</th>
                </tr>
              </thead>
              <tbody>
                {state.recentHistory.map((row) => (
                  <tr key={row.id} className="text-text-secondary" data-egress-history-row={row.id}>
                    <td className="py-0.5 pr-3">{formatWhen(row.createdAt)}</td>
                    <td className="py-0.5 pr-3">{row.provider}</td>
                    {/* 🔴 NULL 을 「실패」로 칠하지 않는다 — 「거기까지 가지 못했다」다. */}
                    <td className="py-0.5 pr-3">{row.connectResult ?? "미실행"}</td>
                    <td className="py-0.5 pr-3">{row.outboundResult ?? "미실행"}</td>
                    <td className="py-0.5 pr-3">{formatElapsed(row.elapsedMs)}</td>
                    <td className="py-0.5">
                      {row.switchCommitted === null
                        ? "—"
                        : row.switchCommitted
                          ? `전환됨${row.switchedFrom ? ` (${row.switchedFrom} →)` : ""}`
                          : "전환 안 함"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
