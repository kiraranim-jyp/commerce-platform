"use client";

import { useState } from "react";
import type { PlatformId } from "@commerce/shared";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { readinessStateToLevel, type ReadinessLevel } from "./readiness-state";
import type { RegistrationChannel } from "./registration-channels";
import {
  PREPARE_SURFACE_LABEL,
  prepareSurfaceOf,
  type PrepareSurface,
  type StageFocus,
} from "./stage-focus";
import { SUB_STEP_ICON, type SubStep, type SubStepStatus, type Workflow } from "./workflow";

/**
 * UX 2.2(CEO 지시, 2026-09-11) — 본문의 주인공은 상단 Flow의 현재 단계가 정한다.
 *
 * ── 이 컴포넌트가 없앤 화면 ──────────────────────────────────────────────
 * 예전 상품정보 탭은 단계와 무관하게 언제나 같은 순서로 전부 펼쳐져 있었다:
 *   MI → 국내 가격비교 → 해외 가격비교 → 이미지 → Source Data → 필수정보 → …
 * 상단이 "③ 등록 준비"라고 말해도 본문은 ②의 근거들을 전부 원래 크기로 들고
 * 있었고, 끝난 단계가 지금 할 일보다 더 넓은 자리를 차지했다.
 *
 * ── 이 컴포넌트가 하는 일 ────────────────────────────────────────────────
 * 단계마다 **딱 하나**를 크게 놓고 나머지는 접는다. 접는 것이지 지우는 것이
 * 아니다 — 모든 섹션은 같은 화면에서 한 번의 클릭으로 열린다(정보 삭제 없음).
 *
 * ── 이 컴포넌트가 하지 않는 일 ───────────────────────────────────────────
 * 1. 단계를 판정하지 않는다(workflow.ts). 무게를 정하지도 않는다(stage-focus.ts).
 * 2. 섹션의 내용을 만들지 않는다 — 무거운 작업 UI는 전부 CommerceWorkspace가
 *    이미 만들어 ReactNode로 넘겨준다. 그래야 핸들러/상태 소유권이 지금처럼
 *    한 곳에 남고, 여기서 같은 편집기의 두 번째 사본이 생기지 않는다.
 */
export interface StageSurfaces {
  /** 상품명·브랜드·옵션·상세설명 편집기(Source Data). */
  source: React.ReactNode;
  /** 이미지 편집기. */
  images: React.ReactNode;
  /**
   * UX 2.5(CEO 지시, 2026-09-11) — 판매가격 확정 카드(PriceEditor).
   *
   * 이 자리에 **노드 하나**로 들어온다는 점이 중요하다. 아래에서 이 값은
   * 두 위치(③ 체크리스트에서 펼친 자리 / "언제든 열어볼 수 있는 것"의 접힘)에
   * 쓰이지만, 두 자리가 동시에 그려지지 않도록 서로 배타적으로 막혀 있고
   * 실제 PriceEditor 엘리먼트는 CommerceWorkspace가 한 번만 만든다 — 화면에
   * 확정 카드가 두 벌 생기면 같은 상품이 위아래에서 다른 판매가를 말한다.
   *
   * MI/PRICE-1(CEO 지시, 2026-09-12) — 이 노드에 계산 사슬은 더 이상 없다.
   * 상세 계산은 MI ③ 💰 수익성의 접힘 하나에만 있고, 여기 남은 것은 "권장가를
   * 최종가로 확정할 것인가"뿐이다.
   */
  price: React.ReactNode;
  /** 채널별 필수 정보 일괄 처리 패널. */
  required: React.ReactNode;
}

/**
 * UX 2.5 — 가격 계산기로 데려갈 때 쓰는 스크롤 앵커.
 *
 * CommerceWorkspace가 surfaces.price 노드에 직접 붙이므로, 체크리스트에서
 * 펼쳤든 아래 접힘에서 열었든 같은 id가 따라다닌다(자리마다 다른 앵커를 두면
 * 어느 쪽이 열렸는지에 따라 스크롤이 조용히 실패한다).
 */
export const PRICE_SURFACE_ANCHOR_ID = "price-surface";

export function StageBody({
  focus,
  workflow,
  surfaces,
  marketEvidence,
  archive,
  channels,
  categoryVerified,
  onGoToChannel,
  openPriceSurfaceRequest = 0,
  openMarketEvidenceRequest = 0,
}: {
  focus: StageFocus;
  workflow: Workflow;
  surfaces: StageSurfaces;
  /** 국내/해외 가격비교 — ②의 본문이자 나머지 단계의 접힌 근거. */
  marketEvidence: React.ReactNode;
  /** 변경 이력·백로그처럼 단계와 무관한 기록. 항상 맨 아래 접힘. */
  archive: React.ReactNode;
  channels: RegistrationChannel[];
  categoryVerified: boolean;
  /** 채널 화면으로 데려간다. 등록을 여기서 실행하지 않는다 — 등록 게이트는
   * 지금까지와 같이 그 화면 하나가 책임진다(ActionCenter와 같은 원칙). */
  onGoToChannel: (id: PlatformId) => void;
  /**
   * UX 2.5 — "가격을 보여달라"는 요청이 바깥에서 올 때마다 1씩 올라가는 값.
   *
   * 불리언이 아니라 카운터인 이유: 같은 요청이 두 번 올 수 있기 때문이다
   * (판단 카드의 [가격/마진 확인]을 닫았다가 다시 누르는 경우). 불리언이면
   * 두 번째 클릭에서 값이 그대로라 아무 일도 일어나지 않는다.
   */
  openPriceSurfaceRequest?: number;
  /**
   * MI-MARKET-EVIDENCE-1(CEO 지시, 2026-09-12) — MI의 [▸ 국내/해외 가격 보기]가
   * 올 때마다 1씩 올라가는 값.
   *
   * ②에서는 근거가 본문에 그대로 있어 이 값이 필요 없지만, ③④에서는 같은
   * 패널들이 「📊 시장 가격 비교」 접힘 **안쪽**에 있다. 그 바깥 접힘을 열어주지
   * 않으면 드릴다운이 조용히 실패한다 — 요약은 "보기"라고 말하는데 눌러도
   * 아무 일이 없는 상태가, 이번 작업이 없애려는 불신과 정확히 같은 종류다.
   * 카운터인 이유는 openPriceSurfaceRequest와 같다(같은 요청이 두 번 온다).
   */
  openMarketEvidenceRequest?: number;
}) {
  /**
   * ③에서 지금 펼쳐 작업 중인 항목. **이 상태가 여기 있는 이유**는 아래 접힘
   * 목록이 같은 값을 봐야 하기 때문이다 — 셀러가 "이미지"를 골라 편집기를 펼쳤는데
   * 아래에 "이미지 ▾" 섹션이 그대로 남아 있으면 같은 편집기가 한 화면에 두 벌
   * 뜬다. 어느 쪽이 진짜인지 알 수 없어지는 그 상태가 UX 2.2가 없애려는 것이다.
   *
   * null이면 "손볼 것이 있는 첫 항목"이 펼쳐진다(workflow.ts가 정한 순서 그대로).
   */
  const [pickedKey, setPickedKey] = useState<string | null>(null);

  /**
   * UX 2.5 — 가격 계산기를 여는 길은 ③ 체크리스트 말고도 있다: ② 시장 판단
   * 카드의 [가격/마진 확인], 해외 가격비교의 같은 버튼, 상단 Flow의 "판매가격"
   * 항목. 그런데 현재 단계가 ③이 아니면 위 체크리스트 자체가 그려지지 않아
   * pickedKey만으로는 열 방법이 없다 — 그때는 아래 "언제든 열어볼 수 있는 것"에
   * 있는 같은 노드를 대신 펼친다. 두 경로 모두 결국 같은 편집기 하나를 연다.
   *
   * useEffect가 아니라 렌더 중 동기화인 이유는 이 저장소의 다른 파생 state
   * (PriceEditor의 LiveNumberField 등)와 같다 — 한 번 더 그리는 대신 이번
   * 렌더에서 바로 맞춘다.
   */
  const [priceOpen, setPriceOpen] = useState(false);
  const [syncedPriceRequest, setSyncedPriceRequest] = useState(openPriceSurfaceRequest);
  if (openPriceSurfaceRequest !== syncedPriceRequest) {
    setSyncedPriceRequest(openPriceSurfaceRequest);
    setPriceOpen(true);
    setPickedKey("price");
  }

  /** MI-MARKET-EVIDENCE-1 — 위와 같은 렌더 중 동기화. 접는 것은 셀러만 한다. */
  const [marketEvidenceOpen, setMarketEvidenceOpen] = useState(false);
  const [syncedMarketEvidenceRequest, setSyncedMarketEvidenceRequest] = useState(openMarketEvidenceRequest);
  if (openMarketEvidenceRequest !== syncedMarketEvidenceRequest) {
    setSyncedMarketEvidenceRequest(openMarketEvidenceRequest);
    setMarketEvidenceOpen(true);
  }

  const prepareSubSteps = focus.main === "PREPARE" ? workflow.current.subSteps : [];
  const activePrepareKey =
    pickedKey != null && prepareSubSteps.some((s) => s.key === pickedKey)
      ? pickedKey
      : defaultHighlightKey(prepareSubSteps);
  /** 아래 접힘 목록에서 빼야 하는 작업면 — 지금 위에서 펼쳐 쓰고 있는 것. */
  const expandedSurface: PrepareSurface | null =
    focus.main === "PREPARE" && activePrepareKey != null ? prepareSurfaceOf(activePrepareKey) : null;

  return (
    <div className="space-y-4">
      {focus.main === "COLLECTION" && <CollectionStage workflow={workflow} images={surfaces.images} />}

      {focus.main === "MARKET" && <MarketStage marketEvidence={marketEvidence} />}

      {focus.main === "PREPARE" && (
        <PrepareStage
          subSteps={prepareSubSteps}
          headline={workflow.current.headline}
          activeKey={activePrepareKey}
          onPick={setPickedKey}
          surfaces={surfaces}
          channels={channels}
          categoryVerified={categoryVerified}
          onGoToChannel={onGoToChannel}
        />
      )}

      {focus.main === "REGISTER" && (
        <RegisterStage workflow={workflow} channels={channels} onGoToChannel={onGoToChannel} />
      )}

      {/* ── 이 단계에서 주인공이 아닌 것들 ──────────────────────────────
          전부 남아 있고 전부 한 번의 클릭으로 열린다. 제목에 무엇이 들어
          있는지 한 줄로 적어서 "열어봐야 아는" 접힘을 만들지 않는다.

          UX 2.4(CEO 지시, 2026-09-11) — 이 묶음에 이름을 붙인다. 지금까지는
          접힌 섹션들이 위 단계 패널과 아무 구분 없이 이어져서, 이미지·Source
          Data가 "지금 해야 할 일"과 같은 층위로 보였다. 한 줄짜리 머리말이
          "여기부터는 이 단계의 일이 아니다"를 말한다 — 접힘/내용은 그대로다. */}
      <div className="space-y-2">
        <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
          이 단계의 일은 아니지만 언제든 열어볼 수 있는 것
        </p>
        {/* UX 2.5(CEO 지시, 2026-09-11) — 가격은 ③의 항목이지만, 어느 단계에서도
            열 수 있어야 한다: 셀러가 가격을 다시 보고 싶어지는 순간은 대개 ②
            판단 카드를 읽은 직후지 ③에 들어와 있을 때가 아니다. 위에서 이미
            펼쳐 쓰고 있으면(expandedSurface === "PRICE") 여기 또 두지 않는다 —
            이미지와 같은 규칙이고, 이유도 같다(계산기가 두 벌 뜨면 안 된다). */}
        {expandedSurface !== "PRICE" && (
          <CollapsibleSection
            title={PREPARE_SURFACE_LABEL.PRICE}
            /* MI/PRICE-1 — 요약이 계산 사슬을 다시 적지 않는다. 이 카드가 묻는
               것은 "얼마로 팔 것인가" 하나이고, 그 값이 어떻게 나왔는지는 MI
               ③ 💰 수익성이 답한다. */
            summary="권장 판매가격을 확인하고 최종 판매가격을 확정합니다 · 여기서 정한 한 값이 모든 채널의 기본 판매가가 됩니다"
            open={priceOpen}
            onToggle={setPriceOpen}
          >
            {surfaces.price}
          </CollapsibleSection>
        )}
        {/* UX 2.4.1(CEO 지시, 2026-09-11) — "가격 비교 근거"에서 "📊 시장 가격
            비교"로. 이 묶음이 실제로 들고 있는 것은 두 시장의 관측이다:
            국내 경쟁 판매자와 해외 판매처. 제목이 "비교 근거"라고만 하면
            무엇과 무엇을 비교한 것인지 열어봐야 알 수 있고, 판단 카드 안의
            ② 한국 시장 경쟁가격과 이름으로 이어지지도 않는다. */}
        {focus.marketEvidence === "COLLAPSED" && (
          <CollapsibleSection
            title="📊 시장 가격 비교"
            summary="🇰🇷 국내 경쟁 판매자 · 🌎 해외 판매처에서 관측된 가격"
            /* MI-MARKET-EVIDENCE-1 — MI의 [▸ 국내/해외 가격 보기]가 여는 바깥 접힘.
               제어 모드로 바꾼 것뿐이고 셀러가 직접 여닫는 동작은 그대로다. */
            open={marketEvidenceOpen}
            onToggle={setMarketEvidenceOpen}
          >
            {marketEvidence}
          </CollapsibleSection>
        )}
        {/* ③에서 이미지 항목을 펼쳐 작업 중이면 여기 또 두지 않는다 —
            같은 편집기가 한 화면에 두 번 뜨면 어느 쪽이 진짜인지 알 수 없다. */}
        {focus.main !== "COLLECTION" && expandedSurface !== "IMAGES" && (
          <CollapsibleSection
            title={PREPARE_SURFACE_LABEL.IMAGES}
            summary={focus.images === "EDIT" ? "등록용 이미지 선택·정렬" : "판단·등록에 쓰는 참고 이미지"}
          >
            {surfaces.images}
          </CollapsibleSection>
        )}
        {/* Source Data는 어느 단계에서도 기본 접힘이다(UX 2.2 명시 지시). */}
        {expandedSurface !== "SOURCE" && (
          <CollapsibleSection
            title={PREPARE_SURFACE_LABEL.SOURCE}
            summary="원본 사이트에서 추출한 값 — 직접 수정할 수 있습니다"
          >
            {surfaces.source}
          </CollapsibleSection>
        )}
        {archive}
      </div>
    </div>
  );
}

/**
 * ③에서 기본으로 펼쳐 둘 항목. 손볼 것이 있는 첫 항목이고, 없으면 첫 항목이다.
 * workflow.ts가 이미 만든 순서를 그대로 쓴다 — 여기서 우선순위를 다시 정하지
 * 않는다(카테고리가 맨 앞인 이유도 그쪽 주석에 근거가 남아 있다).
 */
function defaultHighlightKey(subSteps: SubStep[]): string | null {
  return (
    subSteps.find((s) => s.status === "ATTENTION")?.key ??
    subSteps.find((s) => s.status === "RUNNING")?.key ??
    subSteps[0]?.key ??
    null
  );
}

/* ────────────────────────────── ① 상품 수집 ────────────────────────────── */

/**
 * 수집 중 화면은 page.tsx가 담당하므로(결과 도착 전) 여기까지 오는 경우는
 * 드물다. 그래도 비워두지 않는다 — 단계가 넷인데 본문이 셋만 알고 있으면
 * 언젠가 "상단은 ①인데 본문이 비어 있다"가 된다.
 */
function CollectionStage({ workflow, images }: { workflow: Workflow; images: React.ReactNode }) {
  return (
    <StagePanel index={1} title="상품 수집" headline={workflow.current.headline}>
      <ol className="space-y-1">
        {workflow.current.subSteps.map((sub) => (
          <li key={sub.key} className="flex items-start gap-1.5 text-xs">
            <span className={`w-3 shrink-0 ${SUB_ICON_CLASS[sub.status]}`} aria-hidden>
              {SUB_STEP_ICON[sub.status]}
            </span>
            <span className={sub.status === "RUNNING" ? "font-medium text-text-primary" : "text-text-secondary"}>
              {sub.label}
              {sub.message && <span className="ml-1 text-text-tertiary">{sub.message}</span>}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-3 border-t border-border pt-3">{images}</div>
    </StagePanel>
  );
}

/* ────────────────────────────── ② 시장 판단 ────────────────────────────── */

/**
 * ②의 주인공은 MI 카드다. 그 카드는 이 아래가 아니라 **이 컴포넌트 위**에
 * 있다(CommerceWorkspace가 탭 분기 밖에서 한 번만 마운트한다 — 쿠팡 탭이
 * 복원된 세션에서도 분석이 돌아야 하기 때문이다). 여기서는 그 판단의 근거를
 * 이어서 놓는다: 국내 → 해외 가격비교. 이미지가 이 위로 올라오는 일은 없다.
 *
 * ── UX 2.4(CEO 지시, 2026-09-11) — 결론과 근거의 경계를 조인다 ────────────
 * 지금까지 이 패널은 MI 카드와 **똑같은 껍데기**(같은 테두리·같은 "지금 단계"
 * 머리말)를 쓰고 있었다. 그래서 국내 가격비교·해외 가격비교가 판단의 근거가
 * 아니라 판단과 나란한 또 하나의 결론처럼 읽혔다 — 그 아래 이미지·Source Data
 * 까지 같은 무게로 이어지면서 "결론이 어디였지?"가 다시 생긴다.
 *
 * 그래서 이 블록은 스스로를 근거라고 부르고(제목), 위 카드가 결론이라는 사실을
 * 머리말에서 직접 말한다. 내용·컴포넌트·데이터는 한 줄도 바뀌지 않는다 —
 * 바뀌는 것은 이 덩어리가 자기를 무엇이라고 소개하는가뿐이다.
 */
function MarketStage({ marketEvidence }: { marketEvidence: React.ReactNode }) {
  return (
    <StagePanel
      index={2}
      title="시장 판단"
      headline="결론은 위 판단 카드 하나입니다 — 아래는 그 판단이 어떤 가격 위에 세워졌는지 보여주는 근거입니다"
      badge="근거"
    >
      <div className="rounded-md border border-dashed border-border bg-background/40 p-2">
        <p className="mb-2 text-[11px] text-text-tertiary">
          🔎 판단 근거 — 여기 있는 가격은 결론이 아니라 위 판단이 읽은 원본입니다
        </p>
        {marketEvidence}
      </div>
    </StagePanel>
  );
}

/* ───────────────────────────── ③ 등록 준비 ────────────────────────────── */

function PrepareStage({
  subSteps,
  headline,
  activeKey,
  onPick,
  surfaces,
  channels,
  categoryVerified,
  onGoToChannel,
}: {
  subSteps: SubStep[];
  headline: string;
  /** 지금 펼쳐 둔 항목. 상태는 StageBody가 갖는다(아래 접힘 목록과 같은 값을 봐야 한다). */
  activeKey: string | null;
  onPick: (key: string) => void;
  surfaces: StageSurfaces;
  channels: RegistrationChannel[];
  categoryVerified: boolean;
  onGoToChannel: (id: PlatformId) => void;
}) {
  const doneCount = subSteps.filter((s) => s.status === "DONE" || s.status === "DONE_NO_DATA").length;

  return (
    <StagePanel
      index={3}
      title="등록 준비"
      headline={headline}
      badge={`${doneCount}/${subSteps.length} 확인 완료`}
    >
      <ul className="space-y-1.5">
        {subSteps.map((sub) => {
          const active = sub.key === activeKey;
          return (
            <li key={sub.key}>
              <button
                type="button"
                onClick={() => onPick(sub.key)}
                className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                  active ? "border border-primary bg-primary-soft" : "border border-transparent hover:bg-background"
                }`}
              >
                <span className={`w-3 shrink-0 ${SUB_ICON_CLASS[sub.status]}`} aria-hidden>
                  {SUB_STEP_ICON[sub.status]}
                </span>
                <span className={active ? "font-semibold text-text-primary" : "text-text-secondary"}>
                  {sub.label}
                  {sub.message && (
                    <span className={`ml-1 font-normal ${sub.status === "ATTENTION" ? "text-warning" : "text-text-tertiary"}`}>
                      {sub.message}
                    </span>
                  )}
                </span>
              </button>
              {/* 고른 항목의 **실제 작업 UI**가 바로 여기서 열린다. 다른 화면으로
                  보내지 않는다 — "어디서 고치지?"가 이 단계의 전부였다. */}
              {active && (
                <div className="mt-2 rounded-md border border-border bg-background p-3">
                  <PrepareWorkSurface
                    subStepKey={sub.key}
                    surfaces={surfaces}
                    channels={channels}
                    categoryVerified={categoryVerified}
                    onGoToChannel={onGoToChannel}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </StagePanel>
  );
}

function PrepareWorkSurface({
  subStepKey,
  surfaces,
  channels,
  categoryVerified,
  onGoToChannel,
}: {
  subStepKey: string;
  surfaces: StageSurfaces;
  channels: RegistrationChannel[];
  categoryVerified: boolean;
  onGoToChannel: (id: PlatformId) => void;
}) {
  const surface = prepareSurfaceOf(subStepKey);
  if (surface === "IMAGES") return <>{surfaces.images}</>;
  // UX 2.5 — 가격은 여기서 "채널로 가세요" 안내를 하지 않는다. 카테고리와 달리
  // 채널이 고를 것이 없기 때문이다(값이 하나뿐이다) — 계산기를 그대로 연다.
  if (surface === "PRICE") return <>{surfaces.price}</>;
  if (surface === "REQUIRED") {
    return (
      <div className="space-y-3">
        {surfaces.required}
        <ChannelJumpList
          channels={channels}
          note="채널마다 요구하는 필수 항목이 달라서, 남은 항목은 해당 채널 화면에서 확인합니다."
          onGoToChannel={onGoToChannel}
        />
      </div>
    );
  }
  if (surface === "CATEGORY") {
    return (
      <div className="space-y-2 text-xs">
        {/* 카테고리는 화면 표시용 분류가 아니라 등록 payload에 실제로 들어가는
            값이다(smartstore leafCategoryId / coupang displayCategoryCode).
            그래서 확정은 채널별 후보 목록이 있는 채널 화면에서만 가능하다 —
            여기에 또 하나의 선택 UI를 만들면 두 목록이 갈라진다. */}
        <p className={categoryVerified ? "text-success" : "font-medium text-text-primary"}>
          {categoryVerified
            ? "✓ 등록할 카테고리가 확정되어 있습니다."
            : "카테고리는 채널마다 코드가 달라서 채널 화면에서 확정합니다."}
        </p>
        <p className="text-text-tertiary">
          확정 전에는 ④ 커머스 등록이 열리지 않습니다 — 카테고리가 비면 등록 API가 거부하기 때문입니다.
        </p>
        <ChannelJumpList channels={channels} onGoToChannel={onGoToChannel} />
      </div>
    );
  }
  return <>{surfaces.source}</>;
}

/* ──────────────────────────── ④ 커머스 등록 ───────────────────────────── */

function RegisterStage({
  workflow,
  channels,
  onGoToChannel,
}: {
  workflow: Workflow;
  channels: RegistrationChannel[];
  onGoToChannel: (id: PlatformId) => void;
}) {
  const byId = new Map(channels.map((c) => [String(c.id), c]));
  return (
    <StagePanel index={4} title="커머스 등록" headline={workflow.current.headline}>
      <div className="space-y-2">
        {workflow.current.subSteps.map((sub) => {
          const channel = byId.get(sub.key);
          const level: ReadinessLevel | null = channel?.state ? readinessStateToLevel(channel.state) : null;
          const comingSoon = channel?.availability === "COMING_SOON";
          return (
            <div
              key={sub.key}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2.5 ${
                sub.status === "RUNNING" ? "border-primary bg-primary-soft" : "border-border bg-background"
              }`}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                  {level && <span className={`h-2 w-2 rounded-full ${LEVEL_DOT_CLASS[level]}`} aria-label={level} />}
                  {sub.label}
                </p>
                <p className="text-[11px] text-text-tertiary">
                  {sub.message ?? "등록할 수 있습니다"}
                  {channel && channel.blockingCount > 0 && (
                    <span className="ml-1 text-warning">
                      · 확인 {channel.blockingCount}건{channel.provisional ? " (사전 점검)" : ""}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                disabled={comingSoon || sub.target == null}
                onClick={() => sub.target && onGoToChannel(sub.target as PlatformId)}
                title={comingSoon ? "다음 스프린트에 제공될 예정입니다" : undefined}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  comingSoon || sub.target == null
                    ? "cursor-not-allowed border border-border text-text-tertiary"
                    : sub.status === "RUNNING"
                      ? "bg-primary text-white hover:bg-primary-hover"
                      : "border border-primary text-primary hover:bg-primary-soft"
                }`}
              >
                {comingSoon ? "준비중" : `${sub.label} 화면 열기 →`}
              </button>
            </div>
          );
        })}
      </div>
      {/* 버튼이 바로 등록하지 않는다는 사실을 숨기지 않는다(Action Center와 같은 문구). */}
      <p className="mt-2 text-[10px] text-text-tertiary">채널 화면에서 최종 확인 후 등록됩니다.</p>
    </StagePanel>
  );
}

/* ──────────────────────────────── 공통 조각 ─────────────────────────────── */

/** 단계 본문의 껍데기. 어느 단계를 보고 있는지를 본문 자체가 다시 말한다 —
 * 상단 Flow까지 눈을 올리지 않아도 "지금 ③을 하고 있다"가 읽혀야 한다. */
function StagePanel({
  index,
  title,
  headline,
  badge,
  children,
}: {
  index: number;
  title: string;
  headline: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-primary/30 bg-surface p-4 shadow-subtle">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
            지금 단계 · {index}. {title}
          </p>
          <p className="text-sm font-medium text-text-primary">{headline}</p>
        </div>
        {badge && (
          <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] text-text-secondary">
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/** 채널로 건너가는 작은 목록. 등록 버튼이 아니라 "그 화면을 연다"는 이동이다. */
function ChannelJumpList({
  channels,
  note,
  onGoToChannel,
}: {
  channels: RegistrationChannel[];
  note?: string;
  onGoToChannel: (id: PlatformId) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {channels.map((channel) => {
          const soon = channel.availability === "COMING_SOON";
          return (
            <button
              key={channel.id}
              type="button"
              disabled={soon}
              onClick={() => onGoToChannel(channel.id)}
              title={soon ? "다음 스프린트에 제공될 예정입니다" : undefined}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                soon
                  ? "cursor-not-allowed border border-border text-text-tertiary"
                  : "border border-primary text-primary hover:bg-primary-soft"
              }`}
            >
              {channel.label} 화면 열기 →
            </button>
          );
        })}
      </div>
      {note && <p className="mt-1.5 text-[10px] text-text-tertiary">{note}</p>}
    </div>
  );
}

const SUB_ICON_CLASS: Record<SubStepStatus, string> = {
  DONE: "text-success",
  DONE_NO_DATA: "text-text-tertiary",
  RUNNING: "animate-pulse text-primary",
  UPCOMING: "text-text-tertiary",
  ATTENTION: "text-warning",
};

const LEVEL_DOT_CLASS: Record<ReadinessLevel, string> = {
  GREEN: "bg-success",
  YELLOW: "bg-warning",
  RED: "bg-error",
};
