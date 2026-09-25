/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-11(CTO 지시, 2026-09-25) — **GET 응답을 «실측» 한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * F-6 의 `compareRegisteredProduct()` 는 지금 「전수가 아니다」라고 스스로
 * 말하고 있다(`notCompared`). 그 목록이 긴 이유는 하나뿐이다 —
 * **GET /v2/products/origin-products/{no} 응답의 실제 모양을 본 적이 없다.**
 * 지금 읽는 필드들은 「요청 payload 와 같은 이름일 것」이라는 대칭 가정 위에
 * 서 있다(F-2 가 처음 세운 가정이고, F-6 이 그 위에 더 쌓지 않으려고
 * notCompared 를 만들었다).
 *
 * 이 스크립트가 그 가정을 «사실로 바꾸거나 무너뜨린다».
 *
 * ── 🔴 이 스크립트가 하는 일과 하지 않는 일 ───────────────────────────────
 *   한다:    GET 한 번. 응답에 «어떤 칸이 있는지» 를 세어서 보여준다.
 *   안 한다: PUT · POST · DELETE. 한 줄도 없다(CEO Production 테스트 전까지
 *            수정은 금지 — CTO 명시).
 *   안 한다: 「이 칸이 저 뜻일 것이다」라는 해석. 있는 것을 있다고만 적는다.
 *
 * ── 왜 값이 아니라 «칸» 인가 ──────────────────────────────────────────────
 * 우리가 알아야 하는 것은 「상품명이 무엇인가」가 아니라 「상품명을 읽을 수
 * 있는가」다. 읽을 수 있으면 notCompared 에서 한 줄을 지울 수 있고, 없으면
 * 그 줄은 그대로 남아야 한다. 값은 셀러의 상품 데이터라 굳이 길게 찍지 않는다.
 *
 * 사용법:
 *   DEBUG_NAVER_PROBE_TOKEN=... npx tsx scripts/p0channel03-smartstore-get-probe.ts [originProductNo] [baseUrl]
 *   기본값: 13713593585(정상 등록 건) / https://ttaejyo.vercel.app
 *
 * 🔴 13713593585 는 «읽기만» 한다. 이 상품에 쓰기를 하지 않는다.
 */

const DEFAULT_ORIGIN_PRODUCT_NO = "13713593585";
const DEFAULT_BASE_URL = "https://ttaejyo.vercel.app";

/**
 * `fetchRegisteredProduct()` 가 실제로 읽는 칸 — 경로는 그 파일과 «글자 그대로»
 * 같아야 한다. 여기가 갈라지면 실측 결과가 코드와 무관해진다.
 */
const READ_BY_CODE: { path: string; usedFor: string }[] = [
  { path: "originProduct.name", usedFor: "상품명(변경감지)" },
  { path: "originProduct.salePrice", usedFor: "판매가격(변경감지)" },
  { path: "originProduct.stockQuantity", usedFor: "재고수량(변경감지)" },
  { path: "originProduct.detailContent", usedFor: "상세설명(변경감지·손실방지)" },
  { path: "originProduct.leafCategoryId", usedFor: "🔴 카테고리 — UPDATE/RECREATE 를 가른다" },
  { path: "originProduct.images.representativeImage.url", usedFor: "대표이미지(손실방지)" },
  { path: "originProduct.images.optionalImages", usedFor: "추가이미지 개수" },
  { path: "originProduct.detailAttribute.optionInfo.optionCombinations", usedFor: "옵션 개수" },
  { path: "originProduct.detailAttribute.productInfoProvidedNotice", usedFor: "고시정보 존재" },
];

/**
 * 지금 `notCompared` 에 있는 축들 — 응답에 대응 칸이 «있는지» 만 본다.
 * 있으면 F-11 에서 비교로 승격할 수 있고, 없으면 그 줄은 그대로 남는다.
 */
const NOT_COMPARED_CANDIDATES: { path: string; wouldRetire: string }[] = [
  { path: "originProduct.detailAttribute.naverShoppingSearchInfo", wouldRetire: "브랜드·제조사·모델명" },
  { path: "originProduct.detailAttribute.productAttributes", wouldRetire: "카테고리 상품속성" },
  { path: "originProduct.detailAttribute.originAreaInfo", wouldRetire: "원산지" },
  { path: "originProduct.deliveryInfo", wouldRetire: "배송/반품 정책" },
  { path: "originProduct.detailAttribute.productCertificationInfos", wouldRetire: "KC 인증" },
  { path: "originProduct.detailAttribute.certificationTargetExcludeContent", wouldRetire: "KC 면제 신고" },
  { path: "originProduct.sellerManagementCode", wouldRetire: "판매자 상품코드" },
];

/* 🔴 `export {}` — 이 파일을 «모듈» 로 만든다. 없으면 전역 스크립트로 잡혀
   같은 디렉터리의 다른 진단 스크립트와 함수 이름이 충돌한다(실제로 충돌했다). */
export {};

function readPath(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => {
    if (node == null || typeof node !== "object") return undefined;
    return (node as Record<string, unknown>)[key];
  }, root);
}

/** 🔴 값이 아니라 «모양» 을 적는다. */
function describeShape(value: unknown): string {
  if (value === undefined) return "없음";
  if (value === null) return "null";
  if (Array.isArray(value)) return `배열(${value.length}개)`;
  if (typeof value === "object") return `객체(키 ${Object.keys(value as object).length}개)`;
  if (typeof value === "string") return value.trim() === "" ? '문자열(빈 값 "")' : `문자열(${value.length}자)`;
  return `${typeof value}`;
}

async function probeSmartStoreGet() {
  const originProductNo = process.argv[2] ?? DEFAULT_ORIGIN_PRODUCT_NO;
  const baseUrl = (process.argv[3] ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const token = process.env.DEBUG_NAVER_PROBE_TOKEN;

  if (!token) {
    console.error(
      "DEBUG_NAVER_PROBE_TOKEN 이 없습니다.\n" +
        "🔴 이 값 없이는 실측할 수 없습니다 — 추측으로 채우지 않습니다.\n" +
        "   Vercel Production 에 있는 값을 환경변수로 넘겨주세요.",
    );
    process.exit(1);
  }

  console.log(`GET ${baseUrl}/api/debug/naver-product-get-raw?originProductNo=${originProductNo}`);
  console.log("🔴 읽기 전용입니다 — 이 스크립트에 PUT/POST/DELETE 는 없습니다.\n");

  const res = await fetch(
    `${baseUrl}/api/debug/naver-product-get-raw?originProductNo=${encodeURIComponent(originProductNo)}`,
    { headers: { "x-debug-token": token } },
  );
  const envelope = (await res.json()) as { result?: { status?: number; body?: unknown }; error?: string };
  if (envelope.error) {
    console.error(`진단 라우트가 거부했습니다: ${envelope.error}`);
    process.exit(1);
  }

  const body = envelope.result?.body;
  console.log(`HTTP ${envelope.result?.status ?? "?"}`);
  if (body == null || typeof body !== "object") {
    console.error("응답 본문이 객체가 아닙니다 — 대칭 가정 자체가 틀렸습니다.");
    console.error(JSON.stringify(body).slice(0, 500));
    process.exit(1);
  }
  console.log(`최상위 키: ${Object.keys(body as object).join(", ")}\n`);

  console.log("── ① 코드가 «지금 읽는» 칸 ─────────────────────────────────────");
  let missing = 0;
  for (const { path, usedFor } of READ_BY_CODE) {
    const value = readPath(body, path);
    if (value === undefined) missing += 1;
    console.log(`  ${value === undefined ? "❌" : "✅"} ${path.padEnd(58)} ${describeShape(value).padEnd(20)} ${usedFor}`);
  }
  console.log(
    missing === 0
      ? "\n  → 대칭 가정이 «확인됐다». fetchRegisteredProduct 가 읽는 칸이 전부 있다."
      : `\n  🔴 ${missing}개가 «없다». 그 칸에 기대는 비교는 지금 동작하지 않는다 — 코드를 응답에 맞춘다.`,
  );

  console.log("\n── ② notCompared 를 줄일 수 있는가 ────────────────────────────");
  for (const { path, wouldRetire } of NOT_COMPARED_CANDIDATES) {
    const value = readPath(body, path);
    console.log(
      `  ${value === undefined ? "—" : "＋"} ${path.padEnd(58)} ${describeShape(value).padEnd(20)} ${wouldRetire}`,
    );
  }
  console.log(
    "\n  ＋ 인 줄만 비교로 «승격할 수 있다». — 인 줄은 notCompared 에 그대로 남는다.\n" +
      "  🔴 있다고 해서 «뜻이 같다» 는 뜻은 아니다. 승격 전에 우리가 보내는 payload 의\n" +
      "     같은 경로와 모양이 맞는지 한 번 더 본다(모양이 다르면 거짓 변경이 난다).",
  );

  console.log("\n── ③ originProduct 전체 키(해석 없이 그대로) ──────────────────");
  const origin = readPath(body, "originProduct");
  if (origin && typeof origin === "object") {
    for (const [key, value] of Object.entries(origin as Record<string, unknown>)) {
      console.log(`  ${key.padEnd(34)} ${describeShape(value)}`);
    }
  } else {
    console.log("  originProduct 가 없다 — ①의 모든 경로가 틀렸다는 뜻이다.");
  }
}

probeSmartStoreGet().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
