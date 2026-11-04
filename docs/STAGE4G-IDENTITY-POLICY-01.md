# STAGE 4-G — IDENTITY POLICY 01 · 측정 전문 (2026-11-04)

> 🔴🔴 **결론 한 줄** — CPO 가 GO 한 셋 중 **C 만 구현했다.**
> **A·B 는 실제로 구현해서 전수 측정했고, 회귀 39건(28파일)과 충돌해 CPO 판정으로 올린다.**
> 🔴 **다시 조사하지 않는다.** 이 문서에 숫자가 다 있다.

---

## 0. 무엇을 했는가

```
A  Generic 축만으로 PRESUMED_SAME 금지      🟡 구현 → 측정 → **되돌렸다**(CPO 판정 대기)
B  COLOR 를 Identity 에서 제외              🟡 구현 → 측정 → **되돌렸다**(CPO 판정 대기)
C  MODEL CODE 정의(주석) · 동작 0           🟢 **구현·배포**
```

🔴 운영 동작 변경 **0** · threshold **0** · 점수 **0** · GT 수정 **0** · DB **0** · UI **0** · 네트워크 **0**.
🟢 측정은 **반사실 하니스** 로 CI 에 상주한다 — `stage4g-identity-policy-01.test.ts`
(`replicationGate` 가 복제식 ↔ 운영 verdict **전건 재현 · mismatch 0** 을 먼저 단언한다).

---

## 1. 🔴 왜 A·B 를 커밋하지 않았는가 — 헌장 §4-D

구현한 상태로 **전체 회귀를 돌렸다**:

```
전체 회귀   936 files · 10,294 tests
            🔴 **28 files / 39 tests FAIL**   (HEAD 기준선은 0 failed)
```

그 39건의 성격이 결정적이다:

| 분류 | 건수 | 성격 |
|---|---:|---|
| Legacy GT **기준선 가드** | **25** | 「기준선 숫자가 그대로다」를 **감지하려고 존재하는** 테스트 |
| `COLOR_VARIANT`/COLOR 축 **직접 계약** | 6 | `wu-044`(4) · `wu-045`(2) |
| **소스 앵커** | 2 | `core-2ad` AD-S3 · `core-2i` |
| **P4 불변식** | 1 | `p4-candidate-truth-gate` 「다른 판매처 쌍은 영향이 없다」 |
| 핵심 인수 테스트 | 5 | `cross-seller-matching` A/가격정책/미매칭 · `p53` · `p54b`/`p54c` |

🔴🔴 **헌장 §4-D**: 「계약 변경이 필요하면 **임의 구현하지 않는다** — 변경 범위와
부작용까지 «분석» 해 올린다.」
🔴🔴 그리고 **작업지시서가 「Legacy GT 수정」을 금지** 한다. 25건이 정확히 그 숫자들이다
(`wu-059` GT 51 · `wu-068` 통합 GT 63 · `wu-066` 확대 186쌍 …).
⟹ **CTO 가 그 숫자를 다시 박을 수 없다.** 박으면 그 가드들이 존재하는 이유가 사라진다.

---

## 2. 🟢🟢 안전성 — **새 False SAME 은 하나도 없다**

이것을 먼저 적는다. A·B 는 **precision 방향** 이고 recall 을 깎는다.

```
p53 ② 거짓 SAME 10쌍        🟢 **10/10 그대로 막힌다**(it.each 전건 PASS)
GT 14 FP                     🟢 BASE 6/7 → AB **6/7** (늘지 않았다)
C20 · C25 (Legacy DIFFERENT) 🟢 **SAME 으로 올라가지 않는다**
```

🔴 `C20`·`C25` 가 안전한 이유를 적는다 — `COLOR_VARIANT` 를 없애면 blocker 가 사라지지만
**색의 +1 도 같이 사라져** `corePoints` 가 1 줄어 SAME 문턱(5)에 못 닿는다.
⟹ 🔴🔴 **A 와 B 를 «같이» 넣어야 성립하는 안전성이다. 하나만 넣으면 WU-043 참사가 재발한다.**

---

## 3. 🔴 비용 — 측정된 recall 손실

### 3-A. GT 14 (wu-059 · 작업지시서가 지정한 분모)

| 정책 | TP positive | FP positive | SAME 등급 | PRESUMED |
|---|---|---|---:|---:|
| BASE | 7/7 | 6/7 | 3 | 10 |
| **A** | 7/7 | 6/7 | 3 | 10 |
| **B** | 7/7 | 6/7 | **2** | 11 |
| **AB** | 7/7 | 6/7 | **2** | 11 |

```
🟢 FN 0 — 네 정책 전부 **TP 7/7 유지**(작업지시서의 「GT TP 손실 예상 0」은 **맞았다**)
🔴 등급이 움직인 행 **1** — `C42 main-story.com`(human **SAME**)  SAME → **PRESUMED_SAME**
🔴 그리고 **A 는 이 분모에서 아무것도 바꾸지 않는다** — Generic-only positive 가 0 이다
```

### 3-B. 🔴🔴 작업지시서 **밖** 의 분모 — 여기서 추정이 깨졌다

```
wu-068 통합 GT 63    EXACT **16 → 14**            ← 등급(tier) 손실. 가격비교의 「동일상품」 칸이다
wu-066 확대 186쌍    CF-3 False SAME **16 → 12**  ← 🔴 CF-3 이 「참사」라는 **증거가 약해진다**
wu-064 / wu-065      결합 CF 승격 `[C47]` → **`[C08, C47]`**  ← 🔴 **C08 은 Human DIFFERENT 다**
p53 ①                Grey Melange  SAME → **PRESUMED_SAME**
p54b / p54c          Grey Melange  SAME → **PRESUMED_SAME**
cross-seller-matching 430701↔B226AC114 축에서 COLOR 소실 · 430651↔B226AC043 SAME → PRESUMED_SAME
                     🔴 그리고 **세 쌍 중 하나가 PRESUMED_SAME → SIMILAR**(= positive 이탈 · **FN**)
p4-candidate-truth-gate  🔴🔴 「다른 판매처 쌍은 **영향이 없다**」가 **깨진다**
                     (MI-DISCOVERY-P4 가 자기 주석에 적어 둔 `430700 ↔ B226AC112` 그 쌍이다)
```

🔴🔴 **그래서 작업지시서의 「A 의 GT TP 손실 예상 0」은 «한 분모에서만» 참이다.**
`p4` 와 `cross-seller-matching` 에서는 **A 단독으로 positive 를 하나 잃는다.**
🔴 그 쌍은 오프라인 GT fixture 분모에 **없어서** 작업지시서가 보지 못했다 — 이제 **측정됐다.**

---

## 4. 🟢🟢 이득 — A 의 측정된 효과는 **운영 분모 하나** 에만 있다

```
운영 positive 21 · FP 13 · TP 7   (sprint5-brand-gt · 저장된 근거 문장)
🟢 **Generic-only FP 9건** — 전부 「상품군 TOP↔TOP · 색상 BLUE/RED · 대상 KIDS」 모양
   FP-01 shoppiccoliandco · FP-02 petitemaisonkids · FP-03 kidbizkid · FP-04 folkberlin ·
   FP-05 designerkidswear · FP-07 shoppiccoliandco · FP-08 nickis · FP-09 villagekids ·
   FP-10 kidbizkid          (브랜드가 Hugo Boss · Marc Jacobs · Levi's · Gray Label …)
🔴 Generic-only TP **0**
🔴🔴 **근거 문장이 없는 TP 6/7 은 «측정불가»** — 0 으로 세지 않는다
```

🔴🔴 **그리고 이 이득은 A 와 B 가 «겹친다»** — 그 9건의 근거에 「색상 …」이 **7/9** 다.
B 만 넣어도 3점 → 2점이 되어 같은 9건이 죽는다.
⟹ 🔴🔴🔴 **B 의 «독립적인» 측정된 이득은 0 이고, 비용은 32건이다.**

```
A-only   회귀 FAIL **7**     이득 Generic-only FP 9 차단
B 추가   회귀 FAIL **39**    추가 이득 **0**(측정된 범위에서)
```

---

## 5. 🟡 CPO 판정 — 셋 중 하나

```
① A 만 승인 · B 는 폐기/보류
   🟢 이득 전부(FP 9) 유지 · 회귀 충돌 **7건** 으로 축소
   🔴 그 7건 중 `p4-candidate-truth-gate` 와 `cross-seller-matching` 은 **진짜 불변식** 이다 —
      「다른 판매처 쌍은 영향이 없다」를 포기하는 것이고 **positive 1건을 잃는다**
   🔴 그리고 ②의 안전성 논거(§2)가 **사라진다** — A 단독은 C20/C25 를 안 건드리므로 괜찮지만,
      **B 단독은 절대 안 된다**(WU-043 재발)

② A+B 둘 다 승인 + **Legacy GT 기준선 25건 재박기를 명시 승인**
   🟢 정책이 일관된다(색은 Variant · Generic 은 추정 근거 아님)
   🔴 **Legacy GT 수정 금지를 CPO 가 직접 풀어야 한다**
   🔴 그리고 `wu-066` CF-3 증거가 16 → 12 로 약해지는 것을 **받아들인다는 선언** 이 필요하다
      (그 숫자가 「CF-3 은 영구 폐기안」의 근거다)

③ 둘 다 보류 · C 만 유지(**현재 상태**)
   🟢 운영 위험 0 · 회귀 0 failed
   🔴 운영 FP 9건이 **그대로 남는다**
```

🔴 **CTO 는 셋 중 아무것도 고르지 않았다.** §2 의 「A·B 는 같이여야 안전하다」가
①과 ②를 가르는 핵심이므로 **반드시 같이 판정해야 한다**(따로 열면 WU-043 이 재발한다).

---

## 6. 되돌리는 방법 — 다음 세션이 **조사 없이** 들어간다

구현은 **세 자리** 뿐이다(`packages/crawler/src/comparison-search/cross-seller.ts`):

```
A   verdict 분기 1줄
      - if (totalPoints >= PRESUMED_SAME_MIN_AXES && !sameSellerWithoutIdentity) return "PRESUMED_SAME";
      + if (totalPoints >= PRESUMED_SAME_MIN_AXES && hasIdentifyingEvidence) return "PRESUMED_SAME";
      🔴 `hasIdentifyingEvidence` 는 **이미 그 바로 위에 선언돼 있다**(새 변수 0)
      🔴 새 조건은 기존 `!sameSellerWithoutIdentity` 를 **포함한다**(완화가 아니라 좁히기) ⟹
         그 변수는 쓰이지 않게 되므로 **같이 지운다**
B-1 `if (color.outcome === "match") { … axes.push({ axis: "COLOR", points: 1, … }) }` **블록 제거**
B-2 `if (color.outcome === "match" && color.nameOutcome === "mismatch") { COLOR_VARIANT }` **블록 제거**
🔴 `conflicts` 의 COLOR(색조 불일치)는 **건드리지 않는다** — AGE-LINE-POLICY-01 의 조기 반환
   보호가 그것을 전제로 쓰여 있다
🔴 `isColorUnverified`(match-truth.ts) · `CrossSellerBlocker` 타입 · `blocker-text.ts` 라벨은
   **전부 보존** 한다(과거 저장 행이 그 값을 들고 있다)
```

그 뒤 **갱신해야 하는 계약 목록(전수)** — 이미 세어 뒀다:

```
A 로 깨지는 7       cross-seller-matching(가격정책) · p4-candidate-truth-gate ·
                    core-2ad(AD-S3) · wu-064 · wu-065 · wu-066 · wu-068
B 가 추가로 깨는 32 cross-seller-matching(A·미매칭) · cross-seller-discovery · mi-p0-11(2) ·
                    p53(2) · p54b(2) · p54c(2) · core-2i · core-desc-evidence-01 ·
                    core-desc-review-gt · core-final-visual-01 · core-image-evidence-01 ·
                    core-image-evidence-02 · core-same05(2) · core-same07 ·
                    core-sprint02 · core-sprint07 · core-sprint08 · wu-044(4) ·
                    wu-045(2) · wu-059 · wu-060 · wu-069
```

🟢 그리고 `stage4g-identity-policy-01.test.ts` 의 `C-2` 가 **A·B 가 들어가는 순간 FAIL** 한다 —
그것이 「이 문서를 읽어야 한다」는 신호다. 🔴 그때 그 단언을 **갱신하는 것이 맞다**(의도된 변경).

---

## 7. 🔴 하니스에서 내가 틀린 것 셋 (둘 다 사전에 잡혔다)

```
⒜ `materialText: "cotton:100"` 을 입력으로 썼다 — 그 형식은 `axes[].detail` 의 **출력** 이고
   입력이 아니다 ⟹ MATERIAL 축이 서지 않았다. 🟢 「문턱 3 에 닿는지」를 먼저 단언해서 잡았다
⒝ `compareCategory` 는 `categoryText` 가 null 이면 **제목에서** 상품군을 읽는다 —
   spread 로 title 을 물려받아 「상품군 TOP↔TOP」이 붙어 점수가 4 가 됐다
⒞ 🔴🔴 **`npx vitest run | tail` 의 종료코드를 vitest 것으로 읽었다** — `tail` 이 0 을 내서
   **「28 files FAIL」을 「exit 0」으로 볼 뻔했다**(메모 `tsc | grep` 과 같은 함정 · 재발)
   🟢 파일로 받아 `VITEST_EXIT=1` 을 직접 확인했다
```

🟢 그리고 `cross-seller.ts` 가 `grep` 에 **binary 로 잡힌다** — 결함이 아니다.
`orderPair` 가 합성 키 구분자로 **NUL 문자를 의도적으로** 쓴다(`${sourceUrl}\0${slug}\0${title}`).
🔴 그 파일을 쉘로 grep 할 때는 `-a` 가 필요하다(테스트는 `readFileSync` 라 영향 없다).

---

## 8. 측정불가로 남긴 것

```
⒜ 운영 TP 7 중 **6 이 근거 문장 없는 맨몸 행** ⟹ A 의 운영 recall 비용은 **측정불가**
   🔴 「운영 TP 손실 0」으로 적지 않는다
⒝ `430700 ↔ B226AC112` 의 human 라벨 — 코드 주석이 그 쌍을 「SIMILAR 로 추락」이라 적었지만
   **사람 라벨이 fixture 에 없다** ⟹ 「진짜 FN 인가」는 미확정(쌍의 **모양** 만 측정됐다)
⒞ `wu-066` CF-3 이 12 로 내려가도 「참사」 결론이 유지되는지 — **재해석하지 않았다**(CPO 몫)
⒟ 실제 따져 화면 영향 — CTO 는 볼 수 없다(C 는 주석이므로 화면 영향 **구조적으로 0**)
```
