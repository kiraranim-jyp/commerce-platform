# Commerce-6 C-2C — payload 의 «근거 없는 상수» 전수

> CTO(2026-09-26). **전송값 0줄 변경 · migration 0 · push 0.**
> C-2B 가 고친 `remoteAreaDeliverable` 이 한 번의 실수인지 «부류» 인지 확인했다.
> 🔴 **부류였다.**

---

## 왜 이 결함은 눈에 띄지 않는가

스키마에 맞춰 payload 를 채우다 보면 빈 칸에 그럴듯한 값을 적게 된다. 그 줄만
보면 아무 문제가 없다 — 문제는 **그 값이 판매자의 결정인지 기술적 귀결인지가
구분되지 않은 채 남는다**는 것이다. 그래서 값을 검사하지 않고 **목록을 검사**한다.

---

## ① 쿠팡 — 최상위 하드코딩 «넷»

| 키 | 값 | 판정 |
|---|---|---|
`deliveryMethod` | AGENT_BUY | 🟢 근거 있음 — 구매대행 공식 문서 확인 |
`requested` | false | 🟢 근거 있음 — 사람이 Wing 에서 최종 승인 |
`freeShipOverAmount` | 0 | 🟢 구조적 — `CONDITIONAL_FREE` 를 한 번도 만들지 않는다 |
`unionDeliveryType` | NOT_UNION_DELIVERY | 🔴 **근거 없음 · 다른 채널과 반대** |
~~`remoteAreaDeliverable`~~ | ~~N~~ | C-2B 에서 목록에서 빠짐 |

### 🔴 `unionDeliveryType` — 같은 판매자가 채널마다 반대다

```text
네이버   deliveryBundleGroupUsable: true
         ↑ 대표님 지시(N-3.85 STEP5 「묶음배송 = 항상 사용」) + 공식 스펙 확인
쿠팡     unionDeliveryType: "NOT_UNION_DELIVERY"
         ↑ 🔴 이유가 «어디에도» 없다
```

CEO 가 한 채널에는 지시를 남겼고 다른 채널에는 반영되지 않았다. 바꾸지 않았다 —
**Production 등록 정책이라 CPO/CEO 결정**이다. 대신 그 모순을 소스에 적고
테스트로 고정했다.

### 🟡 `freeShipOverAmount` — 값은 맞는데 «선택지» 가 없다

`deliveryChargeType` 은 `deliveryCharge > 0 ? "NOT_FREE" : "FREE"` 둘뿐이다.
`CONDITIONAL_FREE` 를 만들지 않으니 기준금액 0 이 맞다. 🔴 다만 **「N원 이상
무료배송」을 쓸지 셀러에게 물은 적이 없다** — 쿠팡은 지원한다. 틀린 값이 아니라
없는 기능이다.

---

## ② 롯데ON — 같은 부류가 «훨씬 넓다»

| 키 | 값 | 무엇인가 | 판정 |
|---|---|---|---|
`prstPckPsbYn` | N | 선물포장 가능 | 🔴 판매자 결정 · 근거 0 |
`prstMsgPsbYn` | N | 선물메시지 가능 | 🔴 판매자 결정 · 근거 0 |
`itmByMinPurYn` | N | 최소구매수량 사용 | 🟡 중립(제한 없음) · 근거 0 |
`itmByMaxPurPsbQtyYn` | N | 최대구매수량 사용 | 🟡 중립 · 근거 0 |
`maxPurLmtTypCd` | PERIOD | 최대구매 제한 기준 | 🟡 제한을 안 쓰는데 유형만 채움 |
`cnclPsbYn` | Y | 취소 가능 | 🟢 값은 타당(청약철회) · 근거 0 |
`rtngPsbYn` | Y | 반품 가능 | 🟢 값은 타당 · 근거 0 |
`dpYn` | Y | 전시 여부 | 🟢 등록=전시, 타당 · 근거 0 |
`weekdayCloseTime` | 1400 | 평일 발송마감 | 🟡 **폼 기본값** — 셀러가 화면에서 보고 고칠 수 있다 |
`saturdayShippingAvailable` | false | 토요일 발송 | 🟡 폼 기본값 |
`shipBudgetDays` | 3 | 발송예정일수 | 🟢 문서화된 폴백(상한 3일) |

🔴 **타입 선언에도 근거 주석이 거의 없다.** 다만 롯데ON 은 Production 등록이
아직 0건이라 이 값들이 실제로 검증된 적도 없다 — 값을 지금 바꾸는 것은 근거
없는 상수를 다른 근거 없는 상수로 바꾸는 일이다(C-2B 와 같은 이유로 하지 않았다).

---

## ③ 이번에 «한 것» 과 «안 한 것»

```text
✅ 쿠팡 두 상수에 근거를 기록했다(freeShipOverAmount 는 구조적 · unionDeliveryType 은 「없음」)
✅ 목록 가드 테스트 — 다섯 번째 상수가 «조용히» 생기면 먼저 막힌다
✅ 네이버와의 모순을 소스와 테스트에 고정했다

❌ 전송값 변경 0 — 🔴 전부 Production 등록 정책이다
❌ 롯데ON 상수 수정 0 — 같은 이유
❌ migration 0
```

가드는 **값을 적지 않는다.** 값을 적으면 「그 값이 옳다」고 말하는 두 번째 자리가
생기고, 지금 고치려는 문제가 정확히 그것이다. 목록과 «근거가 있는가» 만 본다.

---

## 🔴 STOP — CPO/CEO 결정이 필요한 지점

```text
① 묶음배송  네이버는 켜져 있고 쿠팡은 꺼져 있다. 어느 쪽이 맞는가
             (해외구매대행에서 묶음배송이 성립하는지부터가 UNKNOWN)
② 조건부 무료배송  「N원 이상 무료」를 셀러에게 열어줄 것인가
③ 롯데ON 선물포장·선물메시지  판매자에게 물을 것인가, N 으로 둘 근거를 세울 것인가
④ (C-2B 이월) 도서산간 결정값 저장 위치 — migration
```

이 넷은 전부 「어떤 값이 맞는가」가 아니라 **「누가 정하는가」** 의 문제다.
