import { NextResponse } from "next/server";
import { backfillCanonicalProduct, buildProductIdentityDna } from "@commerce/shared";
import { getSnapshot } from "../../snapshots/_lib/snapshot";
import { collectWebSearchUrls } from "../../price-history/_lib/web-search-pool";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 QUERY-SIGNAL-AB — **1회용 측정 라우트**(CPO 2026-10-29)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 같은 10개 상품에 **판매처 신호 B**(`국내해외 동일상품 판매처`)로 Search 를 1회씩
 * 보내 **테스트 1 과 건수만** 비교한다. 🔴 운영 Query 는 그대로 **A** 다.
 *
 * ── 🔴 지키는 것 ──────────────────────────────────────────────────────────
 * ```
 * 상품당 Search **정확히 1회** · retry 0 · Query 변형 0 · 국내/해외 분리 0
 * Crawl/판정/저장 **하지 않는다** — 이 라우트는 **URL 목록과 건수만** 돌려준다
 * 🔴 토큰 값을 응답·로그에 싣지 않는다 · 🔴 이 파일은 **실행 후 삭제** 된다(§10)
 * ```
 */

export const maxDuration = 300;

const TARGETS = [
  { cat: "KIDS", label: "Bobo Choses", snapshotId: "c88d2ca4-bfe1-4851-9c1d-92f69222a3f2", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
  { cat: "KIDS", label: "BOSS", snapshotId: "74bbe30a-641c-4226-981d-7ab1552de8ea", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
  { cat: "KIDS", label: "Louis Louise", snapshotId: "621c1848-372b-4719-96e4-61d808e1de0a", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
  { cat: "KIDS", label: "Main Story", snapshotId: "c27d4727-2248-4fe0-9084-8c239737a889", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
  { cat: "KIDS", label: "Mini rodini", snapshotId: "96a9766a-f05d-4c35-b4c9-43de8ca495a5", workspaceId: "df50fd5e-6586-499b-a21d-57f5a3e86d70" },
  { cat: "TENNIS", label: "Damarindo Pique Polo", snapshotId: "5f207353-acd3-4ee4-85d1-88f408452620", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
  { cat: "TENNIS", label: "Fall Cericho T-Shirt", snapshotId: "dbc1e8b5-aec5-4df3-9bd4-b67a84d4d6db", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
  { cat: "TENNIS", label: "Magro Long Sleeve", snapshotId: "614bfeb7-a627-442f-82bb-f6cfed52c428", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
  { cat: "TENNIS", label: "Racchetto Polo", snapshotId: "07fde45e-4a28-478d-8ca8-83a6cea6c0e8", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
  { cat: "TENNIS", label: "Trattino Short", snapshotId: "6333f04f-beba-4840-a2de-99073a700208", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
] as const;

/** 🔴 CPO 가 지정한 **테스트 2** 신호. 운영 기본값(A)은 건드리지 않는다. */
const SIGNAL_B = "국내해외 동일상품 판매처";

function isAuthorized(request: Request): boolean {
  const expected = process.env.DEBUG_SIGNAL_AB_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-debug-token") === expected;
}

/** 🔴 **추정이 아니다** — 한국 TLD 만 센다. 나머지는 「해외」가 아니라 «그 외» 다. */
function split(urls: string[]) {
  const kr: string[] = [];
  const rest: string[] = [];
  for (const u of urls) {
    let host = "";
    try {
      host = new URL(u).hostname.toLowerCase();
    } catch {
      /* 파싱 불가는 rest 로 — 버리지 않는다 */
    }
    (/\.kr$/.test(host) ? kr : rest).push(u);
  }
  return { kr, rest };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const i = Number(new URL(request.url).searchParams.get("i"));
  const t = TARGETS[i];
  if (!t) return NextResponse.json({ error: "i out of range" }, { status: 400 });

  const snapshot = await getSnapshot(t.snapshotId, t.workspaceId);
  if (!snapshot) return NextResponse.json({ stage: "SNAPSHOT", error: "not found" }, { status: 200 });
  const product = backfillCanonicalProduct(snapshot.workspace.canonicalProduct);
  const dna = buildProductIdentityDna(product);

  /** 🔴 운영 호출부와 **같은 칸** 을 채운다(사본이 아니라 같은 모양). */
  const identity = {
    brand: dna.brand.value || null,
    productName: dna.title || null,
    productType: dna.category?.value ?? null,
    genderAge: null,
    color: dna.color,
    size: null,
    season: null,
    productCode: dna.brandModelCode,
    facts: [dna.material, dna.fit].filter((v): v is string => Boolean(v)),
    sourceUrl: product.sourceUrl,
    sourceSite: null,
    sourceCountry: null,
    market: null,
  };

  /** 🔴 **신호 B 로 정확히 1회.** A 는 이미 측정돼 있으므로 다시 쏘지 않는다. */
  const r = await collectWebSearchUrls({ identity, signal: SIGNAL_B });
  const { kr, rest } = split(r.urls);

  return NextResponse.json({
    i,
    cat: t.cat,
    label: t.label,
    signal: SIGNAL_B,
    metrics: r.metrics,
    counts: { raw: r.urls.length, kr: kr.length, rest: rest.length },
    urls: r.urls,
    krUrls: kr,
  });
}
