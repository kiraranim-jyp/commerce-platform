import { toRegisteredProductSnapshot } from "../src/app/api/smartstore/_lib/update-product";
import {
  buildChannelEditModel,
  channelEditDraftFromNaverPayload,
  describeChange,
  editorFieldSchema,
  evaluateEditGate,
} from "../src/app/pipeline/commerce/channel-edit-model";
import type { NaverProductRegistrationPayload } from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-6(CTO 작업지시서 STEP 2·3, 2026-09-26)
 * **실제 GET 응답이 Editor·Summary 까지 그대로 이어지는지 «실측» 한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 지금까지 F-14-3/F-14-5 를 받친 것은 자동검증뿐이다. 그 테스트가 쓰는 GET
 * 응답은 «우리가 만든 것» 이고, 실제 네이버 응답이 그 모양인지는 다른 질문이다
 * (F-11 이 probe 로 그 가정을 사실로 바꾼 것과 같은 축).
 *
 * ── 🔴 하는 일과 하지 않는 일 ─────────────────────────────────────────────
 *   한다:    GET 한 번. 그 응답으로 기준값·수정 가능 목록·변경 판정을 만들어
 *            «화면이 무엇을 보여줄지» 를 그대로 찍는다.
 *   안 한다: PUT · POST · DELETE. 한 줄도 없다. 상품을 고치지 않는다.
 *   안 한다: 매핑을 다시 적는 일. 라우트와 «같은 함수»(toRegisteredProductSnapshot)
 *            를 부른다 — 다시 적으면 probe 는 통과하는데 코드는 실패할 수 있다.
 *
 * ── 🔴 상품번호에 기본값을 두지 않는다 ────────────────────────────────────
 * 이 스프린트는 「번호가 두 개라 섞인」 사고를 겪었다(F-12b). 13713593585 와
 * 13714803530 은 «다른 상품» 이고, 어느 것을 보는지는 사람이 적어야 한다.
 *
 * 사용법:
 *   DEBUG_NAVER_PROBE_TOKEN=... npx tsx scripts/p0channel03-f14-6-edit-model-probe.ts <originProductNo> [baseUrl]
 */

const DEFAULT_BASE_URL = "https://ttaejyo.vercel.app";

export {};

async function probeEditModel() {
  const originProductNo = process.argv[2];
  const baseUrl = (process.argv[3] ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const token = process.env.DEBUG_NAVER_PROBE_TOKEN;

  if (!originProductNo) {
    console.error(
      "상품번호를 인자로 주세요.\n" +
        "🔴 기본값을 두지 않습니다 — 13713593585 와 13714803530 은 다른 상품이고,\n" +
        "   섞이면 남의 상품을 보게 됩니다(F-12b).",
    );
    process.exit(1);
  }
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
  console.log(`HTTP ${envelope.result?.status ?? "?"}`);

  /* ── ① 라우트와 «같은 함수» 로 기준값을 만든다 ───────────────────────── */
  const mapped = toRegisteredProductSnapshot(envelope.result?.body);
  if (!mapped.ok) {
    console.error(`🔴 기준값을 만들지 못했습니다: ${mapped.message}`);
    process.exit(1);
  }
  const built = buildChannelEditModel(
    { kind: "CHANNEL_GET", commerceId: "smartstore", externalProductId: originProductNo },
    mapped.snapshot,
  );
  if (!built.ok) {
    console.error(`🔴 ${built.message}`);
    process.exit(1);
  }
  const model = built.model;

  console.log("\n── ② 화면이 「지금 값」으로 보여줄 것(STEP 3) ──────────────────");
  console.log("  🔴 이 값들의 출처는 채널 GET 하나뿐이다 — 수집 Snapshot 이 아니다.\n");
  const fields = editorFieldSchema(model);
  for (const field of fields) {
    const baseline = field.baseline;
    const shown =
      baseline.state === "UNREAD"
        ? "❌ 읽지 못했다"
        : baseline.state === "PARTIAL"
          ? `△ ${baseline.value} (개수·존재만 대조)`
          : `✅ ${describeChange({ field: field.field, label: field.label, from: baseline.value }).from ?? "비어 있음"}`;
    console.log(
      `  ${field.editable ? "수정가능" : field.capability === "UNKNOWN" ? "미확인 " : "재등록 "} ` +
        `${field.label.padEnd(12)} ${shown}`,
    );
  }
  const unread = fields.filter((field) => field.baseline.state === "UNREAD");
  console.log(
    unread.length === 0
      ? "\n  → 일곱 항목 전부 읽었다. Editor 기준값이 실제 등록값으로 채워진다."
      : `\n  🔴 ${unread.length}개를 읽지 못했다: ${unread.map((f) => f.label).join(" · ")}\n` +
          "     그 항목은 화면에서 「읽지 못했습니다」로 보이고, 대조 대신 «손댔는지» 로만 열린다.",
  );

  /* ── ③ 아무것도 고치지 않았을 때 버튼이 닫혀 있는가(STEP 5 전반부) ────── */
  console.log("\n── ③ 그 기준값을 «그대로» 되돌려 보낼 때(STEP 5) ───────────────");
  console.log("  🔴 이것이 닫혀 있지 않으면 화면을 열자마자 버튼이 열려 있다는 뜻이다.\n");
  /* 기준값과 같은 것을 보내는 payload 를 만든다 — 실제 빌더가 만든 payload 가
     아니라 «GET 값 그대로» 다. 여기서 확인하는 것은 단위 계약 하나뿐이다. */
  const echo = {
    originProduct: {
      name: mapped.snapshot.name,
      salePrice: mapped.snapshot.salePrice,
      stockQuantity: mapped.snapshot.stockQuantity,
      detailContent: mapped.snapshot.detailContent,
      leafCategoryId: mapped.snapshot.leafCategoryId,
      images: {
        representativeImage: mapped.snapshot.representativeImageUrl
          ? { url: mapped.snapshot.representativeImageUrl }
          : undefined,
        optionalImages: Array.from({ length: mapped.snapshot.optionalImageCount ?? 0 }, () => ({})),
      },
      detailAttribute: {
        optionInfo: {
          optionCombinations: Array.from({ length: mapped.snapshot.optionCombinationCount ?? 0 }, () => ({})),
        },
        productInfoProvidedNotice: mapped.snapshot.hasProvidedNotice ? {} : undefined,
      },
    },
  } as unknown as NaverProductRegistrationPayload;
  const gate = evaluateEditGate(model, channelEditDraftFromNaverPayload(echo));
  if (gate.canSubmit) {
    console.log(`  🔴 열려 있다 — 거짓 변경 ${gate.changes.length}건:`);
    for (const change of gate.changes) {
      const shown = describeChange(change);
      console.log(`     ${shown.label}: ${shown.from ?? "없음"} → ${shown.to ?? "없음"}`);
    }
    console.log("     단위 계약이 어긋났다는 뜻이다(기준값과 초안이 같은 단위여야 한다).");
  } else {
    console.log("  ✅ 변경사항 없음 · [상품 수정] 닫힘 — 단위 계약이 맞다.");
  }

  console.log(
    "\n🔴 여기까지가 CTO 가 확인할 수 있는 범위다. 실제 UPDATE(STEP 6)는 CEO 가\n" +
      "   화면에서 «한 번» 누르는 것으로만 한다 — 이 스크립트는 쓰지 않는다.",
  );
}

probeEditModel().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
