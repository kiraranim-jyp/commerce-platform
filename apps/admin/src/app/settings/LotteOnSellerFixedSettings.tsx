"use client";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-REAL-REGISTRATION-03 ㉢(CEO 확정, 2026-09-22)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 여기 있던 «배송 4종 + 발송마감 2종» 입력이 사라졌다. 내가 만든 중복이었다.
 *
 * ── 무엇이 잘못됐나 ────────────────────────────────────────────────────────
 * 설정에는 이미 「배송 프로필」 탭이 있고 거기서 출고지·반품지·택배사를 관리한다.
 * 그런데 내가 롯데ON 아코디언 안에 같은 여섯 개를 또 만들었다 — 같은 값을 두
 * 군데서 독립적으로 고치게 되는 구조다. CEO 가 화면을 보고 바로 지적했다.
 *
 * 원인은 내 STEP 3 분류에 있었다. 「SELLER_SETTING 이다」까지만 적고 **「그
 * SELLER_SETTING 이 이미 어디에 사는가」를 확인하지 않았다.**
 *
 * ── 왜 «의미 계층» 을 지금 만들지 않았나 ──────────────────────────────────
 * 조사해 보니 세 채널이 서로 다른 배송 모델을 쓰고 있었다.
 *
 *     쿠팡    coupang_seller_profiles 의 outbound_shipping_place_code 를 직접 사용
 *             (= 이 표는 «공통 의미» 가 아니라 쿠팡의 식별자다. 이름도 coupang_ 다)
 *     네이버  releaseAddressBookNo / refundAddressBookNo — 자기 주소록 번호 체계
 *     롯데ON  프로필의 배송 식별자를 하나도 읽지 않는다(출고 소요일만 쓴다)
 *
 * 「성남 물류센터」 같은 **사람이 읽는 의미** 계층이 지금 모델에 아예 없다.
 * 그걸 새로 만들려면 쿠팡의 배송 payload 경로를 건드려야 하는데, 오늘 쿠팡은
 * 실제 LIVE 등록에 «딱 한 번» 성공했고(externalProductId 16392432073) 롯데ON 은
 * 아직 0건이다. 유일하게 검증된 경로를 지금 흔들지 않는다 — CEO 가 ㉢ 로 확정.
 *
 * ── 그래서 남은 것 ────────────────────────────────────────────────────────
 * 중복 «입력» 만 지운다. `lotteon_seller_settings`(058)는 «삭제하지 않는다» —
 * 행이 0개라 지금 지워도 잃을 값은 없지만, 앞으로 「공통 의미 → 채널별 매핑」을
 * 담을 자리로 보존한다(CEO 명시 예외). API 와 build-context 사다리도 그대로
 * 살아 있고, 값이 없으니 조용히 아무 일도 하지 않는다.
 */
export function LotteOnSellerFixedSettings({
  /** 같은 설정 화면의 「배송 프로필」 탭으로 옮긴다(별도 페이지가 아니다). */
  onGoToShippingProfile,
}: {
  onGoToShippingProfile: () => void;
}) {
  return (
    <div className="space-y-2" data-lotteon-seller-settings="true">
      <p className="text-sm font-semibold text-text-primary">배송 정보</p>
      <p className="text-xs text-text-tertiary">
        <b className="text-text-secondary">배송 프로필</b>에서 배송비와 출고 소요일을 관리합니다. 롯데ON 등록에는
        그중 <b className="text-text-secondary">출고 소요일</b>이 적용됩니다.
      </p>
      {/* 🔴 Commerce-6 C-2(2026-09-26) — 원래 여기에 「출고지·반품지·배송비 정책·
          배송 가능 지역·발송 마감시간은 배송 프로필에서 관리되며 롯데ON 등록에
          자동 적용된다」고 적혀 있었다. **셋 다 사실이 아니었다.**

            · 배송 프로필에 배송 가능 지역·발송 마감시간 칸은 «없다»(grep 0건)
            · 출고지·반품지·배송비 정책은 프로필에 있어도 쿠팡 것이고,
              롯데ON build-context 는 프로필에서 출고 소요일만 가져간다
            · 그래서 셀러는 「설정해 뒀다」고 읽고, 등록 화면에서 매번 다시 고른다

          값을 못 넣는 것보다, 넣었다고 «믿게» 만드는 편이 나쁘다. 문구를
          사실로 되돌리는 것까지만 한다 — 저장소는 C-2 게이트(아래 안내) 뒤다. */}
      <p className="text-xs text-text-tertiary">
        출고지 · 반품지 · 배송비 정책 · 배송 가능 지역은 아직 설정에 저장되지 않습니다. 지금은{" "}
        <b className="text-text-secondary">상품 등록 화면의 롯데ON 탭</b>에서 상품마다 선택합니다.
      </p>
      <button
        type="button"
        onClick={onGoToShippingProfile}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background"
      >
        배송 프로필 관리
      </button>
      {/* 🔴 롯데ON «고유» 설정을 여기 채우게 되는 날이 오면 이 아래에 선다.
          지금은 하나도 없다 — 없는 항목을 자리만 만들어 두지 않는다.
          impPrxCd(수입대행코드)는 코드값이 롯데ON API 응답으로 확인된 것이
          아니라 우리 코드 주석에서 온 것이라 CEO 판정으로 HOLD 다. */}
    </div>
  );
}
