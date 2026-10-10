import { NextResponse } from "next/server";

import {
  checkEgressHealth,
  recordEgressHealth,
  type EgressHealthReport,
  type EgressHealthVerdict,
} from "@/lib/egress-health";
import {
  asEgressProvider,
  EGRESS_PROVIDERS,
  readEgressLog,
  readEgressSelection,
  writeEgressSelection,
  type EgressLogRecord,
  type EgressProvider,
} from "@/lib/egress-settings";
import {
  configuredEgressProviders,
  invalidateEgressSelectionCache,
  resolveOutboundProxyAsync,
} from "@/lib/outbound-proxy";

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * EGRESS ④ — 셀러가 CTO 없이 OCI ↔ FIXIE 를 전환하는 엔드포인트 (2026-10-10)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ── 🔴 절대 내보내지 않는 것 ────────────────────────────────────────────────
 *
 *     proxy URL · 자격증명 · Authorization 헤더 · host/port
 *
 * provider 이름("OCI"/"FIXIE")과 단계별 판정만 나간다. 🔴 host/port 도 넣지
 * 않는다 — 기존 `/api/diagnostics/proxy` 는 진단 목적으로 그것을 내보내지만,
 * 이 화면은 셀러가 보는 설정 화면이고 거기에 인프라 주소가 있을 이유가 없다.
 *
 * ── 🔴 GET 은 실측하지 않는다 ───────────────────────────────────────────────
 *
 * 설정 화면을 열 때마다 3단계 probe 를 돌리면 화면이 최대 20초 멈추고, 장애 중인
 * 프록시를 사람이 새로고침할 때마다 다시 때린다. 그래서 GET 은 **기록된 최근
 * 측정** 을 돌려준다. 실측은 셀러가 「연결 테스트」를 눌렀을 때만 한다.
 * 🔴 그래서 응답의 health 에는 `measuredAt` 이 같이 나간다 — 「지금 정상」과
 *    「3시간 전에 정상이었다」를 같은 말로 쓰지 않는다.
 *
 * ── 🔴 POST 는 「저장 성공」을 「정상」으로 쓰지 않는다 ──────────────────────
 *
 *     ① 현재 선택을 기억한다
 *     ② 요청받은 provider 로 «실제로» 3단계 측정한다
 *     ③ NORMAL 이 아니면 → DB 를 건드리지 않고 기존 provider 유지 + 실패 기록
 *     ④ NORMAL 이면 → DB commit + 캐시 무효화 + 전환 기록
 *
 * 🔴 ②에서 「임시 적용」을 하지 않는다. 작업지시서는 「요청 Provider 임시 적용 →
 *    CONNECT」 순서로 적었지만, 전역 선택값을 잠깐 바꾸면 **그 사이에 들어온
 *    채널 요청이 검증되지 않은 프록시로 나간다.** 등록 요청 한 건이 그 창에
 *    걸리면 실제 상품이 영향을 받는다. 대신 그 provider 전용 dispatcher 로
 *    직접 측정한다 — 증명하려는 것(「그 프록시로 실제로 나가지는가」)은 똑같이
 *    증명되고, 전역 상태를 건드리는 창이 아예 생기지 않는다.
 *
 * 🔴 자동 failover 는 구현하지 않는다(A⑦). 실패하면 기존 provider 로 남고,
 *    이 라우트는 «대신 다른 provider 를 골라 주지 않는다».
 */

type ProviderView = {
  provider: EgressProvider;
  /** env 에 URL 이 있는가. 🔴 없으면 고를 수 없다 — 고른 뒤에 실패하게 두지 않는다. */
  configured: boolean;
  health: EgressHealthVerdict | null;
  measuredAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
};

/** 이력 한 행이 「성공」인가. 🔴 outbound 가 OK 여야 성공이다 — CONNECT 만
 *  됐으면 성공이 아니다(2026-10-10 이 그 모양이었다). */
function isSuccess(row: EgressLogRecord): boolean {
  return row.outboundResult === "OK";
}

function isFailure(row: EgressLogRecord): boolean {
  if (isSuccess(row)) return false;
  /* 둘 다 NULL 인 행은 「거기까지 가지 못했다」이고, 그것도 실패로 센다 —
     단 어느 단계인지는 detail 이 들고 있다. */
  return row.connectResult !== "OK" || row.outboundResult !== null;
}

/** 기록된 이력에서 provider 별 상태를 만든다. 🔴 추정하지 않는다 — 이력이
 *  없으면 health 는 null 이고, 그것은 「정상」도 「장애」도 아니다. */
function viewFor(provider: EgressProvider, rows: EgressLogRecord[], configured: boolean): ProviderView {
  const mine = rows.filter((row) => row.provider === provider);
  const latest = mine[0] ?? null;
  const success = mine.find(isSuccess) ?? null;
  const failure = mine.find(isFailure) ?? null;
  return {
    provider,
    configured,
    health: latest ? (isSuccess(latest) ? "NORMAL" : latest.connectResult === "OK" ? "DEGRADED" : "DOWN") : null,
    measuredAt: latest?.createdAt ?? null,
    lastSuccessAt: success?.createdAt ?? null,
    lastFailureAt: failure?.createdAt ?? null,
    lastError: failure?.detail ?? null,
  };
}

/** 🔴 응답에 싣는 보고서에서 비밀값이 섞일 여지를 한 번 더 줄인다 —
 *  단계 판정·소요시간·진단 문구만 남기고 그 밖의 필드는 만들지 않는다. */
function publicReport(report: EgressHealthReport) {
  return {
    provider: report.provider,
    health: report.health,
    tcp: report.tcp,
    connect: report.connect,
    outbound: report.outbound,
    outboundIp: report.outboundIp,
    totalElapsedMs: report.totalElapsedMs,
    checkedAt: report.checkedAt,
  };
}

export async function GET() {
  const [selection, effective, log] = await Promise.all([
    readEgressSelection(),
    resolveOutboundProxyAsync(),
    readEgressLog(20),
  ]);

  const configured = configuredEgressProviders();

  return NextResponse.json({
    ok: true,
    /** 지금 «실제로» 나가는 쪽. NONE 이면 프록시 없이 직접 나간다(로컬 개발). */
    currentProvider: effective.provider,
    /** 셀러가 고른 값. 🔴 null 은 「모름」이 아니라 env 폴백이다. */
    selectedProvider: selection.provider,
    /** 이 결정을 누가 했는가 — 「전환이 반영됐는가」를 화면이 알 수 있어야 한다. */
    decidedBy: effective.decidedBy,
    /** READY | NOT_MIGRATED | UNAVAILABLE. 🔴 migration 전과 장애를 갈라 적는다. */
    store: selection.store,
    storeReason: selection.reason ?? null,
    availableProviders: EGRESS_PROVIDERS.map((provider) =>
      viewFor(provider, log.entries, configured.includes(provider)),
    ),
    /** 🔴 기록된 최근 측정이다. GET 은 실측하지 않는다. */
    lastCheck: log.entries[0]?.createdAt ?? null,
    lastSuccess: log.entries.find(isSuccess)?.createdAt ?? null,
    lastFailure: log.entries.find(isFailure)?.createdAt ?? null,
    lastError: log.entries.find(isFailure)?.detail ?? null,
    recentHistory: log.entries,
    historyStore: log.store,
  });
}

type PostBody = {
  /** "test" = 측정만 · "switch"(기본) = 측정 후 성공하면 저장 */
  action?: "test" | "switch";
  /** "OCI" | "FIXIE" | null(= env 폴백으로 되돌리기) */
  provider?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PostBody | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const action = body.action ?? "switch";
  const revertToEnv = body.provider === null;
  const requested = asEgressProvider(body.provider);

  if (!requested && !revertToEnv) {
    /* 🔴 어휘 밖의 값을 받아 넘기지 않는다 — 'oci' 소문자나 'TINYPROXY' 를
       DB 까지 보내 CHECK 제약으로 터지게 하지 않고 여기서 거절한다. */
    return NextResponse.json(
      { ok: false, error: "provider 는 OCI 또는 FIXIE 여야 합니다." },
      { status: 400 },
    );
  }

  /* ── ① 현재 선택을 기억한다 ───────────────────────────────────────────────── */
  const before = await readEgressSelection();

  /* 되돌리기(null)는 env 가 고를 쪽을 실제로 재야 한다 — 「되돌렸더니 그쪽도
     죽어 있었다」를 전환 후에 발견하면 안 된다. */
  const target: EgressProvider | null = requested ?? (await (async () => {
    const effective = await resolveOutboundProxyAsync();
    return effective.provider === "NONE" ? null : (effective.provider as EgressProvider);
  })());

  if (!target) {
    return NextResponse.json(
      {
        ok: false,
        error: "되돌릴 대상 프록시가 환경설정에 없습니다 — 먼저 OCI 또는 FIXIE 주소를 등록해야 합니다.",
      },
      { status: 409 },
    );
  }

  /* ── ② 실제로 3단계 측정한다 (전역 상태는 건드리지 않는다) ────────────────── */
  const report = await checkEgressHealth(target);

  if (action === "test") {
    await recordEgressHealth(report, { source: "HEALTH_CHECK" });
    return NextResponse.json({
      ok: report.health === "NORMAL",
      action: "test",
      /* 🔴 측정만 했다. 선택값은 바뀌지 않았다 — 이것을 응답에 명시한다. */
      switched: false,
      selectedProvider: before.provider,
      report: publicReport(report),
    });
  }

  /* ── ③ NORMAL 이 아니면 기존 provider 를 유지한다 ─────────────────────────── */
  if (report.health !== "NORMAL") {
    await recordEgressHealth(report, {
      source: "SWITCH",
      switchedFrom: before.provider,
      switchCommitted: false,
    });
    return NextResponse.json(
      {
        ok: false,
        action: "switch",
        switched: false,
        /* 🔴 「기존 provider 유지」를 말로만 쓰지 않고 값으로 돌려준다. */
        selectedProvider: before.provider,
        error:
          report.health === "NOT_CONFIGURED"
            ? `${target} 프록시 주소가 환경설정에 없습니다.`
            : `${target} 로 실제 외부 요청이 나가지 않아 전환하지 않았습니다 — 기존 설정을 그대로 유지합니다.`,
        report: publicReport(report),
      },
      { status: 200 },
    );
  }

  /* ── ④ 성공 — 이제서야 저장한다 ──────────────────────────────────────────── */
  const saved = await writeEgressSelection(revertToEnv ? null : target);
  if (!saved.ok) {
    await recordEgressHealth(report, {
      source: "SWITCH",
      switchedFrom: before.provider,
      switchCommitted: false,
    });
    return NextResponse.json(
      {
        ok: false,
        action: "switch",
        switched: false,
        selectedProvider: before.provider,
        store: saved.store,
        error: saved.error,
        report: publicReport(report),
      },
      { status: 200 },
    );
  }

  /* 🔴 저장 직후 캐시를 버린다 — 그러지 않으면 이 인스턴스가 최대 15초 동안
     옛 선택으로 나간다. 다른 인스턴스는 TTL 만큼 늦게 따라온다(즉시 아니다). */
  invalidateEgressSelectionCache();

  await recordEgressHealth(report, {
    source: "SWITCH",
    switchedFrom: before.provider,
    switchCommitted: true,
  });

  const after = await resolveOutboundProxyAsync();
  return NextResponse.json({
    ok: true,
    action: "switch",
    switched: true,
    selectedProvider: revertToEnv ? null : target,
    currentProvider: after.provider,
    decidedBy: after.decidedBy,
    report: publicReport(report),
  });
}
