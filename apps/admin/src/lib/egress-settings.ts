import { getSupabaseAdmin } from "./supabase-admin";

/**
 * ══ EGRESS ② — 「선택값은 DB · 비밀값은 env」의 DB 쪽 절반 ══════════════════
 *
 * 078 migration 이 만든 두 자리를 읽고 쓴다:
 *
 *     seller_settings.egress_provider   NULL | 'OCI' | 'FIXIE'
 *     commerce_egress_log              단계별 이력
 *
 * 🔴 **URL·자격증명은 여기 들어오지 않는다.** provider 이름만 저장한다. 비밀값은
 *    `OCI_PROXY_URL` · `FIXIE_URL` env 에 그대로 남는다(078 주석의 결론이다).
 *
 * ── 🔴 078 이 «아직 적용되지 않았어도» 동작해야 한다 ────────────────────────
 *
 * migration 은 Supabase SQL Editor 에서 실행되고, 코드 배포와 시점이 다르다.
 * 그래서 컬럼/테이블이 없는 상태를 «오류» 로 다루지 않는다 — Postgres 가 주는
 * 코드로 갈라 `NOT_MIGRATED` 로 보고하고, 호출부는 env 폴백으로 내려간다.
 * 이것이 078 이 말한 「NULL 은 모름이 아니라 폴백」을 코드 쪽에서 지키는 방법이다.
 *
 *     42703  undefined_column   → egress_provider 칸이 아직 없다
 *     42P01  undefined_table    → commerce_egress_log 가 아직 없다
 *
 * 🔴 그 둘을 「연결 실패」와 뭉치지 않는다. 「migration 전」과 「DB 가 죽었다」는
 *    다른 사실이고, 뭉치면 화면이 둘을 같은 말로 보고하게 된다.
 */
export type EgressProvider = "OCI" | "FIXIE";

/** 🔴 provider 는 둘뿐이다. Tinyproxy 는 OCI 의 내부 구성요소이고 provider 가
 *  아니다(CPO 명시). 이 배열이 UI·API 의 유일한 어휘 출처다. */
export const EGRESS_PROVIDERS: readonly EgressProvider[] = ["OCI", "FIXIE"];

/** 저장소가 지금 어떤 상태인가. 🔴 세 상태를 뭉치지 않는다. */
export type EgressStore = "READY" | "NOT_MIGRATED" | "UNAVAILABLE";

const UNDEFINED_COLUMN = "42703";
const UNDEFINED_TABLE = "42P01";

export type EgressConnectResult = "OK" | "REFUSED" | "TIMEOUT" | "ERROR";
export type EgressOutboundResult = "OK" | "HTTP_ERROR" | "TIMEOUT" | "ERROR";
export type EgressLogSource = "HEALTH_CHECK" | "SWITCH" | "CHANNEL_REQUEST";

export type EgressLogEntry = {
  provider: EgressProvider;
  /** 🔴 NULL 은 「그 단계까지 가지 못했다」다 — 실패가 아니다(078 주석). */
  connectResult: EgressConnectResult | null;
  outboundResult: EgressOutboundResult | null;
  /** 🔴 소요시간이 원인을 가른다 — 수백 ms = 거절 · 20~25s = hang. */
  elapsedMs: number | null;
  switchedFrom: EgressProvider | null;
  switchCommitted: boolean | null;
  source: EgressLogSource;
  detail: string | null;
};

export type EgressLogRecord = EgressLogEntry & { id: string; createdAt: string };

/** 입력이 어휘 안에 있는가. 🔴 'oci' 소문자나 'TINYPROXY' 는 거절한다 —
 *  078 의 CHECK 제약과 같은 판정을 API 입구에서 먼저 한다. */
export function asEgressProvider(value: unknown): EgressProvider | null {
  return value === "OCI" || value === "FIXIE" ? value : null;
}

/**
 * 🔴 detail 에 비밀값이 섞여 들어가는 길을 입구에서 끊는다.
 *
 * `describeErrorCauseChain()` 은 host/port/에러코드만 남기므로 원칙적으로
 * 안전하다. 그런데 「원칙적으로 안전」은 가드가 아니다 — 누군가 나중에
 * `error.message` 나 fetch 입력 URL 을 그대로 detail 에 넣으면 자격증명이
 * DB·API·화면까지 한 번에 흘러간다. 그래서 저장 «직전» 에 한 번 더 지운다.
 *
 *   ① env 에 든 프록시 URL 전체가 문구에 등장하면 통째로 지운다
 *   ② `scheme://user:pass@host` 형태의 자격증명을 지운다 (env 와 달라도 잡힌다)
 */
export function redactEgressDetail(detail: string | null | undefined): string | null {
  if (!detail) return null;
  let out = detail;
  for (const secret of [process.env.OCI_PROXY_URL, process.env.FIXIE_URL]) {
    if (secret && secret.length > 0) out = out.split(secret).join("[REDACTED]");
  }
  /* 🔴 `//user:pass@` 만 잡는다. 「//」 없는 `a:b@c` 는 이메일 모양이라
     개인정보 쪽이고, 그건 애초에 넣지 않는 것으로 막는다(078 주석). */
  out = out.replace(/\/\/[^/\s@]*:[^/\s@]*@/g, "//[REDACTED]@");
  return out;
}

/**
 * 🔴 seller-settings.ts 와 «같은» 범위 규칙을 쓴다.
 *    workspace 행 → 없으면 레거시 NULL 행. 추정으로 workspace 를 고르지 않는다.
 */
async function resolveCurrentWorkspaceId(): Promise<string | null> {
  try {
    const { requireUser } = await import("@/lib/auth/require-user");
    const auth = await requireUser();
    return auth.ok ? auth.user.workspaceId : null;
  } catch {
    return null;
  }
}

function classifyError(error: { code?: string; message?: string } | null): EgressStore {
  if (!error) return "READY";
  if (error.code === UNDEFINED_COLUMN || error.code === UNDEFINED_TABLE) return "NOT_MIGRATED";
  return "UNAVAILABLE";
}

export type EgressSelection = {
  /** 🔴 null 은 「모름」이 아니라 «env 폴백» 이다(078). */
  provider: EgressProvider | null;
  store: EgressStore;
  reason?: string;
};

/**
 * 셀러가 고른 provider 를 읽는다.
 *
 * 🔴 읽기 실패를 「선택 없음」으로 «조용히» 바꾸지 않는다. provider 는 null 이
 *    되지만 `store` 가 그 이유를 들고 올라간다 — 화면이 「env 폴백 중」과
 *    「DB 를 못 읽었다」를 구별할 수 있어야 한다.
 */
export async function readEgressSelection(workspaceId?: string | null): Promise<EgressSelection> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { provider: null, store: "UNAVAILABLE", reason: "저장소에 연결하지 못했습니다." };

  const scope = workspaceId === undefined ? await resolveCurrentWorkspaceId() : workspaceId;

  const read = async (scopeId: string | null) => {
    const base = supabase.from("seller_settings").select("egress_provider");
    const scoped = scopeId ? base.eq("workspace_id", scopeId) : base.is("workspace_id", null);
    return scoped.eq("scope_key", "default").maybeSingle();
  };

  try {
    let { data, error } = await read(scope);
    /* workspace 행에 값이 없으면 레거시 NULL 행을 본다 — 059 가 NULL 로만
       backfill 했으므로 현재 설정은 거기 있다(seller-settings.ts 와 같은 이유). */
    if (!error && scope && !(data as { egress_provider?: unknown } | null)?.egress_provider) {
      const legacy = await read(null);
      if (!legacy.error && legacy.data) ({ data, error } = legacy);
    }
    if (error) {
      const store = classifyError(error as { code?: string; message?: string });
      return {
        provider: null,
        store,
        reason:
          store === "NOT_MIGRATED"
            ? "078 migration 이 아직 적용되지 않았습니다 — env 설정을 그대로 씁니다."
            : (error as { message?: string }).message,
      };
    }
    const raw = (data as { egress_provider?: unknown } | null)?.egress_provider;
    return { provider: asEgressProvider(raw), store: "READY" };
  } catch (cause) {
    return {
      provider: null,
      store: "UNAVAILABLE",
      reason: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

/**
 * 선택값을 저장한다. `null` 을 주면 env 폴백으로 «되돌린다».
 *
 * 🔴 이 함수는 **health 를 보지 않는다.** 「저장됐다」와 「실제로 나간다」는
 *    다른 사실이고, 실제 outbound 확인은 호출부(A④ POST)가 저장 «전» 에 한다.
 *    여기서 둘을 묶으면 DB 쓰기 성공이 「정상」으로 둔갑한다.
 */
export async function writeEgressSelection(
  provider: EgressProvider | null,
  workspaceId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string; store: EgressStore }> {
  const supabase = getSupabaseAdmin();
  if (!supabase)
    return { ok: false, error: "저장소에 연결하지 못했습니다.", store: "UNAVAILABLE" };

  const scope = workspaceId === undefined ? await resolveCurrentWorkspaceId() : workspaceId;
  const row = { egress_provider: provider, updated_at: new Date().toISOString() };

  try {
    const update = supabase.from("seller_settings").update(row);
    const { data, error } = await (scope
      ? update.eq("workspace_id", scope)
      : update.is("workspace_id", null)
    )
      .eq("scope_key", "default")
      .select("id");

    if (error) {
      const store = classifyError(error as { code?: string; message?: string });
      return {
        ok: false,
        store,
        error:
          store === "NOT_MIGRATED"
            ? "078 migration 이 아직 적용되지 않아 선택을 저장할 수 없습니다."
            : "전환 선택을 저장하지 못했습니다.",
      };
    }
    if (data && data.length > 0) return { ok: true };

    /* 해당 범위의 행이 없으면 만든다 — seller-settings.saveSellerSettings 와 같은 꼴. */
    const { error: insertError } = await supabase
      .from("seller_settings")
      .insert({ workspace_id: scope ?? null, scope_key: "default", ...row });
    if (insertError) {
      const store = classifyError(insertError as { code?: string; message?: string });
      return {
        ok: false,
        store,
        error:
          store === "NOT_MIGRATED"
            ? "078 migration 이 아직 적용되지 않아 선택을 저장할 수 없습니다."
            : "전환 선택을 저장하지 못했습니다.",
      };
    }
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      store: "UNAVAILABLE",
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

/**
 * 이력 1건을 남긴다.
 *
 * 🔴 **이력 기록 실패가 측정/전환을 깨뜨리지 않는다.** 이 표는 「2일 주기」가설을
 *    재기 위한 관측 장치이고, 관측 장치가 없다고 등록 경로가 멈추면 안 된다.
 *    그래서 best-effort 다 — 단, 실패를 «조용히» 삼키지 않고 결과로 돌려준다.
 */
export async function appendEgressLog(
  entry: EgressLogEntry,
): Promise<{ ok: boolean; store: EgressStore }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, store: "UNAVAILABLE" };
  try {
    const { error } = await supabase.from("commerce_egress_log").insert({
      provider: entry.provider,
      connect_result: entry.connectResult,
      outbound_result: entry.outboundResult,
      elapsed_ms: entry.elapsedMs,
      switched_from: entry.switchedFrom,
      switch_committed: entry.switchCommitted,
      source: entry.source,
      detail: redactEgressDetail(entry.detail),
    });
    if (error) return { ok: false, store: classifyError(error as { code?: string }) };
    return { ok: true, store: "READY" };
  } catch {
    return { ok: false, store: "UNAVAILABLE" };
  }
}

/** 최근 이력. 🔴 질의 패턴은 「언제 어느 provider 가 어느 단계에서 실패했나」
 *  하나이고, 078 의 인덱스도 그것만 받친다. */
export async function readEgressLog(
  limit = 20,
): Promise<{ entries: EgressLogRecord[]; store: EgressStore }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { entries: [], store: "UNAVAILABLE" };
  try {
    const { data, error } = await supabase
      .from("commerce_egress_log")
      .select(
        "id, created_at, provider, connect_result, outbound_result, elapsed_ms, switched_from, switch_committed, source, detail",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { entries: [], store: classifyError(error as { code?: string }) };
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    return {
      store: "READY",
      entries: rows.map((row) => ({
        id: String(row.id),
        createdAt: String(row.created_at),
        provider: (row.provider as EgressProvider) ?? "OCI",
        connectResult: (row.connect_result as EgressConnectResult | null) ?? null,
        outboundResult: (row.outbound_result as EgressOutboundResult | null) ?? null,
        elapsedMs: row.elapsed_ms === null || row.elapsed_ms === undefined ? null : Number(row.elapsed_ms),
        switchedFrom: (row.switched_from as EgressProvider | null) ?? null,
        switchCommitted:
          row.switch_committed === null || row.switch_committed === undefined
            ? null
            : Boolean(row.switch_committed),
        source: (row.source as EgressLogSource) ?? "HEALTH_CHECK",
        /* 🔴 읽을 때도 한 번 더 지운다 — 078 적용 «전» 에 들어간 행이나 손으로
           넣은 행이 있을 수 있고, 그것이 API 응답으로 나가면 안 된다. */
        detail: redactEgressDetail(row.detail as string | null),
      })),
    };
  } catch {
    return { entries: [], store: "UNAVAILABLE" };
  }
}
