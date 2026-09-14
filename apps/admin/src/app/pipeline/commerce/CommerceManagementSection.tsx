"use client";

import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import { formatKrw } from "@commerce/pricing";
import { Button } from "@/components/ui/Button";
import { summarizeLotteOnManagedValues } from "./lotteon-channel-form";

/**
 * 3층 구조 재정렬(CEO 지시, 2026-09-14) — 상품 정보의 **세 번째 층**.
 *
 *   상품 정보 ├─ 공통 상품정보   "이 상품이 무엇인가"
 *             ├─ MI              "이 상품을 팔아도 되는가"
 *             └─ 커머스 관리정보  "이 상품을 채널마다 어떻게 관리할 것인가"  ← 여기
 *                 ├─ 스마트스토어
 *                 ├─ 쿠팡
 *                 └─ 롯데ON
 *
 * ── 이 화면이 하지 않는 일 ────────────────────────────────────────────────
 * 1. **카테고리를 보여주지도 고치지도 않는다**(CEO 명시). 카테고리는 채널마다
 *    코드 체계가 다른 채널의 값이라 각 커머스 탭에서 관리한다. 롯데ON 저장
 *    타입에는 카테고리가 들어 있지만 여기서 읽는 summarizeLotteOnManagedValues()
 *    가 그 키를 내보내지 않는다 — 함수 수준에서 경로가 없다.
 * 2. **여기서 값을 고치지 않는다.** 채널 관리값은 전부 각 채널 판매자센터에서
 *    발급되는 코드라, 고치는 자리는 그 채널 탭 하나뿐이어야 한다. 여기서 또
 *    입력받으면 같은 값이 두 곳에 생기고 둘이 갈라진다 — 이 재정렬이 없애려던
 *    문제가 정확히 그것이다.
 * 3. **판정하지 않는다.** 등록 가능/불가, 준비 퍼센트는 전부 채널 탭의 몫이다.
 *    여기는 "무엇이 저장돼 있는가"만 읽는다.
 *
 * ── 왜 필요한가 ───────────────────────────────────────────────────────────
 * 롯데ON 값은 그때까지 LotteOnRegistrationPanel의 컴포넌트 로컬 useState에만
 * 있었다. 탭을 벗어나면 사라졌고, 그래서 "상품정보에 롯데온 내용은 하나도
 * 없다"가 사실이었다. 이제 CanonicalProduct.lotteOnChannelInfo에 저장되고 이
 * 화면이 그 값을 읽는다 — 저장이 실제로 됐다는 것을 셀러가 눈으로 확인하는
 * 자리이기도 하다.
 */
export function CommerceManagementSection({
  product,
  channels,
  onGoToChannel,
  onGoToLotteOn,
}: {
  product: CanonicalProduct;
  /** 상품 수준 가격을 쓰는 채널들(스마트스토어·쿠팡). 라벨은 어댑터 것 그대로. */
  channels: { id: PlatformId; label: string }[];
  onGoToChannel: (id: PlatformId) => void;
  onGoToLotteOn: () => void;
}) {
  const lotteOn = summarizeLotteOnManagedValues(product.lotteOnChannelInfo);

  return (
    <div className="space-y-3">
      <p className="rounded-md bg-background px-3 py-2 text-[11px] text-text-secondary">
        채널마다 따로 관리되는 값입니다 — 공통 상품정보(상품명·가격·옵션·이미지)와 달리 이 값들은 그 채널
        하나에만 적용됩니다. <b>고치는 곳은 각 커머스 탭</b>이고, 여기서는 무엇이 저장돼 있는지만 읽습니다.
        {/* 카테고리를 여기 두지 않는 이유를 화면에도 적는다 — 없는 것이 누락이
            아니라 결정이라는 걸 셀러가 알아야 다른 데서 찾지 않는다. */}
        <br />
        카테고리는 여기에 없습니다. 채널마다 코드 체계가 달라 각 커머스 탭에서 확정합니다.
      </p>

      {channels.map((channel) => {
        const override = product.channelPriceOverrides?.[channel.id]?.value ?? null;
        return (
          <ChannelBlock
            key={channel.id}
            title={channel.label}
            onGo={() => onGoToChannel(channel.id)}
            goLabel={`${channel.label} 탭에서 관리`}
          >
            <ManagedRow
              label="채널 전용 판매가"
              value={override != null ? formatKrw(override) : null}
              emptyText="지정 안 함 — 상품정보 판매가격을 그대로 씁니다"
            />
          </ChannelBlock>
        );
      })}

      <ChannelBlock title="롯데ON" onGo={onGoToLotteOn} goLabel="롯데ON 탭에서 관리">
        <p className="mb-2 text-[11px] text-text-tertiary">
          롯데ON 판매자센터에서 발급되는 값입니다 — 고시 · 안전인증 · 배송 선등록 번호 · 코드.
          {lotteOn.filledCount > 0
            ? ` 지금 ${lotteOn.filledCount}개 항목이 저장돼 있습니다.`
            : " 아직 저장된 값이 없습니다 — 롯데ON 탭에서 입력하면 여기에 남습니다."}
        </p>
        <dl className="divide-y divide-border text-xs">
          {lotteOn.rows.map((row) => (
            <ManagedRow key={row.label} label={row.label} value={row.value} emptyText="미입력" />
          ))}
        </dl>
      </ChannelBlock>
    </div>
  );
}

function ChannelBlock({
  title,
  goLabel,
  onGo,
  children,
}: {
  title: string;
  goLabel: string;
  onGo: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
        <Button variant="secondary" size="sm" onClick={onGo}>
          {goLabel}
        </Button>
      </div>
      {children}
    </section>
  );
}

/** 읽기 전용 한 줄. **입력 요소를 만들지 않는다** — 그것이 이 컴포넌트의 계약이다. */
function ManagedRow({ label, value, emptyText }: { label: string; value: string | null; emptyText: string }) {
  return (
    <div className="grid gap-0.5 py-1.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <dt className="font-medium text-text-secondary">{label}</dt>
      <dd className={value ? "text-text-primary" : "text-text-tertiary"}>{value ?? emptyText}</dd>
    </div>
  );
}
