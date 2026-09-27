# TTAEJYO 개발 완료 프로세스 — 고정 게이트

> CPO 확정 2026-09-28. **이 문서가 「완료」의 정의다.** 스프린트마다 다시 정하지 않는다.

## 0. 역할과 순서

| 역할 | 담당 |
|---|---|
| CEO | 최종 의사결정 · 최종 Production 사용자 테스트 |
| **CPO** | 제품 기준 수립 · **CTO 결과 2차 검증** · CEO 테스트 승인 |
| CTO | 개발 · 1차 검증 · 증거 패키지 · 배포 |

```
CTO 개발 → CTO 1차 검증 → CTO 증거 패키지 → ★ CPO 2차 검증
   → 🟢 CPO PRE-CHECK PASS → CEO 보고 → CEO 최종 Production 테스트
```

🔴 **CTO → CEO 직행 금지.** CPO 판정(🟢 PASS / 🟡 REWORK / 🔴 BLOCK) 없이
CEO 에게 「테스트해 주세요」라고 하지 않는다.

---

## 1. 🔴 품질 기준 — 소스 PASS ≠ Render PASS

2026-09-28 S-24 에서 실증됐다. 계약/소스 검사가 **전부 통과한 채로** 실제 화면에는:

```
PLO3837441 · PLO3837441_R · 4279402 · GN101   코드가 그대로 떴다
택배사 / 반품 택배사                            컨트롤만 사라진 «빈 칸» 이었다
not.toContain                                 빈 DOM 에서도 저절로 통과했다
```

따라서 화면 주장은 **마운트한 DOM** 으로만 한다.

### Failure-path 검증을 함께 한다

```
정상 코드 → PASS
버그 복원 → FAIL   ← 이것을 보지 못하면 통과에 의미가 없다
수정      → PASS
```

`not.toContain` 앞에는 「그려졌는가」를 먼저 세운다.

---

## 2. CTO 증거 패키지 — 6축

| 축 | 무엇을 본다 |
|---|---|
| **A. Render** | 실제 화면 + 실제 데이터 + 실제 상태. 「test PASS」만으로는 안 된다 |
| **B. Data** | 입력/설정 → 저장 → DB → 조회 → UI. 가능하면 save → reload 까지 |
| **C. Payload** | Common → Channel Mapping → Commerce UI → Payload 가 끊기지 않는가 |
| **D. Axis** | 다른 의미를 같은 것으로 취급하지 않았는가 |
| **E. Regression** | 관련 테스트 · 전체 테스트 · typecheck · build · 배포 상태 |
| **F. Failure-path** | 위 §1 의 3단 (정상 → 의도적 실패 → 수정 → 재통과) 최소 1건 |

### D. Axis — 섞으면 안 되는 쌍

```
브랜드            ≠  판매처
상품 원본 재고     ≠  경쟁상품(MI) 재고
Common 출고지     ≠  LotteON 출고지 ID
설정값            ≠  목록에서 «우연히» 자동 선택된 값
국제배송비         ≠  Commerce 고객배송비
제조사            ≠  수입사  ≠  판매자
```

---

## 3. CTO 완료 보고 양식 (15절)

```
[CTO FINAL VERIFICATION]
 1. Scope                     9. Typecheck
 2. 변경사항                  10. Build
 3. Render Evidence          11. Production Deploy
 4. Data Evidence            12. Actual Production API
 5. Payload Evidence         13. Known Unknowns
 6. Axis Check               14. Evidence Links / Screenshots
 7. Failure-path Verification 15. Commit
 8. Regression
```

마지막에 반드시 `CTO SELF-VERIFICATION 🟢 PASS` 또는 `🟡 PARTIAL`.

🔴 **CTO 가 🟢 라고 썼다고 CPO 가 자동 승인하지 않는다.**

---

## 4. CPO 2차 검증 8단계

```
① CTO MD 검토              ⑤ 코드/계약과 Render 결과 대조
② 실제 캡처 검토            ⑥ 실패 시나리오 확인
③ 테스트 결과 검토          ⑦ 미검증 항목 확인
④ 테스트가 공허하지 않은지   ⑧ Production 배포 확인
```

→ `🟢 CPO PRE-CHECK PASS` · `🟡 CPO REWORK` · `🔴 CPO BLOCK`

---

## 5. CTO 금지사항

```
❌ CEO 에게 중간 테스트 요청 (「대표님 한번 확인해주세요」)
❌ 코드만 보고 UI PASS
❌ 계약 테스트만 보고 Render PASS
❌ 빈 DOM 에서 통과하는 negative assertion
❌ 내부 코드가 보이는데 「기능상 문제 없음」
❌ API 응답을 못 봤는데 추정해서 구현
❌ 미검증 사항을 PASS 로 표현
❌ Production 배포 후 바로 CEO 에게 전달
```

---

## 6. 외부 API 자격증명이 없을 때

숨기지 않고 **분리해서 적는다.**

```
개발 검증 → API 호출 «직전» 까지 CTO 검증 → CPO 검증
          → 🟡 외부 API 실제 호출만 미검증
```

🔴 호출이 가능한 환경이면 CTO 가 **먼저 직접 호출하고** 결과를 증거로 낸다.

---

## 7. 결함을 발견했을 때 (S-24 표준 흐름)

```
문제 발견 → 재현 → 원인 확인 → 최소 수정 → 해당 테스트
         → Regression → Render → Build → Deploy → 증거 갱신
```

🔴 **발견한 문제를 숨기지 않는다.** S-24 에서 「소스 PASS → 실제 DOM FAIL」을
찾아냈기 때문에 최종 품질이 올라갔다.

---

## 8. 전략 우선순위 (현재)

```
① 아동의류 → ② SmartStore/Coupang/LotteON → ③ 3채널 공통 Seller UX 안정화
→ ④ 실제 판매자 피드백 → ⑤ 필요한 부분만 MI/Common/Commerce 개선
→ ⑥ 다음 카테고리 → ⑦ 다음 Commerce
```

지금 목표는 **새 Commerce 를 늘리는 것이 아니다.**

```
                 PRODUCT
          ┌─────────┴─────────┐
   Common Information      MI/Pricing
          │
   Commerce Adapter
    ┌─────┼─────┐
 SmartStore Coupang LotteON  →  Payload
```

Commerce 가 20~30개로 늘어도 **셀러가 20~30개의 설정 화면을 관리하지 않게 한다.**
새 Commerce = Common 재사용 최대화 + 채널 고유만 Adapter/Mapping +
정말 필요한 것만 Seller 입력.

---

## 9. Cleanup backlog

```
🔴 Vercel `__tests__` / tests-silk-delta.vercel.app
   CEO 최종 테스트 → 정상 확인 → 별도 Cleanup 에서만 처리
   (존재 확인 → Production 연결 없음 확인 → 환경변수 0 확인
    → 잘못된 배포 1건인지 확인 → 삭제)
   CTO 가 «지금» 임의로 지우지 않는다.
```
