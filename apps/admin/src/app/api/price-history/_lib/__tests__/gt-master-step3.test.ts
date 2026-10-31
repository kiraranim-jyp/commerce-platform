import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 🔴 상한의 owner 는 운영이다 — 하니스가 다른 상한을 갖지 않는다(CAND-02 와 같은 이유).
 *    전에 `10` 을 손으로 적어 둔 하니스가 **조용히 거짓** 을 말한 선례가 있다.
 */
import { MAX_SUPPLIED_CANDIDATE_URLS } from "../run-domestic-price-check";
/**
 * 🔴🔴 **join 키의 owner 는 운영이다** — `canonicalListingKey` 를 그대로 쓴다.
 *    1차 실행이 `host+path` 자작 키를 써서 **같은 후보를 「미도달」과 「GT 라벨 없음」으로
 *    두 번 셌다**(scoutandcokids 2건). 원인은 운영이 Shopify 의 **목록 세그먼트**
 *    `/collections/<c>/products/X` → `/products/X` 를 접기 때문이다
 *    (`self-reference.ts` · 메모 `self-reference-collapses-collections-not-locale`).
 * 🔴 규칙을 내가 다시 쓰면 **운영이 바뀔 때 하니스가 조용히 거짓** 을 말한다.
 * 🟢 로케일은 **접지 않는다** — 그것이 CPO 확정 제품 정책이고 그 함수가 이미 지킨다.
 */
import { canonicalListingKey } from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 IDENTITY-GT-EVIDENCE-MASTER-REVIEW-01 — **Step 3: 8상품 운영 경로 재생**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **분모는 LOCK 이다**(CPO 승인 2026-11-01 · commit `2b431fbf`):
 * ```
 * PRODUCT 8 · UNIQUE CANDIDATE 80 · CEO SAME 43 · DIFFERENT 24 · REVIEW 10 · CONFLICT 3
 * ```
 * 🔴 이 파일은 그 분모를 **다시 계산하지 않는다** — `docs/identity-gt-master/MASTER-GT-DATA.json`
 *    을 **읽기만** 한다. 🔴 숫자가 다르면 그것이 FAIL 이고, 하니스가 분모를 고치지 않는다.
 * 🔴 이상 데이터는 분모를 바꾸지 않고 `DATA-ANOMALY` 로 적는다(CPO 지시 §31).
 *
 * ── 🔴 무엇을 «재지 않는가» ────────────────────────────────────────────────
 * ```
 * Search 0 · Registry 0 · Identity 정책 0 · threshold 0 · 가격 정책 0 · UI 0
 * 운영 코드 변경 0 · 배포 0 · DB 쓰기 0(구조적 불가를 측정 «전» 에 단언한다)
 * ```
 * 🔴 **CTO 는 정책을 결정하지 않는다** — 사실 수집과 분류까지다.
 *
 * ── 🔴 왜 재투입(`reviewedSameUrls`)인가 ───────────────────────────────────
 * ```
 * APIFY_API_TOKEN           부재 ⟹ 새 Search 불가
 * SUPABASE_SERVICE_ROLE_KEY 부재 ⟹ 등록부가 **비어서** 돌고 DB 쓰기가 구조적으로 불가
 * ```
 * 🟢 그래서 **사람이 이미 라벨한 후보 URL** 을 운영 생산자로 되돌려 넣는다.
 * 🔴 「사람이 SAME 이라 했다」가 판정을 **승격하지 않는다** — 그 경로는 URL 을 **다시
 *    열어 보는 것** 뿐이고 SAME/DIFFERENT 는 기존 판정기가 처음부터 다시 낸다
 *    (`run-domestic-price-check.ts` 의 `reviewedSameUrls` 주석).
 * 🔴 그러므로 **CEO DIFFERENT 후보도 같이 넣는다** — FP 를 재려면 그쪽이 분모다.
 *
 * ── 🔴🔴 원상품 DNA 의 owner 는 «저장분» 이다(크롤이 아니다) ────────────────
 * 측정 대상 경로는 `/api/price-history/check` 이고 그 라우트의 DNA owner 는
 * **저장된 canonicalProduct** 다. 🔴 `shopifySiteStrategy.extract` 로 새로 크롤하면
 * 그것은 「새 상품 분석」(pipeline) 경로이고 **이 WU 가 보는 경로가 아니다**.
 * 🟢 그리고 저장분을 쓰면 메모 `origin-brand-recovery-fails-intermittently` 의
 *    **간헐적 brand 공백** 에 측정이 흔들리지 않는다.
 *
 * ── 🔴🔴 상한(20)과 «청크» — 이것은 운영 발견이 아니라 하니스 결정이다 ──────
 * PRODUCT-02(27) · PRODUCT-03(28)은 `MAX_SUPPLIED_CANDIDATE_URLS`(20)를 넘는다.
 * 🔴 **그러나 「운영 상한이 동일상품 N건을 자른다」로 적지 않는다** — 운영에서 그 27·28
 *    건은 **여러 차례의 발견 라운드** 로 나뉘어 도착했고, 한 번에 밀어 넣는 것은 **내
 *    하니스가 분모를 한 통에 담았기 때문** 이다. 🟢 그래서 ≤20 으로 **청크** 해 돌리고
 *    청크마다 `notFetchedOverLimit === 0` 을 단언한다 ⟹ **상한이 아무것도 조용히 버리지
 *    않았다** 는 것을 증거로 남긴다(「후보 없음」과 「fetch 안 됨」을 섞지 않는다).
 *
 * 🔴 게이트 `GTM3_LIVE=1` 없으면 LIVE 블록 SKIP(회귀에서 외부 HTTP 금지).
 * 🔴 jsdom 을 쓰지 않는다 — 라이브 fetch 하니스에 jsdom 을 붙여 전건 UNREACHABLE 을
 *    받은 선례가 있다(WU-133).
 */

const LIVE = process.env.GTM3_LIVE === "1";
const FIX = join(__dirname, "fixtures");
const fx = <T>(f: string): T => JSON.parse(readFileSync(join(FIX, f), "utf8")) as T;

/** 🔴 repo 루트를 **걸어 올라가 찾는다** — 상대경로 `../../..` 는 파일이 옮겨지면 조용히 썩는다. */
function repoRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(join(dir, "docs", "identity-gt-master", "MASTER-GT-DATA.json"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("repo 루트를 찾지 못했다 — MASTER-GT-DATA.json 이 없다");
}

/**
 * 🔴🔴 **join 키는 MASTER-GT 생성기와 «같은 규칙» 이어야 한다**
 *    (`docs/identity-gt-master/build-master-gt.mjs:55`). 규칙이 둘이면 같은 후보가
 *    갈려 「도달하지 않았다」는 거짓이 난다(WU-131 계약 ⒞ 와 같은 이유).
 */
function dedupeKey(raw: string): string {
  try {
    const u = new URL(String(raw).trim());
    const host = u.host.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.toLowerCase().replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return String(raw).trim().toLowerCase();
  }
}

/**
 * 🔴🔴 **실제 join 은 이쪽이다** — 운영 `canonicalListingKey` 산출.
 *    🔴 `dedupeKey`(위)는 **생성기와의 대조용** 이고 join 용이 아니다. 둘을 섞지 않는다.
 *    만들 수 없으면 `dedupeKey` 로 떨어진다(비-http 등).
 */
function joinKey(raw: string): string {
  const k = canonicalListingKey(raw);
  return k ? `${k.host}${k.key}` : dedupeKey(raw);
}

/* ───────────────────────────── 분모(읽기 전용) ───────────────────────────── */

interface MasterCandidate {
  key: string;
  originRaw: string;
  url: string;
  dedupeKey: string;
  CEO_GT: "SAME" | "DIFFERENT" | "REVIEW" | null;
  GT_CONFLICT: boolean;
  GT_SOURCE_FIXTURES: string[];
  GT_VALUES: string[];
  originKeyNormalized: string;
  productId: string;
}
interface Master {
  _counts: { uniqueCandidates: number; SAME: number; DIFFERENT: number; REVIEW: number; GT_CONFLICT: number };
  products: { productId: string; originKey: string }[];
  candidates: MasterCandidate[];
}
interface Facts59 {
  origins: Record<string, { canonicalProduct: Record<string, unknown> }>;
}
interface GtMasterOrigins {
  origins: Record<string, { snapshotId: string; sourceUrl: string; canonicalProduct: Record<string, unknown> }>;
}

const master = (): Master => JSON.parse(readFileSync(join(repoRoot(), "docs/identity-gt-master/MASTER-GT-DATA.json"), "utf8")) as Master;

/**
 * 🔴 **originKey → 저장 canonicalProduct 의 owner 를 «데이터로» 푼다.**
 *    `S3`~`S6` 은 sid 가 그대로 키이고, `B226AC009`/`B226AC010` 은 `cp.sku.value` 로
 *    맞춘다. 🔴 손으로 `S1 = B226AC010` 을 적지 않는다 — 그 매핑이 틀리면 후보가
 *    **엉뚱한 원상품** 에 붙어 측정 전체가 조용히 틀린다(CAND-02-A 가 잡은 그 자리).
 */
export interface OriginResolution {
  productId: string;
  originKey: string;
  /** 🔴 없으면 `null` — **지어내지 않는다**. */
  canonicalProduct: Record<string, unknown> | null;
  factsOwner: string;
  unavailableReason: string | null;
}

export function resolveOrigins(): OriginResolution[] {
  const m = master();
  const f59 = fx<Facts59>("wu-059-gt-facts.json");
  const extra = fx<GtMasterOrigins>("gt-master-origins.json");

  /** sku → sid (저장분에서 읽는다 · 추측 0) */
  const bySku = new Map<string, { sid: string; cp: Record<string, unknown> }>();
  for (const [sid, v] of Object.entries(f59.origins)) {
    const sku = String(((v.canonicalProduct as { sku?: { value?: string } }).sku?.value ?? "")).trim().toUpperCase();
    if (sku) bySku.set(sku, { sid, cp: v.canonicalProduct });
  }

  return m.products.map(({ productId, originKey }) => {
    const up = originKey.toUpperCase();
    /** ① sid 가 그대로 키인 경우(S3~S6) */
    if (f59.origins[originKey]) {
      return { productId, originKey, canonicalProduct: f59.origins[originKey].canonicalProduct, factsOwner: `wu-059-gt-facts.json#origins.${originKey}`, unavailableReason: null };
    }
    /** ② 품번으로 sid 를 찾는 경우(B226AC009 / B226AC010) */
    const hit = bySku.get(up);
    if (hit) {
      return { productId, originKey, canonicalProduct: hit.cp, factsOwner: `wu-059-gt-facts.json#origins.${hit.sid}(sku=${up})`, unavailableReason: null };
    }
    /** ③ 운영 DB 저장분(SM430632) */
    if (extra.origins[originKey]) {
      const e = extra.origins[originKey];
      return { productId, originKey, canonicalProduct: e.canonicalProduct, factsOwner: `gt-master-origins.json#origins.${originKey}(snapshot ${e.snapshotId})`, unavailableReason: null };
    }
    /** ④ 없다 — **측정불가로 적는다**(분모를 줄이지 않는다) */
    return {
      productId,
      originKey,
      canonicalProduct: null,
      factsOwner: "(없음)",
      unavailableReason:
        "ORIGIN_FACTS_UNAVAILABLE — 저장 canonicalProduct 가 fixture 와 운영 DB 양쪽에 없다. 🔴 후보 분모(80)는 그대로다.",
    };
  });
}

/* ──────────────────────────── 분모 계약(네트워크 0) ──────────────────────── */

describe("GTM3 분모 — LOCK 된 입력을 그대로 쓴다", () => {
  /**
   * 🔴🔴 GTM3-A — **LOCK 숫자를 하니스가 재계산하지 않고 «대조» 한다.**
   *    `_counts` 와 실제 행을 양쪽에서 세어 **둘이 같은지** 본다 ⟹ 생성기와 소비자가
   *    갈라지는 순간 FAIL 한다(숫자를 기대값으로 박는 것과 다르다).
   */
  it("GTM3-A 분모 8 / 80 / 43 / 24 / 10 / 3 이 파일 안에서 일관된다", () => {
    const m = master();
    expect(m.products).toHaveLength(8);
    expect(m.candidates).toHaveLength(m._counts.uniqueCandidates);
    const by = (v: string) => m.candidates.filter((c) => c.CEO_GT === v).length;
    expect(by("SAME")).toBe(m._counts.SAME);
    expect(by("DIFFERENT")).toBe(m._counts.DIFFERENT);
    expect(by("REVIEW")).toBe(m._counts.REVIEW);
    expect(m.candidates.filter((c) => c.GT_CONFLICT).length).toBe(m._counts.GT_CONFLICT);
    /** 🔴 CPO 가 LOCK 한 글자 그대로 — 이 줄이 깨지면 분모가 바뀐 것이다. */
    expect([m.candidates.length, m._counts.SAME, m._counts.DIFFERENT, m._counts.REVIEW, m._counts.GT_CONFLICT]).toEqual([80, 43, 24, 10, 3]);
  });

  /**
   * 🔴 GTM3-B — **생성기 키**(`originRaw||url`)가 고유하다 + 내 join 규칙이 생성기와 같다.
   *    🔴 규칙이 둘이면 같은 후보가 갈려 「도달하지 않았다」는 거짓이 난다.
   */
  it("GTM3-B 생성기 키(originRaw||URL) 80건이 고유하고 join 규칙이 같다", () => {
    const m = master();
    const keys = m.candidates.map((c) => `${c.originRaw.toUpperCase()}||${dedupeKey(c.url)}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(80);
    for (const c of m.candidates) expect(dedupeKey(c.url)).toBe(c.dedupeKey);
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 GTM3-E — **DATA-ANOMALY 둘을 «수치로» 고정한다**(CPO §31 · 분모는 안 바꾼다)
   * ══════════════════════════════════════════════════════════════════════════
   *
   * LOCK 된 80 은 **`originRaw` 단위** 분모다. 그런데 `S1`/`S2`(sid)와
   * `B226AC010`/`B226AC009`(품번)가 **같은 상품** 으로 정규화되므로, **같은 (상품, URL)
   * 쌍이 두 행** 으로 들어가 있다.
   * ```
   * ANOMALY-01  (productId, URL) 기준 고유는 **70** 이다(80 − 중복 10)
   * ANOMALY-02  🔴 그 중복 10 중 **1건은 CEO 라벨이 상충** 하는데 `GT_CONFLICT=false` 다
   *             global.trenbe.com/…b226ac009-451-160484657-p
   *               core-same03 + wu-112 (originCode 축) → **SAME**
   *               wu-059      (searchId S2 축)        → **DIFFERENT**
   *             🔴 생성기 키가 `originRaw` 를 포함해 **구조적으로 비교되지 않았다**
   * ```
   * 🔴 **CTO 가 한쪽을 고르지 않는다** — CPO 판정 사안이다(§26 정책 결정 금지).
   * 🔴 **분모 80 을 바꾸지 않는다** — 두 입도를 **갈라서** 보고한다(CPO §31).
   * 🟢 이 숫자를 단언으로 박는 이유: 입력이 바뀌면 **이 계약이 FAIL 로 알려 준다**.
   */
  it("GTM3-E ANOMALY — (상품,URL) 고유 70 · 중복 10 · 교차-origin 라벨 상충 1", () => {
    const m = master();
    const groups = new Map<string, MasterCandidate[]>();
    for (const c of m.candidates) {
      const k = `${c.productId}||${c.dedupeKey}`;
      const arr = groups.get(k) ?? [];
      arr.push(c);
      groups.set(k, arr);
    }
    const dups = [...groups.entries()].filter(([, a]) => a.length > 1);
    /** 🔴 라벨이 **갈리는** 중복만 센다 — 「같은 라벨이 두 번」은 상충이 아니다. */
    const crossConflicts = dups.filter(([, a]) => new Set(a.map((x) => x.CEO_GT)).size > 1);

    /* eslint-disable no-console */
    console.log(`[GTM3-ANOMALY-01] (productId,URL) 고유 ${groups.size} / 생성기 행 ${m.candidates.length} · 중복 그룹 ${dups.length}`);
    console.log(`[GTM3-ANOMALY-02] 교차-origin 라벨 상충 ${crossConflicts.length}건 (생성기 GT_CONFLICT 는 ${m._counts.GT_CONFLICT}건)`);
    for (const [k, a] of crossConflicts) {
      console.log(`   🔴 ${k}`);
      for (const x of a) console.log(`        originRaw=${String(x.originRaw).padEnd(12)} CEO_GT=${x.CEO_GT} ← ${x.GT_SOURCE_FIXTURES.join(" + ")}`);
    }

    expect(groups.size).toBe(70);
    expect(dups).toHaveLength(10);
    expect(crossConflicts).toHaveLength(1);
    /** 🔴 생성기의 `GT_CONFLICT` 가 그 1건을 **놓쳤다** — 그 사실 자체를 단언한다. */
    for (const [, a] of crossConflicts) for (const x of a) expect(x.GT_CONFLICT).toBe(false);
  });

  /**
   * 🔴🔴 GTM3-C — **원상품 facts owner 를 측정 «전» 에 확정한다.**
   *    7개는 저장분이 있고 AC157 하나만 없다. 🔴 「없다」를 **DIFFERENT 나 0 으로
   *    읽지 않는다** — `unavailableReason` 으로 적고 분모는 80 그대로다.
   */
  it("GTM3-C 8상품 중 7개는 저장 canonicalProduct 가 있고 AC157 만 없다", () => {
    const r = resolveOrigins();
    expect(r).toHaveLength(8);
    const missing = r.filter((x) => x.canonicalProduct === null).map((x) => x.originKey);
    expect(missing).toEqual(["AC157"]);
    /** 🔴 owner 문자열이 비어 있으면 「어디서 왔는지」를 보고서가 적을 수 없다. */
    for (const x of r.filter((y) => y.canonicalProduct)) expect(x.factsOwner).toMatch(/\.json#origins\./);
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 GTM3-F — **join owner 가 운영이어야 하는 이유를 수치로 고정한다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 운영은 Shopify 의 **목록 세그먼트** 를 접는다(`/collections/<c>/products/X` →
   * `/products/X`). 🔴 1차 라이브가 자작 `host+path` 키로 join 해서 **같은 후보를
   * 「미도달」과 「GT 라벨 없음」으로 두 번 셌다**(scoutandcokids 2건) — GT 는 목록
   * 형태를, 도달 행은 **접힌 형태** 를 들고 있었다.
   *
   * 🟢 측정 결과 — **GT 원장 «안» 에는 그 중복이 없다**(두 키 모두 고유 70).
   *    ⟹ 🔴 ANOMALY 가 아니라 **내 join 결함** 이었다. 그 사실대로 적는다.
   * 🟢 이 계약은 「두 키의 고유 수가 같다」를 잠근다 — 나중에 GT 에 목록 형태가 섞여
   *    들어오면 **여기가 FAIL 로 알려 준다**(그때는 join 만으로 못 접는다).
   */
  it("GTM3-F join owner 는 운영이고, GT 원장 안에는 목록 세그먼트 중복이 없다", () => {
    const m = master();
    const byDedupe = new Set(m.candidates.map((c) => `${c.productId}||${c.dedupeKey}`));
    const byJoin = new Set(m.candidates.map((c) => `${c.productId}||${joinKey(c.url)}`));
    /** 목록 세그먼트를 접어서 **새로 합쳐지는** 쌍 */
    const collapsed = [...byDedupe].filter((k) => {
      const [p, dk] = k.split("||");
      const same = m.candidates.filter((c) => c.productId === p && c.dedupeKey === dk);
      const jk = joinKey(same[0].url);
      return m.candidates.some((c) => c.productId === p && c.dedupeKey !== dk && joinKey(c.url) === jk);
    });
    /* eslint-disable no-console */
    console.log(`[GTM3-join] 생성기 행 ${m.candidates.length} · dedupeKey 고유 ${byDedupe.size} · 운영 join 고유 ${byJoin.size}`);
    if (collapsed.length) console.log(`   🔴 목록 세그먼트로 합쳐지는 쌍 ${collapsed.length}건 ${JSON.stringify(collapsed)}`);
    /** 🔴 수치로 고정한다 — 입력이 바뀌면 이 계약이 FAIL 로 알려 준다. */
    expect([m.candidates.length, byDedupe.size, byJoin.size]).toEqual([80, 70, 70]);
    /** 🔴 **그리고 운영 키가 목록 형태를 실제로 접는다는 것** 을 같이 단언한다 —
     *    이 단언이 없으면 「join owner 를 바꾼 이유」가 코드에서 사라진다. */
    expect(joinKey("https://scoutandcokids.com/collections/bobo-choses/products/x")).toBe(
      joinKey("https://scoutandcokids.com/products/x"),
    );
    /** 🟢 그러나 **로케일은 접지 않는다**(CPO 확정 정책 · 다른 시장이다). */
    expect(joinKey("https://bobochoses.com/en-kr/products/x")).not.toBe(joinKey("https://bobochoses.com/products/x"));
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 GTM3-G — **「미도달」의 최대 덩어리는 «샵당 1건» 이다** (구조적 상한)
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 운영 sink 는 **샵당 best 1건** 만 싣는다(WU-109 가 확정 · `transientEvidenceSink.push`
   * 가 JUDGED 분기 «안» 에 하나). 그래서 같은 샵의 다른 리스팅은 **구조적으로** 행이
   * 되지 않는다. 🔴 그것을 「우리가 동일상품을 버렸다」로 적으면 거짓이다.
   *
   * 🟢 그 양을 **측정 전에** 세어 둔다 — 고유 (상품,URL) ↔ 고유 (상품,샵) 의 차이.
   * 🔴 이 숫자는 **상한(20)과 무관** 하다. 둘을 합치지 않는다.
   */
  it("GTM3-G 샵당 1건 제한이 접는 후보 수를 측정 전에 센다", () => {
    const m = master();
    const host = (u: string) => {
      const k = canonicalListingKey(u);
      return k ? k.host : "?";
    };
    const uniqPairs = new Map<string, MasterCandidate>();
    for (const c of m.candidates) uniqPairs.set(`${c.productId}||${joinKey(c.url)}`, c);
    const shops = new Set([...uniqPairs.values()].map((c) => `${c.productId}||${host(c.url)}`));
    /* eslint-disable no-console */
    console.log(
      `[GTM3-shop] 고유 (상품,URL) ${uniqPairs.size} · 고유 (상품,샵) ${shops.size}` +
        ` ⟹ 🔴 샵당 1건이 접는 후보 **${uniqPairs.size - shops.size}건**`,
    );
    expect([uniqPairs.size, shops.size]).toEqual([70, 46]);
  });

  /**
   * 🔴🔴 GTM3-D — **상한이 자르는 양을 측정 «전» 에 센다.** 그리고 그것이 운영
   *    발견이 아니라 **하니스 청크 결정** 이라는 것을 같이 적는다.
   */
  it("GTM3-D 상한 20 을 넘는 상품과 청크 수를 기록한다", () => {
    const m = master();
    /** 🔴 **fetch 분모는 고유 (상품,URL) 다**(= 70) — 생성기 행(80)으로 세면 같은 URL 을 두 번 연다. */
    const byP = new Map<string, Set<string>>();
    for (const c of m.candidates) {
      const s = byP.get(c.productId) ?? new Set<string>();
      s.add(c.dedupeKey);
      byP.set(c.productId, s);
    }
    const over = [...byP.entries()]
      .filter(([, s]) => s.size > MAX_SUPPLIED_CANDIDATE_URLS)
      .map(([p, s]) => `${p}:${s.size}건(청크 ${Math.ceil(s.size / MAX_SUPPLIED_CANDIDATE_URLS)})`);
    /* eslint-disable-next-line no-console */
    console.log(`[GTM3-cap] 운영 상한 ${MAX_SUPPLIED_CANDIDATE_URLS} · 초과 상품 ${over.length}건 ${JSON.stringify(over)}`);
    /** 🔴 단언은 「초과가 0」이 아니다 — **초과를 알고 있다** 는 것이다. */
    expect(Array.isArray(over)).toBe(true);
  });
});

/* ───────────────────────────── LIVE 재생 ───────────────────────────── */

/**
 * 🔴 fetch 단위 = **고유 (상품,URL)**. `gtRows` 는 그 쌍에 붙은 **생성기 행 전부** 라
 *    80 ↔ 70 두 입도를 Step 4/5 가 **갈라서** 적을 수 있다.
 */
interface FetchTarget {
  dedupeKey: string;
  url: string;
  /** `SAME`|`DIFFERENT`|`REVIEW`|`GT_CONFLICT`|`GT_CONFLICT_CROSS_ORIGIN`|null */
  CEO_GT: string | null;
  gtRows: { originRaw: string; CEO_GT: string | null; fixtures: string[] }[];
}

interface Step3Row {
  dedupeKey: string;
  url: string;
  domain: string;
  title: string | null;
  CEO_GT: string | null;
  GT_CONFLICT: boolean;
  /** 🔴 그 (상품,URL) 에 붙은 생성기 행 전부 — 80 ↔ 70 두 입도를 Step 4/5 가 가른다. */
  gtRows: { originRaw: string; CEO_GT: string | null; fixtures: string[] }[];
  /* 운영 산출 — 복제 계산 0 */
  market: string | null;
  matchTruth: string | null;
  crossSellerVerdict: string | null;
  crossSellerBlockers: string[] | null;
  crossSellerConflicts: string[] | null;
  matchLevel: string | null;
  confidence: number | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  priceStatus: string | null;
  priceTier: string | null;
  soldOut: boolean | null;
  source: string | null;
  brand: string | null;
  modelCode: string | null;
  display: "LIKELY" | "PRESUMED" | "POSSIBLE" | null;
  priced: boolean;
}

export interface Step3Product {
  productId: string;
  originKey: string;
  factsOwner: string;
  unavailableReason: string | null;
  originUrl: string | null;
  dna: { brand: string | null; brandModelCode: string | null; color: string | null; title: string | null } | null;
  /** 🔴 brand/품번 공백은 **그 상품 숫자를 읽는 전제** 다(WU-133 사슬의 머리). */
  preconditions: string[];
  /** 🔴 생성기 행 수(80 축). */
  gtLedgerRows: number;
  /**
   * 🔴🔴 고유 (상품,URL) 수(70 축). **`suppliedCount` 와 다른 숫자다** —
   *    원상품 facts 가 없는 상품은 고유 후보가 있어도 **공급이 0** 이다.
   *    🔴 1차 실행이 둘을 섞어 「분모 69」라는 거짓을 찍었다(단언이 그것을 잡았다).
   */
  uniqueGtPairs: number;
  suppliedCount: number;
  chunks: number;
  notFetchedOverLimit: string[];
  rows: Step3Row[];
  /** 🔴 공급했는데 **행으로 돌아오지 않은** 후보 — 「후보 없음」과 다른 사실이다. */
  lost: { url: string; CEO_GT: string | null; dedupeKey: string }[];
  metrics: Record<string, unknown>[];
}

describe("GTM3 — 8상품 운영 경로 재생(재투입 · 새 Search 0)", () => {
  it.runIf(LIVE)(
    "🔴 LOCK 된 80후보를 운영 경로로 태우고 Identity/가격/표시 산출을 전수 덤프한다",
    async () => {
      const { backfillCanonicalProduct, buildProductIdentityDna } = await import("@commerce/shared");
      const { runDomesticPriceCheck } = await import("../run-domestic-price-check");
      const { isTransientShopId, REVIEWED_SAME_SHOP_ID } = await import("../transient-candidates");
      const { getSupabaseAdmin } = await import("@/lib/supabase-admin");
      const { selectCandidateList, selectMiSameCandidates } = await import("../../../../pipeline/commerce/mi-same-candidates");
      type Row = import("../../../../pipeline/commerce/GeminiTransientCandidates").GeminiTransientRow;

      /**
       * 🔴🔴 **쓰기 불가를 측정 «전» 에 증명한다.** 이 둘이 참이 아니면 하니스가 엉뚱한
       *    스냅샷에 행을 남길 수 있다 ⟹ 그 상태로는 측정하지 않는다(이중 방어).
       */
      expect(getSupabaseAdmin(), "service-role 이 있다 — 이 하니스로 운영 DB 를 건드릴 수 있다").toBeNull();
      expect(isTransientShopId(REVIEWED_SAME_SHOP_ID), "재투입이 일시 샵이 아니다 — 저장될 수 있다").toBe(true);

      /** 🔴 재투입은 후보 URL 을 **인자로** 받으므로 이 id 로 DB 를 읽어 후보를 만들지 않는다. */
      const SNAPSHOT = "c88d2ca4-bfe1-4851-9c1d-92f69222a3f2";
      const WORKSPACE = "b60b0ad7-d750-4f70-a1c3-a4d220f76756";

      const m = master();
      const origins = resolveOrigins();
      /**
       * 🔴🔴 **고유 (상품,URL) 로 접는다**(GTM3-E 의 ANOMALY-01) — 생성기 행 80 으로
       *    돌리면 같은 URL 을 **두 번 연다**(HTTP 낭비 + 상한을 헛되게 먹는다).
       * 🔴 라벨이 갈리는 1건은 **한쪽을 고르지 않고** `GT_CONFLICT_CROSS_ORIGIN` 으로
       *    적는다 — CTO 가 CEO 판단을 대신 정하지 않는다(§26).
       */
      const byProduct = new Map<string, FetchTarget[]>();
      for (const c of m.candidates) {
        const arr = byProduct.get(c.productId) ?? [];
        /**
         * 🔴🔴 **키를 섞지 않는다.** 2차 라이브가 GT 쪽은 `dedupeKey`(경로만) · 도달 쪽은
         *    `joinKey`(경로+식별쿼리, 목록 접힘)로 join 해서 **URL 이 같은데도** 5건이
         *    「라벨 없음 + 미도달」로 **두 번** 셌다(donokids ×2 · beaumonde · scoutandcokids ×2).
         * 🟢 양쪽 모두 **운영 `joinKey`** 로 맞춘다.
         */
        const key = joinKey(c.url);
        const hit = arr.find((x) => x.dedupeKey === key);
        if (hit) {
          hit.gtRows.push({ originRaw: c.originRaw, CEO_GT: c.CEO_GT, fixtures: c.GT_SOURCE_FIXTURES });
          if (hit.CEO_GT !== c.CEO_GT) hit.CEO_GT = "GT_CONFLICT_CROSS_ORIGIN";
        } else {
          arr.push({
            dedupeKey: key,
            url: c.url,
            CEO_GT: c.GT_CONFLICT ? "GT_CONFLICT" : c.CEO_GT,
            gtRows: [{ originRaw: c.originRaw, CEO_GT: c.CEO_GT, fixtures: c.GT_SOURCE_FIXTURES }],
          });
        }
        byProduct.set(c.productId, arr);
      }

      const out: Step3Product[] = [];

      for (const o of origins.sort((a, b) => a.productId.localeCompare(b.productId))) {
        const cands = byProduct.get(o.productId) ?? [];
        const ledger = m.candidates.filter((c) => c.productId === o.productId).length;
        /* eslint-disable no-console */
        console.log(
          `\n━━━━━━━━ ${o.productId} ${o.originKey} — 고유 후보 ${cands.length}건(생성기 행 ${ledger}) · facts=${o.factsOwner}`,
        );

        if (!o.canonicalProduct) {
          /** 🔴 **지어내지 않는다.** 원상품 DNA 가 없으면 그 상품은 재생할 수 없다. */
          console.log(`   🔴 ${o.unavailableReason}`);
          out.push({
            productId: o.productId,
            originKey: o.originKey,
            factsOwner: o.factsOwner,
            unavailableReason: o.unavailableReason,
            originUrl: null,
            dna: null,
            preconditions: ["ORIGIN_FACTS_UNAVAILABLE"],
            gtLedgerRows: ledger,
            uniqueGtPairs: cands.length,
            suppliedCount: 0,
            chunks: 0,
            notFetchedOverLimit: [],
            rows: [],
            lost: cands.map((c) => ({ url: c.url, CEO_GT: c.CEO_GT, dedupeKey: c.dedupeKey })),
            metrics: [],
          });
          continue;
        }

        const product = backfillCanonicalProduct(o.canonicalProduct as never);
        const dna = buildProductIdentityDna(product);
        const pre: string[] = [];
        if (!dna.brand.value) pre.push("ORIGIN_BRAND_BLANK");
        if (!dna.brandModelCode) pre.push("ORIGIN_MODEL_CODE_BLANK");
        if (!dna.color) pre.push("ORIGIN_COLOR_BLANK");
        console.log(
          `   brand=${JSON.stringify(dna.brand.value)} code=${JSON.stringify(dna.brandModelCode)} ` +
            `color=${JSON.stringify(dna.color)} 전제=${pre.length ? pre.join(",") : "없음"}`,
        );
        console.log(`   원상품 URL = ${(product as { sourceUrl?: string }).sourceUrl ?? "(없음)"}`);
        /**
         * 🔴 brand 가 비면 **모든 후보가 BRAND_UNCONFIRMED** 가 되어 숫자가 조용히 틀린다
         *    (WU-133 사슬의 머리). 🔴 임의로 채우지 않고 **그 전제를 적는다**.
         */
        if (pre.length) console.log(`   🔴 이 상품의 판정 숫자는 위 전제 아래 읽어야 한다 — 값을 채우지 않았다`);

        /** 🔴 청크는 **하니스 결정** 이다(운영 발견이 아니다 · 파일 머리 주석). */
        const chunks: FetchTarget[][] = [];
        for (let i = 0; i < cands.length; i += MAX_SUPPLIED_CANDIDATE_URLS) {
          chunks.push(cands.slice(i, i + MAX_SUPPLIED_CANDIDATE_URLS));
        }

        const rows: Row[] = [];
        const metrics: Record<string, unknown>[] = [];
        const notFetched: string[] = [];

        for (const [ci, chunk] of chunks.entries()) {
          const r = (await runDomesticPriceCheck({
            snapshotId: SNAPSHOT,
            workspaceId: WORKSPACE,
            dna,
            description: product.description.value || undefined,
            /** 🔴 **검색이 아니다** — 사람이 라벨한 URL 을 운영 생산자로 다시 연다. */
            reviewedSameUrls: chunk.map((c) => c.url),
            webSearch: false,
          } as never)) as unknown as Record<string, unknown>;

          /**
           * 🔴 **여섯 출처를 운영과 같은 순서로 합친다** —
           *    `DomesticPriceIntelligencePanel.marketComparisonInput` 의 그 concat 이다.
           *    🔴 한 줄을 빠뜨리면 후보가 화면에서 사라진다(그 파일이 두 번 그렇게 틀렸다).
           */
          rows.push(
            ...((r.geminiEvidence as Row[] | null) ?? []),
            ...((r.urlCandidateEvidence as Row[] | null) ?? []),
            ...((r.overseasAutoEvidence as Row[] | null) ?? []),
            ...((r.reviewedSameEvidence as Row[] | null) ?? []),
            ...((r.domesticListingEvidence as Row[] | null) ?? []),
            ...((r.webSearchEvidence as Row[] | null) ?? []),
          );

          /**
           * 🔴🔴 **칸 이름이 조용히 썩지 않게 단언한다** — 실제 칸은 `reviewedSameMetrics`
           *    이고(`reviewedSameUrlMetrics` 는 **없는 칸** 이다 · CAND-02 가 거기서 틀렸다),
           *    상한에 남은 URL 은 `dropped` 가 아니라 **`notFetchedOverLimit`** 다.
           */
          const met = (r.reviewedSameMetrics ?? null) as Record<string, unknown> | null;
          expect(met, `${o.productId} chunk${ci} reviewedSameMetrics 가 null — 칸 이름이 바뀌었다(측정 무효)`).not.toBeNull();
          metrics.push({ chunk: ci, ...met });
          const over = (met?.notFetchedOverLimit as string[] | undefined) ?? [];
          notFetched.push(...over);
          /**
           * 🔴🔴 **청크가 상한을 넘지 않았음을 증거로 남긴다** — 이것이 참이면
           *    「상한이 동일상품을 버렸다」를 보고서가 **쓸 수 없다**(그 주장의 분모가 0).
           */
          expect(over, `${o.productId} chunk${ci} 가 상한에 잘렸다 — 청크 크기가 상한보다 크다`).toHaveLength(0);
          console.log(`   [GTM3-metrics] chunk${ci} ${JSON.stringify(met)}`);
        }

        /** 운영 선택기 — 표시 축과 가격 축을 **각각** 부른다(복제 0). */
        const display = new Map<string, "LIKELY" | "PRESUMED" | "POSSIBLE">();
        const priced = new Set<string>();
        for (const market of ["KR", "OVERSEAS"] as const) {
          for (const x of selectCandidateList(rows, market)) display.set(joinKey(x.row.discoveredUrl), x.group);
          for (const x of selectMiSameCandidates(rows, market).priced) priced.add(joinKey(x.discoveredUrl));
        }

        const gtByKey = new Map(cands.map((c) => [c.dedupeKey, c]));
        const measured: Step3Row[] = rows.map((row) => {
          const k = joinKey(row.discoveredUrl);
          const gt = gtByKey.get(k);
          const r = row as unknown as Record<string, unknown>;
          return {
            dedupeKey: k,
            url: row.discoveredUrl,
            domain: row.domain,
            title: row.title ?? null,
            CEO_GT: gt?.CEO_GT ?? null,
            GT_CONFLICT: (gt?.gtRows.length ?? 0) > 1 && new Set(gt!.gtRows.map((x) => x.CEO_GT)).size > 1,
            gtRows: gt?.gtRows ?? [],
            market: (row.market as string | null) ?? null,
            matchTruth: (r.matchTruth as string | null) ?? null,
            crossSellerVerdict: (r.crossSellerVerdict as string | null) ?? null,
            crossSellerBlockers: (r.crossSellerBlockers as string[] | null) ?? null,
            crossSellerConflicts: (r.crossSellerConflicts as string[] | null) ?? null,
            matchLevel: (r.matchLevel as string | null) ?? null,
            confidence: (r.confidence as number | null) ?? null,
            priceAmount: row.priceAmount ?? null,
            priceCurrency: row.priceCurrency ?? null,
            priceStatus: (r.priceStatus as string | null) ?? null,
            priceTier: (r.priceTier as string | null) ?? null,
            soldOut: row.soldOut ?? null,
            source: (r.source as string | null) ?? null,
            brand: (r.brand as string | null) ?? null,
            modelCode: (r.modelCode as string | null) ?? null,
            display: display.get(k) ?? null,
            priced: priced.has(k),
          };
        });

        const arrived = new Set(rows.map((x) => joinKey(x.discoveredUrl)));
        out.push({
          productId: o.productId,
          originKey: o.originKey,
          factsOwner: o.factsOwner,
          unavailableReason: null,
          originUrl: (product as { sourceUrl?: string }).sourceUrl ?? null,
          dna: {
            brand: dna.brand.value || null,
            brandModelCode: dna.brandModelCode ?? null,
            color: dna.color ?? null,
            title: product.title.value || null,
          },
          preconditions: pre,
          gtLedgerRows: ledger,
          uniqueGtPairs: cands.length,
          suppliedCount: cands.length,
          chunks: chunks.length,
          notFetchedOverLimit: notFetched,
          rows: measured,
          lost: cands.filter((c) => !arrived.has(c.dedupeKey)).map((c) => ({ url: c.url, CEO_GT: c.CEO_GT, dedupeKey: c.dedupeKey })),
          metrics,
        });

        for (const x of measured) {
          console.log(
            `   [GTM3-row] ${x.domain.padEnd(26)} ceo=${(x.CEO_GT ?? "-").padEnd(9)}` +
              ` market=${(x.market ?? "-").padEnd(9)} truth=${(x.matchTruth ?? "-").padEnd(18)}` +
              ` verdict=${(x.crossSellerVerdict ?? "-").padEnd(14)} tier=${(x.priceTier ?? "-").padEnd(11)}` +
              ` ${String(x.priceAmount ?? "-").padStart(9)} ${(x.priceCurrency ?? "").padEnd(4)}` +
              ` display=${(x.display ?? "X").padEnd(8)} priced=${x.priced ? "O" : "X"}`,
          );
        }
        console.log(`   [GTM3-lost] ${out.at(-1)!.lost.length}건`);
        for (const l of out.at(-1)!.lost) console.log(`        - (${l.CEO_GT ?? "라벨없음"}) ${l.url}`);
      }

      /* ══════════════════ 표 — 상품별 도달/판정/표시 ══════════════════ */
      const pad = (v: unknown, n: number) => {
        const s = String(v);
        return s.length >= n ? s : s + " ".repeat(n - s.length);
      };
      console.log(`\n\n════════ GTM3 Step 3 — 상품별 운영 경로 재생 ════════`);
      console.log(
        `   ${pad("상품", 24)}${pad("행80", 6)}${pad("고유", 6)}${pad("도달", 6)}${pad("표시", 6)}${pad("가격", 6)}${pad("미도달", 8)}${pad("전제", 30)}`,
      );
      for (const p of out) {
        console.log(
          `   ${pad(`${p.productId} ${p.originKey}`, 24)}${pad(p.gtLedgerRows, 6)}${pad(p.suppliedCount, 6)}${pad(p.rows.length, 6)}` +
            `${pad(p.rows.filter((x) => x.display != null).length, 6)}${pad(p.rows.filter((x) => x.priced).length, 6)}` +
            `${pad(p.lost.length, 8)}${pad(p.preconditions.join(",") || "-", 30)}`,
        );
      }

      /** 🔴 **두 입도를 갈라 찍는다** — 생성기 행(80)과 fetch 고유(70)를 섞지 않는다. */
      const all = out.flatMap((p) => p.rows);
      const ledgerTotal = out.reduce((n, p) => n + p.gtLedgerRows, 0);
      const uniqTotal = out.reduce((n, p) => n + p.uniqueGtPairs, 0);
      const gtTotal = out.reduce((n, p) => n + p.suppliedCount, 0);
      const lostTotal = out.reduce((n, p) => n + p.lost.length, 0);
      console.log(
        `\n   생성기 행 ${ledgerTotal}(LOCK 80) · 고유 (상품,URL) ${uniqTotal}(ANOMALY-01 70) · 실제 공급 ${gtTotal}` +
          ` · 도달 ${all.length} · 미도달 ${lostTotal}` +
          ` · 표시 ${all.filter((x) => x.display != null).length} · 가격 ${all.filter((x) => x.priced).length}`,
      );
      /** 🔴 CEO GT 축 — Step 4/5 가 이 표에서 출발한다. 🔴 미도달은 **0 이 아니라 측정불가** 다. */
      for (const g of ["SAME", "DIFFERENT", "REVIEW", "GT_CONFLICT", "GT_CONFLICT_CROSS_ORIGIN"]) {
        const arrived = all.filter((x) => x.CEO_GT === g);
        const lost = out.flatMap((p) => p.lost).filter((x) => x.CEO_GT === g);
        console.log(`   CEO ${pad(g, 26)} 도달 ${pad(arrived.length, 4)} 미도달 ${pad(lost.length, 4)}`);
      }
      /** 🔴 도달한 행 중 **GT 라벨이 안 붙은 것** = join 키 불일치 신호다(조용히 넘기지 않는다). */
      const unjoined = all.filter((x) => x.CEO_GT === null);
      console.log(`   🔴 GT 라벨이 붙지 않은 도달 행 ${unjoined.length}건` + (unjoined.length ? ` ${JSON.stringify(unjoined.slice(0, 5).map((x) => x.dedupeKey))}` : ""));

      writeFileSync(join(repoRoot(), "docs/identity-gt-master/STEP3-REPLAY.json"), JSON.stringify({ _wu: "IDENTITY-GT-EVIDENCE-MASTER-REVIEW-01 Step 3", _lock: m._counts, products: out }, null, 2));

      /**
       * 🔴 **숫자를 기대값으로 박지 않는다** — 측정이 8상품을 돌았고 분모가 보존됐다는
       *    것만 단언한다. 🔴 「도달 == 80」을 단언하면 fetch 실패가 FAIL 로 보이는데
       *    그것은 **제품 사실** 이지 하니스 결함이 아니다(측정불가로 적는다).
       */
      expect(out).toHaveLength(8);
      /** 🔴 LOCK 된 생성기 행(80)과 고유 fetch 분모(70)를 **둘 다** 보존했는지 단언한다. */
      /**
       * 🔴🔴 **라벨 없는 도달 행은 0 이어야 한다** — 이 하니스는 `webSearch:false` 이고
       *    등록부가 비어 있으므로 **공급한 URL 말고는 행이 설 수 없다**.
       * 🔴 이 단언이 **두 번** 내 거짓을 잡았다(1차 자작 join 2건 · 2차 키 혼용 5건).
       * 🔴 나중에 FAIL 하면 둘 중 하나다 — ⒜ join owner 가 또 갈렸다
       *    ⒝ 공급한 URL 이 **다른 상품 페이지로 리다이렉트** 됐다. 🔴 삼키지 말고 가른다.
       */
      expect(
        unjoined.map((x) => x.dedupeKey),
        "GT 라벨 없는 도달 행이 있다 — join 키가 갈렸거나 다른 상품으로 리다이렉트됐다",
      ).toEqual([]);
      expect(ledgerTotal).toBe(80);
      expect(uniqTotal).toBe(70);
      /**
       * 🔴 **공급 == 고유 − (facts 없는 상품의 고유)** 를 단언한다 — 두 분모를 섞지 않는다.
       *    1차 실행이 섞어서 「분모 69」라는 거짓을 찍었고 이 단언이 그것을 잡았다.
       */
      expect(gtTotal).toBe(uniqTotal - out.filter((p) => p.unavailableReason).reduce((n, p) => n + p.uniqueGtPairs, 0));
    },
    3_000_000,
  );
});
