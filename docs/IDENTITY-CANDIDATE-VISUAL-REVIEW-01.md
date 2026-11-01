# IDENTITY-CANDIDATE-VISUAL-REVIEW-01 — 🔴 **STOP: 지시 내부 충돌 1건 (구현 0)**

> 🔴 운영 코드 변경 **0** · 배포 **0** · 판정 엔진 **0**. 이 문서는 **CPO 판정 1건** 을 올린다.
> 🟢 그리고 **CEO 는 지금 바로 육안 검증을 할 수 있다** — 요구한 화면이 **이미 배포돼 있다**.

---

## 1. 🟢🟢 먼저 — CPO 가 요구한 화면은 **이미 있다**(새로 만들 것이 없다)

직전 WU `CANDIDATE-CAP-AND-LABEL-01` 이 이미 배포했고 **글자까지 요구와 같다**:

```
mi-same-candidates.ts  CANDIDATE_GROUP_LABEL
  LIKELY   → "🟢 동일상품 가능성 높음"     ← CPO §1 과 글자 동일
  PRESUMED → "🟡 동일상품 추정"            ← CPO §1 과 글자 동일
  POSSIBLE → "🟡 유사상품 · 참고"
CANDIDATE_LIST_HEADING = "동일상품 가능성이 있는 후보"
```

| CPO 요구(§4·§5·§6) | 현재 상태 |
|---|---|
| 상품 이미지 | 🟢 `imageUrl` 렌더 · 없으면 `IMAGE_MISSING_TEXT = "이미지 없음"` |
| 🔴 대체 사진 금지 | 🟢 **계약으로 잠겨 있다**(「다른 상품 사진을 쓰지 않는다」) |
| 판정 이유 툴팁 | 🟢 `JUDGEMENT_BASIS_LABEL = "판단 근거 보기"` + `matchReasons.slice(0,3)` |
| 🔴 내부 점수 비노출 | 🟢 `matchReasons`(사람 문장)만 쓴다 · tier/score 글자 **0** |
| 🔴 evidence 없는 이유 생성 금지 | 🟢 `matchReasons` 가 비면 **아무 줄도 안 만든다** |
| 상품명·판매처·시장·URL·가격 | 🟢 전부 있다 · 가격 없으면 「가격 확인 필요」 |
| 등급은 운영 owner 가 낸다 | 🟢 `transientDisplayTier` — 복제 계산 **0** |

🔴 ⟹ **§4·§5·§6·§8·§10 은 구현할 것이 없다.** 실제 남은 변경은 **§1 의 「POSSIBLE 제외」 하나** 다.

---

## 2. 🔴🔴🔴 그 하나가 **CPO 지시 §1 ↔ §11 을 충돌시킨다** (실측)

`POSSIBLE` 그룹에 들어온 후보 **전수 3건**(Step 3·4 실데이터 · 도달 33 중):

| CEO GT | 상품 | 후보 | verdict | conflicts | 가격 |
|---|---|---|---|---|---|
| 🟢 **SAME** | P-02 | cemarose.ca | `CONFLICT` | `MODEL_CODE` | **CAD 56** |
| 🟢 **SAME** | P-03 | bobochoses.com | `CONFLICT` | `MODEL_CODE` | **EUR 35** |
| 🔴 DIFFERENT | P-03 | tinyapple.net | `CONFLICT` | `MODEL_CODE` | USD 53 |

```
CPO §1   「후보 리스트 = SAME + PRESUMED_SAME」      ⟹ 이 3건을 **제외** 해야 한다
CPO §11  「가격이 있는 SAME 후보가 화면에서 사라지면 **FAIL** 이다」
⟹ 🔴 제외하면 **가격까지 있는 CEO SAME 2건이 화면에서 사라진다** = §11 FAIL
```

### 🟢🟢 그리고 결정적인 사실 — **이 분모에서 `SIMILAR` 는 0건이다**

```
POSSIBLE 3건의 내역 — SIMILAR + Evidence **0건** ·
                      품번만 충돌한 참고 후보(isModelCodeOnlyReference) **3건**
```

🔴 즉 CPO §1 이 막으려는 것(**🟠 유사상품 섞임**)은 **이미 0** 이다.
⟹ 🔴🔴 **코드를 바꾸면 §1 의 목적은 0 만큼 개선되고 §11 의 FAIL 을 2건 만든다.**
🟢 그래서 **구현하지 않고 올린다**(헌장 §3 STOP — 「정책 결정 필요」).

### 🔴 그 2건이 하필 Step 5 의 **P1 바로 그것** 이다

```
cemarose.ca    B226AC009 ↔ B226AB040   🟡 AC ↔ AB 라인 차이
bobochoses.com B226AC010 ↔ B226AB046   🟡 AC ↔ AB 라인 차이
tinyapple.net  B226AC010 ↔ B226AC141   🔴 AC ↔ AC (CEO DIFFERENT)
```

🟢 Step 5 가 **라인 차이(AC↔AB)는 CEO SAME 4/4 · 같은 라인(AC↔AC)은 DIFFERENT 2/2** 로
측정한 그 축이다. ⟹ 🔴 **POSSIBLE 을 지우면 P1 의 근거 후보를 CEO 가 화면에서 못 본다** —
이번 WU 의 목적(「CEO 가 사진을 보고 다시 판단한다」)과 **정면으로 반대** 다.

---

## 3. 🟡 CPO 판정 1건 — 선택지 셋 (🔴 CTO 가 고르지 않았다)

| | 선택지 | 효과(실측) | 위험 |
|---|---|---|---|
| ⒜ | **현상 유지**(POSSIBLE 그대로 둔다) | 🟢 유사상품 섞임 **이미 0** · CEO SAME 2건 **보인다** | 🔴 나중에 `SIMILAR` 가 생기면 섞인다(이 분모엔 0) |
| ⒝ | **`SIMILAR` 만 제외**(품번참고는 남긴다) | 🟢 §1 목적 달성 · §11 도 지킨다 · 이 분모 변화 **0건** | 🟡 코드 1줄 + 계약 갱신 · `CANDIDATE-POSSIBLE-CONFLICT-01` 은 **보존** |
| ⒞ | **POSSIBLE 전체 제외**(글자 그대로) | 🔴 CEO SAME **2건 소실**(가격 보유) | 🔴🔴 **§11 FAIL** · P1 근거를 CEO 가 못 본다 |

🟢 **CTO 권고는 ⒝** 다 — §1 의 **목적**(유사상품 섞임 방지)을 지키면서 §11 을 깨지 않는다.
🔴 그러나 ⒝ 도 `CANDIDATE-POSSIBLE-CONFLICT-01`(품번만 충돌한 후보를 «참고»로 살린 WU)의
범위를 건드리므로 **CPO 가 정한다.**

---

## 4. 🟢 CEO 가 **지금** 볼 수 있는 화면 (코드 변경 없이)

CPO §9 의 A~E 를 **현재 배포 상태로** 확인할 수 있다. 실측 분포(도달 33 · Step 4):

```
🟢 LIKELY    12   — CEO SAME 11 · GT 상충 1              (CEO DIFFERENT **0** 🟢)
🟡 PRESUMED  14   — CEO SAME 8 · DIFFERENT 5 · GT 상충 1
🟡 POSSIBLE   3   — CEO SAME 2 · DIFFERENT 1
표시 안 됨    4   — CEO SAME 2 · DIFFERENT 2
🟠 SIMILAR    **0**   ⟹ 🟢 「쓸데없는 유사상품이 많다」(CPO §9-C)는 이 분모에서 **발생하지 않는다**
가격 보유     🟢 12 중 … · 🟡 … (상세는 STEP4-TABLE.md)
이미지 보유   A 55 / 70(Step 4 ① 표) · 없으면 「이미지 없음」
```

🟢🟢 **§9-A 의 답이 이미 측정돼 있다** — 🟢 군에 **CEO DIFFERENT 가 0건** 이다.
🟡 **§9-B 는 CEO 눈이 필요하다** — 🟡 군 14건 중 CEO DIFFERENT 가 **5건** 섞여 있다.
🔴 그 5건이 「내가 봐도 같을 수 있다」인지 「유사상품인데 올라왔다」인지는 **CEO 판단** 이다.

### CEO 확인 경로 (🔴 그냥 열면 후보가 안 뜬다)

```
/pipeline → 상품 → 🔴 **「🔄 다시 분석」을 누른다**
   (재진입은 `/check` 를 돌리지 않아 rows=null 이다 · CORE-E2E-CLOSE-05 가 확정한 모양)
→ 📊 시장 판매 판단 → 「동일상품 가능성이 있는 후보」
🟢 CTO 추천 대상 — `Bubble Sweatshirt in Grey Melange by Main Story`(sku `AW26MS185`)
   운영 스냅샷 **있다** · 🔴 B226AC010 은 운영 스냅샷이 **없다**(열 수 없다)
```

---

## 5. 🔴 §11 경로 검증 — **지금 끊긴 곳이 있다**(코드 변경 없이 측정됨)

```
Identity 결과 → Candidate rows → Display selector → Candidate UI
```

🔴 **표시 안 됨 4건 중 CEO SAME 2건** 이 있고 사유가 갈린다(Step 4 §5-7 실측):

```
bobochoses.com (P-02) CEO SAME · `CONFLICT` / tier **EXCLUDED**   ⟹ tier 로 제외
donokids.com   (P-02) CEO SAME · `COMPARISON` · 🔴 **market UNKNOWN**
                      ⟹ 🇰🇷/🌎 어느 블록에도 안 든다(WU-140 ⒟ 가 적어 둔 그 모양)
```

🔴 **「가격이 있는 SAME 이 사라지면 FAIL」 기준으로 보면 `donokids.com` 이 그 모양이다** —
가격이 있고(`VERIFIED_CURRENT`) CEO SAME 인데 **시장 미확정** 이라 두 블록 어디에도 서지 않는다.
🔴 **고치지 않았다** — 시장 분류는 보호 계약이고(`classifyCandidateMarket` · WU-020)
이번 WU 금지 목록의 범위를 넘는다. 🟡 **CPO 판정 사안으로 올린다.**

---

## 6. 이번 WU 가 **하지 않은** 것

```
threshold 0 · SAME_MIN_AXES 0 · 새 점수축 0 · 모델코드 정책 0 · AB↔AC 예외 0 ·
sellerSku 0 · materialText 0 · Search provider/query 0 · 가격 eligibility 0 ·
Registry 0 · SIMILAR→SAME 승격 0 · UNKNOWN→후보 승격 0 · 새 대시보드 0 ·
🔴 **운영 코드 한 줄도 바꾸지 않았다** · 배포 0
```

---

## 6-B. 🟡 CPO ⒝ 구현 — **패치로 보존하고 clean 으로 넘겼다**(§4-C 용량 판단)

```
패치  docs/identity-gt-master/ICVR-01-similar-filter.patch   (git apply 로 복원)
적용  git apply docs/identity-gt-master/ICVR-01-similar-filter.patch
🔴 작업트리에는 **적용하지 않았다** — 남은 계약 4건 + 전체 회귀 + build 를 이 세션에서
   안전하게 끝낼 수 없었다(「작업트리를 더럽힌 채 끊기는 것이 가장 나쁘다」).
🟢🟢 **대가가 0 이다** — 이 분모에서 `SIMILAR` 가 **0건** 이라 그 필터는 **화면을 한 픽셀도
   바꾸지 않는다** ⟹ **CEO 육안 검증은 지금 그대로 가능하다**.
```

### 패치가 담고 있는 것 (검증된 부분)

```
① mi-same-candidates.ts  POSSIBLE_TIERS: ["SIMILAR"] → **[]**
   🟢 `isModelCodeOnlyReference` 분기는 **그대로**(CANDIDATE-POSSIBLE-CONFLICT-01 보존)
② 같은 파일  CANDIDATE_GROUP_LABEL.POSSIBLE
   「🟡 유사상품 · 참고」 → **「🟡 품번 충돌 · 참고」**
   🔴 왜 라벨도 바꿨는가 — `SIMILAR` 를 빼면 그 군에 남는 것은 **품번만 충돌한 참고
      후보** 뿐이고, 그 자리에 **CEO SAME 2건(가격 보유)** 이 있다. 「유사상품」이라
      적으면 **이번 WU 의 목적(CEO 육안 재판단)을 망가뜨린다**. 🟢 CPO 문장을 그대로 썼다.
   🔴 「동일상품」은 넣지 않았다 — `ccl-01` 의 그 금지를 **풀지 않았다**
③ 계약 갱신 — `ccl-01` D·F·H·J · `pp-01` PP-01·PP-08·PP-09
   🟢 느슨하게 하지 않고 **뒤집고 강화** 했다(「유사상품」 리터럴 금지를 **추가**)
🟢 그 둘은 **20/20 PASS** · typecheck **0**
```

### 🔴 남은 일 — 계약 4건이 더 FAIL 한다(사유 확정됨)

```
cand-01-evidence-visibility.test.ts  CAND-04 · CAND-06-b · CAND-10
wu-132-mi-same-price-comparison.test.ts  B-4
🔴 전부 **`CANDIDATE-EVIDENCE-VISIBILITY-01`(SIMILAR 노출을 «넓힌» WU)의 계약** 이다 —
   CPO ⒝ 가 그 WU 의 결론을 **뒤집었다**. 🟢 뒤집는 것이 맞지만 그것은 **정책 반전** 이라
   주석에 그 사실을 적어야 하고, 그 작업을 반쯤 해 놓고 끊지 않았다.
🔴 B-4 는 「SAME 이 아닌 후보가 후보 리스트에도 없으면 FAIL」을 단언한다 — 그 입력이
   `SIMILAR` 라서 깨졌다. 🟢 입력을 **품번충돌 참고 후보** 로 바꾸면 그 계약의 «의도»
   (리스트와 가격축을 가른다)가 그대로 지켜진다
```

🔴 **다음 세션은 조사를 다시 하지 않는다** — 패치 적용 → 위 4건 갱신 → 전체 회귀 →
typecheck → build → 배포. 🔴 그 외 범위를 넓히지 않는다.

---

## 7. 현재 좌표 / 다음 한 수

```
현재   🔴 **STOP — CPO 판정 2건** 이고 코드 변경 0 이다
       ① §1 ↔ §11 충돌: POSSIBLE 처리 ⒜현상유지 / ⒝SIMILAR만 제외(권고) / ⒞전체제외
       ② `donokids.com` — CEO SAME + 가격 있는데 **market UNKNOWN** 으로 화면 누락
🟢 **CEO 육안 검증은 지금 가능하다** — 요구한 2등급·이미지·판단근거가 **이미 배포돼 있다**
       확인 질문은 CPO §9 의 A~E 그대로 · 🔴 특히 **🟡 군 14건 중 DIFFERENT 5건**
다음   ① CPO 가 위 둘을 판정 → ⒝ 를 고르면 **코드 1줄 + 계약 갱신** 이 CTO 의 일이다
       ② 그 뒤 CEO 화면 판단 → **Identity Standard v1 확정**(CPO)
🔴 Search · Price · UI 구조 · Registry 재진입 금지 · 판정 엔진 변경 금지
```
