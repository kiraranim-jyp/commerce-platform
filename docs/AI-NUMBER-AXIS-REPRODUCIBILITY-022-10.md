# WU-022-10 완료 보고 — AI 「숫자 불일치 무시」 재현성

## 1. 완료 판정 — **UNKNOWN 유지** (가설 재현 실패)

## 2. Part A — 기존 51건 스캔
조건(브랜드 동일 · 원상품 품번이 후보에 **미노출** · 후보 쪽 **다른 숫자 노출**) 충족 **4건**:

| S | 후보 제목 | 노출된 숫자 | GT | MI | cto | opus | haiku | 분류 |
|---|---|---|---|---|---|---|---|---|
| **S5** | `225 Pepe Shoes Vernice Nero` | `225` | DIFFERENT | PRESUMED_SAME | 🔴 **SAME** | 🔴 **SAME** | 🔴 **SAME** | **A1** |
| **S5** | `페페슈즈 유광 부츠 Pepe **00225** VERNICE NERO` | `00225` | DIFFERENT | SIMILAR | 🟢 UNCERTAIN | 🟢 UNCERTAIN | 🟢 **DIFFERENT** | **A1** |
| S3 | `Curious Turnip all over swim T-shirt` | `B126AC130` | DIFFERENT | CONFLICT | 🟢 DIFFERENT | 🟢 DIFFERENT | 🟢 DIFFERENT | A1 (🔴 **품목도 다름** — 축 혼재) |
| S6 | `Bobo Choses Embossed blue hoodie` | `B226AC160` | DIFFERENT | CONFLICT | 🟢 DIFFERENT | 🟢 DIFFERENT | 🟢 DIFFERENT | A1 (🔴 **품목도 다름** — 축 혼재) |

🔴 S3·S6 은 **품목(수영모↔티셔츠 · 자켓↔후디)도 다르다** → 「숫자만 다른」 축의 순수 사례가 **아니다**.
🟢 **순수 축 사례는 S5 둘뿐** 이고, 둘 다 브랜드 PèPè · 색상명 Vernice Nero 가 **완전 일치**한다.

## 3. Part B — 신규 사례 **추가하지 않았다**
🟢 Part A 에서 **같은 축의 두 번째 사례를 기존 데이터에서 찾았다**(`00225`).
그래서 §B 의 「A1 이 부족하면 새 pair 추가」 조건이 **발동하지 않았다**.
🔴 새 Search 0 · 새 후보 0 · HTTP 0.
🟡 다만 `00225` 건은 opus/haiku 가 **판정한 적이 없었다**(MI SIMILAR → threeWay DIFFERENT 라 27건 밖).
→ **기존 pair·기존 GT·기존 evidence 그대로** 3-AI 행렬만 채웠다(새 데이터 아님).

## 4. Part C — 3-AI 결과 · 🔴🔴 **갈렸다**
```
사례 ① `225 Pepe Shoes Vernice Nero`        → cto SAME · opus SAME · haiku SAME   = **3/3 False SAME**
사례 ② `Pepe 00225 VERNICE NERO`            → cto UNCERTAIN · opus UNCERTAIN · haiku DIFFERENT
                                               = **0/3 False SAME**
```
| KPI | 값 |
|---|---|
| 숫자불일치 무시율(순수 축 n=2) | **3/6 판정** (사례①만) |
| 3자 공통 False SAME | **1건**(사례①) |
| 3자 불일치 | 사례②에서 haiku 만 DIFFERENT |
| evidence 충분성별 | A1 4건 중 축 혼재 2건은 **3/3 정답** |

### 🔴🔴 이번 WU 의 핵심 — 가설이 **반증되었고 더 날카로운 것으로 바뀐다**
```
WU-022-9 가설: 「브랜드+색상이 일치하면 AI 가 숫자 불일치를 무시한다」
🔴 **재현되지 않았다.** 사례 ②는 브랜드·색상이 «똑같이» 일치하는데 3자 모두 SAME 을 안 냈다.
🟡 두 사례의 차이는 **브랜드/색상이 아니라 «숫자의 모양과 자리»** 다:
    ① `**225** Pepe Shoes …`      → 맨 앞 · 3자리 · 라벨 없음 → **셋 다 넘겼다**
    ② `Pepe **00225** VERNICE…`   → 브랜드 «뒤» · **0 패딩 5자리** → 셋 다 품번으로 **대우했다**
→ 🟡 새 잠정 가설: **「숫자가 품번처럼 «보일 때만» AI 가 식별자로 취급한다」**
🔴 n=2 다. 이것도 **가설이고 결론이 아니다.**
```

## 5. Part D — D counterfactual
🟢 **022-9 수치에서 변하지 않는다.** 사례 ②는 MI 가 `SIMILAR`(threeWay = DIFFERENT)로 **이미 확정**해
UNCERTAIN 구간 밖이므로 D 가 건드리지 않는다.

| 정책 | Precision | False SAME | GT SAME 손실 | UNCERTAIN | **숫자축 False SAME** |
|---|---:|---:|---:|---:|---:|
| A. MI threeWay | 1.000 | 0 | 1 | 27 | **0** |
| D / cto | 1.000 | 0 | 1 | 18 | **0** |
| D / opus | 1.000 | 0 | 1 | 14 | **0** |
| D / haiku | 1.000 | 0 | 1 | 17 | **0** |
| D / 3자 만장일치 | 1.000 | 0 | 1 | 19 | **0** |

🟢 **숫자축에서도 D 의 False SAME 은 0** 이다 — D 는 AI 의 `SAME` 을 채택하지 않으므로
사례 ①의 3/3 오판이 **정책에 들어가지 못하고 UNCERTAIN 으로 남는다**.

## 6. 숫자 불일치 failure 판정 — 🟡 **UNKNOWN 유지**
§「UNKNOWN 유지」 조건에 정면으로 해당한다:
```
🔴 순수 축 사례가 **2건** 뿐이고 그 둘이 **서로 반대 결과**를 냈다
🔴 「최소 2개 이상의 독립 사례에서 재현」 → **충족 실패**(1/2)
🟢 evidence 충분성은 확인됐다 — 둘 다 숫자가 제목·URL 에 글자로 있었다(A1)
→ **GO 승격하지 않는다.**
```
🔴 SKU 우선 규칙 · AI prompt 수정 · MI 규칙 변경 · D fallback 구현 — **전부 0**.

## 7. D 정책 상태 — 🟡 **GO 후보 유지**
숫자축 사례가 추가돼도 D 의 안전 지표(Precision 1.000 · False SAME 0 · GT SAME 추가손실 0)가
**그대로다**. 🔴 운영 채택은 여전히 아님(벤더 독립성 미확보 · 분모 8~13).

## 8. 변경 사항
```
code **0** · HTTP **0** · AI/API **0**(외부 0 · 기존 judge 경로만) · 새 Search **0** ·
새 후보 **0** · 비용 **₩0** · deploy **0** · 문서 1
SKU rule / MI threshold / 색상사전 / PRESUMED_SAME / Registry / Category / Sourcing /
URL normalizer / ensemble / fallback — 전부 **0**
```

## 9. Quality
```
typecheck **0 errors**
🔴 코드 변경 0 이라 regression 재실행 안 함 — **직전 PASS(545 files / 7,857) · 이번 코드 변경 0**
worktree **clean** · origin/main **ahead 58 / behind 0**
```

## 10. CEO Action — **NONE**
