# CTO FINAL VERIFICATION — F2 / F4 / F6 수정 스프린트

> 🔴 CPO 2차 검증 **BLOCK** 에 대한 수정. 15절 양식([TTAEJYO-VERIFICATION-GATE.md](TTAEJYO-VERIFICATION-GATE.md) §3)으로 처음부터 썼다.
> 이전 검증 대상 `d4d548a` 는 **종료**한다.

---

## 1. Scope

```
F2  🔴 BLOCK   저장 실패 상태 정합성 — 화면이 서버보다 앞서 가지 않는다
F4  🟡 Gap     「설정값 적용됨」을 Seller Settings mapping 성공에만 귀속
F6  🟡 Gap     0/6 · 3/6 · 6/6 부분 설정을 영구 계약으로
```

범위 밖(손대지 않음): LotteON 신규 기능 · 150/166/89 추정 구현 · 새 배송 옵션 ·
SmartStore/Coupang 리팩터링 · MI · Common 구조 개편 · `__tests__` Vercel 프로젝트.

## 2. 변경사항

| | |
|---|---|
| 코드 | `settings/LotteOnDeliveryMapping.tsx` **1개 파일만** |
| 신규 테스트 | `settings/__tests__/f2-save-failure.test.ts` (9건) |
| 신규 테스트 | `commerce/__tests__/f4-f6-setting-attribution.test.ts` (7건) |

🔴 **F4·F6 은 코드를 고치지 않았다.** 재현 결과 화면이 이미 정확히 동작했다 —
없던 것은 동작이 아니라 **그것을 지키는 계약**이었다. 범위를 넘지 않았다.

### F2 가 무엇이었나

```js
// 전
setSaved(next);                    // ← 서버에 묻기 «전에» 확정
const res = await fetch(PUT);
setMessage(res.ok ? "저장했습니다" : "저장하지 못했습니다");

// 후
setPending(patch);                 // 고른 것은 보여주되 «확정이 아니다»
const res = await fetch(PUT);
if (!res.ok) throw;
setSaved({ ...saved, ...patch });  // ← 서버가 확인해 준 뒤에만
```

한 줄이 말하는 상태를 넷으로 갈랐다 — `저장 중…` / `저장하지 못했습니다 + 다시 시도` /
`✓ 연결됨 · 이름` / `연결 필요`. 🔴 조회 실패를 「선택 안 함」으로 위장하지 않는
규칙과 **같은 모양** 이다. 조회 쪽만 지키고 저장 쪽은 안 지키고 있었다.

## 3. Render Evidence

```
F2 ① 저장 성공   ✓ 연결됨 + 이름 · 서버에도 그 값 · 나머지 5칸 「연결 필요」   PASS
F2 ② 저장 실패   🔴 ✓ 연결됨이 «서지 않는다»                                PASS
                 「저장하지 못했습니다」 + 「다시 시도」 버튼 실재            PASS
                 다시 열었을 때와 «같은 말» (before === after === false)     PASS
                 다시 시도 → 같은 값으로 재전송(PUT 2회) · 여전히 연결됨 없음 PASS
F2 ③ 실패 후 성공 같은 화면에서 재시도 → ✓ 연결됨 + 서버 반영              PASS

F4 설정없음+후보1건  「설정값 적용됨」 0줄 · 글자로도 없음                   PASS
   🔴 그래도 빈 칸이 아니다 — autopick 값은 「Hessen 물류센터」로 보인다     PASS
F6 0/6 → 0 · 3/6 → 정확히 3 · 6/6 → 6                                      PASS
   미설정 칸의 후보 버튼(PLO_R) 살아 있음 — 등록할 길이 남는다              PASS
   세 상태 «전부» 에서 내부 코드 0건                                        PASS
```

## 4. Data Evidence

```
UI 선택 → PUT → 서버 → 다시 열기 → 같은 값        PASS (F2 ①·②-4)
저장 실패 시 서버 = {}  그리고 화면도 「연결 필요」  PASS
```

🔴 **핵심은 「저장됐다」가 아니라 「화면이 말하는 것 = 서버가 가진 것」 이다.**

## 5. Payload Evidence

배송 6칸 각각 독립. **이번 변경은 payload 경로를 건드리지 않았다** —
`build-context` 사다리와 `build-payload` 6/6 은 그대로다(변경 파일 §2 참조).

## 6. Axis Check

| 축 | 이번에 실제로 가른 것 |
|---|---|
| **화면 표시 ≠ 서버 상태** | F2 의 본체. 낙관적 확정이 이 둘을 갈라놓고 있었다 |
| **설정값 ≠ autopick 값** | F4. 후보 1건 fixture 로 autopick 을 «발동시킨 채» 0줄을 확인 |
| **설정값 ≠ 폼에 값이 있음** | 「적용됨」은 `form 비어 있음 && sellerFixed 있음` 에만 붙는다 |
| 적용됨 표시 ≠ Payload 존재 | S-24 에서 갈랐다. 이번에도 섞지 않았다 |

## 7. Failure-path Verification — 🔴 여기서 내 가드가 «공허했다»

```
① 수정 후 14건 통과
② 옛 버그 복원(`setSaved` 를 PUT 전에)  →  🔴 7건이 «그대로 통과했다»
```

**가드가 버그를 못 잡았다.** 화면이 `failed` 분기를 먼저 보기 때문에 초록 체크가
어차피 가려졌다 — 내 검사 다섯은 «표시» 만 보고 «상태 오염» 은 보지 못했다.

### 그래서 F2 의 진짜 피해를 찾았다

`saved` 가 실패한 값으로 더럽혀지면, PUT 본문이 `{...saved, ...patch}` 이므로
**셀러가 «다른 칸» 을 저장하는 순간 실패했던 값이 조용히 함께 서버로 간다.**

```
출고지 저장 실패      서버 {}
  ↓
택배사 저장 성공      서버에 courierCode=EP  … 그리고 outboundPlaceNo=PLO3837441
                                              🔴 셀러가 확정한 적 없는 출고지
```

가드 2건을 추가하고 다시 대조했다.

```
버그 복원  →  ×  expected 'PLO3837441' to be null
              ×  expected 4 to be 5  (연결 필요 개수가 하나 줄었다)
수정 복귀  →  16건 통과
```

🔴 **보고 정정:** 제가 CPO 께 올린 F2 피해 설명(「표시만 틀린다」)은 **불완전했다.**
실제로는 **다른 필드 저장 시 데이터가 오염된다.** 음성 대조를 하지 않았으면
이것을 모른 채 「고쳤다」고 할 뻔했다.

## 8. Regression

```
admin       351 파일 / 4,716건   PASS   (F2 9건 + F4/F6 7건 추가)
listing 530 · pricing 538 · shared 133 · marketplace 42   PASS
```
🔴 SmartStore/Coupang 등록 로직 · Common · MI **미변경.**

## 9. Typecheck   admin 0

## 10. Build   `next build` 성공 (22.0s)

## 11. Production Deploy

```
deploy   ttaejyo-kx3w87rq0… ● READY (Production)
alias    ttaejyo.vercel.app 200 · commerce-platform-mocha.vercel.app 200
🔴 repo 루트에서 실행했다(지난번 __tests__ 사고 재발 방지 — 실행 전 위치 확인)
```

## 12. Actual Production API

🟡 **EXTERNAL-BLOCKER** — 자격증명이 로컬에 없다. 변함없다.

## 13. Known Unknowns

```
① 롯데ON 실제 등록 호출        자격증명 없음
② 150/166/89 실응답            본 적 없음 — 그래서 코드를 추정하지 않는다
③ Production 재고 0 상품 건수   DB 접근 불가
```

## 14. Evidence Links

```
settings/__tests__/f2-save-failure.test.ts               9건
commerce/__tests__/f4-f6-setting-attribution.test.ts     7건
settings/__tests__/final-mapping-render.test.ts         11건 (S-24, 유지)
commerce/__tests__/s24-delivery-collapse-render.test.ts  6건 (S-24, 유지)
```

## 15. Commit

```
bc03bd3   코드 + 가드 16건 + 이 문서   ← 🔴 새 검증 대상
d4d548a   이전 검증 대상 — 종료
```

---

## CTO SELF-VERIFICATION — 🟡 PARTIAL

F2/F4/F6 · Render · Data · Axis · Failure-path · Regression · Build 는 🟢.
**§12 외부 API 실호출이 🟡** 이므로 전체를 🟢 로 쓰지 않는다.

🔴 CEO 에게 보고하지 않는다. **CPO 2차 검증을 다시 받는다.**
