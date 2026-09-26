import { NextResponse } from "next/server";
import {
  loadLotteOnSellerSettings,
  saveLotteOnSellerSettings,
  type LotteOnSellerSettings,
} from "../../lotteon/_lib/seller-settings";

/**
 * LOTTEON-REAL-REGISTRATION-02 — 롯데ON 판매자 «고정값» CRUD.
 *
 * /api/settings/lotteon 은 **자격증명**(인증키) 라우트다. 이건 그것과 다른
 * 것을 다룬다 — 출고지·반품지·배송비정책·배송가능지역·발송마감시간처럼 판매자가
 * 한 번 정하면 계속 쓰는 값이다. 두 관심사를 한 라우트에 섞지 않는다(한쪽은
 * 절대 값을 되돌려주면 안 되고, 다른 쪽은 되돌려줘야 화면에 현재 설정이 보인다).
 *
 * 🔴 여기에는 비밀이 없다. 창고 번호와 정책 번호이고 화면에 그대로 보여야
 * 하는 값이라 GET 이 값을 그대로 돌려준다.
 */
/**
 * Commerce-6 Phase E-1 — 🔴 `ok` 는 「요청이 처리됐는가」이지 「값을 읽었는가」가
 * 아니다. 지금까지 이 둘이 같은 칸에 있어서, 조회가 실패해도 `ok:true` + 빈 값이
 * 나갔고 화면은 그것을 「설정 없음」이라고 말했다.
 *
 * `failed`/`source` 를 그대로 실어 보낸다 — 판정은 loader 한 곳에서만 하고
 * 여기서는 옮기기만 한다(형제 라우트 /api/settings/seller-settings 와 같은 모양).
 */
export async function GET() {
  const { source, failed, ...values } = await loadLotteOnSellerSettings();
  return NextResponse.json({ ok: true, values, source, failed });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<LotteOnSellerSettings> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }
  const result = await saveLotteOnSellerSettings(body);
  if (!result.ok) return NextResponse.json(result, { status: 500 });
  // 저장 «후의 실제 값» 을 돌려준다 — 화면이 자기가 보낸 값을 그대로 믿지 않게
  // 한다(발송마감시간은 형식이 맞지 않으면 저장되지 않고 null 이 된다).
  const { source, failed, ...values } = await loadLotteOnSellerSettings();
  return NextResponse.json({ ok: true, values, source, failed });
}
