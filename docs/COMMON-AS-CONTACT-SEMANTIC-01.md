# COMMON-AS-CONTACT-SEMANTIC-01 — A/S 연락처의 «의미» (2026-09-29)

> CTO 조사. **코드 변경 0줄 · migration 0 · UI 0.**
> 🔴 이 경계는 **이미 한 번 실측으로 확정됐다**(N-3.51 · 5차 실등록). 재조사하지
> 않고 그 기록을 근거로 정리한다.

---

## 0. 결론 먼저 — **B** 다. 다만 **C 가 이미 일어나고 있다**

```
B  asContactNumber 는 «A/S 안내문» 이다. 실제 A/S 전화번호 칸이 Common 에 «없다».
C  그런데 companyContactNumber(실제 번호)를 «이미 두 채널이» A/S 번호로 쓰고 있다
   — 그 필드는 배송 프로필의 «반품지 연락처» 이고, WIRE-05 가 그 교차를 경고했다.
```

---

## 1. `asContactNumber` — 이름은 「연락처」, 쓰임은 「안내문」 [확정]

### 쓰이는 곳 (전수)

| 채널 | payload 칸 | 성격 |
|---|---|---|
| 네이버 | `afterServiceDirector` | 🟢 **자유 텍스트 고시 항목** |
| 롯데ON | 고시 `0090` 의 전화번호 자리 | 🔴 **번호를 요구한다** |
| 쿠팡 | `buildCoupangCompliance(...).contactNumber` (고시) | 🟡 `\|\| companyContactNumber` 폴백 |

### 「해외 구매대행으로 A/S 불가」는 **의도된 값이다** [확정 · 실측]

[naver/build-payload.ts:144-153](packages/listing/src/naver/build-payload.ts) 원문:

> `afterServiceInfo.afterServiceTelephoneNumber` 는 `afterServiceDirector` 와
> 다른 필드다: 후자는 **자유 텍스트를 허용하는 고시용 항목**(「해외 구매대행으로
> A/S 불가」 같은 문구가 **실제로 통과**)이지만, 전자는 네이버가 실제로
> **숫자/-/+ 만 허용하는 엄격한 전화번호 포맷**(N-3.49 **5차 실등록 시도에서
> 실측 확인**)이라 **같은 소스를 재사용할 수 없다.**

→ 그 값은 오타도 임시값도 아니다. **네이버 고시 칸을 위해 «일부러» 넣은 문장**이고
실등록으로 통과가 확인됐다. 🔴 **그러므로 그 칸을 번호로 바꾸면 네이버가 회귀한다.**

## 2. `companyContactNumber` — **실제 번호가 맞다. 그런데 집이 다르다** [확정]

```
저장 위치   SellerProfile(배송 프로필) — Common seller_settings 가 «아니다»
선언된 의미  반품지 연락처            (WIRE-05:23-24)
실제 값      "+821046458306"         (naver/build-payload.ts:151 에 예시가 적혀 있다)
```

🔴 **이미 A/S 번호로 재사용되고 있다** — 두 곳에서:

```
네이버  afterServiceTelephoneNumber ← companyContactNumber   «의도적» (임의 번호를 지어내지 않는다, CPO 지시)
쿠팡    contactNumber ← asContactNumber || companyContactNumber   «폴백»
```

그리고 WIRE-05 가 바로 그 교차를 경고해 뒀다:

> 그 폴백은 «다른 개념» 으로 넘어간다. `companyContactNumber` 는 **반품지 연락처**
> 이고 A/S 연락처가 아니다. … 합치면 고객에게 A/S 번호로 «반품지 번호» 가 나간다.

→ 🟡 **선언과 실제가 이미 갈라져 있다.** 「반품지 번호를 A/S 번호로 써도 되는가」는
아직 판정된 적이 없고, 네이버는 「지어내는 것보다 낫다」로 넘어갔다.

## 3. 저장소 전수 — 네 개념 중 «둘» 만 칸이 있다

| 개념 | 칸 | 위치 |
|---|---|---|
| A/S **안내문** | `asContactNumber` | 🟢 Common `seller_settings` |
| A/S **업체명** | `asCompanyName` | 🟢 Common (068 로 이번에 생김) |
| A/S **전화번호** | **없다** | 🔴 |
| 사업체/반품지 번호 | `companyContactNumber` | 🟡 SellerProfile(배송 프로필) |

공통 설정은 여섯 칸뿐이고(`manufacturer`·`asContactNumber`·`asCompanyName`·
`qualityGuarantee`·`kcExemptionText`·`defaultCountryOfOrigin`), 전화번호 의미의
칸은 그중에 **없다**.

## 4. 세 채널 A/S 의미 대조

```
                 「누가 책임지나」(텍스트)        「어디로 거나」(번호)
네이버   afterServiceDirector ← asContactNumber   afterServiceTelephoneNumber ← companyContactNumber
쿠팡     고시 contactNumber ← asContactNumber || companyContactNumber   (한 칸에 «둘이 섞인다»)
롯데ON   고시 0090 = 「업체명 + 전화번호」를 «한 문자열» 로 요구
         ← asCompanyName + asContactNumber
```

🔴 **네이버만 둘을 갈라 놓았다.** 쿠팡은 한 칸에 섞고, 롯데ON 은 규격이 「둘 다」를
요구하는데 우리는 «안내문» 을 번호 자리에 넣고 있다.

## 5. 🔴 `0090` 의 readiness 판정 — **형식 검증이 «없다»**

```ts
case "0090": {
  const phone = clean(facts.sellerAsContactNumber);
  const company = clean(facts.sellerAsCompanyName);
  if (company && phone) return filled(spec, `${company} / ${phone}`, ...);
```

`validate-payload.ts` 에도 `0090` 관련 검증이 **0건**이다.

→ 판정 기준이 **「비어 있지 않은가」 하나뿐**이다. 그래서 화면이
`🟢 자동 입력` 이라고 말하지만 **그것은 「값이 있다」는 뜻이지 「유효하다」는 뜻이
아니다.** CPO 지적이 맞다 — 지금 구조로는 `INVALID` 를 «표현할 수단 자체가 없다».

## 6. 선택지 — 근거와 함께

```
A. asContactNumber 를 «실제 번호» 로 바꾸고 안내문을 별도 칸으로
   🔴 탈락. 그 칸의 현재 값은 네이버 고시용으로 «실측 통과» 한 문장이다.
      의미를 바꾸면 네이버 afterServiceDirector 가 번호로 바뀐다 — 회귀다.

B. asContactNumber 는 안내문으로 «두고», A/S 전화번호 칸을 Common 에 «추가»
   🟢 근거와 맞는다. 네 개념 중 번호 칸만 없다(§3). 이름도 실제 쓰임에 맞게
      정리할 수 있다(예: asNoticeText / asPhoneNumber).
      🟡 대가: 칸이 하나 더 늘고, 기존 이름(asContactNumber)이 안내문이라는
      사실을 UI 가 말해줘야 한다.

C. companyContactNumber 를 Common 에서 재사용
   🟡 «이미» 그렇게 쓰고 있다(네이버·쿠팡). 그러나 그 칸은 배송 프로필 소속이고
      선언된 의미는 반품지 연락처다. Common 으로 올리면 WIRE-05 가 경고한
      「A/S 번호로 반품지 번호가 나간다」를 «정식 계약» 으로 만드는 셈이다.
      🔴 그 판단은 사업/CS 정책이지 코드가 정할 것이 아니다.
```

**CTO 권장: B + 0090 검증 추가.** 다만 §2 가 보여주듯 C 는 이미 부분적으로 시행
중이므로, B 를 고르면 **네이버·쿠팡의 기존 배선을 건드릴지**도 함께 정해야 한다
(건드리지 않으면 같은 개념이 채널마다 다른 출처를 갖는 상태가 남는다).

## 7. 🔴 그리고 판단이 나기 전까지

`0090` 은 지금 `🟢 자동 입력` 으로 보이지만 **전화번호가 아니다.** 실등록 시
그대로 나간다. 그래서 이번 조사 결과와 무관하게 **LotteON CREATE 는 계속 BLOCKED**
이고, 그 이유 목록에 **`0090 값의 유효성`** 이 하나 더 붙는다.

## 8. 이번 조사에서 하지 «않은» 것

코드 변경 0줄 · migration 0 · UI 0 ·
`companyContactNumber` 를 롯데ON 에 연결 0 ·
「해외 구매대행으로 A/S 불가」를 번호로 전송하는 경로 추가 0 ·
`asContactNumber` 의 의미 변경 0 · 다른 연락처 자동 대체 0.
