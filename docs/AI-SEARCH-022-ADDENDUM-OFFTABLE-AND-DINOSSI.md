# WU-022 부록 — 작업표 밖 2건 처리 · **Dinossi 충돌 해소** (조사만 · 코드 0)

🔴 운영 코드 0 · 하니스 변경 0 · 작업표 변경 **0** · MI 0 · AI API 0 · 키 0 · 결제 ₩0 ·
배포 0. 🟡 실제 HTTP **3회**(후보 페이지 GET · read-only). 🟢 임시 프로브는 **삭제했다**.

🟢 CPO 결정 접수(2026-10-15): ① 측정 표본은 **기존 S1~S6 유지** ② Dinossi 충돌은
**CTO 가 실제 페이지로 확인**.

---

## 1. 받은 2건은 **작업표 밖** 이다 — 참고 관찰로만 기록한다

```
B226TC174 (Bobo Choses Long Sleeve T-Shirt / Midnight Blue)
   → 리포 전수 grep **0건**. 작업표·테스트·문서 어디에도 없다
Smallable Holly Hearts Ribbed Velvet Baby Pants Pale Pink (441173)
   → 리포에 있으나 **다른 하니스** 다 (p56-* 테스트 · MI-GEMINI-CANDIDATE-001-STATE.md)
작업표 S1~S6 (실측)  b226ac010 · b226ac009 · b126ai018 · aw26ms185 · vernice-nero · b226ac117
```

🔴 그래서 이 둘은 **KPI 에 들어가지 않는다**:
```
① 검증기가 `모르는 searchId` 로 **거부** 한다(설계대로다)
② 019A 가 확정한 known-positive 집합이 **없다** → Discovery 분모가 **부재** 다
   🔴 「0%」가 아니라 **분모 없음** 이다
③ 받은 것이 `rawAnswer` **원문이 아니라 요약·판정 텍스트** 다 → ②추출
   (`extractCandidateUrlsFromAiAnswer`)이 원래 AI 가 적은 URL 집합을 **재현할 수 없다**
```

🟢 **작업표를 바꾸지 않았다** — 측정 시작 후 표본을 바꾸는 것이 WU-011 에서 숫자를
전부 무효로 만든 함정이다(§5-B).

### 🟡 그래도 버리지 않는 관찰 셋 (N=1 · 일반화 금지)

```
⒜ 「AI 가 사이트 «이름» 을 말한 것」 ≠ 「그 사이트에서 상품 URL 을 «발견» 한 것」
   예: 「포레포레에서 검색해 보세요」는 **후보 URL 이 아니다**. 추출기가 URL 만 집는 설계가 맞다.
⒝ 모델별 성향 차(보수적 ↔ 넓음)가 관측됐다 — 🔴 **N=1 이라 모델 특성으로 적지 않는다.**
⒞ 「후보 URL 은 있는데 SKU 증거가 없다」(예: KREAM)가 실제로 나왔다 →
   🟢 WU-022 다리의 ⑤fetch·⑥MI·⑦GT 단계가 필요한 이유가 데이터로 확인됐다.
```

---

## 2. 🔴🔴 Dinossi — **CPO 판정이 반증됐다**(실측 · HTTP 3회)

CPO 가 적은 것: 「Dinossi Holly Hearts = **Navy** 색상, Pale Pink 아님」 ·
「추가 해외 동일상품: 현재 **미확인**」.

🔴 **Dinossi 에는 페이지가 «둘» 이고, Pale Pink 쪽이 실재하며 지금도 열린다**:

| URL 꼬리 | status | 추출된 제목 | colorText | brandModelCode |
|---|---|---|---|---|
| `…-acik-pudra-pembe` (터키어 **연한 파우더 핑크**) | 🟢 **OK** | `Louis Louise - Holly Hearts Ribbed Velvet Baby Pants \| **Light Powder Pink**` | 🟢 **"Pink"** | null |
| `…-lacivert` (터키어 **네이비**) | 🟢 OK | `… \| **Navy**` | "Navy" | null |
| smallable NAVY 441172 | 🔴 **UNREACHABLE** | — | — | — |

🔴 **인용된 것은 `lacivert`(네이비) 쪽이다.** `acik-pudra-pembe` 쪽을 보지 않았다.
→ 🔴 **「추가 해외 동일상품 미확인」은 성립하지 않는다.** Pale Pink 페이지가 실재한다.

### 🟢 그리고 이 관측은 헌장의 기존 실측과 **정합한다**

헌장 §12(MI-GEMINI-CANDIDATE-001) 기록:
> 「Dinossi 🟢🟢 **SAME** (0.81) · blockers [] · conflicts [] · reasons: 상품명 5토큰 ·
> 상품군 pants · **색상 PINK** · 소재 cotton:100 · KIDS · 🟢 **품번 없이** SAME 에 닿았다」

🟢 이번 실측이 그 두 전제를 **독립적으로 재확인**했다 — `colorText = "Pink"` ·
`brandModelCode = **null**`(품번 없음). 즉 그 기록은 **이 페이지를 본 것** 으로 보인다.

### 🔴 단정하지 않는 것 셋

```
① 「그래서 SAME 이다」 — 🔴 **이번에 MI 를 재현하지 못했다.** 원상품(Holly Hearts Pale Pink)이
   로컬 덤프(`mi-017-e2e-cases.json`)에 **없어서**(holly 관련 0건) withConfidence 를 못 돌렸다.
   → **측정불가** 다. 헌장의 0.81 은 «당시» 실측이고 이번에 재확인한 것은 **입력 두 축** 뿐이다.
② 「Smallable 이 유일한 동일상품」 — 🔴 기준상품이 **Smallable 441173** 이므로 그것은
   **자기참조** 다. 하니스가 자기참조를 후보에서 뺀다 → 그 표현대로면 외부 후보는 **0건** 이다.
③ 「Smallable Navy 는 UNREACHABLE 이니 없는 상품이다」 — 🔴 아니다. **우리가 못 읽은 것** 이다
   (Smallable fetch 실패는 선행 WU 에서도 관측됐다 · 메모 `smallable-market-is-shipping-destination`).
```

---

## 3. 그래서 지금 상태

```
WU-022 측정 표본   🟢 **S1~S6 유지**(변경 0)
받은 2건           🟡 참고 관찰 — KPI 분모·분자 어디에도 넣지 않는다
rawAnswer          🔴 **0/6** — 원문 수집 대기
Dinossi 충돌        🟢 **해소** — Pale Pink 페이지 실재 확인 · 🔴 SAME 여부는 측정불가
MI 정책·Category/Sourcing  🟢 **변경 0**(이 1건으로 아무것도 바꾸지 않았다)
```

🔴 **다음 수집은 패킷의 S1~S6 URL 로 한다** — `docs/AI-SEARCH-COLLECTION-PACKET-022.md`.
🔴 그리고 **답변 원문 전체**를 넣는다(요약·판정 금지 · §1-③).
