# STEP3-FIX — 설정값이 상품 화면에 «닿지 않던» 결함

> CPO Production FAIL 판정(2026-09-28)에 대한 CTO 원인 조사 · 수정 · 증거.
> 검증 축 6개(Render · Data · Payload · Axis · Regression · Failure-path).

---

## 1. 무엇이 잘못됐는가

설정에는 여섯 값이 «다» 저장돼 있었다. 그런데 상품 등록 화면에서는 일부가 빈 칸이었다.
셀러는 빈 칸을 「입력 필요」로 읽는다 — 이미 설정한 값을 상품마다 다시 고르게 되는 자리다.

이 스프린트가 없애려던 바로 그 자리다: **공통에 있는 값을 커머스마다 다시 묻는 것.**

---

## 2. 🔴 CPO 요청 표 — 필드별 실측

측정 방법: jsdom 마운트 후 각 `<input>` 에서 «가장 가까운 라벨» 로 올라가 행을 식별했다.
(라벨에서 내려가면 스코프가 그리드 전체가 되어 여섯 행이 같은 값을 뱉는다 — 조사 중 한 번 당했다.)

| 필드 | Seller Settings 값 | 상품 화면 표시 (수정 전) | 상품 화면 표시 (수정 후) | Payload | 결과 |
|---|---|---|---|---|---|
| 출고지 | `PLO3837441_출고지__Am Holzweg 28-34\|Hessen` | 이름 표시 — **단 autopick 덕분** | 이름 표시 (설정에서) | `outboundPlaceNo` ✅ | 🟢 |
| 반품지 | `PLO3837441_회수지_12921_경기 하남시` | 이름 표시 — **단 autopick 덕분** | 이름 표시 (설정에서) | `returnPlaceNo` ✅ | 🟢 |
| 배송비 정책 | `4279402 / 업체배송_배송비 유료 19800원` | 이름 표시 — **단 autopick 덕분** | 이름 표시 (설정에서) | `deliveryCostPolicyNo` ✅ | 🟢 |
| 배송 가능 지역 | `전국` | 🔴 **빈 칸** | `전국` | `deliveryRegionGroupCode` ✅ | 🟢 |
| 출고 택배사 | `우체국택배` | 🔴 **빈 칸** | `우체국택배` | `courierCode` ✅ | 🟢 |
| 반품 택배사 | `우체국택배` | 🔴 **빈 칸** | `우체국택배` | `returnCourierCode` ✅ | 🟢 |

🔴 표에서 가장 중요한 칸은 **Payload 열이 수정 전에도 전부 ✅ 였다**는 것이다.
값은 처음부터 롯데ON 으로 «가고 있었다». 깨져 있던 것은 화면 하나다.
그래서 이것은 등록 실패가 아니라 **셀러가 이미 끝난 일을 다시 하게 만드는 UX 결함**이다.

### 🔴 위 셋의 🟢 는 «가짜 초록» 이었다

출고지·반품지·배송비정책이 차 있어 보인 이유는 설정에서 와서가 아니다.
후보가 **1건이라 `autoPick` 이 폼을 채웠기** 때문이다.

```
// LotteOnRegistrationPanel.tsx — autopick
if (!form.delivery.outboundPlaceNo && outbound) patch.outboundPlaceNo = outbound.no;
```

`autoPick` 은 「판매자센터 기본 표시」이거나 「후보가 하나뿐」일 때만 고른다.
**출고지가 두 곳인 셀러에게는 이 셋도 똑같이 빈 칸이 된다.** 실제로 후보를 둘로 둔
테스트에서 여섯 칸이 «전부» 비었다. 즉 결함은 셋이 아니라 여섯이었다.

---

## 3. 원인 — 두 겹

CPO 지시대로 `Seller Settings → 저장 → route → props → resolver → form → payload` 를
한 칸씩 따라갔다. 라우트(`/api/settings/lotteon-seller` GET/PUT)와 로더/세이버 컬럼은
여섯 필드 모두 대칭이었고, 값은 화면 컴포넌트까지 «도착해 있었다»(`sellerFixed`).

깨진 곳은 그 다음 한 줄이다.

**① 여섯 칸 중 셋에는 `displayValue` 가 아예 없었다.**
배송 가능 지역 · 출고 택배사 · 반품 택배사. 폼이 비면 칸도 빈다.

**② 있던 셋도 «폼 값만» 봤다.**

```tsx
displayValue={sellerFacingName(
  form.delivery.outboundPlaceNo,                                   // ← 폼만
  liveNameOf(deliverySettings.data?.outboundPlaces, form.delivery.outboundPlaceNo),
  …
)}
```

그런데 payload 는 «사다리» 를 탄다 — `build-context.ts:225`:

```ts
const fixed = (formValue, settingValue) => resolveLotteOnSellerFixedValue(formValue, settingValue).value;
outboundPlaceNo:         fixed(form.outboundPlaceNo, sellerSettings.outboundPlaceNo),
deliveryRegionGroupCode: fixed(form.deliveryRegionGroupCode, sellerSettings.deliveryRegionGroupCode),
courierCode:             fixed(form.courierCode, sellerSettings.courierCode),
```

화면은 폼만, payload 는 폼+설정. 그래서 **「payload 로는 가는데 화면에는 없는」** 상태였다.

---

## 4. 수정 — 화면이 payload 와 «같은 사다리» 를 탄다

```ts
function deliveryFieldDisplay(formValue, settingValue, liveOptions, savedLabel, what): string {
  const code = formValue.trim() || (settingValue ?? "").trim();   // ← payload 의 fixed() 와 같은 순서
  return sellerFacingName(code, liveNameOf(liveOptions, code), savedLabel, what);
}
```

여섯 칸 «전부» 에 적용했다(`grep -c` = 7 = 정의 1 + 호출 6).

무엇을 «하지 않았는지» 가 더 중요하다 — CPO 금지 조항 그대로다.

- ❌ resolver 재설계 — `resolveLotteOnSellerFixedValue` 는 한 줄도 건드리지 않았다.
- ❌ 임의 기본값 — 폼에도 설정에도 없으면 **빈 칸 그대로**다. 값을 만들지 않는다.
- ❌ 배송비 정책 자동 선택 / 배송지역 `전국` 강제 / 택배사 임의 선택 — 없다.
- ❌ 코드 fallback — 이름을 못 찾으면 「택배사 확인 필요」다. `0099` 를 보여주지 않는다.
- ❌ Seller Settings 재작성, CEO 재설정 요청 — 없다.

이 수정은 **읽기 전용**이다. 폼 상태도, 저장값도, payload 도 바뀌지 않는다.
바뀌는 것은 「이미 정해진 값을 셀러에게 보여주는가」 하나다.

---

## 5. 축(Axis) — 표시와 출처를 섞지 않았다

`displayValue` 는 «보여줄 이름» 이고, `form.delivery.X` 는 여전히 폼의 값이다.
설정에서 온 값이 폼으로 «복사되지 않는다» — 셀러가 이 상품에서 다른 택배사를 고르면
그 값이 먼저다(사다리 순서가 payload 와 같으므로 화면과 결과가 갈라지지 않는다).

그리고 「설정값 적용됨」 표시(`SellerSettingApplied`)는 그대로 남아 있다 —
셀러는 **이 값이 어디서 왔는지** 를 계속 구분할 수 있다.

---

## 6. 검증 — `step3fix-settings-reach-screen.test.ts` (14건 통과)

🔴 후보를 «둘씩» 둔다. 1건이면 autopick 이 채워서 「설정에서 온 값」이 아니라
「목록에서 자동으로 고른 값」을 재게 된다. 이 파일이 재려는 것은 앞쪽이다.

| 군 | 검사 |
|---|---|
| 설정만 있고 폼은 빈 상태 | 여섯 칸이 전부 이름을 보여준다 (6건) + 빈 칸이 하나도 없다 (1건) |
| 목록 조회 실패 | 저장된 이름으로 여전히 보인다 (1건) |
| 라벨 없이 «코드만» 저장된 낡은 행 | 목록에서 이름을 찾아 보여준다 (4건) + 목록에 없는 코드는 「확인 필요」, 코드 비노출 (1건) |
| 설정도 폼도 없음 | 여섯 칸이 비고 `0004`·`GN000`·`4279402`·`DV_CO_CD` 가 새지 않는다 (1건) |

### 🔴 음성 대조 — 두 번 했고, 첫 번째는 «내가 틀렸다»

**NC-0(실패한 대조).** 사다리에서 설정값만 뺐더니 **14건이 그대로 통과했다.**
원인은 `sellerFacingName` 이 `liveName || savedLabel` 을 먼저 보기 때문이다 —
저장 라벨이 있는 한 사다리는 화면에 관여하지 않는다.
**즉 그 시점의 테스트는 사다리에 대해 공허했다.** 보고 전에 잡았다.

그래서 사다리«만» 이 구하는 경우를 테스트에 추가했다 — 라벨 컬럼이 생기기 전에
저장돼 **코드만 있고 라벨이 없는 행**. 그 이름은 「설정의 코드 → 조회 목록」 으로만 나온다.

**NC-1.** 사다리에서 설정값 제거 → **5건 FAIL** (라벨 없는 네 행 + 「확인 필요」).
**NC-2.** 새로 붙인 세 칸의 `displayValue` 만 제거 → **9건 FAIL**, 그리고 무너진 것이
정확히 배송 가능 지역 · 택배사 · 반품 택배사 세 행과 그 합계였다.

두 대조 모두 복원 후 14/14 통과를 다시 확인했다.

---

## 6-B. 🔴 회귀가 잡은 것 — S-19 가드 3건 FAIL

전체 회귀에서 `s19-lotteon-no-code-on-screen.test.ts` 3건이 깨졌다. 원인은 동작이
아니라 «모양» 이다. S-19 는 소스 문자열을 검사했다 —

```ts
expect(PANEL).toContain(`liveNameOf(deliverySettings.data?.${list}, form.delivery.${field})`);
```

그 호출이 `deliveryFieldDisplay` 안으로 들어가면서 문자열이 사라졌다.
S-19 가 지키려던 것(「세 칸이 코드가 아니라 이름을 보여준다」)은 그대로다.

가드를 «없애지 않고» 새 모양으로 옮겼다 — 그 행이 살아 있는 목록과 그 폼 필드를
함께 넘기는지를 보고, 「이름을 찾는 한 줄이 헬퍼 안에 있는지」를 한 건 더 본다.
그리고 **「이름이 실제로 그려지는가」는 소스가 아니라 마운트가 잰다**(§6).

**NC-3.** 출고지 행의 살아 있는 목록 인자를 `undefined` 로 바꿨더니 **1건 FAIL** —
새 가드도 공허하지 않다. 복원 후 10/10 통과.

---

## 7. 회귀

| 대상 | 결과 |
|---|---|
| `packages/listing` 전체 | **43 파일 / 557 건 통과** |
| `apps/admin` 전체 (1차) | 🔴 358 파일 중 1 파일 실패 / 4813 건 중 3 건 실패 → §6-B |
| `apps/admin` 전체 (S-19 가드 이전 후) | **358 파일 / 4814 건 전부 통과** |
| `tsc --noEmit` (admin) | exit 0 |
| `next build` | exit 0 |

계약 가드(`rework14-field-parity`, `three-layer-realign`, `commerce-tab-alignment`,
`s15-commerce-neutral-settings`)가 포함된다 — 이 수정이 쿠팡에 없는 UI 를 만들지
않았다는 것은 그 가드가 말한다.

---

## 8. 🔴 남은 사실 — 솔직하게

- 이 검증은 **jsdom 마운트 실측**이다. Production 브라우저 실행이 아니다.
  CPO 가 본 화면과 같은 코드 경로를 같은 입력으로 돌린 것이고, 그 이상은 아니다.
- **CEO 테스트는 요청하지 않는다.** 게이트대로 CPO 2차 검증이 먼저다.
- 이 수정으로 「화면에 안 보이던 값」은 사라졌다. 그러나 **실제로 값이 없는 필드**가
  있다면 여전히 빈 칸이다 — 그것은 결함이 아니라 사실이며, 없는 값을 만들지 않는다.

---

## CTO SELF-VERIFICATION
