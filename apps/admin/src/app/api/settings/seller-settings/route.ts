import { NextResponse } from "next/server";
import {
  SELLER_SETTINGS_UNAVAILABLE_MESSAGE,
  loadSellerSettings,
  pickSellerSettingFields,
  saveSellerSettings,
} from "@/lib/seller-settings";

/**
 * TTAEJYO-PIVOT-03 Phase 0-4+2-A — 판매자 «공통» 설정의 canonical 읽기 창구.
 *
 * ── 왜 새 라우트인가 ──────────────────────────────────────────────────────
 * 지금 화면 네 곳이 판매자 다섯 칸을 `/api/settings/coupang/profiles` 에서
 * 꺼내 쓴다. 그 라우트는 «배송 프로필 목록» 이고 프로필마다 한 벌씩 돌려준다.
 * 그래서 화면은 아직도 「이 프로필의 판매자 정보」라는 모양을 보고 있다.
 *
 *     프로필 A ─ 판매자 정보 A        ← 지금 화면이 믿는 것
 *     프로필 B ─ 판매자 정보 B
 *
 *     셀러 ─ 판매자 정보 하나          ← 실제로 등록에 나가는 것(059 이후)
 *     프로필 A · B · C ─ 배송값만
 *
 * 서버 경로(등록 · 미리보기 · 게이트 판정)는 Phase 1 에서 전부 seller_settings
 * 로 옮겼다. 이 라우트는 «화면» 이 같은 곳을 보게 하기 위한 첫 계단이다.
 *
 * ── 읽기 → 화면 → 쓰기 ──────────────────────────────────────────────────
 * A 에서 GET 만 열었다. 저장 경로를 먼저 바꾸면 화면이 아직 레거시를 읽는
 * 동안 「저장한 값과 보이는 값」이 갈라지기 때문이다. B 에서 화면 셋이
 * canonical 로 옮겨 왔고(요약카드 둘 · 제조사 resolver), 이제 C 에서 쓰기가
 * 붙는다.
 *
 * 기존 `/api/settings/coupang/profiles` 는 계속 그대로다 — 배송 프로필 목록은
 * 여전히 프로필 개념이 맞다.
 *
 * ── 판정은 여기서 하지 않는다 ────────────────────────────────────────────
 * 값을 찾는 규칙은 전부 loadSellerSettings() 안에 있고, 세 채널의 실제 등록이
 * 이미 그 함수를 쓴다. 여기서 한 줄이라도 다시 판정하면 「화면이 말하는 값」과
 * 「등록에 나가는 값」이 갈릴 수 있는 자리가 하나 더 생긴다.
 *
 * ── 🔴 비밀이 없다 ───────────────────────────────────────────────────────
 * 제조사 · A/S 안내 · 품질보증 문구 · KC 문구 · 원산지 기본값 — 전부 셀러가
 * 설정 화면에서 직접 적었고 상품 상세에 그대로 노출되는 값이다. 그래서 GET 이
 * 값을 그대로 돌려준다(자격증명 라우트와 정반대의 판단이다 — 그쪽은 절대
 * 되돌려주지 않는다). `/api/settings/lotteon-seller` 가 같은 이유로 같은 모양이다.
 *
 * 권한 경계도 기존 설정 API 와 같다 — `/api/settings/*` 는 proxy.ts 의 matcher
 * 에 포함되어 세션 검사를 받고, 라우트 자체에는 추가 가드가 없다.
 *
 * ── workspace ────────────────────────────────────────────────────────────
 * 🔴 인자를 받지 않는다. 그렇다고 「판매자 정보는 전역 하나」라고 박는 것은
 * 아니다 — 표는 (workspace_id, scope_key) 축을 갖고 있고, 지금 값이 귀속
 * 미확정(workspace_id IS NULL)인 레거시 행 하나뿐이라 고를 것이 없을 뿐이다.
 * 고르는 규칙은 loadSellerSettings() 안에 있고 Beta Security 가 채운다.
 */
export async function GET() {
  const resolved = await loadSellerSettings();
  const { source, failed, ...values } = resolved;
  /* 🔴 PIVOT-03 R6-FS — 「읽지 못했다」를 200 + 빈 값으로 말하지 않는다.
     그러면 설정 화면이 다섯 칸을 빈칸으로 그리고, 셀러가 그 상태로 저장하면
     멀쩡한 값이 «지워진다». 값이 없는 것과 모르는 것은 다르다. */
  if (failed) {
    return NextResponse.json({ ok: false, error: SELLER_SETTINGS_UNAVAILABLE_MESSAGE }, { status: 503 });
  }
  /* source 는 돌려주되 화면에 «띄우지 않는다». 셀러에게는 아무 의미가 없는
     말이고(어느 표에서 읽었는가), 우리에게는 필요하다 — 여기가 계속
     LEGACY_PROFILE 이면 임시 호환층을 아직 뗄 수 없다는 뜻이다(⑨ 판단 근거). */
  return NextResponse.json({ ok: true, values, source });
}

/**
 * 판매자 공통 설정을 저장한다 — TTAEJYO-PIVOT-03 0-4+2-C.
 *
 * 🔴 profile id 를 받지 않는다. 그게 이 라우트의 존재 이유다. 지금까지는
 * 판매자 정보를 고치려면 «배송 프로필 하나를 골라» 그것을 PATCH 해야 했고,
 * 그래서 프로필이 하나도 없으면 저장할 길이 없었다.
 *
 * 다섯 칸«만» 다룬다. body 에 배송·가격·상세페이지 값이 섞여 와도
 * pickSellerSettingFields 가 걸러낸다 — 이 창구로 프로필 값이 새어 들어가면
 * 두 관심사를 갈라 놓은 의미가 없어진다.
 *
 * 🔴 여기서는 coupang_seller_profiles 에 쓰지 않는다(060 RPC 도 부르지 않는다).
 * 기존 PATCH /profiles/[id] 의 dual-write 는 그대로 살아 있다 — 배송 프로필
 * 편집 화면이 아직 그 경로를 쓰기 때문이다. 그쪽을 끊는 것은 D 다.
 *
 * 부분 업데이트다. 키가 안 오면 그 칸은 건드리지 않는다 — 판매자 정보 탭이
 * 다섯 칸을 늘 함께 보내더라도, 계약이 그렇게 되어 있어야 나중에 한 칸만
 * 고치는 화면이 생겨도 나머지가 지워지지 않는다.
 */
export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const fields = pickSellerSettingFields(body);
  const result = await saveSellerSettings(fields);
  if (!result.ok) return NextResponse.json(result, { status: 500 });

  /* 저장 «후의 실제 값» 을 돌려준다 — 화면이 자기가 보낸 값을 그대로 믿지
     않게 한다(빈 문자열로 보낸 칸은 null 이 되어 돌아온다). lotteon-seller
     라우트가 같은 이유로 같은 모양이다. */
  const resolved = await loadSellerSettings();
  const { source, failed: _failed, ...values } = resolved;
  return NextResponse.json({ ok: true, values, source });
}
