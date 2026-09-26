import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import type { ExecutionMode, ListingResult } from "./types";

/**
 * 실제 등록 로직을 API 호출로 할지 브라우저 자동화로 할지는 이 인터페이스
 * 뒤에 완전히 숨는다 — CommerceWorkspace는 LISTING_EXECUTORS[platform].execute()만
 * 호출하고, SmartStore가 API 기반이든 나중에 Coupang이 Playwright 기반이든
 * 알 필요가 없다.
 *
 * product를 listing과 별도로 받는 이유: 원산지/반품정보/배송비/재고 같은 등록
 * 직전 필드는 ListingModel(플랫폼 Preview 모양)에 없다 — CanonicalProduct에만
 * 있다. ListingModel에 이 필드들을 밀어넣으면 "플랫폼 Preview 모양"과 "등록
 * 준비 데이터"가 섞여서 STEP 1이 요구하는 3단 분리(CanonicalProduct → ListingModel
 * → Payload)가 무너진다.
 */
export interface ListingExecutor {
  platform: ListingModel["platform"];
  execute(
    product: CanonicalProduct,
    listing: ListingModel,
    mode: ExecutionMode,
    /** "최근 작업" 스냅샷에서 이어서 등록한 경우의 스냅샷 id — LIVE 등록 시
     * registration_attempts.snapshot_id에 남겨 감사 추적 및 스냅샷 status를
     * REGISTERED로 갱신하는 데 쓴다. API 기반이 아닌 실행기(Playwright 등)는
     * 무시해도 된다. */
    context?: {
      snapshotId?: string;
      /** Sprint B-1(CPO 지시) — snapshotId와 함께 그대로 register API에 전달해서
       * registration_attempts.job_key에 남긴다(감사 로그를 조인 없이 검색하기
       * 위한 복제값 — snapshotId가 구조적 연결의 원본이다). */
      jobKey?: string;
      /**
       * P0-CHANNEL-03 F-10 — RECREATE 를 «실행해도 되는가» 에 대한 셀러 동의.
       *
       * 🔴 이 값이 lifecycle 을 «정하지» 않는다. 무엇을 할지는 서버가
       * resolveLifecycle() 로 정하고, 이것은 서버가 RECREATE 라고 정한 «뒤»
       * 「그래도 진행할까요」에 대한 대답일 뿐이다 — 그래서 「클라이언트가 보낸
       * 값을 신뢰하지 않는다」는 register 라우트들의 원칙과 충돌하지 않는다.
       *
       * 🔴 기본값은 «안 함» 이다. 보내지 않으면 서버가 needsConfirmation 을
       * 실어 되묻고, 외부 API 호출은 0회다.
       */
      confirmRecreate?: boolean;
      /**
       * P0-CHANNEL-03 F-12 — UPDATE 를 «이대로 보내도 되는가» 에 대한 확인.
       *
       * 🔴 confirmRecreate 와 같은 성질이고 기본값도 같다(안 함). 네이버 수정은
       * «전체 교체» 라, 무엇이 바뀌고 무엇이 유지되는지 보여주지 않고 보내는
       * 것 자체가 사고다 — 서버가 needsConfirmation.diff 로 되묻는다.
       */
      confirmUpdate?: boolean;
      /**
       * ════════════════════════════════════════════════════════════════════
       * P0-CHANNEL-03 F-14 — **내가 보고 고친 그 상품이 맞는가.**
       * ════════════════════════════════════════════════════════════════════
       *
       * 수정 대상의 기준은 Snapshot 이 아니라 «Commerce 등록 ID» 다. 화면은
       * `ChannelProduct.external_product_id` 로 실제 등록상품을 GET 해서 기준값을
       * 만들고, 셀러는 «그 값» 을 보고 고친다.
       *
       * 🔴 그런데 서버는 전송 시점에 snapshotId 로 연결을 «다시» 찾는다. 두 시점
       * 사이에 그 연결이 달라질 수 있다:
       *   · `@@unique([productId, channel])` 가 아직 걸려 있지 않아 중복 행이 있고
       *     (기존 9건), 「현재」는 `updated_at` 최신 한 건으로 고른다 — 다른 행이
       *     갱신되면 «가리키는 상품이 바뀐다».
       *   · 그 사이 RECREATE 나 「연결 확인」으로 연결이 갈아끼워질 수 있다.
       *
       * 그러면 셀러는 A 를 보고 고쳤는데 B 가 수정된다. 이 스프린트가 고쳐 온
       * 「번호가 섞여 남의 상품을 고친다」가 바로 그 모양이다(F-12b).
       *
       * 🔴 이 값은 «판단하지» 않는다 — 대상을 정하는 것은 여전히 서버의
       * ChannelProduct 조회다. 이것은 「내가 본 것과 같은가」를 묻는 대조값이고,
       * 다르면 서버가 «보내지 않는다». 클라이언트가 보낸 값을 신뢰하지 않는다는
       * 원칙과 충돌하지 않는 이유가 그것이다(confirmUpdate 와 같은 성질).
       */
      expectedExternalProductId?: string;
      /**
       * P0-CHANNEL-03 F-14-7 — 셀러가 «이번에 실제로 고친» 항목의 이름.
       *
       * 🔴 값이 아니라 «이름» 만 보낸다. 서버는 이 목록으로 「어느 칸을 지금
       * 등록된 값으로 되돌릴지」만 고르고, 되돌리는 값은 서버가 채널에서 직접
       * 읽은 것에서만 온다 — 클라이언트가 값을 밀어 넣을 길이 없다.
       *
       * 🔴 보내지 않으면 아무것도 되돌리지 않는다(예전 동작). 「빈 배열」과
       * 「안 보냄」은 다른 뜻이다 — 전자는 「하나도 안 고쳤다」이다.
       */
      editedFields?: string[];
    },
  ): Promise<ListingResult>;
}
