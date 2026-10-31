/**
 * IDENTITY-GT-EVIDENCE-MASTER-REVIEW-01 — Step 1·2 (조사 전용 · 운영 코드 0)
 *
 * 🔴 fixture 모양이 제각각이다(배열 · 숫자키 객체 · origins+candidates …).
 *    그래서 **모양을 가정하지 않고** JSON 트리를 걸어 「url 류 칸 + verdict 류 칸을
 *    «함께» 가진 객체」를 후보로 본다. 🟢 어떤 칸을 썼는지 행마다 기록한다.
 * 🔴 라벨을 **추측하지 않는다** — 정규화는 글자 매핑뿐이고 충돌은 **보존** 한다.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const FIX = "apps/admin/src/app/api/price-history/_lib/__tests__/fixtures";
const OUT = "docs/identity-gt-master";
mkdirSync(OUT, { recursive: true });

/** 🔴 측정 산출물은 사람 라벨이 아니다 — 분모에서 뺀다(이중 집계 방지). */
const NOT_HUMAN_GT = new Set([
  "cand-02-rows.json", // 라벨이 다른 fixture 사본
  "dsp-01-funnel.json",
  "dsp-01-reviewed-same.json",
  "dmc-01-trace.json",
  "query-adopt-01-production.json",
  "query-arch-01-production.json",
  "query-arch-01-preview.json",
  "query-signal-ab-result.json",
  "e2e-history-10-report.json",
  "e2e-history-10-targets.json",
  "e2e-history-10-code.json",
  "search-provider-04-raw.json",
  "search-provider-05-raw.json",
  "search-provider-11-code-rate.json",
  "search-provider-11-origins.json",
  "search-provider-13-aspx-evidence.json",
  "wu-074-probe.json",
  "rc-01-input-url.json",
  "ab046-evidence.json",
  "wu-099-human-value.json", // 가치 라벨(USEFUL/NOISE) — 동일성 GT 가 아니다
  "wu-100-human-value.json",
]);

const URL_KEYS = ["url", "candidateUrl", "candidate_url", "discoveredUrl", "sourceUrl"];
const GT_KEYS = ["humanGt", "human_verdict", "human", "ceo", "gt", "verdict", "calibrationLabel", "ceoUiLabel"];
const ORIGIN_KEYS = ["originCode", "origin_code", "origin", "searchId", "sid", "productCode"];

/** 🔴 글자 매핑뿐이다 — 「판단불가」를 DIFFERENT 로 바꾸지 않는다. */
function normGt(v) {
  const s = String(v ?? "").trim();
  if (/^(SAME|동일)$/i.test(s)) return "SAME";
  if (/^(DIFFERENT|다른제품|다름)$/i.test(s)) return "DIFFERENT";
  if (/^(UNCERTAIN|UNDECIDED|REVIEW|판단불가|유사)$/i.test(s)) return "REVIEW";
  return null; // 🔴 모르는 값은 라벨로 쓰지 않는다
}

/** 🔴 GT 중복 제거 «전용» 키다 — self-reference 정책이 아니다(§3). */
function dedupeKey(raw) {
  try {
    const u = new URL(String(raw));
    const host = u.host.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.toLowerCase().replace(/\/+$/, "");
    return host + path;
  } catch {
    return String(raw).trim().toLowerCase();
  }
}

const rows = [];
const skipped = [];
for (const f of readdirSync(FIX).filter((x) => x.endsWith(".json"))) {
  if (NOT_HUMAN_GT.has(f)) {
    skipped.push(f);
    continue;
  }
  let json;
  try {
    json = JSON.parse(readFileSync(join(FIX, f), "utf8"));
  } catch {
    skipped.push(f + "(파싱불가)");
    continue;
  }
  const found = [];
  const walk = (node, inheritedOrigin) => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((c) => walk(c, inheritedOrigin));
      return;
    }
    const urlKey = URL_KEYS.find((k) => typeof node[k] === "string" && /^https?:\/\//.test(node[k]));
    const gtKey = GT_KEYS.find((k) => normGt(node[k]) !== null);
    const originKey = ORIGIN_KEYS.find((k) => typeof node[k] === "string" && node[k]);
    const origin = originKey ? String(node[originKey]) : inheritedOrigin;
    if (urlKey && gtKey) {
      found.push({
        fixture: f,
        url: node[urlKey],
        urlKey,
        gtRaw: String(node[gtKey]),
        gt: normGt(node[gtKey]),
        gtKey,
        originRaw: origin ?? null,
        originKey: originKey ?? (origin ? "(상속)" : null),
      });
    }
    for (const v of Object.values(node)) walk(v, origin);
  };
  walk(json, undefined);
  if (found.length === 0) skipped.push(f + "(라벨+URL 쌍 0)");
  rows.push(...found);
}

/* ── Step 1 — (원상품, 후보URL) 단위 고유화 · 충돌 보존 ── */
const byKey = new Map();
for (const r of rows) {
  const k = `${(r.originRaw ?? "?").toUpperCase()}||${dedupeKey(r.url)}`;
  if (!byKey.has(k))
    byKey.set(k, {
      key: k,
      originRaw: r.originRaw,
      url: r.url,
      dedupeKey: dedupeKey(r.url),
      labels: [],
    });
  byKey.get(k).labels.push({ fixture: r.fixture, gt: r.gt, gtRaw: r.gtRaw, gtKey: r.gtKey, originKey: r.originKey });
}

const master = [...byKey.values()].map((c) => {
  const set = [...new Set(c.labels.map((l) => l.gt))];
  return {
    ...c,
    CEO_GT: set.length === 1 ? set[0] : null, // 🔴 충돌이면 자동 선택하지 «않는다»
    GT_CONFLICT: set.length > 1,
    GT_SOURCE_FIXTURES: [...new Set(c.labels.map((l) => l.fixture))],
    GT_VALUES: set,
  };
});

/* ── Step 2 — PRODUCT-ID ── */
const origins = [...new Set(master.map((m) => (m.originRaw ?? "(미상)").toUpperCase()))].sort();
const pid = new Map(origins.map((o, i) => [o, `PRODUCT-${String(i + 1).padStart(2, "0")}`]));
for (const m of master) m.productId = pid.get((m.originRaw ?? "(미상)").toUpperCase());

/* ── 출력 ── */
const n = (p) => master.filter(p).length;
console.log("=== Step 1 · URL 단위 고유화 ===");
console.log(`라벨 행(중복 포함)        ${rows.length}`);
console.log(`고유 (원상품,URL) 후보    ${master.length}`);
console.log(`  SAME                    ${n((m) => m.CEO_GT === "SAME")}`);
console.log(`  DIFFERENT               ${n((m) => m.CEO_GT === "DIFFERENT")}`);
console.log(`  REVIEW                  ${n((m) => m.CEO_GT === "REVIEW")}`);
console.log(`  🔴 GT 충돌(자동선택 안 함) ${n((m) => m.GT_CONFLICT)}`);
console.log(`분모 제외 fixture         ${skipped.length}`);

console.log("\n=== Step 2 · PRODUCT-ID × GT ===");
console.log("PRODUCT      원상품키              후보  SAME DIFF REV 충돌  fixtures");
for (const o of origins) {
  const g = master.filter((m) => (m.originRaw ?? "(미상)").toUpperCase() === o);
  const c = (p) => g.filter(p).length;
  const fx = [...new Set(g.flatMap((m) => m.GT_SOURCE_FIXTURES))].length;
  console.log(
    `${pid.get(o)}  ${o.padEnd(20)} ${String(g.length).padStart(4)} ${String(c((m) => m.CEO_GT === "SAME")).padStart(5)} ${String(c((m) => m.CEO_GT === "DIFFERENT")).padStart(4)} ${String(c((m) => m.CEO_GT === "REVIEW")).padStart(3)} ${String(c((m) => m.GT_CONFLICT)).padStart(4)}  ${fx}`,
  );
}
console.log("\n분모 제외 목록:\n  " + skipped.join("\n  "));

writeFileSync(
  join(OUT, "MASTER-GT-DATA.json"),
  JSON.stringify(
    {
      _wu: "IDENTITY-GT-EVIDENCE-MASTER-REVIEW-01 Step 1·2",
      _note: "🔴 GT 충돌은 자동 선택하지 않았다(CEO_GT=null · GT_VALUES 보존). 🔴 라벨 정규화는 글자 매핑뿐이다.",
      _excludedFixtures: skipped,
      _counts: {
        labelRowsWithDuplicates: rows.length,
        uniqueCandidates: master.length,
        SAME: n((m) => m.CEO_GT === "SAME"),
        DIFFERENT: n((m) => m.CEO_GT === "DIFFERENT"),
        REVIEW: n((m) => m.CEO_GT === "REVIEW"),
        GT_CONFLICT: n((m) => m.GT_CONFLICT),
      },
      products: origins.map((o) => ({ productId: pid.get(o), originKey: o })),
      candidates: master,
    },
    null,
    2,
  ),
);
console.log("\n→ docs/identity-gt-master/MASTER-GT-DATA.json");
