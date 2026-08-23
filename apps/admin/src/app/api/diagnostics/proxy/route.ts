import { NextResponse } from "next/server";
import { getOutboundProxyDiagnostics } from "@/lib/outbound-proxy";

/**
 * N-3.75 STEP4(사용자 지시) — Naver/Coupang을 실제로 호출하기 전에 "지금
 * 어떤 프록시를 쓰고 있는지"만 먼저 볼 수 있게 한다. host/port까지만
 * 보여주고 사용자명/비밀번호/전체 URL은 절대 노출하지 않는다(env var
 * 자체를 이 응답에 포함하지 않는다 — getOutboundProxyDiagnostics가 이미
 * host/port만 파싱해서 돌려준다).
 */
export async function GET() {
  return NextResponse.json(getOutboundProxyDiagnostics());
}
