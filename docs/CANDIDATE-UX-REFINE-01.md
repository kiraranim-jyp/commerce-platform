# CANDIDATE-UX-REFINE-01 — 해외 소싱 후보군 UI/UX (CPO GO · 범위 LOCK)

> 🔴 **순수 UI 7건만 한다.** 🔴 조사를 다시 하지 않는다 — owner·칸 이름이 아래에 전부 있다.
> 🔴 착수 전 상태: `2c16152c` · clean · 배포 완료.

## 0. 🔴 동결 목록 (CPO 확정)

```
Identity 전 축 · threshold · SAME_MIN_AXES · matchTruth · priceTier ·
가격 eligibility · 가격 집계 · 가격 owner 배치 · Market Classification ·
AI Search · Search query/provider · Crawl · Registry · transient · snapshot ·
자동 분석 · [다시 분석] · **접힘(mi-022 / WU-136)** · SIMILAR 판정 · candidate cap ·
sellerSku · materialText · P1 AB↔AC · DB schema
```

🟢 `SIMILAR` 미노출은 **`2c16152c` 에서 이미 배포됐다** — 또 건드리지 않는다.

---

## 1. 필수 변경 7건 — owner 와 칸

| # | 변경 | owner (정확한 자리) |
|---|---|---|
| **U1** | 섹션 제목 → **「해외 소싱 후보 N곳」** + 보조 1줄 | `mi-same-candidates.ts` `CANDIDATE_LIST_HEADING` · 소비 `MarketPriceComparison.tsx:1555` |
| **U2** | 그룹 3개에 **보조 설명 1줄** | `CANDIDATE_GROUP_LABEL` 옆에 **신규 상수** 하나(같은 파일) |
| **U3** | 그룹별 제목 + 후보 수 + 여백 | `MarketPriceComparison.tsx` 후보 리스트 블록(`data-testid="mi-candidate-list"` 내부) |
| **U4** | 카드 순서 — **이미지 → 등급 → 가격 → 상품명 → 판매처 → 판단 근거 → 링크** | 같은 블록 |
| **U5** | 가격 강조 · 없으면 **「가격 확인 필요」** | 같은 블록 (`priceAmount` / `priceCurrency`) |
| **U6** | 그룹 라벨 옆 **tooltip 3종** | 신규 상수(같은 파일) |
| **U7** | 빈 상태 문구 | `CANDIDATE_LIST_EMPTY` |

🟢 **그룹 순서(🟢 → 🟡 → 품번충돌)는 이미 그 순서다** — `selectCandidateList` 가 그 순으로 push 한다. 변경 불필요.

### 확정된 글자

```
U1  제목   「해외 소싱 후보」 + 「N곳」
    보조   「원상품과 같거나 같을 가능성이 높은 해외 판매처입니다.」
U2  🟢 동일상품 가능성 높음  — 「상품 정보가 강하게 일치하는 후보입니다.」
    🟡 동일상품 추정         — 「일부 정보가 확인되지 않아 동일상품으로 추정한 후보입니다.」
    🟡 품번 충돌 · 참고      — 「상품 정보는 참고할 가치가 있지만 품번이 달라 별도로 확인해야 하는 후보입니다.」
U6  tooltip 은 위 보조 문장과 같은 뜻으로 짧게
U7  「해외 소싱 후보가 없습니다.」 +
    「현재 확인된 정보만으로는 같은 상품으로 판단할 수 있는 판매처를 찾지 못했습니다.」
```

🔴 「유사상품」·`SIMILAR`·`PRESUMED_SAME`·`POSSIBLE` 같은 **내부 enum 을 글자로 쓰지 않는다**.
🔴 「동일상품」을 **품번 충돌 군에 쓰지 않는다**(`ccl-01` 이 잠근 금지 · 유지).

---

## 2. 🔴 판단 근거 — **새 문장을 만들지 않는다**(CPO 승인된 정정안)

```
✓ 줄  `row.matchReasons` 를 **그대로** 쓴다(운영이 만든 문장 · 현재 slice(0,3))
△ 줄  **blocker 가 실재할 때만** `blocker-text.ts` 의 사람 문장을 쓴다(WU-133 이 만든 owner)
🔴 없는 evidence 로 줄을 만들지 않는다 · 🔴 corePoints·threshold·score·enum 노출 0
```

🔴 이유 — 「무엇이 충족이고 무엇이 미확인인가」를 CTO 가 가르면 그것이 **판정 어휘 생성** 이고
계약 `wu-130 F-4`(그 영역에 판정/집계 어휘 금지)에 걸린다.

---

## 3. 🔴 이번 WU 에서 **빼기로 확정된 것 5건**

```
① 판단 근거 ✓/△ 재작성      → §2 로 축소(기존 문장만 쓴다)
② 국가 표시                  → 🔴 `market` 은 KR/OVERSEAS/UNKNOWN 이고 국가가 아니다
                               ⟹ **통화만**(`priceCurrency`)
③ 국내가격↓후보 영역 «연결»  → 🔴 영역 순서/위치는 WU-140·141-R3 가 확정한 가격 owner
                               배치다 ⟹ **후보 섹션 «안» 의 계층만** 고친다
④ [다시 분석] 우선순위 낮추기 → 🔴 자동 로드가 없는 지금 그 버튼이 **후보로 가는 유일한
                               입구** 다. 낮추면 셀러가 후보를 영영 못 본다 ⟹ 건드리지 않는다
⑤ 「후보 6곳」 단일 숫자      → 🔴 후보 수는 **시장별(🇰🇷/🌎)** 로 센다. 합치면 집계 변경이다
                               ⟹ 현재 구조 유지, 그 블록 «안» 에서 또렷하게
```

---

## 4. 🔴 상품별 분모 — **합계 사용 금지**

```
AW26MS185 (PRODUCT-05)   고유 6 · 공급 6 · **도달 3**
B226AC009 (PRODUCT-02)   고유 21 · 공급 21 · **도달 14**   ← CEO 검증은 이쪽
🔴 **33 은 8상품 합계** 다 — 개별 상품 화면에 절대 쓰지 않는다
```

---

## 5. 테스트 — 갱신될 계약

```
ccl-01-cap-and-label.test.ts   라벨/문구 단언(글자가 바뀌면 여기가 FAIL 한다)
pp-01-possible-conflict.test.ts PP-09 가 화면 글자를 단언한다
cand-01-evidence-visibility.test.ts  군 분류(글자 무관 · 손댈 필요 낮음)
wu-132-mi-same-price-comparison.test.ts  마운트 DOM 축
mi-022                          🔴 **접힘** — 이번에 바꾸지 않으므로 그대로 통과해야 한다
```

🔴 **기존 보호 계약을 이유 없이 완화하지 않는다.** 글자가 바뀌면 **계약의 기대 글자를 갱신**
하되, 금지(「동일상품」·「유사상품」·내부 enum)는 **유지하거나 강화** 한다.

### 반드시 확인할 축

```
SAME → 🟢 · PRESUMED_SAME → 🟡 · 품번충돌 → 🟡 품번 충돌 · 참고 · SIMILAR → **미노출**
이미지 있음/없음 · 가격 있음/없음(후보 유지) · 판단 근거 · 상품별 denominator ·
🔴 다른 상품 후보가 섞이지 않는다 · 🔴 접힘 정책 불변
```

---

## 6. 실행 순서 (다음 세션 · 조사 0)

```
① mi-same-candidates.ts  — U1·U2·U6·U7 상수
② MarketPriceComparison.tsx — U3·U4·U5 (후보 리스트 블록 내부만)
③ 계약 갱신(위 §5) → ④ 전체 회귀 → ⑤ typecheck → ⑥ build → ⑦ commit/push(=배포)
⑧ CEO 화면 캡처 2건 — B226AC009(후보 많음) · AW26MS185(후보 적음)
🔴 그 밖으로 확장하지 않는다. Identity 로 되돌아가지 않는다.
```

🔴 **CEO 확인 경로** — 상품 열기 → 「🔄 다시 분석」 → 📊 시장 판매 판단 →
**「▸ 해외 소싱 후보 N곳」 줄 클릭**(🔴 접힘은 이번에도 유지된다).

---

## 7. 착수 전 좌표

```
HEAD      2c16152c · clean · 0/0 · 배포 완료
직전 WU   IDENTITY-CANDIDATE-VISUAL-REVIEW-01 — SIMILAR 후보군 제외 + 「🟡 품번 충돌 · 참고」
이번 WU   순수 UI 7건 · 운영 파일 **2개 예상**(상수 + 컴포넌트)
다음 WU   자동 분석 + 결과 재사용 + [다시 분석] 제거
          🔴 그것은 **후보 보관 정책**(§12-0 「외부 URL 영구 저장 ❌」 · WU-119 STOP)을
             CPO 가 먼저 풀어야 열린다 — UI WU 가 아니다
```
