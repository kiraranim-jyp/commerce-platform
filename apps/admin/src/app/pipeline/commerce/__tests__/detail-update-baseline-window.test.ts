import { describe, expect, it } from "vitest";
import {
  preserveRegisteredValues,
  type NaverProductRegistrationPayload,
  type RegisteredProductSnapshot,
} from "@commerce/listing";
import { smartStoreEditAdapter } from "../edit-adapters/smartstore";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMMON-DETAIL-CONTENT-REFLECTION 공백 B — **「고쳤다」의 기준이 «창» 이다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 🔴 이 파일이 «무엇을» 하는 파일인가 ───────────────────────────────────
 * 이것은 **재현 테스트** 다. 아래 시나리오 2 의 결과가 «옳다» 고 말하는 파일이
 * 아니다. 지금 코드가 그렇게 «동작한다» 는 사실만 고정한다.
 *
 * 🔴 그래서 고치는 날 이 파일은 «깨져야 한다». 깨지면 그것이 회귀가 아니라
 * 의도된 변경이고, 그때 이 주석을 지우고 계약으로 바꾼다. 「현재 동작」을
 * 「올바른 계약」으로 적어 두면 미래의 수정이 회귀로 보인다(CPO 지적 이력).
 *
 * ── 추적한 생명주기 (CommerceWorkspace.tsx) ───────────────────────────────
 *   2749  const [channelEdit, setChannelEdit] = useState(...)   ← useMemo 가 아니다
 *   2790  setChannelEdit({ ... basePayload: smartStorePayload })
 *         └ `loadChannelEdit()` «안» 이고, 그 함수는 셀러가 「불러오기」를
 *           누를 때만 돈다(2734 주석: 자동으로 읽지 않는다)
 *   2844  const current  = smartStorePayload ?? channelEdit.basePayload
 *   2854  const edited   = smartStoreEditAdapter.editedFields(basePayload, current)
 *   3301  editedFields: channelEditInput?.edited          ← 서버로 그대로 간다
 *
 * 🔴 `basePayload` 는 **「불러오기」를 누른 순간에 «얼어붙는다»**. `smartStorePayload`
 * 가 뒤에 다시 계산돼도 따라 바뀌지 않는다(state 객체 안에 박혀 있다). 반대로
 * `current` 는 살아 있는 값이다. 그래서 둘의 차이는 **「등록된 값과 다른가」가
 * 아니라 「불러오기 뒤에 달라졌는가」** 를 뜻한다.
 *
 * ── 🔴 그것이 왜 위험한가 ─────────────────────────────────────────────────
 * `editedFields` 는 `preserveRegisteredValues` 의 **의도 목록** 이다. 거기 없는
 * 축은 «채널에 등록된 값으로 되돌려진다»(preserve-registered-values.ts:97).
 * 따라서 상세를 고친 «뒤» 에 불러오기를 누르면, 그 변경이 창 밖에 있어서
 * 목록에 오르지 못하고 → 되돌려진다.
 *
 * ── 🔴 그런데 단순 버그가 아니다 ──────────────────────────────────────────
 * 창을 「채널 등록값」으로 바꾸면 F-14-7 이 없앤 사고가 되살아난다. Master 재생성
 * payload 는 셀러가 손대지 않아도 채널값과 다르다(재고 999 · 상세 1835자) —
 * 그러면 «전부» 변경으로 잡혀 preserve 가 아무것도 되돌리지 못하고, 셀러가
 * 스마트스토어에서 직접 고쳐 둔 값이 Master 값으로 덮인다. 그것이 원래 사고다.
 *
 * 두 선택에 각각 실패 모드가 있다:
 *     채널값 기준   → 거짓 양성(안 고친 것이 고친 것으로)  = F-14-7 사고
 *     창 기준(현재) → 거짓 음성(고친 것이 안 고친 것으로)  = 아래 시나리오 2
 * 그래서 이 파일은 «고르지 않는다». 사실만 고정하고 CPO 판단으로 넘긴다.
 */

/** 스마트스토어에 «지금 올라가 있는» 것. 채널 GET 이 준 값이다. */
const REGISTERED_DETAIL = "<p>등록 당시 상세</p>";
/** 셀러가 상세 블록에 이미지 2장을 넣은 «뒤» 의 조립 결과. */
const EDITED_DETAIL = '<p>등록 당시 상세</p><img src="https://cdn.example.com/size-1.jpg"><img src="https://cdn.example.com/size-2.jpg">';

const REGISTERED: RegisteredProductSnapshot = {
  name: "테스트 상품",
  salePrice: 157100,
  stockQuantity: 7,
  detailContent: REGISTERED_DETAIL,
  representativeImageUrl: "https://shop-phinf.pstatic.net/a.jpg",
  optionalImageCount: 2,
  optionCombinationCount: 1,
  hasProvidedNotice: true,
};

/** Master 재생성 payload. 🔴 `detailContent` 만 시나리오별로 갈린다. */
const masterPayload = (detailContent: string): NaverProductRegistrationPayload =>
  ({
    originProduct: {
      name: "테스트 상품",
      salePrice: 157100,
      stockQuantity: 7,
      detailContent,
      images: {
        representativeImage: { url: "https://shop-phinf.pstatic.net/a.jpg" },
        optionalImages: [{ url: "x" }, { url: "y" }],
      },
      detailAttribute: {
        productInfoProvidedNotice: { productInfoProvidedNoticeType: "WEAR" },
        optionInfo: { optionCombinations: [{}] },
      },
      leafCategoryId: "50000535",
    },
  }) as unknown as NaverProductRegistrationPayload;

const detailOf = (payload: NaverProductRegistrationPayload) =>
  (payload.originProduct as unknown as { detailContent?: string }).detailContent;

/**
 * 화면이 하는 일을 그대로 따라한다 — `CommerceWorkspace.tsx:2844-2854`.
 * 🔴 두 줄을 베껴 쓰지 않고 «같은 함수» 를 부른다. 베끼면 화면이 바뀌어도
 * 이 테스트가 옛 동작을 계속 통과시킨다.
 */
function runUpdate(input: { basePayload: NaverProductRegistrationPayload; current: NaverProductRegistrationPayload }) {
  const edited = smartStoreEditAdapter.editedFields(input.basePayload, input.current);
  const result = preserveRegisteredValues(input.current, REGISTERED, edited);
  return { edited, outgoingDetail: detailOf(result.payload), preserved: result.preserved };
}

describe("🔴 전제 — 세 값이 실제로 서로 다르다", () => {
  /* 이 단정이 없으면 아래 둘이 «같은 문자열끼리» 비교하며 공허하게 통과한다.
     실제로 그 구멍에 한 번 걸린 이력이 있다(A-1 핏 척도 테스트). */
  it("등록값 · 수정값이 다르고, 둘 다 비어 있지 않다", () => {
    expect(REGISTERED_DETAIL).not.toBe(EDITED_DETAIL);
    expect(REGISTERED_DETAIL.length).toBeGreaterThan(0);
    expect(EDITED_DETAIL).toContain("size-1.jpg");
    expect(EDITED_DETAIL).toContain("size-2.jpg");
  });
});

describe("시나리오 1 — 「불러오기」를 «먼저» 누르고 상세를 고친다", () => {
  /* 불러오기 시점의 Master 는 아직 옛 상세를 만든다 → 창 «안» 에서 달라진다. */
  const subject = () =>
    runUpdate({
      basePayload: masterPayload(REGISTERED_DETAIL),
      current: masterPayload(EDITED_DETAIL),
    });

  it("detailContent 가 「고친 축」으로 잡힌다", () => {
    expect(subject().edited).toContain("detailContent");
  });

  it("🟢 셀러가 넣은 이미지 2장이 그대로 나간다", () => {
    const { outgoingDetail } = subject();
    expect(outgoingDetail).toBe(EDITED_DETAIL);
    expect(outgoingDetail).toContain("size-1.jpg");
    expect(outgoingDetail).toContain("size-2.jpg");
  });

  it("고치지 않은 축은 등록된 값으로 보존된다 — F-14-7 이 그대로 산다", () => {
    expect(subject().preserved).toContain("stockQuantity");
    expect(subject().preserved).not.toContain("detailContent");
  });
});

describe("🔴 시나리오 2 — 상세를 «먼저» 고치고 「불러오기」를 누른다", () => {
  /* ── 🔴 CommerceWorkspace.tsx:2793 이 그 순간의 smartStorePayload 를 그대로
     basePayload 로 박는다. 이미 고쳐진 값이므로 base === current 가 된다.
     「다른 화면 갔다가 수정 화면에 다시 들어온다」도 같은 모양이다 — 다시
     들어오면 불러오기가 다시 돌아 기준값이 «새 값으로 갈아끼워진다». */
  const subject = () => {
    const alreadyEdited = masterPayload(EDITED_DETAIL);
    return runUpdate({ basePayload: alreadyEdited, current: alreadyEdited });
  };

  it("「고친 축」이 «비어» 있다 — 창 밖의 변경은 보이지 않는다", () => {
    expect(subject().edited).toEqual([]);
  });

  it("🔴 그래서 detailContent 가 «등록 당시 값으로 되돌려진다»", () => {
    expect(subject().preserved).toContain("detailContent");
    expect(subject().outgoingDetail).toBe(REGISTERED_DETAIL);
  });

  it("🔴 셀러가 넣은 이미지 2장이 payload 에서 «사라진다»", () => {
    const { outgoingDetail } = subject();
    expect(outgoingDetail).not.toContain("size-1.jpg");
    expect(outgoingDetail).not.toContain("size-2.jpg");
  });

  it("🔴 화면과 전송이 «갈라진다» — 이것이 silent loss 의 정의다", () => {
    /* 화면은 current(새 상세)를 보여 주고, 나가는 것은 등록 당시 값이다.
       셀러에게는 「저장했는데 반영이 안 된다」로 보인다. */
    const alreadyEdited = masterPayload(EDITED_DETAIL);
    expect(detailOf(alreadyEdited)).toBe(EDITED_DETAIL);
    expect(subject().outgoingDetail).not.toBe(detailOf(alreadyEdited));
  });
});

describe("🔴 이 갈림이 «상세에 한정되지 않는다»", () => {
  it("같은 창을 쓰는 네 축 전부가 같은 모서리를 갖는다", () => {
    /* preserve 대상 축 전체가 editedFields 하나에 걸려 있으므로, 재고·가격·
       상품명도 「창 밖에서 고치면 되돌려진다」. 상세만의 문제로 좁히지 않는다. */
    const alreadyEdited = {
      ...masterPayload(EDITED_DETAIL),
      originProduct: {
        ...(masterPayload(EDITED_DETAIL).originProduct as object),
        stockQuantity: 99,
      },
    } as unknown as NaverProductRegistrationPayload;
    const { edited, preserved } = runUpdate({ basePayload: alreadyEdited, current: alreadyEdited });
    expect(edited).toEqual([]);
    expect(preserved).toContain("stockQuantity");
  });
});
