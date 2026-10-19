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

## 3. 🔴 **CEO 지적으로 고친 것 — 원상품이 화면에 없었다**

```
🔴 1차 페이지는 후보만 보여주고 원상품을 **설명 문장에만** 적었다.
   육안 비교가 목적인데 **비교 대상이 화면에 없었다** — 내 누락이다.
🟢 **맨 위에 고정(sticky)되는 원상품 패널** 을 넣었다(스크롤해도 보인다):
   Bobo Choses Pop T-shirt · brand Bobo Choses · code **B226AC112** · color offwhite
   · 🔴 가격 **없음**(SHOPIFY_JSON 경로 · WU-079 보류 항목 — 지어내지 않았다)
   · 이미지 🟢 임베드됨
🔴 운영 추출기는 **고치지 않았다** — 검증 화면용으로 facts 를 **읽기만** 했다.
```

## 4. 화면에 적은 것 — **덤프에 있는 값만**

```
샵명 · 상품명 · 이미지 · 브랜드 · 상품코드 · 색상 · 가격 · 시장 ·
crossSellerVerdict · blockers/conflicts · matchReasons · **dropGate**
🔴 priceTier / matchTruth / verified — **애초에 덤프에 없다**(만들지 않았다)
🟢 판정 어휘는 **기존 것 그대로** 쓴다 — 🔴 충돌 · ⚪ 유사 · 🟡 판정 보류
```

🔴 구역 머리에 **「가격비교·동일상품 판정·알림은 전혀 바뀌지 않습니다」** 를 명시했다
(WU-091 ④ 와 같은 원칙).

## 5. 🔴 이미지 11/26 없음 — **차단이 아니라 «없음» 이다**

```
imageUrl 이 **애초에 null** 인 것 **11/11** ⟹ fetch 실패 **0**
   rboutique · stockmann.ee · biskuit.kr · m.luxboy.com · donokids · littleluna ·
   miniboutique · beaumonde · m.web.mustit · stadtlandkind.ch · wconcept
```
🔴 **「판매처가 막는다」로 읽지 않았다**(WU-093 에서 그 오진을 한 번 했다).
🔴 운영 추출 상태 **그대로** 이고 **고치지 않았다**.

## 6. 검증

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

---

# 🔴🔴 CEO 평가 수신 (2026-10-19) — **절반이 측정불가다**

## 집계

```
USEFUL  **2**   ·  NOISE **12**  ·  UNSURE **12**
```

## 🔴🔴 ① UNSURE 12 는 «가치 판단이 아니다» — **전부 이미지 문제** 다

```
UNSURE 12 ↔ 이미지 문제 12   ⟹ **완전히 일치**(교차 확인)
   · imageUrl 이 애초에 null  **11**  (CEO 메모 「이미지 안뜸/안보임」)
   · 이미지는 있었는데 **잘려서 판단 불가** 1 (luksusbaby.kr)
🟢 「이미지 null 인데 UNSURE 가 아닌 곳」 **0** · 「UNSURE 인데 이미지가 있던 곳」 **1**(위 1건)
```

🔴🔴 **그러므로 이 측정의 분모는 26 이 아니라 14 다.**
```
측정 가능  14/26 (53.8%)  →  USEFUL **2** · NOISE 12
측정 불가  12/26 (46.2%)  →  🔴 **0% 로 적지 않는다**(헌장 §5-B)
```

## 🔴🔴 ② USEFUL 2 와 NOISE 2 가 **같은 상품군** 이다 — 기준이 확정되지 않았다

| 평가 | 샵 | 제목 | system |
|---|---|---|---|
| 🔴 **NOISE** | bobochoses.com | Booty Ghosts T-shirt | CONFLICT |
| 🔴 **NOISE** | junioredition.com | Booty Ghosts T-Shirt by Bobo Choses | CONFLICT |
| 🟢 **USEFUL** | eraldo.com | Bobo Choses Booty Ghost-print **Long-sleeve** T-shirt | CONFLICT |
| 🟢 **USEFUL** | kolkid.ca | Bobo Choses Booty Ghosts T-Shirt | CONFLICT |

🔴 `kolkid.ca` 는 `bobochoses.com` 과 **사실상 같은 제목** 인데 평가가 갈렸다.
🔴 `eraldo.com` 은 **Long-sleeve**(긴팔)라 원상품과 더 다른데 USEFUL 이다.
🔴 **CTO 가 이유를 단정하지 않는다** — 「유용함」이 「동일상품」인지 「참고가 된다」인지
   **기준이 글로 정해지지 않았다**(CPO 지시문엔 「실제 비교 후보로 다시 볼 가치」였다).

## 🔴 그래서 **「DROPPED 보존이 가치 있다/없다」를 지금 결론 내릴 수 없다**

```
🔴 분모의 **46%가 비어 있다**(이미지)
🔴 유효 분모 14 안에서도 **USEFUL 2 의 기준이 NOISE 와 충돌** 한다
⟹ 🔴 **이 숫자로 제품 기능 결정을 하지 않는다.**
```

## 🟡 다시 재려면 — 선택지 둘 (🔴 CTO 가 고르지 않았다)

```
⒜ **이미지를 채우고 재측정** — 운영 facts 에 imageUrl 이 없는 11건을 검증 화면용으로만
   `og:image` 로 보충한다(WU-093 에서 원상품에 이미 쓴 방법 · 운영 추출기 변경 0).
   🟢 그러면 분모가 **26 전체** 가 된다.
⒝ **「유용함」의 기준을 한 줄로 고정** — 「동일상품으로 다시 볼 가치」인지
   「같은 브랜드 참고로 볼 가치」인지. 🔴 그것이 없으면 재측정해도 같은 충돌이 난다.
```

🔴 **둘 다 CPO 결정 사안** 이고 CTO 는 구현하지 않았다.

## 🔴 Known Unknowns (평가 수신 후)

```
⑦ 🔴 **「USEFUL」의 정의가 미확정** 이다 — ②의 충돌을 CTO 가 해석하지 않았다
⑧ 🔴 luksusbaby 1건은 이미지가 **있었는데 잘렸다** — `object-fit:contain` 인데도 그랬다면
   원본 이미지 자체가 크롭된 것일 수 있다. **원인 미규명**
⑨ 🔴 NOISE 12 중 **CONFLICT 가 다수** 다 — 시스템 판정과 사람 평가가 **일치한 쪽** 이지만
   표본이 작아 「시스템이 옳았다」로 일반화하지 않는다
⑩ 🔴 이 26건은 **원상품 1개** 기준이다
```

## 판정 — 🔴 **측정 불충분 / 재측정 또는 기준 확정 필요 · 구현 0**
