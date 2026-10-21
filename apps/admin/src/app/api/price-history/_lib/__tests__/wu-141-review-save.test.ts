import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-141-R1 STEP 4 — **후보 검토 저장 실패의 원인은 `ON CONFLICT` 였다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **운영 DB 실측**(`packages/database/scripts/wu-141-review-save-probe.mjs` · 2026-10-21):
 * ```
 * 079 의 유니크는 **부분 인덱스 둘** 이다(`where snapshot_id is not null` …).
 * 그런데 코드가 `.upsert(…, { onConflict: "snapshot_id,candidate_url" })` 를 썼고,
 * PostgREST 는 그것을 `ON CONFLICT (snapshot_id, candidate_url)` 로 번역한다.
 * 🔴 Postgres 는 **부분 인덱스를 술어 없이 추론하지 못한다**:
 *    ⒜ 앱과 같은 문장                        → **42P10** (실측)
 *    ⒝ `… WHERE snapshot_id is not null` 추가 → 🟢 성공
 *    ⒞ 수정 후 모양(조회 → insert / update)   → 🟢 성공 · 재삽입은 **23505 로 계속 막힌다**
 * ⟹ 🔴 네 판단 **전부** 실패였고(CEO 가 본 그것) 📚 이력도 **조용히** 0 이었다.
 * ```
 * 🟢 **schema 를 바꾸지 않고** 문장 모양만 고쳤다 — 부분 유니크 둘은 WU-131 이 계약으로
 *    잠근 설계이고, 그 **무결성 방어는 그대로 살아 있다**(실측 ⒞-3).
 *
 * 🔴 이 파일은 **네트워크 0 · DB 0** 이다. supabase 클라이언트를 가짜로 바꿔
 *    **어떤 문장을 보내는가** 를 본다(실제 DB 축은 위 probe 가 이미 쟀다).
 */

const LIB = path.join(__dirname, "..");
const strip = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
const DATA = strip(path.join(LIB, "candidate-review.ts"));

/* ─────────────── A. 🔴 회귀 잠금 — `upsert` 가 돌아오면 FAIL ─────────────── */

describe("A. 🔴🔴 `onConflict` upsert 를 다시 쓰지 않는다", () => {
  it("A-1 🔴🔴 `.upsert(` 가 **코드에** 없다(주석은 벗겨서 본다)", () => {
    /**
     * 🔴 이 한 줄이 이번 결함의 재발을 막는다. 🔴 `onConflict` 문자열만 금지하면
     *    `.upsert()` 를 인자 없이 써서 **전건 insert 충돌** 로 또 터진다 ⟹ 둘 다 막는다.
     */
    expect(DATA).not.toContain(".upsert(");
    expect(DATA).not.toContain("onConflict");
  });

  it("A-2 🟢 대신 **조회 → insert / update** 모양이다", () => {
    const save = DATA.slice(DATA.indexOf("export async function saveHumanVerdict"));
    expect(save).toContain("findReviewId(");
    expect(save).toContain(".insert(");
    expect(save).toContain(".update(");
  });

  it("A-3 🔴 **경쟁 삽입을 23505 로 받아 갱신** 한다 — 셀러의 클릭을 잃지 않는다", () => {
    expect(DATA).toContain('UNIQUE_VIOLATION = "23505"');
    const save = DATA.slice(DATA.indexOf("export async function saveHumanVerdict"));
    expect(save).toContain("error.code === UNIQUE_VIOLATION");
  });

  it("A-4 🔴 키 축은 **(snapshot_id, candidate_url)** 그대로다 — 새 키를 만들지 않았다", () => {
    const find = DATA.slice(DATA.indexOf("async function findReviewId"), DATA.indexOf("export async function recordSeenCandidates"));
    expect(find).toContain('.eq("snapshot_id", snapshotId)');
    expect(find).toContain('.eq("candidate_url", key)');
  });

  it("A-5 🔴 실패 사유를 **삼키지 않는다** — 오류 코드를 로그에 남긴다", () => {
    /** 🔴 1차 결함이 «조용히» 살아 있던 이유가 이것이다(코드 없는 warn + null 반환). */
    expect(DATA).toContain("error.code");
    expect(DATA.match(/console\.warn\(`\[candidate-review\]/g)?.length ?? 0).toBeGreaterThan(2);
  });
});

/* ─────── B. 🔴 행동 — 가짜 supabase 로 «보내는 문장» 을 본다 (네트워크 0) ─────── */

type Sent = { table: string; op: string; payload?: unknown; filters: [string, unknown][] };

let sent: Sent[];
let existingRow: { id: string } | null;
let insertError: { code: string; message: string } | null;
/** 🔴 **연속 조회가 다른 답을 주는** 상황(경쟁 삽입)을 표현하려면 큐가 필요하다. */
let selectQueue: ({ id: string } | null)[];

/** 🟢 supabase-js 가 쓰는 체이닝만 흉내낸다 — thenable 이라 `await` 가 끝을 잡는다. */
function fakeClient() {
  const make = (table: string, op: string, payload?: unknown) => {
    const rec: Sent = { table, op, payload, filters: [] };
    sent.push(rec);
    const result = () => {
      const inFilter = rec.filters.find(([c]) => c === "in");
      if (op === "select" && inFilter) {
        /**
         * 🔴 **조회한 키를 그대로 되돌려 준다.** 1차 fake 는 `candidate_url: "k"` 를
         *    돌려줘서 `reviewKey(url)` 와 **영원히 매칭되지 않았고**, 그래서 「갱신이
         *    아예 안 보내진다」는 **거짓 FAIL** 이 났다(하니스 결함이었다).
         */
        const [, keys] = (inFilter[1] as [string, string[]]) ?? ["", []];
        return {
          data: existingRow ? keys.map((k) => ({ id: existingRow!.id, candidate_url: k })) : [],
          error: null,
        };
      }
      if (op === "select") {
        const next = selectQueue.length > 0 ? selectQueue.shift()! : existingRow;
        return { data: next, error: null };
      }
      if (op === "insert" && insertError) return { data: null, error: insertError };
      return { data: { id: "row-1", human_verdict: (payload as Record<string, unknown>)?.human_verdict }, error: null };
    };
    const builder: Record<string, unknown> = {
      eq: (c: string, v: unknown) => {
        rec.filters.push([c, v]);
        return builder;
      },
      in: (c: string, v: unknown) => {
        rec.filters.push(["in", [c, v]]);
        return builder;
      },
      select: () => builder,
      maybeSingle: () => Promise.resolve(result()),
      then: (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res),
    };
    return builder;
  };
  return {
    from: (table: string) => ({
      select: (cols: string) => make(table, "select", cols),
      insert: (payload: unknown) => make(table, "insert", payload),
      update: (payload: unknown) => make(table, "update", payload),
    }),
  };
}

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => fakeClient() }));

const { saveHumanVerdict, recordSeenCandidates } = await import("../candidate-review");

const base = {
  snapshotId: "11111111-1111-1111-1111-111111111111",
  originCode: "B226AC009",
  workspaceId: "22222222-2222-2222-2222-222222222222",
};

beforeEach(() => {
  sent = [];
  existingRow = null;
  insertError = null;
  selectQueue = [];
});

describe("B. 🔴 네 판단이 «전부» 저장된다", () => {
  for (const verdict of ["SAME", "SIMILAR", "DIFFERENT", "UNDECIDED"] as const) {
    it(`B-1 🟢 ${verdict} — 행이 없으면 **insert** 한다`, async () => {
      const row = await saveHumanVerdict({ ...base, candidateUrl: "https://a.example/p/1", humanVerdict: verdict });
      expect(row).not.toBeNull();
      /** 🔴 조회를 **먼저** 한다(그래야 ON CONFLICT 가 필요 없다). */
      expect(sent[0].op).toBe("select");
      expect(sent[1].op).toBe("insert");
      expect((sent[1].payload as Record<string, unknown>).human_verdict).toBe(verdict);
    });
  }

  it("B-2 🔴🔴 이미 판단한 후보를 **다시 누르면 갱신** 된다(판단 변경이 막히지 않는다)", async () => {
    existingRow = { id: "row-1" };
    const row = await saveHumanVerdict({ ...base, candidateUrl: "https://a.example/p/1", humanVerdict: "DIFFERENT" });
    expect(row).not.toBeNull();
    expect(sent.map((s) => s.op)).toEqual(["select", "update"]);
    /** 🔴 **id 로** 갱신한다 — 키 두 칸으로 다시 찾지 않는다. */
    expect(sent[1].filters).toEqual([["id", "row-1"]]);
  });

  it("B-3 🔴🔴 **경쟁 삽입(23505)** 이 나면 다시 찾아 갱신한다 — 클릭을 잃지 않는다", async () => {
    /**
     * 🔴 실제로 일어나는 순서다: 첫 조회는 비었고 → insert 를 보내는 사이
     *    `recordSeenCandidates` 가 같은 키를 먼저 넣어 **부분 유니크가 23505 로 막는다**.
     * 🟢 그때 다시 찾아 **갱신** 해야 셀러의 클릭이 사라지지 않는다.
     */
    selectQueue = [null, { id: "raced-1" }];
    insertError = { code: "23505", message: "duplicate key value violates unique constraint" };
    const row = await saveHumanVerdict({
      ...base,
      candidateUrl: "https://a.example/p/1",
      humanVerdict: "SAME",
    });
    expect(sent.map((s) => s.op)).toEqual(["select", "insert", "select", "update"]);
    expect(sent[3].filters).toEqual([["id", "raced-1"]]);
    /** 🔴 **null 을 돌려주면 route 가 500 을 내고 셀러는 「저장 실패」를 본다.** */
    expect(row).not.toBeNull();
  });

  it("B-3b 🔴 23505 가 **아닌** 오류는 삼키지 않는다 — 조용히 성공으로 만들지 않는다", async () => {
    insertError = { code: "42P10", message: "no unique or exclusion constraint matching" };
    const row = await saveHumanVerdict({
      ...base,
      candidateUrl: "https://a.example/p/1",
      humanVerdict: "SAME",
    });
    /** 🟢 그래야 화면이 「🔴 저장 실패」를 **정직하게** 말한다(낙관적 성공 금지). */
    expect(row).toBeNull();
    expect(sent.map((s) => s.op)).toEqual(["select", "insert"]);
  });

  it("B-4 🔴🔴 **`system_*` 칸을 쓰지 않는다** — 사람 판단이 MI 산출을 덮지 않는다", async () => {
    await saveHumanVerdict({ ...base, candidateUrl: "https://a.example/p/1", humanVerdict: "SAME" });
    const payload = sent[1].payload as Record<string, unknown>;
    for (const sys of ["system_verdict", "match_truth", "price_tier", "blockers"]) {
      expect(payload, sys).not.toHaveProperty(sys);
    }
  });
});

describe("C. 🔴 이력 기록이 사람 판단을 덮지 않는다", () => {
  const seen = {
    ...base,
    candidates: [
      { candidateUrl: "https://a.example/p/1", source: "OVERSEAS_AUTO" as const, systemVerdict: "SAME" },
    ],
  };

  it("C-1 🟢 행이 없으면 insert 한다", async () => {
    const n = await recordSeenCandidates(seen);
    expect(n).toBe(1);
    expect(sent.map((s) => s.op)).toEqual(["select", "insert"]);
  });

  it("C-2 🔴🔴 행이 있으면 갱신하는데 **판단 칸을 넣지 않는다**", async () => {
    existingRow = { id: "row-1" };
    await recordSeenCandidates(seen);
    const update = sent.find((s) => s.op === "update");
    expect(update).toBeTruthy();
    const payload = update!.payload as Record<string, unknown>;
    /** 🔴 이 셋이 들어가면 이미 판단한 후보가 **재조회로 초기화된다**(WU-131 의 핵심 성질). */
    for (const human of ["human_verdict", "human_note", "reviewed_at"]) {
      expect(payload, human).not.toHaveProperty(human);
    }
    expect(payload).toHaveProperty("last_seen_at");
    /** 🔴 키 칸은 다시 쓰지 않는다. */
    for (const key of ["workspace_id", "snapshot_id", "candidate_url"]) {
      expect(payload, key).not.toHaveProperty(key);
    }
  });
});
