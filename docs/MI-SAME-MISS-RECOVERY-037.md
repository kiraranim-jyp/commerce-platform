# WU-037 — Human GT 기준 MI 동일상품 판정 개선

> 목표는 Recall 을 올리는 것이 아니다 — **가격·판매판정에 넣어도 안전한 SAME 만 회수**하고
> **False SAME 을 1에서 한 건도 늘리지 않는 것** 이다.

---

## §1 문제

WU-036 Human GT 기준 `SAME MISS 18 · False SAME 1 · Precision 0.900 · Recall 0.333`.
18건 중 **기술적으로 안전하게 회수 가능한 것이 무엇인가** 를 확정하고 그것만 회수한다.

## §2 기준 데이터 (고정)

```
Human  SAME 27 · DIFFERENT 23 · UNCERTAIN 1 · 미판정 0   (전수 51)
MI     SAME 10 · PRESUMED_SAME 27 · SIMILAR 4 · CONFLICT 10
```
🔴 모든 하니스가 이 baseline 을 **단언으로** 재확인한다(틀어지면 측정이 무효다).

## §3 C06 — 고정 오류 사례

```
품번 B226AC009 동일 · 표기 색상 Light Blue 동일 · 브랜드 동일 · 긴소매 동일
(원상품 설명 원문이 「featuring long sleeves」라고 적는다)
→ 그런데 **실제 색상이 다르다** (CEO 육안 확정)
```
🔴 **C05 와 조건이 유사하다는 이유로 SAME 으로 바꾸지 않았다.** 이 WU 의 모든 안은
「C06 이 SAME 이 되지 않는가」를 통과해야 했다.

## §4 SAME MISS 18건 — 10축 전수 재분해

🔴 WU-036 분류를 복사하지 않고 **운영 comparator 를 다시 호출해** 축 상태를 새로 만들었다.
`MATCH / MISMATCH / UNKNOWN / NOT_AVAILABLE` 를 합치지 않았다.

| 축 | MATCH | MISMATCH | UNKNOWN | N/A |
|---|---:|---:|---:|---:|
| **brand** | **0** | 1 | **17** | 0 |
| modelCode | 11 | 1 | 6 | 0 |
| color | 5 | **0** | 13 | 0 |
| title | 13 | 3 | 2 | 0 |
| category | 12 | 0 | 6 | 0 |
| garmentForm | 1 | 0 | 13 | 4 |
| **variantId** | 0 | 0 | 0 | **18** |
| **image** | 0 | 0 | **18** | 0 |
| material | 5 | 2 | 11 | 0 |
| sizeConfig | 3 | 4 | 11 | 0 |

🔴🔴 **brand 축이 18건 중 단 한 번도 MATCH 가 아니다.** 그리고 `image` 는 판정에
**전혀 쓰이지 않고**, `variantId` 는 **제품에 칸이 없다**.

### 원인 분류 (CPO §3 A~F)

| 분류 | 건수 | 사례 |
|---|---:|---|
| **A. 정책 손실** | **6** | baby 사이즈 판 C29·C30·C34·C42 · baby 품번이 **실제로 다름** C33(`B226AB040`) · **세트 상품** C35 |
| **B. 증거 부족** | **9** | `BRAND_UNCONFIRMED` — WU-034 가 「안전한 확인 증거원 **0**」으로 닫은 축 |
| **C. Extraction 실패** | **0** | 🔴 페이지에 있는데 못 읽은 건을 찾지 못했다(C10 은 trenbe 가 `product_type="NEW"` 를 주고 색상 옵션이 **없다**) |
| **D. 정규화 문제** | **4** | 국내 샵 한글 제목 `NO_TITLE_OVERLAP` 3 + 샵 이름 오염 `BRAND_MISMATCH` 1(biskuit 「비스킷」) |
| **E. MI logic 문제** | **1** | **C48** — 축 8개 전부 일치인데 `BRAND_UNCONFIRMED` 하나가 막는다 |
| **F. Human GT 재검증** | 0 | 자기동일 4쌍 전부 SAME · 그룹별 SAME 분포 6/6 → GT 정상 |

🔴 한 건에 blocker 가 둘 이상 붙어 합계가 18 을 넘는다(상호배타 아님).

## §5 False SAME 분석

**C06 1건.** 기계가 볼 수 있는 축이 전부 일치한다 — 품번·표기색상·브랜드·소매.
🔴 **variant 식별자로도 걸러지지 않는다**(§8). 이번 개선 후에도 **1 그대로** 다.

## §6 정책 손실 vs 기술 손실

```
정책 손실  6 / 18   🔴 「baby 사이즈 라인 · 세트 구성을 같은 상품으로 볼 것인가」
                      = **제품 정책**. CTO 가 바꾸지 않았다.
증거 부족  9 / 18   🔴 WU-034 에서 「안전한 확인 증거원 없음」으로 닫혔다
정규화     4 / 18   🔴 한글 제목·다국어는 별칭 사전 = Registry 성격(금지)
기술 손실  **1 / 18**  🟢 **이번에 회수했다**
```

## §7~§8 Evidence 10축 · variant-level identifier

🟢 **WU-035 가설은 이번에도 지지된다** — S4(`AW26MS185`) 색상 변형 9건이 Human
전부 DIFFERENT 이고 **MI 도 SAME 을 0건** 준다. 현재 보수성이 그 축을 정확히 막는다.
🔴 **그러나 C06 은 variant 식별자로 해결되지 않는다** — 품번도 표기 색상도 같기 때문이다.
🔴 `variantId` 는 ProductFacts 에 **칸 자체가 없다**(18/18 NOT_AVAILABLE). 이번에 만들지 않았다.

## §9 10축 대안 비교 — 🔴 측정으로 하나를 탈락시켰다

| 안 | ΔSAME | ΔFalse SAME | 판정 |
|---|---:|---:|---|
| **A. `brand == og:site_name` 이면 오염이니 버린다** | — | — | 🔴 **탈락** |
| **B. 같은 스토어의 같은 listing → 브랜드 확인** | **+1** | **0** | 🟢 **채택** |
| C. 색상 사전 확대 | — | — | ❌ CPO 금지 |
| D. SKU→brandModelCode 강제 | +5 | **+5** | ❌ WU-032 에서 탈락 |
| E. 도메인→브랜드 표 | +1 | 0 | ❌ 거짓 MISMATCH 3건(WU-034) · Registry 성격 |
| F. threshold 완화 | — | — | ❌ 금지 |
| G. 이미지 자산 축 | 0 | 0 | 🔴 발화 0/24(WU-033) |
| H. JSON-LD 전면 활용 | 0 | 0 | 🔴 WU-032 실측 |
| I. 다국어 별칭 | — | — | ❌ Registry 성격 |
| J. 정책 변경(baby/세트) | +6 | ? | 🔴 **CPO 결정 사안** |

🔴🔴 **A 가 왜 탈락했는가 — 이론이 아니라 전수 측정이다**:
브랜드 **공식몰**에서는 `og:site_name` 이 **올바른 브랜드** 다(`bobochoses.com` →
"Bobo Choses"). 그 규칙을 넣으면 **C01·C02·C04(현재 정답 SAME) 3건이 깨진다.**
오염(biskuit 「비스킷」)과 정답(bobochoses 「Bobo Choses」)을 그 규칙으로는 가를 수 없다.

## §10 선택한 해결책

> **같은 등록 도메인 라벨 «그리고» 같은 시장중립 경로이면, 두 페이지는 같은 브랜드
> 스토어의 같은 listing 이다 → 브랜드가 다를 수 «없다» → 한쪽이 비면 다른 쪽으로 «확인» 한다.**

```
🟢 Registry 0 · 브랜드 사전 0 · 도메인→브랜드 표 0 · 새 데이터 0
🟢 threshold 0 · 색상사전 0 · PRESUMED 승격 0 · AI 0 · 외부 API 0
🔴 라벨만으로는 부족하다 — 멀티브랜드 리테일러의 «다른 상품» 이 브랜드를 물려받는다.
   그래서 **경로까지** 같을 때만 적용한다(같은 경로에 다른 상품은 없다).
🔴 양쪽 다 비어 있으면 아무것도 만들지 않는다. 원상품 brand 가 있으면 덮어쓰지 않는다.
```
🟢 이것은 리포의 기존 정책을 **한 단계 위로** 적용한 것이다 —
「`/en-kr/products/X` ↔ `/products/X` → **다른 시장** → 자기참조 아님」.

## §11 구현

```
packages/crawler/src/comparison-search/match.ts   +~70줄 (술어 + 적용 3줄)
packages/crawler/src/comparison-search/index.ts   +3줄 (술어 노출 — 하니스 복제 금지)
테스트 3파일 추가(해부 · 반사실/E2E · 계약+음성대조)
운영 파일 **2개** · 판정 로직·threshold·사전 변경 **0**
```

## §12 E2E — 운영 `withConfidence` 로 전수 51건

| KPI | Before | After |
|---|---:|---:|
| MI SAME | 10 | **11** |
| **False SAME** | **1** | **1** ✅ |
| SAME MISS | 18 | **17** |
| Precision | 0.900 | **0.909** ✅ |
| Recall | 0.333 | **0.370** |

🟢 **바뀐 행은 C48 하나**(PRESUMED_SAME → SAME · Human SAME).

## §13 CONTROL (하니스에 고정)

```
🟢 자기동일 4쌍 C09·C12·C17·C48 → **전부 SAME** (C48 이 그동안 이것을 어겼다)
🟢 C06 Human DIFFERENT 유지 · MI SAME 이 되지 않는다
🟢 S4 `AW26MS185` 색상 변형 6건 → SAME 금지
```

## §14 Mutation / Regression / Typecheck / Build

```
음성대조 5종 **전부 FAIL** → 원상복구 17 passed
  M1 경로검사 제거 2F · M2 라벨검사 제거 3F · M3 덮어쓰기 가드 제거 2F ·
  M4b 인자 되돌리기 1F · M5 적용 상수 false 1F
🔴 1차 M1~M4 는 **변이가 적용되지 않아** 전부 통과했다(MSYS `/tmp` 경로).
   「적용 실패 = 통과」를 또 밟을 뻔했고, 경로를 고쳐 다시 돌렸다.

회귀    admin **553 files / 8,103 passed · failed 0**
typecheck 0 · build exit 0
```

## §15 Security

```
🟢 WU-025 outbound guard · WU-026 fetch rebinding · rate-limit → **99 passed**
🟢 client 번들 `node:dns` / `undici` 유입 **0 파일**
🔴 URL/fetch 경로는 건드리지 않았다 — `new URL` 파싱만 추가했다
```

## §16 Production

```
배포    `326495ff` — 빌드 로그 `Commit: 326495f`
smoke   GET / **200** · /today 307(인증) · POST /api/price-history/check 401(인증)
```

## §17 잔여 문제 (고치지 않았다)

```
① 🔴🔴 **정책 6건** — baby 사이즈 라인 · 세트 구성을 같은 상품으로 볼 것인가.
   바꾸면 baby·세트 가격이 성인 단품의 국내 최저가로 들어간다(가격 판정 오염).
② 🔴 **브랜드 증거 9건** — WU-034 가 「안전한 확인 증거원 0」으로 닫았다.
③ 🟡 **모르는 색상 문자열은 MISMATCH 가 아니라 UNKNOWN** 이다
   (`Grey Melange` ↔ `Conker Stripe` → 충돌 없음). 색상 사전 확대가 금지라
   고치지 않고 **테스트로 성질을 적어 뒀다.**
④ 🔴 `variantId` 칸 부재 · `image` 축 미사용(18/18) — 만들지 않았다.
⑤ 🔴 **C06** 은 어떤 기계 축으로도 걸러지지 않는다. False SAME 1 은 남는다.
```

## §18 최종 판정

```
False SAME        1 → **1**      ✅ 증가 없음
Precision     0.900 → **0.909**  ✅ 0.900 미만 아님
SAME MISS        18 → **17**
회수한 것          **1건 (기술 손실 전부)**
회수하지 않은 것   정책 6 · 증거부족 9 · 정규화 4 — 전부 근거를 적었다
Production        🟢 배포·smoke 완료
──────────────────────────────────────────
**GO**
```

🔴 **CEO Action: Production 최종 제품 테스트 1회.**
