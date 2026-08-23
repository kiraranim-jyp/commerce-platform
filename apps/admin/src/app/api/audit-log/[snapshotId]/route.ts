import { NextResponse } from "next/server";
import { getAuditLog } from "@/lib/audit-log";

/**
 * N-4.05 Track V(대표님 지시) — 스냅샷 하나의 감사 로그 조회. 쓰기는
 * recordAuditLog()를 각 변경 지점(등록 성공/실패 등)에서 직접 호출한다 —
 * 이 라우트는 읽기 전용.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ snapshotId: string }> }) {
  const { snapshotId } = await params;
  const entries = await getAuditLog(snapshotId);
  return NextResponse.json({ ok: true, snapshotId, entries });
}
