import { NextResponse } from "next/server";
import type { KcStatus } from "@commerce/listing";
import { COMPLIANCE_POLICY_VERSION } from "@commerce/listing";
import { saveSellerComplianceConfirmation, getLatestSellerComplianceConfirmation } from "../_lib/seller-compliance";

const VALID_KC_STATUSES: KcStatus[] = ["NOT_APPLICABLE", "CERTIFIED_REFERENCE", "SELLER_REVIEW_REQUIRED", "BLOCKED"];

/**
 * N-3.52(CPO 지시 STEP6/8) — "판매 전 최종 확인" 화면에서 판매자가 확인
 * 버튼을 누르면 이 라우트가 호출된다. 등록 API(POST /api/smartstore/register)와
 * 분리한 이유: 확인 자체는 등록 시도 여부와 무관하게 감사 로그로 남아야
 * 한다(등록을 취소해도 "이 시점에 판매자가 이렇게 확인했다"는 기록은
 * 유지되는 게 맞다).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    snapshotId?: string | null;
    jobKey?: string | null;
    categoryCode?: string;
    kcStatus?: string;
    confirmed?: boolean;
  } | null;

  if (!body || !body.categoryCode || typeof body.confirmed !== "boolean") {
    return NextResponse.json({ error: "categoryCode, confirmed는 필수입니다." }, { status: 400 });
  }
  if (!body.kcStatus || !VALID_KC_STATUSES.includes(body.kcStatus as KcStatus)) {
    return NextResponse.json({ error: "kcStatus 값이 유효하지 않습니다." }, { status: 400 });
  }
  // N-3.52/N-3.53(CPO 지시) — 판매자가 SELLER_REVIEW_REQUIRED 상품을 직접
  // 검토하고 "판매 가능 여부를 확인했다"고 선언하는 것은 이 확인 화면에서만
  // 허용한다 — TTAEJYO가 대신 이 값을 채워 보내는 경로를 만들지 않는다.
  const saved = await saveSellerComplianceConfirmation({
    snapshotId: body.snapshotId ?? null,
    jobKey: body.jobKey ?? null,
    platform: "smartstore",
    categoryCode: body.categoryCode,
    kcStatus: body.kcStatus as KcStatus,
    confirmed: body.confirmed,
  });
  if (!saved) {
    return NextResponse.json({ error: "저장에 실패했습니다(Supabase 연결 확인 필요)." }, { status: 500 });
  }
  return NextResponse.json({ confirmation: saved, policyVersion: COMPLIANCE_POLICY_VERSION });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const snapshotId = searchParams.get("snapshotId");
  const confirmation = await getLatestSellerComplianceConfirmation(snapshotId);
  return NextResponse.json({ confirmation, policyVersion: COMPLIANCE_POLICY_VERSION });
}
