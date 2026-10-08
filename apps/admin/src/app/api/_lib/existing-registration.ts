import type { ListingResult } from "@commerce/listing";
import {
  classifyExistingRegistration,
  existingRegistrationMessage,
} from "@/app/pipeline/commerce/channel-lifecycle";
import { findSiblingChannelConnections } from "./channel-product";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * A-IMPLEMENT(CPO 승인, 2026-10-08) — **세 라우트가 «같은» 복구 안내를 낸다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 있는 이유는 이 저장소가 이미 겪은 실수다. F-12 후속에서 중복
 *    빗장을 세 register 라우트에 «복제» 했고, 그때 한 채널의 채널 문자열만
 *    안 고쳐서 조용히 틀린 상태였다. 그래서 조립을 여기 한 곳에 둔다.
 *
 * 🔴 **CREATE 를 열지 않는다.** 이 함수는 게이트 판정을 받지도, 바꾸지도 않는다.
 *    이미 BLOCKED 로 정해진 응답에 「어디에 나가 있는지」를 더하는 일만 한다.
 */
export interface ExistingRegistrationNotice {
  /** `ListingResult.existingRegistration` 에 그대로 넣는다. */
  existingRegistration: NonNullable<ListingResult["existingRegistration"]>;
  /** 셀러가 읽는 문장. 🔴 화면이 지어내지 않는다. */
  message: string;
}

export async function buildExistingRegistrationNotice(input: {
  snapshotId: string | null | undefined;
  /** DB 의 `channel_products.channel` 값(= platform 문자열). */
  channel: string;
  /** 셀러에게 보여줄 채널 이름. */
  channelLabel: string;
}): Promise<ExistingRegistrationNotice> {
  const scan = await findSiblingChannelConnections(input.snapshotId, input.channel);
  const outcome = classifyExistingRegistration(scan);
  const message = existingRegistrationMessage(outcome, input.channelLabel);

  if (outcome.kind === "EXISTING_CONNECTION_FOUND") {
    return {
      message,
      existingRegistration: {
        kind: "EXISTING_CONNECTION_FOUND",
        externalProductId: outcome.externalProductId,
        status: outcome.status,
        /* 🔴 화면이 「이동」 링크를 만들 근거. 연결을 옮기는 값이 아니다. */
        siblingJobKey: outcome.siblingJobKey,
        siblingSnapshotId: outcome.siblingSnapshotId,
      },
    };
  }
  return {
    message,
    existingRegistration: {
      kind: "NEEDS_RECONCILIATION",
      reason: outcome.reason,
      /* 🔴 후보를 «하나로 줄이지 않는다». 화면이 전부 보여주고 사람이 고른다. */
      candidates: outcome.candidates,
    },
  };
}
