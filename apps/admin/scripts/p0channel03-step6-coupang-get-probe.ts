/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 Sprint A-2 STEP 6-5(CPO 확정, 2026-09-26)
 * **쿠팡 등록상품 GET 을 «실측» 하고, 무엇을 알 수 있는지만 적는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 쿠팡 어댑터를 만들 조건은 여덟 개인데(STEP 6-8), 그 첫 칸이 「실제 GET 확인」이다.
 * 지금 코드가 그 응답에서 읽는 것은 `data.displayCategoryCode` 한 칸뿐이고, 그것도
 * 실측된 적이 없다 — `coupang/_lib/registered-product.ts` 가 스스로 그렇게 적어 뒀다.
 *
 * ── 🔴 하는 일과 하지 않는 일 ────────────────────────────────────────────
 *   한다:    GET 한 번. 응답에 «어떤 칸이 있는지» 세어서 보여준다.
 *   안 한다: POST · PUT · PATCH · DELETE. 한 줄도 없다. 상품을 고치지 않는다.
 *   안 한다: 🔴 capability 판정. 「칸이 있다」는 「고칠 수 있다」가 아니다 —
 *            이 스크립트는 «읽을 수 있는가» 까지만 답하고, EDITABLE 여부는
 *            수정 API 조사(STEP 6-6)가 끝난 뒤 사람이 정한다.
 *
 * 🔴 값이 아니라 «모양» 을 찍는다. 셀러의 상품 데이터를 길게 남기지 않는다
 * (SmartStore probe 와 같은 규칙).
 *
 * 사용법:
 *   DEBUG_COUPANG_PROBE_TOKEN=... npx tsx scripts/p0channel03-step6-coupang-get-probe.ts <sellerProductId> [baseUrl]
 */

const DEFAULT_BASE_URL = "https://ttaejyo.vercel.app";

/**
 * Commerce Core 의 중립 통화(`ChannelFieldValues`)가 요구하는 칸 —
 * 쿠팡 응답에서 이것들을 «찾을 수 있는가» 가 어댑터 가능 여부를 가른다.
 *
 * 🔴 경로 후보를 여러 개 적는다. 쿠팡 응답 모양을 우리가 «모르기» 때문이고,
 * 모르는 것을 하나로 단정하면 「없다」는 거짓 결론이 난다.
 */
const CORE_FIELD_CANDIDATES: { field: string; paths: string[] }[] = [
  { field: "상품명", paths: ["data.sellerProductName", "data.displayProductName", "data.productName"] },
  { field: "판매가격", paths: ["data.salePrice", "data.items.0.salePrice", "data.originalPrice"] },
  { field: "재고", paths: ["data.maximumBuyCount", "data.items.0.maximumBuyCount"] },
  { field: "상세설명", paths: ["data.contents", "data.items.0.contents", "data.productDescription"] },
  { field: "이미지", paths: ["data.images", "data.items.0.images"] },
  { field: "옵션", paths: ["data.items", "data.options"] },
  { field: "상품정보제공고시", paths: ["data.items.0.notices", "data.notices"] },
  { field: "카테고리", paths: ["data.displayCategoryCode", "data.categoryId"] },
];

/** 등록 ID 축 — 🔴 이 셋을 «섞으면» 남의 상품을 고친다(F-12b 와 같은 축). */
const ID_CANDIDATES = [
  "data.sellerProductId",
  "data.productId",
  "data.items.0.vendorItemId",
  "data.items.0.sellerProductItemId",
];

/** 등록 상태 축 — 수정이 «지금 가능한 상태인가» 를 가르는 값들. */
const STATUS_CANDIDATES = [
  "data.statusName",
  "data.sellerProductItemStatus",
  "data.items.0.itemStatus",
  "data.saleStartedAt",
  "data.saleEndedAt",
];

export {};

function readPath(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => {
    if (node == null || typeof node !== "object") return undefined;
    if (Array.isArray(node)) {
      const index = Number(key);
      return Number.isInteger(index) ? node[index] : undefined;
    }
    return (node as Record<string, unknown>)[key];
  }, root);
}

/** 🔴 값이 아니라 모양을 적는다. */
function describeShape(value: unknown): string {
  if (value === undefined) return "없음";
  if (value === null) return "null";
  if (Array.isArray(value)) return `배열(${value.length}개)`;
  if (typeof value === "object") return `객체(키 ${Object.keys(value as object).length}개)`;
  if (typeof value === "string") return value.trim() === "" ? '문자열(빈 값 "")' : `문자열(${value.length}자)`;
  return `${typeof value}`;
}

async function probeCoupangGet() {
  const sellerProductId = process.argv[2];
  const baseUrl = (process.argv[3] ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const token = process.env.DEBUG_COUPANG_PROBE_TOKEN;

  if (!sellerProductId) {
    console.error(
      "sellerProductId 를 인자로 주세요.\n" +
        "🔴 기본값을 두지 않습니다 — 쿠팡에는 이미 중복 3건(16336681622 · 16338809221 ·\n" +
        "   16340176952)이 있고, 번호가 섞이면 남의 상품을 보게 됩니다.",
    );
    process.exit(1);
  }
  if (!token) {
    console.error(
      "DEBUG_COUPANG_PROBE_TOKEN 이 없습니다.\n" +
        "🔴 이 값 없이는 실측할 수 없습니다 — 추측으로 채우지 않습니다.\n" +
        "   Production 환경변수로 한 번 설정돼야 이 통로가 열립니다(없으면 404).",
    );
    process.exit(1);
  }

  const url = `${baseUrl}/api/debug/coupang-product-get-raw?sellerProductId=${encodeURIComponent(sellerProductId)}`;
  console.log(`GET ${url}`);
  console.log("🔴 읽기 전용입니다 — 이 스크립트에 POST/PUT/PATCH/DELETE 는 없습니다.\n");

  const res = await fetch(url, { headers: { "x-debug-token": token } });
  if (res.status === 404) {
    console.error("진단 통로가 닫혀 있습니다(404) — DEBUG_COUPANG_PROBE_TOKEN 이 설정되지 않았거나 값이 다릅니다.");
    process.exit(1);
  }
  const envelope = (await res.json()) as { result?: { status?: number; body?: unknown }; error?: string };
  if (envelope.error) {
    console.error(`진단 라우트가 거부했습니다: ${envelope.error}`);
    process.exit(1);
  }

  const body = envelope.result?.body;
  console.log(`HTTP ${envelope.result?.status ?? "?"}`);
  if (body == null || typeof body !== "object") {
    console.error("응답 본문이 객체가 아닙니다.");
    console.error(String(JSON.stringify(body)).slice(0, 500));
    process.exit(1);
  }
  console.log(`최상위 키: ${Object.keys(body as object).join(", ")}\n`);

  /* ── ① 지금 코드가 읽는 «단 한 칸» ─────────────────────────────────────── */
  console.log("── ① 지금 코드가 읽는 칸 ──────────────────────────────────────");
  const category = readPath(body, "data.displayCategoryCode");
  console.log(
    `  ${category === undefined ? "❌" : "✅"} data.displayCategoryCode        ${describeShape(category)}` +
      "   RECREATE 판단의 유일한 근거",
  );
  console.log(
    category === undefined
      ? "\n  🔴 대칭 가정이 «틀렸다». 지금 RECREATE 판단은 항상 UNKNOWN → BLOCKED 로 간다.\n" +
          "     그것이 안전한 쪽이긴 하지만, 셀러는 쿠팡 상품을 영영 고칠 수 없다."
      : "\n  → 대칭 가정이 «확인됐다». 카테고리 축은 읽을 수 있다.",
  );

  /* ── ② 등록 ID 축 — 섞이면 남의 상품을 고친다 ──────────────────────────── */
  console.log("\n── ② 등록 ID 축 🔴 섞지 않는다 ────────────────────────────────");
  console.log(`  우리가 external_product_id 로 쓰는 값: sellerProductId = ${sellerProductId}`);
  for (const path of ID_CANDIDATES) {
    const value = readPath(body, path);
    console.log(`  ${value === undefined ? "—" : "＋"} ${path.padEnd(38)} ${describeShape(value)}`);
  }

  /* ── ③ Core 중립 통화를 채울 수 있는가 ────────────────────────────────── */
  console.log("\n── ③ Commerce Core 가 요구하는 칸 ─────────────────────────────");
  let found = 0;
  for (const { field, paths } of CORE_FIELD_CANDIDATES) {
    const hit = paths.find((path) => readPath(body, path) !== undefined);
    if (hit) found += 1;
    console.log(
      `  ${hit ? "✅" : "❌"} ${field.padEnd(14)} ${hit ? `${hit} → ${describeShape(readPath(body, hit))}` : `후보 ${paths.length}개 모두 없음`}`,
    );
  }
  console.log(
    `\n  ${found}/${CORE_FIELD_CANDIDATES.length} 개 칸을 찾았다.\n` +
      "  🔴 이것은 «읽을 수 있는가» 에 대한 답일 뿐이다. 「고칠 수 있는가」는 수정 API\n" +
      "     조사(STEP 6-6)가 답한다 — 칸이 있다고 EDITABLE 로 올리지 않는다.",
  );

  /* ── ④ 등록 상태 ─────────────────────────────────────────────────────── */
  console.log("\n── ④ 등록·판매 상태 ──────────────────────────────────────────");
  for (const path of STATUS_CANDIDATES) {
    const value = readPath(body, path);
    console.log(`  ${value === undefined ? "—" : "＋"} ${path.padEnd(38)} ${describeShape(value)}`);
  }

  /* ── ⑤ data 전체 키(해석 없이) ────────────────────────────────────────── */
  console.log("\n── ⑤ data 전체 키(해석 없이 그대로) ──────────────────────────");
  const data = readPath(body, "data");
  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      console.log(`  ${key.padEnd(34)} ${describeShape(value)}`);
    }
  } else {
    console.log(`  data 가 객체가 아니다: ${describeShape(data)}`);
  }

  console.log(
    "\n🔴 다음 단계(STEP 6-6)는 «수정 API» 조사다. 그리고 그것은 이 스크립트로 하지\n" +
      "   않는다 — 쓰기는 한 줄도 넣지 않는다.",
  );
}

probeCoupangGet().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
