# WU-045 — `SIZE_SYSTEM` 비차단 재평가 + 다국어 색상 안전성 전수검증

> 🟢 **GO.** 운영 1파일 · 배포 완료 · **ΔSAME +2 · ΔFalse SAME 0** ·
> Precision 0.909 → **0.923**. 🔴 무차별 blocker 제거 **0** · 색상사전 **0** · threshold **0**.

---

## §1 기준선 (WU-044 고정)

```
MI SAME **11** · False SAME **1** · SAME MISS **17** · Precision 0.909 · Recall 0.370
```

---

## §2 다국어 색상 안전성 — 🔴 **측정불가** 로 적는다

WU-044 가 남긴 미측정 구간을 전수로 봤다(캐시 · HTTP 0):

```
후보 색상 보유       **28 / 51**
문자 체계 분포       영문 ↔ 영문 **26** · (원상품 없음) ↔ 영문 2
🔴 교차 문자 체계 쌍  **0건**
🔴 한글 색상 후보     **0건**
```
🔴 **「다국어 과잉 차단은 일어나지 않는다」로 적지 않는다** — 표본에 그 조건이
**아예 없다**. 측정불가다.
🟢 다만 `COLOR_VARIANT` 는 **보류이지 충돌이 아니라서** 최악이
「SAME 대신 PRESUMED_SAME」이고 **False SAME 을 만들지 않는다**(설계된 보수성).

---

## §3 `SIZE_SYSTEM` 비차단 재평가 — 색상 보호가 켜진 상태에서

| | SAME | **False SAME** | MISS | Precision |
|---|---:|---:|---:|---:|
| WU-044 기준선 | 11 | **1** | 17 | 0.909 |
| **WU-043 때**(색상 보호 없음) | 14 | **2** 🔴 | 15 | — |
| **이번**(색상 보호 있음) | **13** | **1** 🟢 | 15 | **0.923** |

🟢🟢 **같은 변경인데 결과가 다르다** — WU-044 의 `COLOR_VARIANT` 가 C25 를 막는다.

```
C25 main-story  PRESUMED_SAME  blockers = [**COLOR_VARIANT**]   ← 색상 «하나가» 막는다
C20 junioredition               [COLOR_VARIANT, SAME_SELLER_DISTINCT_LISTING]
C19 junioredition               [SAME_SELLER_DISTINCT_LISTING]
C17 Grey Melange → **SAME** (유지)
```

### 바뀐 행 — **2건, 전부 🟢**

```
C30 billsstore.com.au  PRESUMED_SAME → SAME   Human **SAME** (baby 판)
C42 main-story.com     PRESUMED_SAME → SAME   Human **SAME**
```

### 🔴 CPO 컨트롤 대조 — 정직하게

| 요구 | 결과 |
|---|---|
| C17 → SAME | 🟢 SAME |
| C19 · C20 · C25 → SAME 금지 | 🟢 **전부 PRESUMED_SAME**(SAME 아님) |
| C06 → DIFFERENT | 🟡 **SAME** — 🔴 기존 1건 FP 가 **그대로 남아 있다**(증가 없음) |
| C09 · C12 · C48 자기동일 | 🟢 SAME |
| **C29 · C30 · C34 baby → SAME** | 🟡 **C30 만 SAME.** C29·C34 는 **미달** |
| False SAME 증가 금지 | 🟢 **1 → 1** |

🔴 **C29·C34 가 왜 안 올라왔나** — blockers 가 **`[]`(비어 있다)** 인데도 SAME 이
아니다. 즉 막는 것이 없고 **축이 모자란다**. 증거 부족(색상·품번 UNKNOWN)이고
**이 WU 의 범위가 아니다.** 🔴 축을 늘리는 것은 threshold 완화와 같은 등급이라
손대지 않았다.

---

## §4 정책 / 기술 분리 (CPO §5)

```
🟢 안전하게 회수됨            **2** (C30 · C42)
🔴 정책상 SAME 인데 증거 부족  **2** (C29 · C34 — blocker 0 · 축 부족)
🟢 DIFFERENT 보호가 필요해 막힘 C19 · C20 · C25 (색상·동일판매처)
🟡 실제 MI 로직 문제          **0건** 새로 발견되지 않음
```

---

## §5 구현 — 운영 1파일

```
`SIZE_SYSTEM` 보류 push 제거 → `sizeLineNote` 로 **관측만** 남긴다
🔴 사이즈 라인 **하나만** 비차단이다. 아래는 전부 그대로 막는다:
   COLOR · COLOR_VARIANT · MODEL_CODE · COMPOSITION ·
   GARMENT_FORM · AUDIENCE_LINE · MATERIAL · FIT
🟢 사실은 버리지 않는다 — `reasons` 에 「사이즈 라인 차이이고 같은 모델로 본다」로 남는다
```

---

## §6 🔴 기존 계약 2건을 갱신했다 — 둘 다 «축 이름» 을 단언하고 있었다

```
① wu-044 「SIZE_SYSTEM 을 건드리지 않는다」
   → 그 WU 의 역할은 **색상 보호** 이고, 사이즈 계약은 wu-045 가 갖는다.
② MATCHING-2.0-REGRESSION 「아기옷은 SAME 이 아니다」의 blocker 단언
   🟢🟢 **계약은 한 글자도 약해지지 않았다** — 그 다섯 쌍은 `AUDIENCE_LINE` 이
      **그대로 막고**, `verdict !== "SAME"` 과 `goesIntoSameProductPrice === false`
      가 **통과한다**. 막는 축이 **사이즈 체계 → 연령 라인** 으로 옮겨갔을 뿐이다.
   🔴 즉 「아기옷이 아동복의 동일상품 가격에 들어오지 않는다」는 CEO 지시는 유효하다.
```

🔴 **그리고 이것이 미묘한 지점이다** — CPO 의 「baby 사이즈 라인 = SAME」과
CEO 의 「아기옷은 아동복 가격에 안 들어온다」가 **둘 다 성립한다**:
연령 라인(`AUDIENCE_LINE`)이 관측되면 여전히 막고, 사이즈 **표기 체계** 만
다르면(C30) 통과한다. 🔴 두 규칙의 경계는 **`compareAudienceLine` 이 연령 라인을
읽어내는가** 이고, 그것이 못 읽으면 통과한다. 이 성질은 **지금 그대로 둔다.**

---

## §7 검증·배포

```
계약 테스트   wu-045 13 passed + wu-044 10 passed = **23 passed**
음성대조      M1 보류 되돌리기 **5 FAIL** · M2 색상 보호 죽이기 **5 FAIL** ·
              M3 관측 삭제 **1 FAIL** → 복구 23 passed
회귀          admin **556 files / 8,136 passed · failed 0**
typecheck 0 · build exit 0
배포          `7607fb4b` — 빌드 로그 `Commit: 7607fb4`
smoke         GET / **200** · POST /api/price-history/check **401**(인증)
```

🔴 **변이 1차가 전부 「미적용」으로 나왔다** — heredoc 이 한글에서 깨졌다.
스크립트를 파일로 써서 다시 돌렸고, **적용 실패를 통과로 읽지 않았다**.

---

## §8 최종 판정

```
ΔSAME          **+2** (C30 · C42 — 둘 다 Human SAME)
ΔFalse SAME    **0** (1 → 1) ✅ 절대 조건 충족
Precision      0.909 → **0.923**   Recall 0.370 → **0.444**
C19·C20·C25    🟢 전부 SAME 차단 유지 (C25 는 색상 하나로)
C29·C34        🟡 미달 — blocker 0 · **축 부족**(증거 부족)
다국어         🔴 **측정불가**(표본에 교차 문자 체계 0건)
무차별 제거     🟢 **없음** — 사이즈 라인 하나만
──────────────────────────────────────────
**GO**
```

### 🔴 다음에 남은 것 (CTO 가 고르지 않았다)

```
① C29·C34 는 **blocker 가 아니라 축 부족** 이다 — 증거(색상·품번)를 더 얻어야 한다.
   🔴 축 개수를 낮추는 것은 threshold 완화라 금지다.
② 다국어 색상은 **표본이 없어** 측정하지 못했다. 한글 색상을 가진 쌍을 모아야 한다.
③ C06(유일한 False SAME)은 여전히 어떤 기계 축으로도 걸러지지 않는다(WU-036 §3).
```

🔴 **CEO Action: NONE.**
