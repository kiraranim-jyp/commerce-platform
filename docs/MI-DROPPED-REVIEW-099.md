# WU-099 — DROPPED 후보 가치 검증 Review-only 페이지 (운영 변경 0)

> 🔴 CPO 지시 2026-10-19. 「**가치 검증용이며 운영 기능 구현이 아니다.**
> matchLevel 완화 ❌ · threshold ❌ · 8축 ❌ · **priceTier 생성 ❌** · **matchTruth 생성 ❌** ·
> MI 전달 ❌ · price_alerts ❌ · JUDGED 경로 변경 ❌ · 운영 가격비교 UI 변경 ❌」

---

# WU-099 FINAL — **CEO 평가 대기**

## 📍 검증 URL
**https://claude.ai/code/artifact/5249e23c-ce08-4afd-891f-0cb977453335**
로그인 불필요 · 자립형(원격 이미지 **0**).

## 1. Scope — 운영 파일 **0**

```
🟢 추가: 덤프 하니스 1(`__tests__`) · 생성기 1(`scripts/`) · 생성된 HTML 1(`docs/`)
🔴 운영 코드 변경 **0** · 배포 **0** · MI 전달 **0** · UI 본편 **0** · DB 0 · API 0
🔴 금지 어휘 대조 — 생성물에 `priceTier` **0** · `matchTruth` **0** (grep)
```

🔴 **운영 가격비교 경로와 «완전히» 분리돼 있다** — 이 페이지는 `computeMarketIntelligence`
에 아무것도 넘기지 않는다. 덤프는 **읽기만** 한다.

## 2. 대상 — 운영 `judgeDomesticCandidate` 의 `DROPPED` **샵당 top 1건**

```
DROPPED 샵 **26** · JUDGED 4
crossSellerVerdict — **CONFLICT 16 · SIMILAR 8 · UNKNOWN 2**
dropGate — **EVIDENCE_NOT_WORTHWHILE 26/26** (🔴 `NOT_MATCHED` 은 0건)
```
🟢 보존 범위가 **샵당 1건** 이므로 `DomesticJudgement` **계약 변경 0**(WU-098 §5 선택지 중 앞쪽).

## 3. 화면에 적은 것 — **덤프에 있는 값만**

```
샵명 · 상품명 · 이미지 · 브랜드 · 상품코드 · 색상 · 가격 · 시장 ·
crossSellerVerdict · blockers/conflicts · matchReasons · **dropGate**
🔴 priceTier / matchTruth / verified — **애초에 덤프에 없다**(만들지 않았다)
🟢 판정 어휘는 **기존 것 그대로** 쓴다 — 🔴 충돌 · ⚪ 유사 · 🟡 판정 보류
```

🔴 구역 머리에 **「가격비교·동일상품 판정·알림은 전혀 바뀌지 않습니다」** 를 명시했다
(WU-091 ④ 와 같은 원칙).

## 4. 🔴 이미지 11/26 없음 — **차단이 아니라 «없음» 이다**

```
imageUrl 이 **애초에 null** 인 것 **11/11** ⟹ fetch 실패 **0**
   rboutique · stockmann.ee · biskuit.kr · m.luxboy.com · donokids · littleluna ·
   miniboutique · beaumonde · m.web.mustit · stadtlandkind.ch · wconcept
```
🔴 **「판매처가 막는다」로 읽지 않았다**(WU-093 에서 그 오진을 한 번 했다).
🔴 운영 추출 상태 **그대로** 이고 **고치지 않았다**.

## 5. 검증

```
typecheck **0**(🔴 한때 1 — `reduce` 누적 타입 미명시 · 이 트랙 반복)
apps/admin **600 files / 8,367 passed** · failed **0** · build **exit 0**
생성물 구조 — 카드 **26** · 평가 버튼 **78**(26×3) · 메모 26 · 원격 이미지 **0**
```

---

## 🔴 Known Unknowns

```
① 🔴 **가치는 CEO 가 판정한다** — CTO 는 「유용해 보인다」를 한 줄도 적지 않았다
② 🔴 표본은 **원상품 1개 · AI 산출 1덩어리** 다. 전수가 아니다
③ 🔴 **샵당 top 1건** 만 본다 — 같은 샵의 2번째 이하 후보가 더 나을 가능성은 **미측정**
④ 🔴 `dropGate` 가 **전건 `EVIDENCE_NOT_WORTHWHILE`** 이라 `NOT_MATCHED` 모양은 **미측정**
⑤ 🔴 이미지 없는 11건은 **사진 없이** 판단해야 한다 — CEO 가 링크를 열어야 한다
⑥ 🔴 평가는 **화면 state** 에만 산다 ⟹ **[결과 복사]** 를 눌러야 보존된다
```

## 판정 — 🟢 **구축 완료 / 운영 변경 0 · CEO 평가 1회 대기**

---

## CEO Action — **평가 1회 (26건)**

```
① https://claude.ai/code/artifact/5249e23c-ce08-4afd-891f-0cb977453335 를 엽니다
② 각 후보가 **원상품(Bobo Choses Pop T-shirt · B226AC112)** 의 비교 후보로
   **다시 볼 가치가 있는지** 봅니다
③ [🟢 유용함] / [🔴 불필요] / [🟡 판단 어려움] 중 하나
④ 맨 아래 **[결과 복사]** → 붙여넣어 주십시오

🔴 미리 알려 드리는 «정상» 셋
   · 사진이 없는 것이 11건 — **우리가 수집하지 못한 것** 이고 차단이 아닙니다
   · 상품코드·색상이 「없음」 — 지금 측정 중인 상태입니다
   · 대부분이 🔴 충돌 로 표시됩니다 — **그것이 이 WU 가 묻는 바로 그 질문** 입니다
🔴 이 화면에서 무엇을 누르셔도 **가격비교·판정·알림은 바뀌지 않습니다**
```
