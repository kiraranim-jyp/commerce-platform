# TTAEJYO — 다음 세션 인수인계 (CTO)

## 🔵🔵🔵 0-HANDOFF. **[2026-11-21 갱신] 이 블록만 읽고 시작한다**

### ① 지금 좌표 — 🔴 **CTO 가 할 작업이 «없다». 새 WU 를 스스로 만들지 않는다**

```
직전 작업   🟡🟡 **`MI-IDENTITY-REVIEW-COMPLETION-01` — P0-4 비교목록표 «선택기» 구현·배포**(§0-REV01)
            🟢 `selectReviewQueue` 신설 — 셀러 리스트가 **의도적으로 제외** 하는 후보
               (CONFLICT · 등급 없음 · Evidence 없는 UNKNOWN)를 **사람이 볼 창구** 로 모은다
            🟢 사유 다섯 — 판단 불가 · 추가 확인 · 자동 판정 차단 · 근거 충돌 · 식별정보 부족
            🔴 **판정 승격 0** · 셀러 화면 **불변** · 정책/가격/DB **0**
            🔴🔴 **상세설명 브랜드·상품명의 «운영 판정 연결» 은 하지 않았다** —
               `brand-1-description-evidence.test.ts:256` 이 **계약으로 금지** 하고
               해제 조건이 **GT 정밀도 재측정** 인데 그 분모가 **없다**(§0-REV01 ③)
            🟢 상세설명 **품번** 은 `MLLC-01` 로 **이미 연결·배포** 돼 있다(seller-facts.ts:412)
            🔴 **화면 배선·E2E·성능 측정은 미완** — §0-REV01 ④
그 전 작업   🟢🟢 **`MI-FINAL-COMPLETION-01` — 상품 하나가 ③~⑧ 을 «끝까지» 돈다**(§0-FIN01)
            🟢 운영 스냅샷 `25a3bba7`(EUR 62 · 후보 10 전건 판정)으로 운영 owner E2E
            🟢 ④⑤ 가격 집계 실제 산출 EUR 62 · GBP 58 · 차단축 7건 영향 **0**
            🟢🟢 ⑥ **시장 미확정 3건**(그중 **SAME·EXACT 1**) ⟹ D 축이 **실데이터에서 발화**
            🟢 ⑦ 원가 ₩94,055 → **CASE D(판단 보류)** · 🔴 입력에 시장 가격 **0**(A/B 분리)
            🟢 ⑧ sellability **YELLOW** — 국내 SAME 0 인데 GREEN 아님
            🔴 **MI P0 는 미완** — 국내 오탐·탐색률 분모가 비어 있다(§0-FIN01 ⑤)
그 전 작업   🟡🟡 **`MI-P0-CROSS-MARKET-COMPLETION-03` — GT × 운영 조인 · 🔴 MI P0 «미완»**(§0-XM03)
            🟢🟢 **오탐 분모가 처음 생겼다** — 확정 SAME **4/4 정확 · 오탐 0** ·
               보류 2는 **둘 다 human DIFFERENT** · human SAME 회수 **4/4**
            🔴 연결 **6 / 39** — domain 조인은 1:1 이 0건 · `brand-conflict`(159)는 URL 칸 없음
            🔴🔴 **조인에서 두 번 틀렸다** — `?? v`(사람 판정) 폴백 ⟹ 동어반복 ·
               `source` 로 거르기 ⟹ provenance 아님. 둘 다 고쳐서 다시 쟀다
            🔴 **국내 표본이 0** 이라 국내 오탐·회수율은 **여전히 측정 불가**
그 전 작업   🟡🟡 **`MI-P0-CROSS-MARKET-COMPLETION-02` E — 측정 완료 · 🔴 MI P0 는 «미완»**(§0-XM02)
            🔴🔴 **지시 전제를 데이터가 정정** — 국내 탈락 5건의 원인은
               UNREACHABLE 2 · REDIRECTED_AWAY 1 · tier EXCLUDED 2 ⟹ **market UNKNOWN 0**
            🟢🟢 **「국내 SAME 0」이 이 분모에서 반증** — human 동일 2/2 국내참고 진입 ·
               `beaumonde` **SAME · EXACT · blockers []** · 🔴 분모 섞지 않는다(core-same03 10)
            🔴 **못 잰 것 셋** — 오탐(DIFFERENT 0) · 탐색률(발견 분모 없음) · 운영 market 분포(1건)
            🔵 **필요한 데이터 하나** — 운영 칸(market·system·tier·blockers)을 가진
               **DIFFERENT 포함 GT** · 🔴 그 전에는 E 를 완료로 적지 않는다
그 전 작업   🟢🟢 **`MI-P0-CROSS-MARKET-COMPLETION-01` — A·B·C 는 «이미» 완성 · D 구현·배포**(§0-XM01)
            🟢🟢 **A·B·C 를 다시 만들지 않았다** — 운영에서 이미 하나다:
               생산자 **7**(국내 등록부 p0/other · 해외 자동 · URL · 재투입 · 국내 목록 · 웹검색)
               → `searchResults` **한 배열**(:1513 + :2070) → **한 엔진** `judgeDomesticCandidate`(:2169)
            🔴 **D 에 구멍이 있었다** — 후보 리스트가 시장을 **둘** 로만 갈라
               `market UNKNOWN` 후보가 **두 칸 어디에도 서지 않았다**(WU-140 ④ 의 그 거짓말)
            🟢 **「전체(All)」 축 신설** — 같은 선택기에서 파생 · 🔴 **가격 0**(통화 혼합 금지) ·
               승격 0 · 기존 두 칸 산출 **불변** · 배포 `def2aa5`
            🔴 **E 는 분모가 막는다** — GT 를 합치지 않고 fixture 별로 적었다(§0-XM01 ③)
그 전 작업   🟢🟢 **`MI-ORIGIN-FX-VARIANT-WIRING-04` — 구현·검증 완료 · 🟢 배포 완료**(§0-OFX04)
            🟢 probe 경로가 원본 URL 의 **`?variant=` 를 보존** 한다 — 운영 **1파일 · 실코드 +9줄**
            🟢 **새 규칙 0** — 옵션 선택·「못 찾으면 가격 미산출」은 `shopify-product-json.ts:426`
               에 **이미 있었다** ⟹ 그 함수에 URL 을 온전히 넘기는 **배선** 하나다
            🟢 대표 사례 원가 **£115 → £119**(지정 옵션 UK 11) · 미지정/오류/미발견 전부 안전
            🟢🟢 기존 계약 `C-1`(비대칭 고정)이 **설계대로 FAIL 로 뒤집혔고** 방향을 뒤집어 **강화**
            🔴 가격 영향 — variant 고정 스냅샷 **9/566** · 값이 바뀔 ORIGIN_FX **2** · 과거 행 **0**
            🟢🟢 **[04A 보완] 무효한 variant 지정에 첫 옵션 가격을 쓰지 않는다**(CPO 지적)
               `?variant=abc` · `?variant=`(명시했으나 쓰레기)가 **115 를 반환** 하고 있었다 ⟹
               `?variant=99999999999`(숫자인데 없다 · null)와 **불일치** 였다
               🟢 `resolveRequestedVariant` 로 셋을 갈라 **무효면 두 진입점 모두 차단**(질의 0회)
               🔴 숫자 규칙은 **복제하지 않았다** — owner 가 판단하고 probe 는 `has` 로 존재만 본다
            🟢🟢 **[FINALIZE] CPO 승인 · main FF · Production 배포 완료 · CLOSED**
               빌드 `Branch: main, Commit: **15ea5d9**` · `● Ready` · `ttaejyo.vercel.app` 전환
               🟢 main == uird-deploy-01 == HEAD == **15ea5d99**
그 전 작업   🟢🟢 **`MI-ORIGIN-FX-DISCREPANCY-03` — 미규명 2건 «원인 확정»**(§0-OFX03)
            🟢🟢 원인 = **사이즈별 가격 × URL 의 `?variant=`** — 추출은 그 옵션(£119)을
               존중하고 관측은 그 파라미터를 **버려** 첫 구매가능 옵션(£115)을 쓴다
               ⟹ 🔴 둘 중 하나가 «틀린 값» 이 아니라 **서로 다른 옵션의 가격** 이다
            🔴 더 정확히는 **같은 수정이 한쪽 경로에만 적용됐다** — CEO 지시 P0-A.29-E ㉮
               (`683d9d83` · 2026-09-20)가 **추출 경로만** 고쳤고 probe 경로는 그 이전(09-13)이다
            🔴🔴 **현재 생산 경로에서 재현된다**(사례 관측이 수정 «이후» 다) — 과거 잔존이 아니다
            🟢 영향 범위 — ORIGIN_FX 498 중 `?variant=` 고정 **9** · 그중 불일치 **2**
            🔴 **수정 0**(지시가 운영 코드 변경 금지) · 계약 `C-1` 이 현재 상태를 고정 ⟹
               probe 에 variant 가 배선되면 **FAIL 로 뒤집힌다**(수정의 증거)
그 전 작업   🟢🟢 **`MI-ORIGIN-FX-ACCURACY-02` — 운영 DB 전수 측정 완료**(§0-OFX02)
            🟢 운영 DB **읽기 전용** 경로가 이 환경에 **있었다** — `packages/database/.env`
               + `node --env-file=.env packages/database/scripts/*.mjs`(Prisma)
            🔴 **지시의 숫자가 낡았다** — 397/1,476 → 실측 **566 스냅샷 / 2,395 관측**
            🟢 통화 일치 **498/498(100%)** · 금액 **486/498(97.6%)** · 잘못된 선택 **0** ·
               환산 정합 **1,799/1,799** · 정답 근거 없음 **0**
            🔴 확인 불가 **140/566(24.7%)** — 전부 **2026-09-13 이전** 생성 · 그 이후 **0건**
               ⟹ 🟢 현재 생산자 경로에서 **재현되지 않는다** · 🔴 그중 **103건 원가가 KRW**
            🔴 오류 네 유형 전부 **과거 잔존** — 할인 비대칭 10 · 미규명 2 · KRW 환율"1" 47 ·
               **CAD 84 → ₩84** 4 · smallable USD/JPY 구간
            🔴 **수정 0** — 교정이 전부 DB 쓰기 또는 원가 정책 변경(금지축) ⟹ 원인·영향만 확정
            🔴 운영 코드 0 · DB 쓰기 0 · **main 머지 0 · 배포 0**
그 전 작업   🟡🟡 **`MI-ORIGIN-FX-ACCURACY-01` — 측정 완료 · 🔴 분모가 397 이 «아니다»**(§0-OFX01)
            🔴🔴 **CPO 지시의 분모 397 에 도달하지 못했다** — 그 데이터는 운영 DB 이고
               `DATABASE_URL`·service-role 키가 **둘 다 없다**(실측). 저장소 전수에서
               ORIGIN_FX 관측 입력은 **하나**(스냅샷 13 · 관측 58)뿐이었다
            🔴 그 13 은 상품 13개가 아니라 **고유 상품 2개** 의 반복이다 ⟹ 비율 일반화 금지
            🟢 측정(운영 owner 직접 호출) — 원본가격 **12/12** · 통화 **12/12** ·
               잘못된 선택 **0** · 환산 정합 **47/47** · 🔴 **확인 불가 1/13**
            🔴 **수정 0** — 확인 불가 1건은 과거 데이터 잔존분이고 고치는 길 둘이 모두 금지축
            🔴 운영 코드 0 · 정책 0 · DB 0 · **main 머지 0 · 배포 0**(지시: 실제 변경 없으면 배포 금지)
그 전 작업   🟢🟢 **`MI-REGRESSION-PORTABILITY-01` — 구현·검증·push 완료 · CLOSED**(§0-RP01)
            🔴🔴 **가격 안전성 계약이 다른 환경에서 «한 번도» 돌지 않았다** —
               입력이 머신 로컬 `TEMP` 덤프였고 `describe.runIf` 가 **조용히 SKIP** 했다
            🟢 입력을 저장소로 옮겼다 — `fixtures/brand-conflict-price-real.json`
               (운영 저장분 **159건** · 값 무변경 · `census` 보존 · 민감문자열 0)
            🟢 `describe.runIf` **제거** · 입력 부재/분모 변화는 **E-0 이 FAIL** 한다
            🟢 기존 9개 단언(R-1~3 · P-1~3 · C-1~3)을 **한 글자도 바꾸지 않았다**
            🔴 운영 코드 **0** · DB/schema **0** · 정책/집계기/분류표 **0** · GT 라벨 **0**
            🟡 **사업 성과가 아니다** — 회귀 안전성 개선이다
            🟢🟢 **CPO 승인 후 main fast-forward + Production 배포 완료**
               (`MI-REGRESSION-PORTABILITY-01-MERGE-DEPLOY` · 빌드 로그
                `Branch: main, Commit: f7c12fe` · `ttaejyo.vercel.app` alias 전환 확인)
그 전 작업   🔵🔵 **`MI-UNIFIED-MARKET-ARCHITECTURE-03`** — **CPO 결정: ④ 아무것도 변경하지 않는다**
            🔴 가격 축 통합 **보류**(승인 안 한 변경 5건은 §0-ARCH03 B)
            🟢🟢 **정정** — 국내 가격 축은 **둘** 이고 `transient` 축은 해외와 **이미 공통** 이다
               (같은 타입·같은 집계기·`blockers` 실제 전달) · 남은 것은 **DB 영속 축 하나**
            🔴 재검토 조건 **5**(§0-ARCH03 E) — 첫째가 **GT KR 표본**(현재 0건)
            🔴 코드 0 · 테스트 0 · DB 0 · 배포 0 — 문서만
그 전 작업   🔵🔵 **`MI-UNIFIED-MARKET-ARCHITECTURE-01`** — **CPO 전략 확정 · 문서화 완료**
            🔵 최상위 기준이 **§0-ARCH01** 에 고정됐다(원칙 10 · 체크 8 · 차이 8 · 결정대기 4)
            🔴 코드 0 · 테스트 0 · DB 0 · 배포 0 — **문서 1파일만** 바꿨다
            🔴 다음은 **조사가 아니라 §0-ARCH01 G 의 결정 4건 중 하나** 다(CPO 지정)
그 전 트랙   🟢🟢 **`MI-LISTING-LABELED-CODE-01` — 구현·검증 완료 · CLOSED**(§0-MLLC01)
            운영 코드 **1줄** — `productFactsFromListing` 의 `brandModelCode` 를
            **라벨 전용**(`extractLabeledProductCode(input.description) ?? null`)으로 채운다
            🔴 slug 폴백 · sellerSku · 라벨 없는 코드 · 제목토큰 — **전부 금지**(계약 5파일이 잠금)
            🔴 `materialText`·`fitText`·`ageRangeText`·`sizeLabels` 는 **그대로 제한 유지**
            🟢 계약 앵커 **4건 갱신·강화** + A-0 **per-label 단언** + STEP A-2(확인 배선)
            🔴 **운영 verdict 변화 0** — 이득은 **잠재적** 이다(브랜드 등록부가 구속 조건 · 별도 과제)
            🟢🟢 **[2026-11-21 정정] 배포 완료** — 커밋 `39d688f6` 이 Production 빌드
               **`95fd84b`** 에 실려 있다(실측 `origin/main:seller-facts.ts:412`)
               🔴 전에 「배포 안 함(main 머지 승인 사항)」으로 적혀 있었다 — **낡은 기록이다**
그 전 트랙   **`MI-IDENTITY-DATA-FLOW-01`** — 조사 단계 종료(CPO 확정) · §0-FLOW01 참조
            🟢🟢 **이 트랙의 반복 관측이 «하나의 구조적 원인» 으로 설명됐다** —
            판매처별 `ProductFacts` 생성 경로의 **비대칭**(Shopify ↔ Listing · 최대 7점 손실)
            🔴 **CPO: 같은 현황을 다시 조사하지 않는다** · 다음은 **원인 해결 단계** 다
            🔴 결정 — Smallable `description` 칸 **보류**(정확도 개선이 아니다) ·
               동결 순위 1~4 **승인 보류** · 코드/DB/Git(문서 외) **변경 0**
그 전 트랙   **`MI-DESCRIPTION-COMPARISON-01`** — 측정 종료 · §0-MDCP01 참조
            🔴🔴 **기존 「상세설명 효과 0」은 CONTROL 실패(1/16) 상태의 값이라 결론이 아니었다**
            🟢 원인 둘로 갈림 — ⒜ 하니스가 후보 brand 를 판정기에 안 넘김(**복구 가능** · 2→4/24)
            ⒝ fixture 에 후보 구조화 facts 없음(**복구 불가** · 15건 축 1개)
            🔴 복구 후에도 CONTROL **4/24** ⟹ 이 분모의 효과 수치는 전략 판단에 쓰지 않는다
            🟡 CPO 판단 — 같은 레버의 기존 REJECT 를 열려면 **오염 호스트가 든 분모** 가 필요하다
그 전 트랙   **`MI-DOMESTIC-CONTROL-01`**(가격 자격 CONTROL) — 종결 · §0-MDC01 참조
            🔴 그 WU 가 인수인계 ⑦의 「10건 tier COMPARISON = 가격 비교 유입」을 **정정** 했다
            🟡 남은 것은 **CPO 판단 1건**(국내 금액 축에 「관측된 차이」 필터 여부 · §0-MDC01 ⑥)
그 전 트랙   KIDS MI 핵심 식별 증거 검증 — **전부 종결**(CPO 최종 검토 완료)
최종 커밋   🟢🟢 **[2026-11-21 갱신] `79e449e6`** — `origin/main` == `origin/uird-deploy-01`
            == HEAD **(0 0)** 로 정렬 · 🟢 **Production 반영 완료**
            (빌드 `Branch: main, Commit: 79e449e` · `● Ready` · `ttaejyo.vercel.app` alias 전환)
            🔴 아래 줄들은 **그 시점의 기록** 이다 — 「`origin/main` behind · 배포 0」은
               **더 이상 현재 상태가 아니다**(당시 `317a8346` 기준의 서술이었다)
🔴🔴 **이 문서 전역 주의** — 각 WU 절의 「배포 **0** · main 머지 **0**」은 **그 WU 가 그때
            무엇을 바꿨는지** 의 기록이고 **현재 Git/Production 상태가 아니다.**
            🟢 현재 상태는 **이 줄 하나** 다 — 이 문서의 모든 내용과 그 트랙의 커밋은
            `79e449e6` 로 **main 에 반영되어 Production 에 배포돼 있다.**
            🔴 운영 코드 변경이 있었던 절은 **§0-MLLC01 하나** 이고 그것도 **배포 완료** 다.
작업트리    **120건**(사용자 수정 15 + untracked) — 🔴 **이것이 기준선이다. 종료 시 같은 수로 돌린다**
운영 코드    🔴 **KIDS MI 검증 트랙에서는** 0줄 변경 · DB **0**
            🟢🟢 **단 이 문서의 다른 트랙에는 운영 변경이 있고 «이미 배포됐다»** —
               `MI-LISTING-LABELED-CODE-01` 의 **1줄**(`39d688f6` · §0-MLLC01)이
               Production 배포 **`95fd84b`** 에 실렸다(실측: `origin/main:seller-facts.ts:412`)
               🔴 「운영 코드 0 · 배포 0」을 **문서 전체의 상태로 읽지 않는다**
다음 범위    🔴 **CPO 가 지정한다** — 기준은 「**현재 확인 가능한 증거로 개선 효과를 입증할 수
            있는 과제**」(미규명 문제를 다시 열지 않는다)
```

### ①-b 🔵🔵🔵🔵 **최상위 전략 기준 — 모든 MI 작업 «전» 에 읽는다**

```
🔵 **§0-ARCH01 `MI-UNIFIED-MARKET-ARCHITECTURE-01`**(CPO 확정 2026-11-21)
   한 줄 — **후보는 전체 시장에서 찾고, 판단은 «하나의» MI 엔진에서 하며,
            화면에서 국내와 해외를 구분한다.**
🔴 그 절의 **절대 유지 원칙 10** 과 **전략 정합성 체크 8** 을 착수 전에 통과시킨다
🔴 국내·해외 **별도 판정 엔진을 새로 만드는 작업 금지** · 공통 계약 변경은 **CPO 승인**
🔴 개별 blocker·브랜드·상품·어댑터 개선이 **전체 전략보다 우선하지 않는다** —
   그 작업이 **공통 아키텍처의 어느 단계에 기여하는지** 를 반드시 명시한다
🟢 현재 구현 ↔ 목표의 **차이 8항목**(코드 위치 포함)은 §0-ARCH01 **F** 에 있다
🟡 CPO·CEO 결정 대기 **4건** 은 §0-ARCH01 **G** 에 있다 — 🔴 CTO 가 열지 않는다
```

### ①-c 🔵🔵🔵 **운영 방식 — §0-EXEC01 `MI-EXECUTION-EFFICIENCY-01`**(CPO 2026-11-21)

```
🔵 체계  기존 근거 재사용 → CPO 우선순위 → 승인 범위 내 실행 → E2E·회귀 → **사업 성과 보고** → 종료
🔴 금지  이유 없는 재조사 · 종료 이슈 재개 · 같은 사실 중복 작성 · 단순 확인용 조사 신설 ·
        🔴 **선택지를 나열해 결정을 미루는 행위** · 🔴 **테스트 통과 수를 성과로 보고** ·
        완료 작업에 검토 단계 덧붙이기
🟢 CTO 자율  승인 범위 안의 **세부 구현 방법** · 산출물 재사용 · 한 묶음 실행 ·
            🔴 장애·정책 충돌이 없으면 **중간 승인 요청 금지**
🔴 승인 필요 8  정체성 정책 · 가격 적격성/blocker · 가격 산출/FX · 동결 공급원 확대 ·
              DB/schema · 보호 문서 · **main merge·배포** · 사업 전략·사용자 정책
🔵 보고 7  사업 기능 · 실제 상품 성과 · **GT SAME 회수 ↔ DIFFERENT 오탐** ·
          가격 관측/적격/표시 변화 · 부작용 · 미해결 위험 · Git·Production
          🔴 성과를 재지 못했으면 **「성과 미측정」으로 적는다**
🔵🔵 **일괄 실행 · 최종 1회 보고**(§0-EXEC01 **H~K** · `OPERATING-MODE-02`)
   🔴 작업지시서는 **항상 CPO 가 쓴다** · CTO 는 승인 범위를 **처음부터 끝까지** 수행한다
   🔴🔴 **CEO 에게 중간 단계별 검토·승인을 요청하지 않는다** · 중간 보고서 제출 금지
   🔴 중단·보고 예외는 **넷뿐** — ⒜ 미승인 사업 정책 변경 ⒝ 데이터 손실·Production 위험
      ⒞ 동결 정책 충돌 가능성 ⒟ 진행 불가한 실제 장애
   🟢 그 외(기술 선택 · 구현 방법 · **테스트 실패 수정** · 일반적 불확실성)는 **CTO 가 해결** 한다
```

### ② 🔴🔴 다시 열지 않는 것 (CPO 확정 · 재조사 금지)

```
B-38 후보 품번 복구(`productFactsFromListing` brandModelCode)   **NO-GO**(§0 전문)
AC↔AB · `AGE-LINE-POLICY-01`                                  기존 계약 **9건** 으로 종결
상품유형 토큰 운영 반영                                          **불승인** — 🔵 운영 판정 효과 **0** 측정됨
`sources.size >= 2`(PRODUCT_NAME 2출처) 완화                   **불승인**
점수 · threshold · blocker 정책 · 가격 자격                      **변경 불승인**
저장 `PRESUMED_SAME` 13건의 3점 구성                           **원인 미규명 종결**(후보 facts 미보존)
브랜드 별칭 사전 확대                                            **보류**(후보 어휘 8종은 목록만 보존)
카테고리 확장(WOMEN/ACCESSORIES/HOME)                          🔴 **보류** — KIDS 먼저
🔴🔴 **[2026-11-21 추가 · CPO 확정] 아래 «현황 조사» 를 다시 하지 않는다**
   상세설명 비교 효과 재측정 · 제목↔설명 제품명 충돌 축 · 미라벨 GT 자료상태 재분류 ·
   가격 자격 국내/해외 비대칭 · **식별정보 데이터 흐름 재추적**
   ⟹ 🟢 결론은 §0-FLOW01 · §0-MDCP01 · §0-MDC01 에 있다. **원인은 특정됐다.**
   🔴 다음은 조사가 아니라 **원인 해결** 이고 범위는 **CPO 가 지정** 한다
```

### ③ 작업 방식 (헌장 §4 요약 — 이것을 그대로 지킨다)

```
🔴 **착수 전 「기존 구현 확인」** — 이 트랙에서 「이미 있었다」가 **5번** 나왔다(§A-MI 전부)
🔴 **WU 는 한 덩어리** — 조사→원인확정→전수검토→구현→E2E→회귀→배포→**보고 1회**
   단계마다 승인 요청 금지 · 중간 진행 보고 금지
🔴 **용량은 WU 단위로 판단** — 못 끝낼 크기면 **안전 종료 지점**까지 가고 **clean handoff**
🔴 **운영 owner 를 그대로 호출** — 재구현 금지 · **운영 순서대로** 부른다
   (`compareModelCode` 만 보고 `compareCrossSellerProducts` 를 안 봐서 **틀렸다**)
🔴 **칸 이름을 추측하지 않는다** — 타입/소스에서 **읽는다**(이 트랙에서 `snake_case` 로 1회 틀렸다)
🔴 **0 을 결과로 읽지 않는다** — 스캔이 0 이면 **하니스부터 의심**(실제로 1회 났다)
🔴 **CONTROL** — 저장된 운영 결과를 재현하지 못하면 그 숫자를 **전략 판단에 쓰지 않는다**
🔴 **측정불가 ≠ 0** · 분모를 **합산하지 않는다**(109 · 92 · 19 · 16 · 26 은 서로 다른 집합)
🔴 **내 지표 ↔ 운영 축을 갈라 적는다** — 이 구분이 **거짓 개선 보고를 막았다**(63.6%→9.1% 사건)
🔴 산출물은 **`preserved/`** 에만 쓴다 — `fixtures/` 에 쓰면 **사용자 계약이 FAIL** 한다
```

### ④ Git · 보존 (절대 규칙)

```
🔴 `git add .` · `reset --hard` · `clean` · `stash` · 강제 checkout **전부 금지**
🔴 **내 파일만 명시적으로** `git add <path>` · 사용자 수정/untracked **전부 보존**
🔴 보호 문서 수정 금지 — `docs/START-HERE.md` · `docs/STANDARD-V1.md` · `CLAUDE.md`
🔴 동결 브랜치 `mi-locale-link-01` = **`7b093ef4`**(수정·머지·배포 금지)
🔴 `origin/main` 머지 · Production 배포 — **승인 없이 하지 않는다**
🟢 순서 — 테스트 → typecheck → **회귀** → commit → push (회귀 전 커밋 금지)
```

### ⑤ 회귀 실행 명령 (🔴 사용자 untracked 테스트 2개 제외)

```bash
cd apps/admin && npx vitest run \
  --exclude "src/app/pipeline/__tests__/golf01-wire-page-chain.test.ts" \
  --exclude "../../packages/crawler/src/comparison-search/__tests__/kids-locale-link-integration-design.test.ts"
# 🟢 기준선 — 936 files / 11,462 passed / 0 failed · typecheck 0 errors
# 🔴 그 두 파일은 **사용자 untracked** 이고 기준선에서 이미 실패한다(내 변경과 무관 · 손대지 않는다)
```

### ⑥ 보고 방식

```
🔴 **중간 보고 없이 완료 보고 1회.** 「진행 중」 보고를 하지 않는다
🔴 필수 — 숫자 + **측정 방법** + **재현 가능성**(파일·칸 이름·조인 키)
🔴 **PASS 등급을 구분** — Code / Test / Type / Build / Deploy / Production UI / Production API
   🔴 「테스트 PASS」를 「Production PASS」로 쓰지 않는다
🔴 **UNMEASURED 를 PASS 로 적지 않는다** · 추정으로 칸을 채우지 않는다
🔴 내가 틀린 것은 **그대로 적는다**(이 트랙에서 **5번** 정정했고 그것이 신뢰의 근거다)
🔴 보고 끝에 **「현재 좌표 + 다음 한 수」** 를 적고 **이 문서 §0-HANDOFF 를 갱신** 한다
🔴 CEO 에게는 **실제 화면 확인이 필요한 순간에만** 올린다(§3 게이트) · 단계별 승인 요청 금지
```

### ⑦ 이 트랙이 남긴 자산 (🟢 재사용 · 재조사 금지)

```
전략 상시 규칙   `docs/CTO-SESSION-START.DRAFT.md` **§A-MI-1 ~ §A-MI-11**
계약 개정안      `docs/MI-DESCRIPTION-CODE-CONTRACT-PROPOSAL.md`(§0 = NO-GO 결정)
측정 하니스 7종   `__tests__/` — `mi-composite-identity-eval` · `mi-code-typology-eval` ·
                `mi-operational-code-counterfactual` · `kids-core-evidence-audit` ·
                `kids-conflict-gate-counterfactual` · `kids-evidence-store-design` ·
                `kids-origin-name-nonpromotion`(4 tests)
산출물 10종      `__tests__/preserved/*.json`
🔵 핵심 수치     BRAND ABSENT **83%** · MODEL_CODE ABSENT **79%**(🔴 **fixture 축** 109쌍) ·
                GT DIFFERENT **13/13** 이 저장 `PRESUMED_SAME` ·
                blocker 는 **SAME 게이트에만** 걸린다(`PRESUMED_SAME` 을 막지 않는다)
🔴🔴 **[2026-11-20 MDC-01 정정] 위의 「10건 tier COMPARISON(가격 비교 유입)」을 «폐기» 한다**
   실측 **11건** 이고(운영 저장분 전수) 그 11건은 운영 금액 자격 퍼널에서 **전건 탈락** 한다
   ⟹ 🔴 **`priceTier` 를 「가격 비교 유입」으로 읽은 것이 틀렸다** — tier 는 관측/분류다
   🟢 GT 라벨 39행 금액 오염 — DIFFERENT **0/15** · 통과 5건 중 DIFFERENT **0**
   전문 §0-MDC01 · 산출물 `preserved/mdc-01-price-eligibility-control.json`
```

### ⑧ 새 세션 첫 메시지

```
docs/START-HERE.md §0-NOW → docs/NEXT-SESSION-B38.md §0-HANDOFF 를 읽고 시작해.
CTO 작업은 없는 상태다 — 다음 범위를 지정해 주면 그 범위만 한 묶음으로 수행해.
```

---

## 🟡🟡🟡 §0-REV01. **[2026-11-22] `MI-IDENTITY-REVIEW-COMPLETION-01` — P0-4 구현 · 나머지 미완**

🔴 **다시 조사하지 않는다.** 🟢 커밋 `5cc78592` · 정책 **0** · 판정 **0** · DB **0** · 셀러 화면 **0**.

### ① 🟢 한 것 — **비교목록표 선택기**(P0-4 의 핵심)

```
🔴 고친 문제 — 셀러용 `selectCandidateList` 는 `CONFLICT` · 등급 없음 ·
   Evidence 없는 `UNKNOWN` 을 **의도적으로 제외** 한다(2026-09-19 사고 방지 장치).
   그 규칙은 셀러 화면에서 **맞다**. 🔴 그런데 **CPO·CEO 가 판단해야 하는 후보가
   정확히 그 제외분** 이다 ⟹ **사람이 볼 창구가 없었다.**
🟢 `selectReviewQueue(rows, scope)` — 같은 `rows` · 같은 판정값 · **승격 0**
   사유 다섯  판단 불가 · 추가 확인 필요 · 자동 판정 차단 · 근거 충돌 · 핵심 식별정보 부족
   제외       확정 `SAME`(자동 판정이 끝났다) · 근거가 하나도 없는 행
   scope      `CandidateListScope` **그대로**(전체/국내/해외 공용) · 같은 URL 한 번만
🔴 셀러용 선택기를 **한 글자도 바꾸지 않았다**(그 화면은 그대로다).
```

### ② 🟢 상세설명 — **품번은 이미 연결·배포돼 있다**

```
🟢 `seller-facts.ts:412`  brandModelCode: extractLabeledProductCode(input.description) ?? null
   ⟹ **상세설명의 라벨 붙은 품번이 판정 입력으로 들어간다**(MLLC-01 · 배포 완료)
🟢 브랜드·상품명 추출기도 **구현돼 있다** —
   `brand-description-evidence.ts`(302줄) · `product-name-description-evidence.ts`(310줄)
```

### ③ 🔴🔴 **하지 «않은» 것과 그 이유 — 상세설명 브랜드·상품명의 운영 판정 연결**

```
🔴 `packages/crawler/src/comparison-search/__tests__/brand-1-description-evidence.test.ts:256`
   expect(read(owner)).not.toContain("brand-description-evidence")
   ⟹ **운영 owner 소스에 그 이름이 있으면 FAIL** 한다(계약으로 잠겨 있다)
🔴 금지 사유(CLAUDE.md §5-D) — `COLOR_VARIANT`/`FIT` 가 **다른 표기를 다른 상품으로**
   읽어 **정밀도 손실**(2분모 재현 · CPO 확정)
🔴 해제 조건 — **GT 정밀도 재측정 하나** · 🔴🔴 「정밀도 검증 없이 해제하지 않는다」(CPO)
🔴 그런데 그 재측정의 분모가 **없다** — §0-XM03 이 확정했다(국내 human DIFFERENT 0)
⟹ 🔴 **지시의 「기존 동결 계약을 임의 해제하지 말 것」을 지켜 연결하지 않았다.**
🟢 대신 지시 §3 의 「추출 ≠ 판정 확정」대로 **검토 근거로 쓰는 길** 을 열었다(①).
```

### ④ 🔴 미완료 — **이번 지시 범위 안에서 남은 것**

```
🔴 P0-4 **화면 배선** — 선택기는 있으나 `MarketPriceComparison`/검토 화면에
   **아직 그려지지 않았다**(렌더 0). 다음 세션이 **그 배선부터** 한다.
🔴 P0-6 **실제 상품 E2E** — 선택기 단위 계약(9)만 있고 운영 데이터 E2E 미실행
🔴 P0-7 **성능 측정**(브랜드/품번/상품명 추출률 · 등록률 · 누락률) 미실행
🔴 P0-5 **검토 상태 저장** — `candidate_reviews` 재사용 가능 여부 미확인
   (🟢 `saveHumanVerdict` 는 존재한다 · 🔴 `source` CHECK 확장이 필요한지 미확인)
```

### ⑤ 🔴 내 단언이 두 번 뚫렸고 둘 다 남겼다

```
⒜ A-1 을 `crossSellerConflicts: ["MODEL_CODE"]` 로 썼더니 **셀러 리스트에 선다** —
   `CANDIDATE-POSSIBLE-CONFLICT-01` 이 「품번만 충돌한 참고 후보」를 **이미 보여준다**.
   🟢 진짜 제외분(품번 «외» 축이 같이 충돌)으로 바꿨다.
⒝ B-1 에서 변이 N1(확정 SAME 가드 제거)이 **통과** 했다 — 그 행에 `reasons` 가 생기지
   않아 **두 번째 가드가 우연히** 막았다 ⟹ 첫 가드가 단독 검증되지 않았다.
   🟢 「확정 SAME + 차단축 보유」 행으로 바꿔 N1 이 **1 FAIL** 로 잠겼다.
```

### ⑥ 검증

```
신규 계약   review-queue-01.test.ts **9 passed**
음성 대조   N1 확정 SAME 가드 제거 **1 FAIL** · N2 충돌 미확인 **2** · N3 차단 미확인 **1** ·
           N4 중복 URL 허용 **1** · N5 식별정보 문턱 완화 **2** → **md5 복구 · diff 0**
회귀        **949 files / 11,588 passed / 0 failed** · typecheck **0** · build **exit 0**
🟡 1회차 `mi-reeval-05-shadow` 파일 쓰기 실패(UNKNOWN) — 단독 1 passed · 재실행 0 failed ·
   그 산출물 **해시 불변** ⟹ **실행 간 불안정**(이 세션 2회째 · 내 변경 아님)
```

---

## 🟢🟢🟢 §0-FIN01. **[2026-11-22] `MI-FINAL-COMPLETION-01` — 통합 MI 운영 E2E**

🔴 **다시 조사하지 않는다.** 🟢 커밋 `3c7d82d0` · 운영 코드 **0** · DB 쓰기 **0** · 정책 **0**.

### ① 무엇을 증명했나 — **상품 하나가 ③~⑧ 을 끝까지 돈다**

```
표본  운영 스냅샷 `25a3bba7…` Bobo Choses Pop sweatshirt · **EUR 62** ·
      priceBreakdown {fee 10% · shipping ₩12,000 · margin 12%} ·
      관측 **6** · 후보 **10**(🟢 전건 운영 판정) · 🔴 상품 **1개** · human 라벨 **0**
🔴 `computeMarketIntelligence` 는 **supabase service-role 키** 를 요구해 직접 호출 불가 ⟹
   🟢 **그 함수가 부르는 운영 owner** 들에 같은 입력을 넣어 ③~⑧ 을 돌렸다(복제식 0).
🟢 ①② 는 §0-XM01 이 **코드 위치로** 확정했다 — 재조사하지 않았다.
```

| 단계 | 운영 owner | 실제 산출 |
|---|---|---|
| ③ 판정 | `system_verdict`(judgeDomesticCandidate 산출) | **10/10** 보유 · 판정 어휘 **한 집합** |
| ④⑤ 가격 | `summarizeCandidateOverseasPrices` | **EUR 62 · GBP 58** · byMarket{OVERSEAS 7 · UNKNOWN 3} · byPriceTier{EXACT 2 · COMPARISON 8} |
| ④ 차단축 | `PRICE_DISQUALIFYING_BLOCKER_LIST` | 보유 **7건** → 금액 집계 영향 **0** |
| ⑥ 화면 | `selectCandidateList` ALL/KR/OVERSEAS | 전체 10 · 🇰🇷 0 · 🌎 7 · 🔴 **시장 미확정 3** |
| ⑦ 원가→추천가 | `selectCostBasisOriginObservations` → `computePriceRecommendation` | 원가 **₩94,055** → **CASE D(판단 보류)** |
| ⑧ MI CASE | `computeSellability` | **YELLOW**(국내 SAME 0 인데 **GREEN 아님**) |

### ② 🟢🟢 **D 축이 실데이터에서 «발화» 했다**

```
시장 미확정 **3건** — coupleshot.com · kids-world.com · **mariodannakids.it**
🔴 그중 `mariodannakids.it` 은 **SAME · STRONG_IDENTIFIER · EXACT** 다
⟹ 🔴🔴 「전체」 축이 없으면 그 후보가 **화면에서 사라진다**(🇰🇷 0 · 🌎 7 에 안 든다)
🟢 §0-XM01 이 fixture 로 증명한 것이 **운영 실데이터에서 재현** 됐다
```

### ③ 🟢 A/B 분리와 「없는 데이터로 추천하지 않는다」가 지켜진다

```
⑦ 추천가 입력에 **시장 가격이 한 칸도 없다**(`domesticLowestPriceKrw: null` ·
   `domesticBasis: "NONE"`) ⟹ **CASE D** · `recommendedPrice: null`
   🟢 `minimumPrice`/`targetPrice`(₩120,517)는 **원가 역산** 값이고 시장 평균이 아니다
⑧ sellability — 국내 확정 SAME **0** ⟹ **YELLOW**(🔴 GREEN 아님)
```

### ④ 🔴 내 단언이 두 번 틀렸고 코드가 맞았다

```
⒜ 「`lowestKrw` 칸이 있으면 환산한 것」 → **FAIL**. 그 칸은 **호출자가 넘긴
   `krwEquivalent` 의 파생** 이고 집계기는 환율을 **모른다**(candidate-market.ts:633).
   🟢 단언을 「넘기지 않았으니 **null 이어야** 한다」로 바꿔 **경계를 지키는 방향** 으로 강화했다.
⒝ 칸 이름을 추측해 **typecheck 가 잡았다** — `costKrw`/`feePercent` 가 아니라
   **`totalCostKrw`·`expectedFeePercent`·`domesticBasis`** · **`costPriceKrw`·`domestic.matched`**.
   🟢 타입에서 읽어 고쳤다(§12 의 반복 함정 · 이번에도 **사전에** 잡혔다).
```

### ⑤ 🔴 남은 미완료 — **현재 MI 범위에서 반드시 해결해야 하는 것**

```
🔴 **국내 오탐(precision)과 후보 탐색률** — 분모가 비어 있다
   ⒜ 국내 표본에 human **DIFFERENT** 가 없다(`core-same03` DIFFERENT 0 ·
      `cross-market-eval-03` 의 `.kr` 0)
   ⒝ 발견 단계 분모가 없다(보유 자료는 전부 「후보가 된 뒤」다)
🔵 **필요한 원천은 하나** — 「**국내 후보를 포함하고 `market`·`price_tier` 가 채워진,
   human DIFFERENT 를 가진 운영 판정 자료**」
   🔴 CTO 가 만들 수 없다(새 수집·CEO 육안 GT 는 승인 사안) ⟹ **CPO/CEO 결정**
```

### ⑥ 🟡 **완료 후 별도로 검토할 추가 개선 제안**(🔴 현재 범위에 끼워 넣지 않았다)

```
① 국내 DB 영속 가격 축의 blocker 필터        ARCH-03 보류 · human SAME 2건 손실 실측
② ORIGIN_FX 과거 행 backfill(140 · CAD 4 등)  §0-OFX02 ⑥ · DB 쓰기 승인 사항
③ 상세설명 증거를 운영 SAME 판정에 연결        §5-D 동결 · 재개 조건 = GT 정밀도 재측정
④ `brand-conflict-price-real` 덤프에 URL 칸 추가  조인 가능 범위를 159행 넓힌다
⑤ 「전체」 축의 **가격 표시**                 🔴 통화 혼합이라 현 정책에서는 불가 · 정책 사안
```

---

## 🟡🟡🟡 §0-XM03. **[2026-11-22] `MI-P0-CROSS-MARKET-COMPLETION-03` — GT × 운영 산출 조인**

🔴 **다시 조인하지 않는다.** 🟢 커밋 `0044d24e` · 운영 코드 **0** · 새 GT **0** · 새 수집 **0**.

### ① 🔴🔴 **조인에서 두 번 틀렸고 둘 다 남긴다**

```
⒜ `system_verdict ?? v` 로 읽었다 ⟹ `v` 는 **사람 판정** 이라 **10/10 완전 일치** 가 나왔다
   🔴 그대로 보고했으면 **「정확도 100%」라는 동어반복 거짓** 이었다
   🟢 `system_verdict` **만** 쓴다(사람 판정으로 폴백 금지)
⒝ `source === "GT_IMPORT"` 로 거르려 했다 ⟹ 🔴 `source` 는 **provenance 가 아니다**
   🟢 **시스템 칸이 실재하는가**(`system_verdict != null`)로 거른다(기존 메모의 규칙)
```

### ② 조인 범위 — 🔴 **실패를 숨기지 않는다**

```
키        **정규화 URL 하나**(host 소문자 · `www.` 제거 · 끝 슬래시 제거)
🔴 domain 조인 **쓰지 않았다** — wu-112 도메인 × 운영 덤프에서 **1:1 이 0건**
   (junioredition **62행** · global.trenbe **2행** ⟹ 어느 행에 붙일지 알 수 없다)
🔴 `brand-conflict-price-real`(**159행**)은 **URL 칸이 없어** 조인 대상에서 빠졌다
운영 덤프  `dsp-01` · `ceo-evidence-review-db` · `ux04-b3` = **45행** ·
          그중 **운영 판정 실재 19**
결과      human GT **39** → 연결 **6**(고유 URL) · 🔴 **미연결 33**
```

### ③ 🟢🟢 측정 — **오탐 분모가 처음 생겼다**

| 지표 | 분자 / 분모 |
|---|---|
| 🟢 확정 SAME 정밀도 | **4 / 4**(오탐 **0**) |
| 🔴 보류(PRESUMED) × human DIFFERENT | **2 / 2** |
| 🟢 human SAME 회수율 | **4 / 4**(놓친 동일상품 0) |
| 🟡 가격 참고 축 도달 | **1 / 6** |
| 🟡 시장 분류 기록 | **1 / 6**(OVERSEAS 1) |

🔴 **확정과 보류를 합치지 않는다** — 합치면 「4/6」이라는 **다른 사실**이 된다.
🔴 **`null` 을 UNKNOWN·제외로 읽지 않는다** — 그 칸이 **비어 있다**(tier 5 · market 5).
🟢 그리고 **보류 2/2 가 human DIFFERENT** 인 것은 WU-123/125 패턴의 **재현**이다.

### ④ 🔴 여전히 측정 불가 — **0% 로 적지 않는다**

```
① 후보 탐색률        발견 단계 분모 없음(이 자료는 「후보가 된 뒤」를 담는다)
② **국내** 오탐·회수율  🔴 이 자료의 `.kr` 표본 **0** · `core-same03` 은 DIFFERENT **0**
                     ⟹ 🔴 **국내 오탐은 어느 자료로도 측정 불가** 다
③ 시장 분포          `market` 칸 보유 **1 / 6**
🔵 필요한 원천 **하나** — 「**국내 후보를 포함하고 `market`·`price_tier` 칸이 채워진,
   human DIFFERENT 를 가진 운영 판정 자료**」
```

---

## 🟡🟡🟡 §0-XM02. **[2026-11-22] `MI-P0-CROSS-MARKET-COMPLETION-02` E — 측정 완료 · MI P0 는 «미완»**

🔴 **다시 조사하지 않는다.** 🟢 커밋 `a1a264f5` · 운영 코드 **0** · 새 GT **0** · 새 수집 **0**.

### ① 🔴🔴 **지시 §3 의 전제를 데이터가 정정했다**

```
지시   「운영 market 이 UNKNOWN 인 원인을 확정한다」
실측   `core-same03` 의 `.kr` **7건 전수** — 국내 축 탈락 **5건** 의 원인:
       **UNREACHABLE 2 · REDIRECTED_AWAY 1 · tier EXCLUDED 2** ⟹ 🔴 **market UNKNOWN 0**
⟹ 🔴 **3/5 는 시장 분류 «이전» 단계** 에서 끝났다(후보를 읽지 못했다).
   나머지 2는 판정이 **났고** tier 가 EXCLUDED 다(SIMILAR · CONFLICT) — 시장 문제가 아니다.
🔴 그리고 **「market 칸이 null」을 「UNKNOWN」으로 읽지 않는다** — GT fixture 에 그 칸이
   **없을 뿐** 이다(보유한 GT 는 `wu-116` **1건** 뿐이고 그 값은 **KR 확정**).
```

### ② 🟢🟢 **「국내 SAME 0」이 이 분모에서 «반증» 됐다**

```
🇰🇷 human 동일 **2건이 둘 다 국내 참고가격 축에 들어간다**(`inDomesticReference = true`)
   www.beaumonde.co.kr  **SAME** · STRONG_IDENTIFIER · **EXACT** · blockers **[]**
   biskuit.kr           PRESUMED_SAME · COMPARISON · [BRAND_MISMATCH · NO_TITLE_OVERLAP]
⟹ 🟢 **국내에서 SAME + EXACT 가 실재한다.** 「국내는 구조적으로 0」이 아니다.
🔴 **분모를 섞지 않는다** — 이것은 `core-same03`(10) 의 사실이고, 과거의 「국내 SAME 0」은
   **다른 분모·다른 시점**(WU-138 · B226AC009)이다.
```

### ③ 성능 — 🔴 **분모를 같이 적고 합치지 않는다**

```
🇰🇷 국내  .kr **7** · human 동일 2 · 국내참고 **2/2** · SAME 1 · PRESUMED 1 · 가격축 **2/7**
🌎 해외   **3** · human 동일 3 · SAME 1 · PRESUMED 2 · 가격축 **3/3**
🟢 **같은 판정 어휘** 를 쓴다(C-2) — 국내 전용 «판정» 상태 **0**.
   국내에만 있는 `UNREACHABLE`·`REDIRECTED_AWAY` 는 **판정이 아니라 수집 실패** 다.
```

### ④ 🔴 측정 불가 — **0% 로 적지 않는다**(계약으로 못 박았다)

```
① 오탐(precision)   분모 **0** — `core-same03` 에 human DIFFERENT 가 없다
② 후보 탐색률        분모 **없음** — fixture 가 「후보가 된 뒤」를 담는다(발견 단계가 빠졌다)
③ 운영 market 분포   그 칸을 가진 GT 가 **1건**(wu-116 · KR) ⟹ 분포를 말할 수 없다
🔴 `wu-112`(27 · DIFFERENT 6)는 **운영 칸이 없다**(sid·domain·url·verdict·reason) ⟹
   human 라벨은 있지만 **운영 결과와 대조할 수 없다**(A-0 가 그 사실을 계약으로 고정)
🔵 **필요한 추가 데이터는 하나다** — **운영 `market`·`system`·`priceTier`·`blockers` 칸을
   가진, human DIFFERENT 를 포함한 GT.** 🔴 그것 없이는 ①③ 을 영원히 못 잰다.
```

### ⑤ 🟡 **MI P0 완료 여부 — 아직 아니다**

```
🟢 A 통합 탐색 · B 공통 정규화 · C 단일 엔진 · D All/Domestic/Overseas  — 완료(배포)
🟡 E 실데이터 성능 — **부분 완료**
   🟢 잰 것 — 국내·해외 공통 기준 적용 · 국내 SAME/EXACT 실재 · 탈락 원인 전수 ·
      가격축 도달 · 판정 어휘 동일성
   🔴 못 잰 것 — 오탐 · 탐색률 · 운영 market 분포 (분모 부재 · 위 ④)
🔴 **E 를 완료라고 적지 않는다.** 분모가 없는 것을 수치로 만들지 않았다.
```

---

## 🟢🟢🟢 §0-XM01. **[2026-11-22] `MI-P0-CROSS-MARKET-COMPLETION-01` — A·B·C 기완성 · D 구현·배포**

🔴 **다시 조사하지 않는다.** 🟢 커밋 `def2aa52` · main 반영 · Production **`def2aa5`** `● Ready`.

### ① 🟢🟢 **A·B·C 는 «이미» 운영에서 완성돼 있었다 — 다시 만들지 않았다**

```
A 통합 탐색   `run-domestic-price-check.ts`
   :1513  const searchResults = [...p0Results, ...otherResults, ...(overseasAuto?.searchResults ?? [])]
          ⟹ **국내 등록부 + 해외 자동** 이 한 배열
   :2070  searchResults.push({ ...r, candidates: priced })   ← `transientPools` 전부가 합류
          ⟹ 생산자 **7**(국내 p0 · 국내 other · 해외 자동 · URL · 재투입 · 국내 목록 · 웹검색)
B 공통 정규화 같은 `ComparisonCandidate` → `withConfidence` → `ProductFacts`
C 단일 엔진   :2098 `for (const result of searchResults)` → :2169 **`judgeDomesticCandidate` 한 번**
              🟢 호출부가 **하나뿐** 이다(전수 grep · 국내/해외 전용 분기 0)
가격 적격성   축2 국내 transient · 축3 해외 · 축4 마진이 **같은 집계기**
              (`summarizeCandidateOverseasPrices` · ARCH-02 정정) ·
              🔴 축1 국내 DB 영속만 다르고 그것은 **ARCH-03 보류 결정** 이다
```

🔴 **그래서 A·B·C 에 코드를 쓰지 않았다** — 쓰면 **하나인 것을 둘로 쪼갠다**(§4-D).

### ② 🔴🔴 **D 에 실제 구멍이 있었고 그것을 닫았다**

```
문제   `selectCandidateList(rows, "KR" | "OVERSEAS")` 가 `row.market !== market` 으로 걸러
       ⟹ 후보 시장은 **셋** 인데(`classifyCandidateMarket` 은 증거 일치 시에만 단정)
          **`UNKNOWN` 후보가 두 리스트 «어디에도» 서지 않았다**
선례   WU-140 ④ — `beaumonde.co.kr` 은 human SAME 인 `.kr` 인데 **가격이 없어 UNKNOWN** 이라
       🇰🇷 칸이 「후보를 찾지 못했습니다」라고 **거짓** 을 말했다(그때는 **문장** 으로 메웠다)
구현   `CandidateListScope = "ALL" | "KR" | "OVERSEAS"` + `rowInScope` (술어 **한 군데**)
       화면 = 격자 **위 한 줄** — 전체 N · 국내 K · 해외 M · **시장 미확정 U**
       🔴 `U = all − kr − overseas` (**합으로 만들지 않는다** — 합으로 만들면 그 후보가 사라진다)
🔴 바꾸지 «않은» 것 — 등급(`transientDisplayTier`) · 제외 규칙(CONFLICT · Evidence 없는 UNKNOWN) ·
   SAME 기준 · 가격 적격성 · 환산 · 금액 집계 · `row.market` 값 · 기존 두 칸의 산출 · 기존 두 글자
🔴🔴 **가격을 만들지 않았다** — 「전체」에 금액을 붙이면 **통화가 섞인다**(환산 금지).
   계약 `D-3` 이 그 구간에 금액 어휘(`₩`·`KRW`·`priceKrw`·`환산`·`평균`…)가 들어오면 **FAIL** 한다.
🔴 **승격 0** — `UNKNOWN` 을 국내/해외로 바꿔 적지 않는다(`A-1` 이 양방향 단언).
```

### ③ 🔴 **E — 분모가 막는다. 숫자를 합치지 않고 그대로 적는다**

```
fixture 별 GT(🔴 **합산 금지** · 도메인 TLD 기준 국내/해외)
  wu-112-human-gt.json       n=27 · 🇰🇷 5 🌎 22 · SAME 19 DIFF 6 · 🔴 KR×SAME **2**
  core-same03-human-gt.json  n=10 · 🇰🇷 7 🌎  3 · SAME  5 DIFF 0 · 🔴 KR×SAME **2**
  wu-093-human-gt.json       n=10 · 🇰🇷 0 🌎  0 · SAME  2 DIFF 8
  wu-125-human-gt.json       n= 9 · 🇰🇷 0 🌎  9 · SAME  5 DIFF 4
  wu-111-human-gt.json       n= 2 · 🇰🇷 0 🌎  2 · SAME  2
  wu-116-human-gt.json       n= 1 · 🇰🇷 1 🌎  0 ·          DIFF 1
🟢🟢 **「GT KR 표본 0」을 정정한다 — 축을 가려 적어야 한다**:
   ⒜ **도메인이 한국인 GT 행** = **13**(그중 human SAME **4**) 🟢 실재한다
   ⒝ **운영이 `market==="KR"` 로 «확정» 한 GT 행** = 🔴 **그 축이 0 이라는 것이 기존 기록이다**
   ⟹ 🔴 둘은 **다른 분모** 다. WU-140 ④ 가 그 차이의 실례이고, **D 가 닫은 것이 바로 그 간극** 이다
🔴 그래서 「국내 동일상품 판정 정확도 X%」를 **적지 않는다** — ⒝ 의 분모가 비어 있다
🔴 그 분모를 채우려면 **새 수집 또는 CEO 육안 GT** 가 필요하고 둘 다 이번 범위 밖이다
```

### ④ 검증

```
신규 계약   cross-market-all-axis-01.test.ts **9 passed**
            A-1 범위 술어(양방향) · B-1 시장 미확정이 전체에만 선다 · B-2 합이 아니다 ·
            C-1 제외 규칙 불변 · C-2 기존 두 칸 산출 불변 · C-3 말 불변 ·
            D-1 같은 선택기(복제 0) · D-2 요약 줄 배선 · **D-3 금액 금지**
음성 대조   M1 ALL 을 시장 필터로 **4 FAIL** · M2 ALL 이 제외 규칙까지 품 **1** ·
           M3 전체를 합으로 **1** · M4 요약 줄 제거 **2** · M5 전체 줄에 금액 **1**
           → 운영 2파일 **md5 복구 · diff 0**
기존 계약   `cand-02 UX-07` 이 `Object.values` 전수 비교라 FAIL(의도된 변경) ⟹
           **키 단위로 갱신·강화**(각 글자를 더 정확히 잠그고 축이 셋을 넘으면 FAIL)
회귀        **945 files / 11,557 passed / 0 failed** · typecheck **0** · build **exit 0**
배포        `def2aa5` · `● Ready` · alias 전환 · 헬스체크 기준선 동일
```

### ⑤ 🔵 MI P0 완료 여부 — 🟡 **아직 아니다**

```
🟢 완료   A 통합 탐색 · B 공통 정규화 · C 단일 판단 엔진 · D All/Domestic/Overseas 연결
🔴 미완   **E 성능 수치** — 운영 `market==="KR"` 확정 GT 분모가 **0** 이라 국내 정확도를
          숫자로 말할 수 없다. 🔴 **분모가 없는 것을 0% 로 적지 않는다.**
🔴 남은 정책 결정 **둘**(CTO 가 열지 않았다)
   ⒜ 국내 DB 영속 가격 축에 blocker 필터(ARCH-03 보류 · human SAME 2건 손실 실측)
   ⒝ ORIGIN_FX 과거 행 backfill(§0-OFX02 ⑥)
🔵 다음 한 수 — **⒝ 의 KR 확정 GT 분모를 만드는 것** 이 E 를 여는 유일한 열쇠다
   (CEO 육안 GT 1회 또는 승인된 수집) · 🔴 CPO 지정 사안
```

---

## 🟢🟢🟢 §0-OFX04. **[2026-11-21] `MI-ORIGIN-FX-VARIANT-WIRING-04` — 구현·검증 완료 · 🟢 배포 완료**

🔴 **다시 조사하지 않는다.** 🟢 커밋 `42402b1a` · 🟡 **main 병합 0 · Production 배포 0**
(CPO 최종 검토 후 **CEO 승인 대상** · CPO 지시).

### ① 고친 것 — 🟢 **운영 1파일 · 실코드 +9줄**(나머지는 근거 주석)

```
`packages/crawler/src/shopify-market-probe.ts`
  ⒜ `probeMarket(origin, handle, marketCode, **selectedVariantId**)` — 인자 추가
  ⒝ 질의 URL  `${base}${variantQuery}`   (variantQuery = `?variant=<id>` 또는 "")
  ⒞ 기록 URL  `${base}.json${variantQuery}`  🔴 `.json` 이 쿼리 **앞** 이다
  ⒟ `probeOriginAndKrMarkets` · `probeAdditionalShopifyMarkets` 가 `sourceUrl` 에서
     **한 번** 추출해 전달 — 🔴 한 스냅샷 안에서 옵션이 갈리지 않게 **둘 다** 보존
🟢 **새 규칙 0** — 옵션 선택·품절·「못 찾으면 가격 미산출」은
   `shopify-product-json.ts:426-446` 에 **이미 구현돼 있었다**(§4-D 확인 결과) ⟹
   이 WU 는 `extractShopifySelectedVariantId` 를 **재사용** 하는 배선 하나다
🟢 배선이 실제로 발화하는지 **먼저 확인했다** — `canonicalProduct.sourceUrl` 이 쿼리를
   **그대로 보존** 하고 전수 677 중 variant 보유가 `source_url` **9** ↔ `cp.sourceUrl` **9** 로 일치
```

### ② 「반드시 지킬 동작 5」 전수 대조

| 지시 | 결과 | 근거 |
|---|---|---|
| ① 원본 URL 에 variant 있으면 우선 | 🟢 | `B-1` — 대표 사례 원가 **£119**(지정 옵션 UK 11) |
| ② 확인 불가 시 조용히 대체 금지 | 🟢 | `B-5` — probe **null** ⟹ 관측 행 **자체가 없다** |
| ③ variant 없는 URL 기존 동작 | 🟢 | `B-3`(쿼리 0 · **115** · sourceUrl 예전 모양) · `B-4`(숫자 아닌 값) |
| ④ 가격·통화·환산·후보·MI 기준 불변 | 🟢 | 변경 **0**(그 파일 밖 운영 코드 0) |
| ⑤ 다른 Shopify 경로 부작용 0 | 🟢 | `C-2` — 후보 목록·`marketMayBeObserved`·요청 수 **불변** |

🟢🟢 **②가 왜 안전한가** — 지정 variant 를 못 찾으면 `fetchShopifyProductJson` 이 가격을
내놓지 않고 `if (!price || !price.currency) return null` 이 **관측을 만들지 않는다**.
그때 원가는 `run-price-check` 의 **기존 폴백(= 스냅샷 추출가)** 으로 서고, 그 값은
**이미 variant 를 존중한다** ⟹ 🔴 **어느 경로로도 「다른 옵션의 가격」이 되지 않는다.**

### ③ 🔴 가격 영향 범위(전수 fixture · 다시 측정할 때)

```
variant 고정 스냅샷      **9 / 566** (전부 `www.junioredition.com`)
그 스냅샷의 관측 36행     ORIGIN_FX 9 · KR_MARKET 9 · MARKET_PROBE 18
🔴 값이 바뀔 ORIGIN_FX    **2** (£115 → £119 · +3.4%)
🟢 불변                  **7** (사이즈별 가격이 없는 상품이면 두 규칙이 같은 값)
🔴 과거 행 수정           **0** — backfill 하지 않았다. 다음 「가격 확인」부터 새 값이 쌓인다
🔴 전수 분모의 영향        ORIGIN_FX 498 중 **2건**(0.4%) — 🔴 작아 보이지만 **신발처럼
   사이즈별 가격이 있는 상품군에서 셀러가 옵션을 지정하면 상시 발생** 한다(원인은 구조였다)
```

### ④ 🟢🟢 기존 계약이 **설계대로 뒤집혔다**

```
`origin-fx-discrepancy-03.test.ts` **C-1** 은 「배선 비대칭이 존재한다」를 고정하고 있었다.
⟹ 🟢 이번 수정으로 **FAIL** 했고, 그 FAIL 이 **수정의 증거** 다(쿠팡 고시·WU-076 선례).
🟢 **느슨하게 하지 않고 방향을 뒤집어 «강화» 했다**:
   ⒜ probe 가 추출기를 **재사용** 하는지(복제하면 「숫자만」 규칙이 둘로 갈린다 — 복제 금지 단언)
   ⒝ 두 진입점 **모두** 에 전달하는지  ⒞ 쿼리를 실제로 붙이는지
   ⒟ 🔴 **보존 단언 4** — handle 조립 · `.json` 위치 · 조용한 대체 금지 · 배송 게이트
🟢 그 갱신된 C-1 도 **배선을 지우면 FAIL** 한다(음성 대조로 확인)
```

### ⑤ 검증

```
신규 계약   origin-fx-variant-wiring-04.test.ts **8 passed** (🔴 외부 HTTP **0** — fetch mock)
            A-0 운영 가격표 · B-1 대표 사례 119 · B-2 sourceUrl 모양 ·
            B-3 미지정 · B-4 숫자 아닌 값 · B-5 미발견 안전 · C-1 확장 시장 · C-2 불변
기존 계약   `-01` 9 · `-02` 9 · `-03` 7 **전건 유지**
음성 대조   M1 쿼리 미부착 **4 FAIL** · M2 기본 조회 미전달 **3 FAIL** ·
           M3 확장 조회 미전달 **1 FAIL** · M4 `.json` 위치 오류 **1 FAIL**
           → 운영 파일 **md5 복구 · diff 0**
회귀        **944 files / 11,546 passed / 0 failed** · typecheck **0** · **build exit 0**
```

### ⑥ 🟢🟢 **04A 보완 — 무효한 variant 지정에 첫 옵션 가격을 쓰지 않는다**(커밋 `fc764441`)

🔴🔴 **CPO 가 내 1차 구현의 구멍을 잡았다. 그 사실을 남긴다.**

```
전  `?variant=99999999999`(숫자인데 없다)      → 가격 **없음**(관측 0)   🟢
    `?variant=abc` · `?variant=`(명시했으나 쓰레기) → **£115**(첫 구매가능 옵션)  🔴
    ⟹ 같은 「지정했는데 못 찾았다」인데 결과가 갈렸고 뒤쪽은 **조용한 갈아타기** 그 자체다
후  `resolveRequestedVariant(sourceUrl)` 가 **셋** 을 가른다:
    ⒜ 파라미터 없음        → 🟢 기존 동작(첫 구매가능 옵션)
    ⒝ 숫자형 있음          → 🟢 그 id 를 질의(존재/부재는 기존 경로가 처리)
    ⒞ 있는데 id 를 못 얻음 → 🔴 **invalid** ⟹ 두 진입점 **모두** 즉시 차단
                              기본 `{origin:null, kr:null}` · 확장 `[]` · **HTTP 질의 0회**
🔴 숫자 규칙을 **복제하지 않았다** — 유효성은 `extractShopifySelectedVariantId`(owner)가
   그대로 판단하고 probe 는 `searchParams.has("variant")` 로 **존재만** 본다
   (계약 `C-1` 이 `get` 복제를 금지하고, 변이 N4 가 그것을 **1 FAIL** 로 확인했다)
🔴 두 진입점을 **같이** 막았다 — 한쪽만 막으면 원가는 없는데 시장 관측은 £115 가 선다
```

**지시 §필수 동작 5 ↔ 계약** — ① 미지정 기존 동작 `B-3` · ② 유효하면 그 variant `B-1`(119) ·
③ 숫자인데 못 찾으면 null `B-5` · ④ `abc`/빈 값 null `B-4`·`B-4b`(+확장 `B-4c`) ·
⑤ 첫 옵션 대체 금지 — `B-4`·`B-4b`·`B-5` 가 **115·119 둘 다** 금지로 단언.

**음성 대조** — N1 무효를 무시 **3 FAIL** · N2 기본 차단문 제거 **2 FAIL** ·
N3 확장 차단문 제거 **1 FAIL** · N4 `has→get` 규칙 복제 **1 FAIL** → **md5 복구 · diff 0**.
🔴 변이 중 `cd` 가 `apps/` 에 남아 상대 경로가 깨졌다 — **읽기에서 실패해 파일은 수정되지
않았고** md5 로 무손상 확인 후 **절대 경로** 로 다시 돌렸다.

🟢 회귀 **944 files / 11,548 passed / 0 failed** · typecheck **0** · build **exit 0** ·
기존 `-01` 9 · `-02` 9 · `-03` 7 · `-04` **10** 계약 전건 유지.

### ⑦ 🟢🟢 **FINALIZE — main 반영 · Production 배포 완료 · CLOSED**

🟢 **CPO 가 직접 승인·지시** 했다(`MI-ORIGIN-FX-VARIANT-WIRING-04 FINALIZE` · CEO 승인 요청 없음).

```
main     `fccfb178..15ea5d99` **fast-forward**(`+` 없음) · 머지 커밋 **0** · 잔여 **0**
         🔴 `git checkout main` 안 썼다 — 사용자 미커밋 변경 7건 보존(ref 직접 push)
배포     `dpl_Rc5s4KBAh5b5uo5TG8uPtHDcyVKq` · `ttaejyo-dlxbdvino` · **● Ready** · target production
증거     빌드 로그 **`Branch: main, Commit: 15ea5d9`** · alias `ttaejyo.vercel.app` 전환 확인
헬스체크  `/` **200** · `/today` 307 · `/pipeline` 307 · `/api/price-history/check` **401**(기준선 동일)
배포 검증 배포 커밋의 `shopify-market-probe.ts` 에 운영 변경 **5요소 전건 확인**
         (`resolveRequestedVariant` 3 · 기본 차단문 1 · 확장 차단문 1 · 쿼리 부착 1 · `has` 1)
계약     대표 사례 + 무효 variant **17 passed**(`-04` 10 + `-03` 7)
```

🔴🔴 **반영 범위를 정확히 적는다 — 지시의 4건보다 넓다**:
```
지시 목록   `42402b1a` · `fc764441` · `3438fc70` · `15ea5d99` (4)
실제 FF     `origin/main..HEAD` = **10** — 위 4 + 그 **조상 6**
            (`cb2c734c` `24fb01fe` `83e92d26` `869e7848` `8e2ac75c` `508b5db7`)
🔴 4건만 cherry-pick 할 수 **없다** — 승인 커밋의 테스트가 조상 커밋의 fixture 를 읽는다
   (`-04` 테스트 → `origin-fx-discrepancy-03.json`(8e2ac75c) ·
    `-03` 테스트 → `origin-fx-accuracy-full.json`(83e92d26)) ⟹ 따로 따면 **테스트가 깨진다**
🟢 그 6건은 **전건 테스트·fixture·문서** 다(운영 코드 **0** · 기계 확인) ⟹
   운영 영향은 승인된 **`shopify-market-probe.ts` 하나** 로 한정된다
```

🔵 **남은 것** — 🔴 과거 행 backfill 은 **별개 미승인 결정** 이다(§0-OFX02 ⑥ 와 같은 축).
🟡 이번 수정은 **다음 「가격 확인」부터** 새 값을 쌓는다(과거 행 수정 0).

---

## 🟢🟢🟢 §0-OFX03. **[2026-11-21] `MI-ORIGIN-FX-DISCREPANCY-03` — 미규명 2건 원인 확정**

🔴 **다시 조사하지 않는다.** 🟢 커밋 `8e2ac75c` · 🔴 **운영 코드 0 · DB 쓰기 0 · main 머지 0 · 배포 0**.

### ① 🟢🟢 원인 — **확정**(추측 0)

```
그 상품은 **사이즈마다 가격이 다르다**(운영 `canonicalProduct.variants` 전수 9개):
   £115 — 21 EUR(UK 4) · 22 EUR(UK 5)
   £119 — 24 · 25 · 26 · 28 · **29 EUR(UK 11)**
   £123 — 30 · 31

스냅샷 URL  …/en-kr/products/lulu-t-bar-shoes-in-tobacco-by-pepe?…&**variant=40096037535807**
            ⟹ 그 id = **29 EUR(UK 11) = £119** · 추출가가 **정확히 119**
관측 URL    …/products/lulu-t-bar-shoes-in-tobacco-by-pepe**.json**(로케일·variant **없음**)
            ⟹ **첫 구매가능 옵션** 21 EUR(UK 4) = **£115**(데이터로 확인 · 가정 아님)
⟹ 🔴🔴 **둘 중 하나가 「틀린 값」이 아니다 — 서로 «다른 옵션» 의 가격이다.**
```

**CPO 6분류 대조** — ① 사이트↔추출 차이 🔴아니다(사이트는 두 질문에 정확히 답했다) ·
② 통화/반올림 🔴아니다(둘 다 GBP 정수 · 환산 정합 100%) · ③ **상품 옵션/판매 단위 차이 🟢🟢 이것** ·
④ 시점 차이 🔴아니다(**실측 15초** 차) · ⑤ 데이터 연결 🟡**부분**(경로별 URL 조립 비대칭) ·
⑥ 확인 불가 🔴아니다.

### ② 🔴🔴 더 정확한 분류 — **같은 수정이 한쪽 경로에만 적용됐다**

```
🟢 CEO 지시 **P0-A.29-E ㉮**(커밋 `683d9d83` · **2026-09-20** ·
   「URL 이 «UK 11» 을 가리키는데 «UK 4» 가격을 쓰던 것을 멈춘다」)가
   `extractShopifySelectedVariantId`(shopify-product-json.ts:31)로 **추출 경로** 를 고쳤다.
   🟢🟢 그 커밋 주석이 **이 상품·이 variant id·£115/£119/£123 을 그대로 적어 뒀다**
      (shopify-product-json.ts:417-425) ⟹ **이미 알려진 결함의 «나머지 반쪽»** 이다.
🔴 그런데 **관측(probe) 경로** 는 URL 을 새로 조립한다 —
   `shopify-market-probe.ts:31  const url = ${origin}${prefix}/products/${handle}`
   ⟹ `?variant=` 가 **거기서 버려진다.** 그 파일 마지막 변경은 **2026-09-13** 으로
      `683d9d83` 보다 **먼저** 다 ⟹ 그 수정이 이 경로에 **오지 않았다**.
```

### ③ 🔴🔴 현재 생산 경로 영향 — **재현된다**

```
사례 관측 시각  **2026-09-20T17:03Z** · **2026-10-01T00:37Z** — 🔴 수정(09-20) **이후** 인데 115 다
⟹ 🔴 **과거 잔존이 아니다.** `-02` 가 닫은 네 유형과 **성질이 다르다**
영향 범위(전수 fixture) ORIGIN_FX **498** 중 `?variant=` 고정 **9** · 그중 불일치 **2** ·
                      🔴 둘 다 수정 이후 · 🟡 나머지 7은 사이즈별 가격이 없어 두 규칙이 같은 값
사업 의미   원가(ORIGIN_FX)가 **셀러가 지정한 옵션이 아니라 가장 싼 옵션의 가격** 이 될 수 있다
            ⟹ 착지원가·마진·CASE 가 **과소** 로 선다(£115 ↔ £119 · 이 사례 3.4%)
🔴 「신발 45%가 사이즈별 가격」은 `shopify-product-json.ts:421` 의 **과거 실측** 이고
   이 입력(`canonical_price` 만 담았다)으로는 **재측정 불가** 다
```

### ④ 기존 정확도 측정에 미치는 영향

```
🟢 `-02` 의 숫자는 **바뀌지 않는다** — 통화 498/498 · 금액 486/498 · 선택 0 · 환산 1,799/1,799
🟢 달라진 것은 **불일치 12 의 분류** 다 — 「할인 비대칭 10 + **미규명 2**」 →
   「할인 비대칭 10 + **옵션 차이 2(원인 확정)**」 ⟹ 🟢 **미규명 0**
🔴 그러나 금액 일치율 **97.6%** 를 「97.6% 가 맞고 2.4% 가 틀렸다」로 읽지 않는다 —
   12건 전부 **두 생산자가 서로 다른 사실을 적은 것** 이고 「틀린 값」은 **0건** 이다
```

### ⑤ 검증

```
신규 계약   origin-fx-discrepancy-03.test.ts **7 passed**
            A-0 입력·분모 · B-1 사이즈별 가격 셋 · B-2 고정 variant == 추출가 ·
            B-3 관측 URL 이 variant·로케일을 버린다 + 첫 구매가능 옵션 == 관측가 ·
            B-4 시점 차이 아님(60초 이내) · **C-1 배선 비대칭** · C-2 영향 범위
기존 계약   `-01` 9 passed · `-02` 9 passed **전건 유지**(합계 25 passed)
음성 대조   M1 probe 에 variant 배선 **1 FAIL** · M2 추출기 이름 변경 **1 FAIL** ·
           M3 variant 파라미터 제거 **1 FAIL** → 운영 2파일 **md5 복구 · diff 0**
🔴 **M2 가 1차에 통과했다** — `toContain` 이 부분 문자열이라 `…IdX` 에도 매칭됐다.
   🟢 선언 경계(`export function …(`)까지 단언해 **강화** 했다(그 교훈을 파일에 적었다)
회귀        **943 files / 11,538 passed / 0 failed** · typecheck **0** · 미분류 **0** · GT 수집 **17 불변**
입력        `fixtures/origin-fx-discrepancy-03.json`(9.3KB) — 🔴 **손으로 베끼지 않았다**
            (운영 DB 읽기 전용으로 받아 프로그램이 기록 · variants 9×2 + 관측 8행)
```

### ⑥ 🔵 남은 결정

```
🟡 **probe 경로에 `?variant=` 를 배선할 것인가** — 🔴 CTO 가 고치지 않았다(지시 §3)
   🟢 수단은 이미 있다 — `extractShopifySelectedVariantId` 가 **추출 경로에 구현돼 있다**
   🔴 단 그것은 **운영 가격 산출 변경** 이다(원가가 115 → 119 로 올라간다) ⟹ **CPO 판단**
   🟢 계약 `C-1` 이 현재 상태를 고정하므로 배선하면 **FAIL 로 뒤집히고** 그것이 수정의 증거다
🔴 「신발 45%」 재측정은 `variants` 를 담은 입력이 필요하다(현재 전수 fixture 에 없다 · 미측정)
```

---

## 🟢🟢🟢 §0-OFX02. **[2026-11-21] `MI-ORIGIN-FX-ACCURACY-02` — 운영 전수 측정 완료**

🔴 **다시 조사하지 않는다.** 🟢 커밋 `83e92d26` · 🔴 **main 머지 0 · 배포 0**(운영 변경 0).

### ① 🟢 운영 DB 읽기 전용 경로는 **이 환경에 있었다**

```
`packages/database/.env` 에 `DATABASE_URL`·`DIRECT_URL` 이 있고, 기존 덤프 스크립트가 쓰는
승인 경로가 그것이다 — `node --env-file=.env packages/database/scripts/*.mjs`(Prisma).
🔴 `-01` 이 「도달 불가」로 적은 것은 **`scripts/.env`·`.env.local`·`apps/admin/.env.local`
   세 곳만 보고** 내린 결론이었다 ⟹ **그 판단이 틀렸다. 전수를 안 봤다.**
🟢 이번에는 `find -name ".env*"` 전수로 확인했다 · 🔴 자격증명 값은 출력·문서화·커밋 0 ·
   임시 스크립트는 실행 직후 **명시적 `rm`**(trap 에 맡기지 않았다).
```

### ② 🔴 지시의 분모가 낡았다

```
지시   스냅샷 397 · SELLER_ORIGIN 관측 1,476
실측   SELLER_ORIGIN 보유 스냅샷 **566** · 관측 **2,395**
       (product_snapshots 677 · price_observations 2,675 · 호스트 **15**)
🔴 「397」은 `docs/MI-SOURCING-VALUE-WU-STATE.md:135` 시점 값이고 그 뒤 데이터가 늘었다
🟢 397 에 맞추지 않고 **지금 있는 전수** 를 썼다 · 🟢 기존 13/58 이 전수 안에 **값까지 그대로**
   있음을 계약(A-1)으로 잠갔다(불일치 0)
```

### ③ 정확도 — 🟢 운영 owner **직접 호출**

| 축 | 값 | 분모 |
|---|---|---|
| 통화 일치율 | 🟢 **498 / 498 = 100.0%** | ORIGIN_FX 행 498 |
| 원본가격 일치율 | 🟢 **486 / 498 = 97.6%** | 동일 |
| 잘못된 원본가격 선택률 | 🟢 **0** | 스냅샷 566 전수 |
| 환산 정합 | 🟢 **1,799 / 1,799** | 환율 보유 행 |
| 정답 근거 없음 | **0** | — |
| 🔴 원본가격 확인 불가 | 🔴 **140 / 566 = 24.7%** | 스냅샷 566 |

### ④ 🔴 확인 불가 140건 — **원인과 경계가 확정됐다**

```
생성일   2026-08-08 … **2026-09-13** · 🟢 그 이후 **0건**
원인     `GLOBAL-ORIGIN-PRICE-WIRING-1`(2026-09-13 · `run-price-check.ts:254-268`)이
         「한국 표시가를 원가의 **대체** 로 고르던 것」을 고쳤다 ⟹ 그 **이전 데이터** 다
⟹ 🟢 **현재 생산자 경로에서 재현되지 않는다**(지시 §C 의 답)
🔴 사업 영향 — 그중 **103건** 은 원가가 **KRW(판매처의 한국 표시가)** 가 된다
         (사이트 자체 환산·스프레드 포함 ⟹ 착지원가·마진·CASE 가 그 값을 쓴다)
🟢 나머지 37건은 외화 원가 행(라벨 null = 라벨 도입 이전 ORIGIN_FX)이 남아 있다
호스트   junioredition 99 · smallable 25 · bobochoses.com 16
```

### ⑤ 🔴 오류 네 유형 — **전부 과거 잔존 · 현재 재현 0**

```
① 금액 불일치 **12** (= 486/498 의 나머지)
   🟢 할인 포착 비대칭 **10** — 관측이 `sale_price_krw`/`original_price_krw` 를 들고
      **할인가 25.9 GBP** 를 잡고, 추출은 **표시가 37** 을 쥐었다 ⟹ 두 생산자가
      **서로 다른 사실** 을 적은 것이고 「관측이 틀렸다」가 아니다
   🔴 **원인 미규명 2** — `115 ↔ 119 GBP` · 할인 플래그 **없음** · 같은 날 ⟹ **추측하지 않았다**
② KRW 에 환율 **"1"** 을 박은 행 **47** — 전건 **legacy 라벨** · … **2026-08-26** ·
   이후 592건 전건 null(🟢 `convertToKrw:42` 「KRW 는 환산이 아니다」 CPO 결정 B 준수)
③ 🔴🔴 **CAD 84 → ₩84** 로 저장된 행 **4** (designerkidswear · 2026-09-09~10)
   원인 = `FIXED_RATES_TO_KRW` 에 CAD 가 없어 `convertToKrw` 가 금액을 그대로 돌려줬다
   (`run-price-check.ts:176-177` 이 「499 DKK 가 ₩499 로 저장됐다」로 적어 둔 그 결함)
   🟢 CAD 는 **2026-09-11 `51758aa0`** 에서 `TRACKED_CURRENCIES` 에 추가됐다 ⟹ **재현 불가**
   🔴 단 **저장된 4행은 지금도 그 값** 이다
④ 🔴 `smallable.com` ORIGIN_FX 통화가 **셋**(USD 38 · EUR 76 · JPY 10)
   🔴 정책은 EUR **하나** 다(`source-currency-policy.ts:76`) · PHASE-2 가 그 `?currency=` 를
      **표시 계층(사이트 자체 환산)** 으로 확정했다 ⟹ 환산값이 원본가로 저장된 구간이다
   🟢 경계 — USD·JPY **… 2026-09-10** / EUR **2026-09-11 …**(`51758aa0` 이후) ⟹ 재현 0 ·
      PHASE-2 계약 **B-2/B-3** 가 재발을 기계로 막는다
```

### ⑥ 🔴 **수정 0 — 그 이유**

```
네 유형 전부 **과거에 저장된 행** 이고 교정 수단이 둘뿐이다:
  ⒜ 행 backfill / 재계산 ⟹ **DB 쓰기**(지시가 금지)
  ⒝ 읽는 쪽 규칙 변경    ⟹ **원가 정책 변경**(지시가 금지 · 그 상품은 원가가 사라진다)
⟹ 지시 §C 대로 **원인과 영향만 확정** 했다. 🟡 교정 여부는 **CPO 판단 사안**.
```

### ⑦ 검증

```
신규 계약   origin-fx-accuracy-02-full.test.ts **9 passed**
            A-0 분모 · A-1 13/58 교차검증 · B-1 선택 · C-1 확인 불가 ·
            D-1 2생산자 · D-2 불일치 분해 · E-1 환산 · E-2 KRW 환율 · E-3 CAD · F-1 호스트 · G-1 분포
기존 계약   `-01` **9 passed** 전건 유지
음성 대조   M1 KR_MARKET 배제 제거 **1 FAIL** · M2 MARKET_PROBE 를 원가 후보로 **2 FAIL** ·
           M3 ORIGIN_FX 라벨 변조 **6 FAIL** → 운영 파일 **md5 복구 · diff 0**
회귀        **942 files / 11,531 passed / 0 failed** · typecheck **0**
🟡 직전 1회차  `mi-reeval-05-shadow` 가 `docs/MI-REEVAL-STEP5-SHADOW.json` **쓰기**(UNKNOWN)로
           실패 → 단독 **1 passed** · 재실행 **0 failed** · 🟢 그 산출물 **해시 불변**(사용자 수정 보존)
           ⟹ **실행 간 불안정** 이고 내 변경이 아니다
입력        `fixtures/origin-fx-accuracy-full.json`(1.2MB) — numeric 은 `::text` 로 받아
            **정밀도 무손실** · 🔴 SKIP 불가(A-0 가 FAIL)
```

### ⑧ 🔵 이 축의 판정과 남은 것

```
🟢 **현재 생산자 경로의 ORIGIN_FX 는 정확하다** — 통화 100% · 금액 97.6%(나머지는 할인
   비대칭 10 + 미규명 2) · 잘못된 선택 0 · 환산 정합 100% · 2026-09-13 이후 누락 0
🔴 **저장된 과거 데이터에는 결함이 남아 있다** — 확인 불가 140(그중 KRW 원가 103) ·
   KRW 환율"1" 47 · CAD ₩84 4 · smallable 환산 원본가 48
🟡 남은 결정 **둘**(🔴 CTO 가 고르지 않았다)
   ⒜ 과거 행 교정 여부(backfill ↔ 현상 유지) — 🔴 DB 쓰기 · 승인 사항
   ⒝ 미규명 2건(115↔119) 재조회 여부 — 🔴 외부 HTTP
🔴 **그 전에는 「ORIGIN_FX 정확도 = 100%」로 적지 않는다** — 현재 경로와 저장 데이터를 가른다
```

---

## 🟡🟡🟡 §0-OFX01. **[2026-11-21] `MI-ORIGIN-FX-ACCURACY-01` — 측정 완료 · 분모 부족**

🔴 **다시 조사하지 않는다.** 🟢 커밋 `cb2c734c` · 브랜치 `uird-deploy-01` ·
🔴 **main 머지 0 · Production 배포 0**(지시: 「실제 변경이 없으면 불필요한 배포는 하지 않는다」).

### ① 🔴🔴 **분모 397 에 도달하지 못했다 — 이것이 가장 중요한 결과다**

```
「397」의 출처   docs/MI-SOURCING-VALUE-WU-STATE.md:135-136
                「SELLER_ORIGIN 관측 1476행 / 스냅샷 397개 전부 … withCost 397/397」
🔴 그 데이터는 **운영 DB `price_observations`** 이고 이 세션에 자격증명이 **없다**(실측):
   scripts/.env = `GEMINI_API_KEY` 하나 · .env.local = `VERCEL_OIDC_TOKEN` ·
   apps/admin/.env.local = `QA_PROXY_TO_PROD` `OCI_PROXY_URL`  ⟹ `DATABASE_URL` **0**
🔴 저장소·docs·fixtures·preserved·TEMP(170파일) 전수에서 ORIGIN_FX 관측을 담은 입력은
   **하나** 였다 — `wu008-provenance.json`(스냅샷 **13** · 관측 **58**)
🔴🔴 그리고 그 13 은 **상품 13개가 아니다** — 고유 상품 **2개** 의 반복이다
   (bobochoses.co.jp JPY 26,400 × 2 · bobochoses.com EUR 120 × 11)
⟹ 🔴 **「ORIGIN_FX 정확도 N%」로 적지 않는다.** A-0 가 그 분모를 계약으로 잠근다
```

### ② 측정 결과 — 🟢 운영 owner `selectCostBasisOriginObservations` **직접 호출**

```
원본가격 일치율   **12 / 12**   ORIGIN_FX ↔ 스냅샷 `canonical_product.price`(2 생산자)
통화 일치율       **12 / 12**
잘못된 선택률     **0**         MARKET_PROBE 선택 0 · ORIGIN_FX 있을 때 KR_MARKET 누출 0
확인 불가         🔴 **1 / 13**  ORIGIN_FX 0건 스냅샷 → 원가가 **KRW 258,000(한국 표시가)**
환산 정합         **47 / 47**   `price_krw ≈ amount × rate`(반올림 1원 이내 · 불일치 0)
호스트 통화 일관성  🟢 호스트당 **1통화**(.co.jp JPY · .com EUR)
정답 근거 없음     **0**(분모에서 뺄 것이 없었다)
```

🔴 **독립 정답 근거를 무엇으로 썼는지 적는다** — 생산자가 **둘** 이다(관측 행 ↔ 크롤 시점
추출). 🔴 **국가→통화 표는 만들지 않았다** — `market_country` 를 통화의 정답으로 쓰면
PHASE-2 가 계약으로 금지한 축(`phase2-market-currency-is-not-site-fx` A-3)이다.
🔴 그래서 `market_country` 는 **분포만** 적었다(관측 전용 · G-1).

### ③ 🔴 **수정 0 — 그 이유**

```
확인 불가 1건(`2ca33295` bobochoses.com)은 **과거 데이터 잔존분** 이다
(`run-price-check.ts:254-268` 이 고친 그 결함의 이전 행 · 생산자는 지금 항상 ORIGIN_FX 를 만든다)
🔴 고치는 길이 둘뿐이고 둘 다 금지축이다 —
   ⒜ ORIGIN_FX 행 **backfill** ⟹ **DB 쓰기**(접근 없음 · 승인 사항)
   ⒝ 읽는 쪽에서 KR_MARKET 도 배제 ⟹ **원가 정책 변경** 이고 그 상품은 **원가가 사라진다**
      (owner 주석이 「ORIGIN_FX 가 한 건도 없는 스냅샷은 예전 결과와 완전히 동일하다 —
       과거 행을 지우거나 다시 계산하지 않는다」고 명시)
⟹ 🟡 **CPO 판단 사안** 으로 올린다
```

### ④ 🔴 내 단언이 틀렸고 코드가 맞은 자리 — 남긴다

```
1차 단언   「KRW 관측은 환율 1 이어야 한다」  → **FAIL**
🟢 사실    `convertToKrw`(packages/pricing/src/currency.ts:42)가 **KRW 를 환산으로 취급하지 않는다**
          「KRW → KRW 는 «환산이 아니다». 1:1 이라 추정할 것이 없는데 고정표 경로를 타면서
           `isEstimate: true` 가 붙어 화면이 환산하지 않은 값을 「추정 환율」이라 말했다」(CPO 결정 B)
⟹ 🟢 `exchange_rate = null` 이 **정답** 이고 「1」을 박으면 환산한 척이 된다
🟢 단언을 그 정책을 **지키는 방향** 으로 바꿨다 — 1 이 들어오면 FAIL 하고, 외화는 환율 보유를 요구한다
🟢 그리고 `market_country = ES` 도 결함이 아니다 — `market-target.ts:15` 가 「ES → 스페인 시장 ✕ ·
   **판매자가 신고한 국가**」로 못 박았고 `isKoreanMarket()` 은 그 값을 **인자로조차 받지 않는다**
```

### ⑤ 검증

```
대상 파일   9 passed  (A-0 · B-1 · B-2 · C-1 · D-1 · E-1 · E-2 · F-1 · G-1)
음성 대조   M1 KR_MARKET 배제 제거 **1 FAIL** · M2 MARKET_PROBE 를 원가 후보로 **2 FAIL**
           → 운영 파일 **md5 복구 확인 · diff 0**
회귀        **941 files / 11,520 passed / 0 failed**(기준선 11,511 + 내 9)
typecheck   0 · `preserved/` 변경 **0** · 전수 분류 가드 미분류 **0**(GT 수집 **17 불변**)
입력        `fixtures/origin-fx-accuracy-real.json` — 🔴 SKIP 불가(A-0 가 FAIL 한다)
           observations **값 무변경 58행 전건** · snapshots 는 측정이 읽는 칸만(축소 명시)
```

### ⑥ 🔵 다음 한 수 — **분모를 여는 것** 하나다

```
🔴 이 축의 결론은 「정확한가」가 아니라 **「측정할 수 있는 분모가 2 상품뿐이다」** 다
🟡 분모를 여는 길 둘(🔴 CTO 가 고르지 않았다)
   ⒜ 운영 DB 읽기 자격증명(`DATABASE_URL`) — 🟢 읽기 전용이면 정책 변경 0 · 가장 직접적
   ⒝ 실제 상품 N개 재분석으로 ORIGIN_FX 를 새로 쌓는다 — 🔴 외부 HTTP + 비용
🔴 그 전에는 이 축을 **VERIFIED COMPLETE 로 적지 않는다**
```

---

## 🟢🟢🟢 §0-RP01. **[2026-11-21] `MI-REGRESSION-PORTABILITY-01` — 구현·검증·push 완료 · CLOSED**

🔴 **다시 조사하지 않는다.** 🟡 이것은 **사업 성과가 아니라 회귀 안전성** 개선이다.
🟢 커밋 `69eefaa5` + `f7c12fe5` · 🟢🟢 **main fast-forward · Production 배포 완료**
(`MI-REGRESSION-PORTABILITY-01-MERGE-DEPLOY` · CPO 승인 2026-11-21).

```
반영 방식   🔴 `git checkout main` 을 쓰지 않았다 — 그 파일에 **사용자 미커밋 변경** 이 있어
            checkout 이 덮어쓰려 할 자리였다 ⟹ **`git push origin HEAD:main`**(ref 직접)
            `95fd84b0..f7c12fe5`(`+` 없음) = **fast-forward** · 머지 커밋 **0** · 작업트리 무접촉
배포 증거   빌드 로그 `Cloning … (Branch: main, Commit: f7c12fe)` · 상태 `● Ready`(3m)
            alias `ttaejyo.vercel.app` → `ttaejyo-g0r2fp2lz-…` 전환 확인
헬스체크    `/` **200** · `/today` 307 · `/pipeline` 307 · `/api/price-history/check` **401**
            🔴 307/401 은 **정상 보호** 다(메모 `production-307-is-not-route-evidence`)
🟡 [당시 결정 · 지금은 해소됐다] 이 문서의 갱신 커밋(`79e449e6`)을 **그때는** main 에
   올리지 않았다 — 지시가 두 커밋 외 반영을 금지했고 main push 가 **추가 Production 배포**
   를 부르기 때문이다. 🟢 **그 뒤 CPO 가 그 커밋의 main 반영을 승인했다**
   (`MI-RP01-HANDOFF-CORRECTION-01`) ⟹ `f7c12fe5..79e449e6` **fast-forward** 반영 ·
   Production 배포 **`Branch: main, Commit: 79e449e` · `● Ready`** 확인
🟢🟢 **현재 상태** — `origin/main` == `origin/uird-deploy-01` == **`79e449e6`** 로 정렬돼 있고
   그 커밋 기준으로 Production 까지 반영돼 있다. 🔴 위 「올리지 않았다」를 **현재 상태로 읽지 않는다.**
```

### ① 고친 문제 — 🔴🔴 **가격 안전성 계약이 다른 환경에서 «한 번도» 돌지 않았다**

```
brand-conflict-price-real.test.ts 가 입력을 **머신 로컬** 에서 읽었다:
  const DUMP  = path.join(process.env.TEMP ?? ".", "mi-p0-02", "brand-conflict-price.json")
  const READY = existsSync(DUMP)
  describe.runIf(READY)(…)                         ← 🔴 없으면 **조용히 SKIP**
⟹ 🔴 CI·새 체크아웃·다른 사람의 머신에서 **비검증인데 초록으로 보였다**
🔴 그 계약이 지키던 것이 가볍지 않다 — 「**차단축을 든 후보는 금액 집계에 들어가지 않는다**」
   (= 다른 브랜드 가격이 셀러 화면의 가격에 섞이지 않는다는 보장 · 운영 저장분 **159건** 전수)
```

### ② 한 것 — 입력을 저장소로 옮기고 **SKIP 을 없앴다**

```
🟢 입력   apps/admin/.../__tests__/fixtures/brand-conflict-price-real.json
          🔴 그 TEMP 덤프를 **값 그대로** 옮겼다 — records **159** · `at` 보존 ·
             `census` 보존(BRAND_MISMATCH 89 · NO_TITLE_OVERLAP 83 ·
             SAME_SELLER_DISTINCT_LISTING 4 · BRAND_UNCONFIRMED 8 · 차단축 없음 58)
          🔴 민감 문자열 **0**(도메인·제목·금액·verdict·blockers 뿐) · 런타임 쓰기 **0**
🟢 경로   path.join(__dirname, "fixtures", "brand-conflict-price-real.json")
🟢 실행   `describe.runIf` **제거** — 이제 **항상** 돈다
🟢 신규   **E-0 하나** — 입력 부재 · 분모 변화(≠159) · 칸 소실 · **환경변수 경로 복귀** ·
          **`describe.runIf` 복귀** 를 전부 **FAIL** 로 잡는다
🔴 기존 9개 단언은 **한 글자도 바꾸지 않았다** — R-1·R-2·R-3 · P-1·P-2·P-3 · C-1·C-2·C-3
   제거된 줄은 **정확히 셋**(경로 · `READY` · `runIf`)이다
```

🔴🔴 **의도를 약화하지 않고 «강화» 했다** — 원래 주석이 「덤프가 없으면 SKIP 한다 —
「0건 통과」로 적지 않는다(측정불가 ≠ PASS)」였다. 🟢 이제 **측정불가가 PASS 가 아니라 FAIL** 이다.

### ③ 🟢🟢 **기존 전수 분류 가드가 내 fixture 를 잡았고, 가드를 풀지 않았다**

```
core-same06-safety-gt-search.test.ts 의 「fixture 전수 분류」 가드가
  expected [ 'brand-conflict-price-real.json' ] to deeply equal []
로 **정확히 FAIL** 했다(회귀에서 1건).
🔴 `unseen.toEqual([])` 를 **느슨하게 하지 않았다** — 그 파일의 선례 **넷** 과 같이
   **용도를 적어 분류** 했다(`skipped.push`).
🔴 분류 문구가 핵심이다 — 그 파일의 `verdict` 는 `candidate_reviews.**system_verdict**`
   (운영 MI 산출)이고 `human_verdict` 칸이 **없다** ⟹ GT 분모에 넣으면
   **시스템 판정을 사람 라벨로 세는 것** 이다.
🟢 GT 분모 **불변** — 수집 **17**(전과 같다) · 제외 31 → **32** · 미분류 **0**
```

### ④ 음성 대조 — **셋 다 FAIL → 복구**

```
M1  fixture 경로를 없는 파일로            → **10 FAIL**(전건) 🟢 더는 조용히 넘어가지 않는다
M2  `describe.runIf(existsSync(DUMP))` 복귀 → **1 FAIL**(E-0)
M3  `process.env.TEMP` 경로로 되돌림       → **1 FAIL**(E-0)
    🔴🔴 **이 머신에 그 덤프가 실재해도 FAIL 한다** — 로컬 가용성과 무관하게 잡는다
복구 → **10 passed**
🟢 다른 환경 모사 — `TEMP` 를 빈 디렉터리로 바꿔 실행 → **10 passed · skipped 0**
```

### ⑤ 검증 수치

```
대상 파일   10 passed (기존 9 + 신규 E-0)
회귀        **940 files / 11,511 passed / 0 failed** (기준선 11,510 + 내 E-0 **1**)
typecheck   exit 0 · `error TS` **0**
preserved/  변경 **0**(회귀가 산출물을 덮지 않았다)
작업트리    **120 = 기준선**
```

### ⑥ 🔴🔴 사용자 작업물을 커밋에 끌고 들어가지 않았다

```
`core-same06-safety-gt-search.test.ts` 는 **세션 시작 시점에 이미 수정돼 있었다**
(미추적 fixture 4개 — `mi-current-recapture*.json` ×3 · `brand-0-wu080-cf3.json` — 의 분류 **48줄**).
🔴 `git add <file>` 을 하면 그 48줄이 **내 커밋에 들어간다**.
🟢 그래서 **HEAD + 내 19줄** 만으로 blob 을 만들어 `update-index --cacheinfo` 로 **그 버전만** staged 했다
   (작업트리의 사용자 변경 4건은 **그대로** 남아 있다 · 실측 확인).
🟢 그 staged 버전이 **깨끗한 체크아웃에서 자기완결** 임을 기계적으로 증명했다 —
   fixtures 추적 **43** + 내 것 **1** = **44**, 그 44가 staged 소스에 **전건 등장**(미분류 0).
🔴 `git add .` · `reset` · `clean` · `stash` **사용 0**.
```

### ⑦ 바꾸지 않은 것 (CPO 절대 금지 전수 대조)

```
SAME/상품 정체성 정책      0     blocker/가격 적격성 정책   0
가격 산출 · FX             0     운영 데이터 · DB · schema  0
Production 코드            0     GT 라벨 · preserved 산출물 0
동결 공급원 · 어댑터        0     기존 계약의 검증 의미      0 (9개 단언 바이트 불변)
main 머지                  0     Production 배포            0
```

---

## 🔵🔵🔵🔵 §0-EXEC01. **[2026-11-21 · CPO 운영 원칙] `MI-EXECUTION-EFFICIENCY-01`**
## **반복 검토 중단 · 사업 성과 중심 실행 체계**

🔴🔴 **이 절은 모든 세션에 적용되는 «운영 방식» 이다.** §12 가 회전해도 남는다.
🟢 **기존 전략(§0-ARCH01 · §0-ARCH03)과 동결 정책을 변경하지 않는다** — 실행 방식만 바꾼다.
🔴 이 절 자체는 문서 반영이고 코드 **0** · DB **0** · Production **0** · 재조사 **0** 이다.

### A. 🔵 전환된 실행 체계

```
기존 근거 재사용 → **CPO 우선순위 결정** → 승인 범위 내 실행 → E2E·회귀
→ **사업 성과 보고** → 종료
🔴 검토 자체가 목적이 되어서는 안 된다.
```

### B. 🔴🔴 반복 작업 금지 **7**

```
① 기존 조사 결과가 있는 항목을 **이유 없이 재조사**
② 이미 종료된 이슈를 **새 작업처럼 재개**
③ 같은 사실을 **여러 문서에 반복 작성**
④ 단순 확인을 위한 **별도 조사 작업 생성**
⑤ 🔴 기술적으로 가능한 선택지를 **매번 CPO 에게 나열하고 결정을 미루는 행위**
⑥ 🔴 **테스트 통과 수를 사업 성과처럼 보고**
⑦ 완료된 작업에 **추가 검토 단계를 계속 붙이는 행위**
🟢 기존 근거가 현재도 유효하면 **그대로 재사용** 한다.
```

### C. 역할 — CPO ↔ CTO

```
CPO  제품 전략·사업 우선순위 결정 · 작업 범위와 정책 변경 승인 ·
     사업 성과 기준 설정 · 결과 검토와 다음 우선순위 결정
CTO  승인된 범위에서 **실행 방법 자율 결정** · 기존 코드·조사·테스트 산출물 재사용 ·
     조사~구현~E2E~회귀를 **한 묶음** 으로 · 🔴 실제 장애·정책 충돌이 없으면
     **중간 승인 요청 금지** · 결과와 위험을 **한 번에** 보고
🔴 CTO 는 기술 실행 방법을 정할 수 있으나 **동결 정책과 사업 전략을 임의로 바꾸지 않는다.**
```

### D. 작업 진행 방식 **6**

```
① 기존 근거로 실행 가능하면 **즉시 실행** 한다
② 미확인 사항은 **실제 구현을 막을 때만** 최소 범위로 확인한다
③ 승인 범위 안의 **세부 구현 방법은 CTO 가 결정** 한다
④ 독립적으로 해결 가능한 작업은 **하나의 실행 묶음** 으로 처리한다
⑤ 구현 후 **E2E 와 필요한 회귀** 를 수행한다
⑥ 완료 조건을 충족하면 **추가 검토 없이 종료** 한다
```

### E. 🔴 별도 승인이 필요한 **8** (이것만 CPO/CEO 승인 대상)

```
① SAME 및 상품 정체성 판정 정책 변경      ② 가격 적격성 및 blocker 정책 변경
③ 가격 산출 및 FX 정책 변경              ④ 동결된 공급원·어댑터·자동 검색 범위 확대
⑤ DB/schema 변경                        ⑥ 보호 문서 변경
⑦ **main merge 및 Production 배포**      ⑧ 사업 전략·사용자 정책에 영향을 주는 변경
🟢 이외의 승인 범위 내 기술 실행은 **CTO 자율** 이다.
```

### F. 🔵 사업 성과 중심 보고 **7** (한 번에 제출)

```
① 실제 개선된 **사업 기능**
② **실제 상품 데이터** 기준 성과
③ **GT SAME 회수 ↔ GT DIFFERENT 오탐** 변화
④ 가격 관측 · 적격 후보 · 가격 표시 변화
⑤ 기존 기능에 대한 **부작용**
⑥ 미해결 위험 및 승인 필요 사항
⑦ Git 및 Production 상태
🔴 **테스트 통과 수는 «회귀 안전성 근거» 로만** 기록한다.
🔴 사업 성과를 측정하지 못했으면 **「성과 미측정」으로 명시** 한다.
```

### G. 🟢 MI 전략 불변 조건 (이 절이 바꾸지 않는 것)

```
§0-ARCH01 · §0-ARCH03 이 **최상위 전략 기준** 으로 유지된다 —
  전체 시장 후보 발견 · 공통 후보 정규화 · **하나의 공통 MI 판단 엔진** ·
  동일한 정체성/가격 적격성/가격 산출 기준 · 화면에서 전체·국내·해외 분류 ·
  🔴 국내 **DB 영속 축은 ARCH-03 의 보류 결정 유지** ·
  🟢 이미 공통화된 **국내 transient·해외 경로는 유지**
🔴 이 운영 방식 변경은 **기존 전략이나 동결 정책을 변경하지 않는다.**
```

---

### H. 🔵🔵🔵 **[추가 2026-11-21 · `MI-EXECUTION-OPERATING-MODE-02`] 일괄 실행 · 최종 1회 보고**

🟢 위 A~G 를 **보존한 채** 얹는 규칙이다. 🔴 전략·동결 정책을 변경하지 않는다.

```
🔵 모든 CTO 작업은 **CPO 가 작성한 «완전한» 작업지시서** 를 기준으로 수행한다
🔵 CTO 는 승인 범위 안에서 **조사 → 설계 → 구현 → 테스트 → E2E → 회귀 → 완료 검증** 을
   **일괄** 수행한다
🔴🔴 **CEO 에게 중간 단계별 검토·승인을 요청하지 않는다**
```

**표준 실행 순서 7**

```
① CPO 가 **목표·범위·완료 조건·금지 사항** 을 명시한 작업지시서를 작성한다
② CTO 가 **기존 근거와 산출물을 재사용** 해 실행한다
③ 필요한 **기술적 판단은 CTO 자율** 로 결정한다
④ 구현 및 **E2E·회귀** 를 완료한다
⑤ CTO **최종 보고 1회** 를 제출한다
⑥ CPO 가 결과를 검토하고 **다음 작업을 결정** 한다
⑦ CEO 에게는 **결과와 중요 결정 사항만** 보고한다
```

### I. 🔴🔴 중간 중단·보고가 허용되는 **예외 넷** (이것뿐이다)

```
① 승인되지 않은 **사업 정책 변경** 이 필요한 경우
② **데이터 손실 또는 Production 안전성 위험** 이 발생한 경우
③ **동결 정책과 충돌** 할 가능성이 있는 경우
④ 작업 진행을 **불가능하게 하는 실제 장애** 가 발생한 경우
🔴 그 외는 CTO 가 해결한다 — **단순 기술 선택 · 구현 방법 · 테스트 실패 수정 ·
   일반적인 불확실성** 은 보고 사유가 아니다.
🔴 중간 단계별 보고서 제출과 **반복 승인 요청은 금지** 한다.
```

### J. 🔵 CTO 최종 보고에 반드시 담을 것 **8**

```
① 작업 목표 **달성 여부**            ② 실제 **사업 성과**
③ 변경 파일 및 주요 변경 내용        ④ **E2E·회귀** 결과
⑤ **GT SAME 회수 ↔ GT DIFFERENT 오탐**  ⑥ 부작용과 미해결 위험
⑦ Git 및 Production 상태            ⑧ **인수인계 문서 좌표 갱신**
🔴 F 의 규칙이 그대로 적용된다 — 테스트 통과 수는 회귀 안전성 근거로만 쓰고,
   사업 성과를 재지 못했으면 **「성과 미측정」으로 명시** 한다.
```

### K. 🟢 CPO 책임 (이 절이 CPO 에게 지우는 의무)

```
🔵 매 작업마다 **완전한 작업지시서** 를 작성한다
🔴 CTO 에게 **작업 선택을 반복해서 요구하지 않는다**
🔵 CTO 완료 보고 뒤 CPO 가 결과를 검토하고 다음 우선순위를 정한다
🔴 CEO 에게 **기술적 실행 과정의 관리 부담을 전가하지 않는다**
```

> 🔵🔵🔵 **최종 원칙** — **작업지시서는 항상 CPO 가 쓴다. CTO 는 승인된 작업을 처음부터
> 끝까지 수행한다. CEO 는 모든 단계를 검토하지 않는다.**

---

## 🔵🔵🔵🔵 §0-ARCH03. **[2026-11-21 · CPO 결정] `MI-UNIFIED-MARKET-ARCHITECTURE-03`**
## **G③ 후속 — 현행 유지 · 통합 보류**

🔴 **결정: ④ 현재 아무것도 변경하지 않는다.** 근거는 `ARCH-02` READ ONLY 보고다.
🔴 코드 **0** · 테스트 **0** · DB/schema **0** · Production **0** — **문서만** 바꿨다.
🟢 **§0-ARCH01 의 전략 원칙은 삭제·변경하지 않았다** — 이 절은 그 위에 얹는 후속 결정이다.

### A. 🔴🔴 기존 판단 정정 — 「국내 가격 단계 전체가 해외와 분리」는 **너무 넓었다**

```
🔴 CPO 가 정정한 문장(그대로 기록한다):
   「국내 transient 와 해외 가격 판단은 **이미 공통 구조** 다.
     **국내 DB 영속 관측 축만** 별도의 데이터 모델과 집계 경로를 유지하고 있다.」

실제 구조는 **세 경로** 다(ARCH-02 가 코드로 확정):
  축1 국내 **DB 영속**  `PriceObservationRecord`(pricing/price-history.ts:24 · 17칸)
                      → `summarizeDomesticMarketSplit`(pricing/price-history.ts:630)
                      → 적격성 `market-intelligence.ts:332-333` **tier 둘만** · 🔴 blocker 칸 없음
  축2 국내 **transient** `CandidateOverseasPriceRecord`(candidate-market.ts:160)
                      → `summarizeCandidateOverseasPrices`(:516) · `market-intelligence.ts:1418`
                      🟢 `:699-702` 가 `priceTier · priceStatus · **blockers**` 를 실제로 넘긴다
  축3 해외             같은 타입 · 같은 집계기(`:1434`)
  축4 마진 기준         같은 집계기(`:1427`)
⟹ 🟢🟢 **축2·3·4 는 타입·집계기·blocker 전달이 «이미» 공통이다.** 남은 것은 **축1 하나** 다.
🔴 그리고 해외/transient 레코드는 **DB 영속이 0** 이다(쓰기 코드 없음) ⟹ schema 영향은 축1 에만 있다.
```

### B. 🔴 지금 승인하지 않는 변경 **다섯**

```
① 축1 에 해외 **5단 blocker 퍼널** 적용
② `PriceObservationRecord` 의 **공통 타입 전환**
③ 국내·해외 **`basis` 어휘 강제 통일**
④ **집계 owner 통합**
⑤ 기존 국내 가격 관측 결과의 **적격성·표시 범위 변경**
```

### C. 결정 이유 (전부 실측 근거)

```
🔴 축1 에 blocker 를 적용하면 **human SAME 2건의 가격이 사라진다**(§0-MDC01 실측 ·
   기존 측정에서 국내 레코드 **1 → 0**)
🔴 GT 라벨 **39행 중 `market === "KR"` 이 0건** ⟹ 축1 적격성 안전성 **미검증**
🔴 `basis` 가 **세 뜻** 으로 쓰인다 — 가격 버킷(`EXACT|COMPARISON|NONE`) ·
   시장 선택 근거(`MarketResolutionBasis` = `SINGLE|ANALYSIS|UNRESOLVED`) ·
   그리고 해외 집계 반환에는 **`basis` 칸이 아예 없다**(`market-intelligence.ts:410` 주석)
   ⟹ 🔴 이름만 통일하면 **화면이 잘못된 가격 판단을 말할 위험** 이 있다
🟢 원천 관측 데이터의 차이는 **공통 MI 판단 기준과 구분해 보존** 한다
```

### D. 🔵🔵 전략 원칙 재확인 — **범위를 정확히 적는다**

> **공통 MI 엔진을 유지한다는 것은 «모든 저장 타입과 원천 관측 구조까지» 하나로 합친다는
> 뜻이 아니다.** 원천 관측의 **생명주기·필드·비용 정보·출처 정보** 는 다를 수 있다.
> **공통화 대상은 상품 정체성 판정과 가격 적격성·가격 산출의 «판단 기준» 이다.**

```
🟢 공통화 대상    정체성 판정 기준 · 가격 적격성 기준 · 가격 산출 규칙
🟢 보존 대상      저장 타입 · 관측 생명주기 · 비용 축(배송비·세금·환율·정상가) · 출처 칸
🔴 원천 관측 구조를 합치는 작업은 **별도 근거와 승인** 이 필요하다
🔴 그러므로 §0-ARCH01 **원칙 ①~⑩ 은 후퇴하지 않는다** — 적용 «층» 을 명확히 한 것이다
```

### E. 🟡 재검토 조건 **다섯** — 충족 전에는 축1 적격성 정책을 바꾸지 않는다

```
□ 국내 **GT KR 검증 표본** 확보(현재 0건 · 🔴 신규 수집은 동결축)
□ **human SAME 회수 ↔ GT DIFFERENT 오탐** 동시 측정
□ `PriceObservationRecord` **참조·계약 영향 전수** 확인(ARCH-02 에서 **미측정** 으로 남겼다)
□ `basis` **소비처의 의미와 계약** 확인(미측정)
□ 기존 **가격 표시 결과** 에 미치는 영향 확인
```

### F. 🔴 ARCH-02 가 남긴 UNKNOWN (이 결정으로 해소되지 않았다)

```
⒜ 축1 타입/적격성 변경의 계약·참조 **전수 숫자**        ⒝ schema 변경 실제 필요 여부
⒞ `MarketResolutionBasis` 소비처 전수
⒟ 🔴 **`"RANGE"` 리터럴이 운영 코드에 없다** — 과거 보고의 「SINGLE ↔ RANGE」는
   이 코드베이스에서 **확인되지 않는다**(CTO 자기정정 · 그 표현을 다시 쓰지 않는다)
```

---

## 🔵🔵🔵🔵 §0-ARCH01. **[2026-11-21 · CPO 전략 확정] `MI-UNIFIED-MARKET-ARCHITECTURE-01`**
## **국내·해외 통합 후보 발견 + 공통 MI 판단 아키텍처 — 최상위 구현 기준**

🔴🔴🔴 **이 절은 단기 작업 메모가 아니다. MI 전체 개발 방향을 유지하기 위한 전략 기준이고
§12 가 회전해도 남는다.** 🔴 CTO 가 임의로 변경하지 않는다 — 변경은 **CPO 승인 사항** 이다.
🔴 이 작업은 **문서화만** 했다 — 코드 **0** · 테스트 **0** · DB **0** · 배포 **0** · main 머지 **0**.

---

### A. 🔵 CPO 전략 결정 (STEP B)

> **MI 는 국내 MI 와 해외 MI 를 «별도로» 만드는 제품이 아니다.**
> **전체 시장에서 후보를 발견하고, «하나의» 공통 MI 엔진으로 상품 정체성·가격 적격성·가격을
> 판단하며, 화면에서 후보 출처를 국내와 해외로 구분해 보여주는 구조다.**

```
① 전체 시장 후보 발견   국내몰 · 해외몰 · 기타 검증 가능한 공급원
                      🔴 발견 경로는 독립 운영 가능하나 **결과는 공통 후보 구조로 연결** 한다
                      🔴 국내·해외라는 «이유만으로» 다른 판정 기준을 적용하지 않는다
② 공통 후보 정규화      원천 URL·판매처 · **출처 구분(보존)** · 브랜드 · 모델코드 · 상품명 ·
                      상세설명 · 색상/소재/사이즈/핏/대상/카테고리 · 가격·통화 ·
                      배송비·세금 등 비교 조건 · 관측 시점·원천 근거
                      🔴 **출처 자체가 동일성·가격 적격성을 결정하지 않는다**
③ 공통 MI 판단 엔진     정체성(SAME / PRESUMED_SAME / SIMILAR / UNKNOWN) →
                      가격 관측(가격·통화·출처·시점·확인상태) → **공통 blocker·적격성** →
                      가격 산출(0건 근거없음 / 1건 SINGLE / 복수 RANGE · **적격 후보만**) →
                      신뢰도·불확실성 표시(근거 부족을 숨기지 않는다 · 판매자가 최종 판단)
④ 화면 분류            전체 시장 · 국내 후보 · 해외 후보 (+ 출처·판매처·통화·조건 필터)
                      🔴 **화면 분류를 위해 판정 엔진·적격성 기준을 따로 만들지 않는다**
```

### B. 🔴🔴 절대 유지 원칙 **10** — CTO 가 임의로 변경할 수 없다

```
①  국내·해외는 **후보 발견 경로의 차이** 이고 MI 판단 기준의 차이가 아니다
②  후보 발견 결과는 **공통 MI 판단 엔진** 으로 연결한다
③  상품 정체성 판단은 국내·해외에 **동일 기준**
④  가격 적격성 판단은 국내·해외에 **동일 기준**
⑤  가격 산출은 **동일한 적격 후보 기준**
⑥  출처 정보는 **보존** 하되 판정 기준을 분리하는 근거로 쓰지 않는다
⑦  근거가 부족하면 **UNKNOWN / 근거 부족** 으로 처리한다
⑧  **SAME 과 가격 적격성은 별개** 로 판단한다
⑨  시장 가격과 **원가 기반 `recommendedPrice`** 를 혼동하지 않는다
⑩  화면에서 국내·해외를 구분하더라도 **내부 MI 판단은 통합 구조** 를 유지한다
🔴🔴 **구현 편의성 · 기존 코드의 분리 상태 · 특정 시장의 데이터 부족** 을 이유로
     별도 MI 판정 체계를 만드는 것을 **금지** 한다.
```

### C. 🟢 기존 승인 정책은 **그대로 보존** 한다(이 결정이 완화 지시가 아니다)

```
SAME 임계값·기존 판정 정책 · PRESUMED_SAME 정책 · **IMAGE 는 SAME 근거가 아니다** ·
브랜드 충돌·모델코드 충돌 처리 · 기존 blocker 및 가격 적격성 승인 정책 ·
SINGLE/RANGE 및 가격 표시 정책 · FX·가격 비교 정책 ·
원가 기반 `recommendedPrice` ↔ 시장 참고가격 **분리** · 판매자 최종 결정 원칙
🔴 국내에 해외 blocker 를 **단순 복사하지 않는다** · 해외 정책을 **근거 없이 완화하지 않는다**
🔴 공통 계약을 만들 때 **양쪽 정책·데이터 구조를 먼저 대조** 하고 차이를 다섯으로 가른다 —
   통합 가능 / 수집 경로에만 남을 차이 / 원천 데이터 차이로 보존 /
   기존 승인 때문에 즉시 통합 불가 / **CEO·CPO 추가 결정 필요**
🔴 정책 변경이 필요하면 **별도 CPO 승인 없이 구현하지 않는다**
```

### D. 🔵 CTO 실행 기준 (STEP C) — 모든 MI 작업에 적용

```
① 이 아키텍처가 **최상위 구현 방향** 이다
② 🔴 **국내·해외 «별도» 판정 엔진을 새로 만드는 작업 금지**
③ 책임 구분 — **발견 경로**(수집·출처)와 **판단 엔진**(정체성·적격성·산출)을 섞지 않는다
④ 공통 계약 변경은 **CPO 승인 필요**
⑤ 착수 전 **기존 정책과 실측 근거를 먼저 확인** 한다(§4-D · 이 트랙에서 「이미 있었다」가 반복됐다)
⑥ 🔴 전략과 다른 구현을 발견하면 **임의로 유지하지 말고 차이와 영향을 보고** 한다
```

### E. 🔴 향후 작업 전 **전략 정합성 체크 8** (지시서 §7)

```
□ 전체 시장 후보 발견 구조를 유지하는가
□ 국내·해외가 **동일한 MI 판단 엔진** 을 쓰는가
□ 상품 정체성 기준이 동일한가
□ 가격 적격성 기준이 동일한가
□ 가격 산출 규칙이 동일한가
□ 국내·해외 차이를 **수집·출처·화면 계층에 한정** 했는가
□ 기존 승인 정책을 임의로 변경하지 않았는가
□ **GT 와 실측 근거를 구분** 했는가
🔴 하나라도 위반하면 **착수 전에** CPO 에게 차이와 이유를 보고한다.
🔴 「기존 코드가 그렇게 되어 있다」를 이유로 목표 아키텍처를 바꾸지 않는다.
🔴 개별 blocker · 특정 브랜드 · 특정 상품 · 개별 어댑터 개선이 **전체 MI 전략보다 우선하지 않는다** —
   개별 작업은 **공통 아키텍처의 어느 단계에 기여하는지** 를 반드시 명시한다.
```

---

### F. 🔵 현재 구현 ↔ 목표 아키텍처 **차이 목록**(STEP D · 코드 위치 대조 완료)

| # | 항목 | 실제 코드 위치 | 현재 동작 | 목표 | 미확인 · 선행 조건 |
|---|---|---|---|---|---|
| 1 | 후보 발견 경로 | `comparison-search/index.ts` **:304** `searchComparisonShops`(해외) · **:564** `searchDomesticShops`(국내) | 🟢 **같은 파일·같은 단계·같은 `ComparisonCandidate` 계약** (WU-147 이 「분리된 pipeline」을 반증) · 갈리는 곳은 `ADAPTER_BY_DOMAIN`(domain→단일 catalog) | 전체 시장 발견 | 🔴 등록부·어댑터 확대는 **동결축**(§12-0) ⟹ CPO 결정 |
| 2 | 공통 후보 구조 | `types.ts` `ComparisonCandidate` · `shared/product-facts.ts` `ProductFacts` | 🟢 **공통 타입 하나** · `facts.description`·`evidence` 칸 존재 | 그대로 | 🔴 출처 칸 `source` 가 **provenance 로 신뢰 불가**(§0-SUVG01) |
| 3 | 정체성 판정 연결 | `cross-seller.ts` `compareCrossSellerProducts` · `match.ts:581` `withConfidence` · `match-truth.ts:74` `deriveMatchTruth` | 🟢 **국내·해외 공통 엔진** · 시장을 보지 않는다 | 그대로 | 🟢 원칙 ③ 충족 |
| 4 | 가격 관측 구조 | 🔴 **타입이 둘** — 국내 `pricing/price-history.ts:24` `PriceObservationRecord` · 해외 `candidate-market.ts:160` `CandidateOverseasPriceRecord` | 🔴 국내 타입에 **`blockers` 칸이 없다** · 해외 타입에는 있다 | 공통 관측 구조 | 🔴 통합은 **타입 경계 변경** ⟹ CPO 승인 · DB 영향 미확인 |
| 5 | blocker·적격성 | 해외 `candidate-market.ts:570·582·596·614`(5단 퍼널 · `PRICE_DISQUALIFYING_BLOCKERS`) · 국내 `market-intelligence.ts:332-333`(**tier 둘만**) | 🔴🔴 **비대칭** — 국내는 blocker 를 **구조적으로 못 본다** | 공통 적격성 계약 | 🔴 좁히면 **human SAME 2건 손실** 실측(§0-MDC01) ⟹ precision↔recall 교환 · CPO 판단 |
| 6 | 가격 산출·집계 | 🔴 **owner 가 둘** — 해외 `candidate-market.ts:516` `summarizeCandidateOverseasPrices` · 국내 `pricing/price-history.ts:630` `summarizeDomesticMarketSplit`(호출부 `market-intelligence.ts:747`) | 🟡 SINGLE/RANGE·통화 분리·환산 금지는 양쪽 동일 | 동일 산출 규칙 | 🔴 두 owner 통합 범위 **미측정** |
| 7 | 화면 분류 | `MarketPriceComparison`(🇰🇷/🌎) · `market-split` · `WU-148` 시장별 해석 | 🟢 **표시 계층에서만** 구분 · 집계 어휘 금지 계약 존재(`wu-130 F-4`) | 전체+필터 | 🟡 「전체 시장」 통합 보기 **없음** |
| 8 | GT 검증 공백 | `preserved/mdc-01-…json`(저장분 39) · `fixtures/mi-reeval-03-…json`(109) | 🔴 **GT 라벨 39행 중 `market === "KR"` 이 0건** | 국내·해외 동일 기준 검증 | 🔴🔴 **국내 가격 안전성을 검증했다고 주장할 수 없다** |

🟢 **§5 표의 사실 넷을 코드로 재대조했고 전부 유효합니다** — ⒜ 국내 `PriceObservationRecord` 에
`blockers` 칸 **없음**(필드 전수 확인) ⒝ 국내 aggregator 는 **tier 중심**(`:332-333`)
⒞ 해외에 `PRICE_DISQUALIFYING_BLOCKERS` 적용(`:596`) ⒟ GT KR 행 **0건**.

🔴🔴 **[정정 2026-11-21 · ARCH-02/03] 위 표의 항목 4·5 는 «국내 축을 하나로 본» 오류다.**
🔴 원문을 지우지 않고 남긴다 — 어떤 전제에서 그렇게 적혔는지 다음 세션이 알아야 한다.
```
🔴 틀린 것   「국내는 blocker 를 구조적으로 못 본다 · 타입이 둘이라 갈라져 있다」
🟢 사실      국내 가격 축은 **둘** 이다 —
            축1 **DB 영속**(`PriceObservationRecord` → `summarizeDomesticMarketSplit`) 🔴 blocker 없음
            축2 **transient**(`CandidateOverseasPriceRecord` → `summarizeCandidateOverseasPrices`)
               🟢 해외와 **같은 타입·같은 집계기** 이고 `market-intelligence.ts:699-702` 가
                  `blockers` 를 **실제로 넘긴다**
⟹ 🟢 항목 4·5 의 「위반」은 **축1 에만** 해당한다. 축2·3·4 는 **이미 공통** 이다.
🔵 그래서 CPO 가 **§0-ARCH03** 에서 「④ 아무것도 변경하지 않는다」로 결정했다.
```

### G. 🔴 미확인 · CEO·CPO 결정 필요

```
🔴 미확인(UNKNOWN)
   ⒜ 항목 4·6 통합의 DB·계약 영향 범위(측정 안 함)
   ⒝ 「전체 시장」 통합 보기의 제품 요구(화면 정책)
   ⒞ 국내 가격 안전성 — GT KR 표본 **0** 이라 구조적으로 미검증
🟡 CPO·CEO 결정 필요
   ① 항목 1 — 발견 확대를 위해 **동결축(등록부·어댑터·해외 자동풀)** 을 열 것인가
   ② 항목 5 — 국내 금액 축에 「관측된 차이」 필터를 넣을 것인가(human SAME 2건 손실 공시)
   ③ 항목 4·6 — 두 타입·두 owner 를 통합할 것인가(선행: 영향 범위 측정)
   ④ 항목 2 — `source` 칸의 provenance 정확성(코드가 **D4 · CPO 사안** 으로 표시해 둠)
🔴 CTO 는 넷 중 **아무것도 열지 않았다.**
```

### H. 🔵 향후 첫 번째 실행 순서 (CPO 결정 뒤)

```
🔴 **조사가 아니다.** 위 ①~④ 중 CPO 가 고른 **하나** 에 대해:
   ① 전략 정합성 체크 8 통과 확인 → ② 기존 산출물 재사용(재측정 0) →
   ③ 변경 전 반사실(GT SAME 회수 ↔ **GT DIFFERENT 오탐** 동시 측정) →
   ④ 계약 영향 전수 → ⑤ 구현 → ⑥ E2E → ⑦ 회귀 → ⑧ 보고 1회
🔴 그리고 **테스트 통과 수를 사업 성과로 적지 않는다** — 회귀는 안전성 수단이다.
```

---

## 🔵🔵🔵 §0-MLLC01. **[2026-11-21] `MI-LISTING-LABELED-CODE-01` — 구현·검증 완료 · CLOSED**

🟢 CPO 가 **제한적 B-38 부분 해제**(라벨 전용 · slug 폴백 제외)와 **계약 4 앵커 갱신** 을
승인해 집행했다. 운영 코드 **1줄** · DB **0**.
🟢🟢 **[2026-11-21 정정] 배포 완료** — 커밋 `39d688f6` 이 Production 빌드 **`95fd84b`** 에
실려 있다(실측 `origin/main:seller-facts.ts:412`). 🔴 이 절에 「배포 **0**(main 머지 승인
사항)」으로 적혀 있었다 — **그 시점의 기록이고 현재 상태가 아니다.**
🔴 단 **운영 verdict 변화는 여전히 0** 이다(아래 ⓞ) — 「배포됐다」를 「효과가 났다」로 읽지 않는다.

### ⓞ 최종 상태

```
운영 변경  `seller-facts.ts` productFactsFromListing
          `brandModelCode: null` → `extractLabeledProductCode(input.description) ?? null`
          🔴 실제 코드 **1줄**(나머지는 근거 주석) · 승인된 추출기 하나 · 폴백은 `null`
금지 유지  slug 폴백 · `sellerSku` · 라벨 없는 코드 · 제목토큰 승격 ·
          `materialText`/`fitText`/`ageRangeText`/`sizeLabels` · Contract P2 ·
          브랜드 점수/등록부/alias · 임계값 · blocker · 가격 적격성 · DB/schema
계약      신규 `mllc-01-labeled-code-contract`(12) ·
          반사실 `mllc-01-labeled-code-counterfactual`(15 · A-0 per-label + STEP A-2) ·
          앵커 갱신 4 — candidate-code-parity-01 C-1 · core-2ab AB-S1 ·
          core-2ac AC-6 · core-2j A
음성대조   M1 한 줄 되돌림 → **7 FAIL** · M2 slug 폴백 추가 → **5 FAIL** → 복구 PASS
검증      대상 7파일 **58 passed** · typecheck **0** ·
          회귀 **940 files / 11,510 passed / 0 failed**
🔴 **운영 verdict 변화 0** — 이득은 잠재적이고 구속 조건은 **브랜드 등록부** 다(별도 과제)
```

### ⓞ-b 🔴 앵커 4건의 변경 전후 의미

```
candidate-code-parity-01 C-1  「하드코딩 null」      → 「**라벨 전용** + 금지축 3 잠금」
core-2ab AB-S1                「빈 칸 **다섯**」      → 「빈 칸 **넷** + 품번은 라벨에서만」
core-2ac AC-6                 「하드코딩 null」      → 「라벨 전용 + 제외 범위 3 잠금」
core-2j  A                    「null 이 의도다」      → 「**라벨 뒤의 값만** · 자체코드 문은 닫힘」
                              + ③ 확인 경로 주석에 **실측(61/2/0)** 을 박았다
🟢 네 건 모두 **보호 의도를 약화하지 않고** 좁게 다시 적었다(금지축을 단언으로 추가).
```

### ① 🟢 STEP A 반사실 — 분모와 수치(재측정 불필요)

```
분모  fixture 109 = GT **SAME 20 · DIFFERENT 15 · SIMILAR 1** · 미라벨 **73**  (= 109 ✅)
      🔴🔴 **[2026-11-21 정정]** 1차 보고가 이 자리에 「SAME 18 · DIFFERENT 13 · SIMILAR 1」을
         적었다 — 그것은 **98 축**(후보 제목 ∧ 설명) 수치이고 **109 축에 섞어 적은 것** 이다.
         🟢 산출물(`denominator.gt`)과 하니스는 **처음부터 109 축이 맞았다** — 틀린 것은 보고서 본문이다.
         🟢 차이 **4건** = GT 라벨이 있는데 **후보 설명이 없어** 98 축에서 빠진 쌍이다:
            SAME `B226AC009`×bornyesterdaykids · SAME `B226AC036`×beaumonde ·
            DIFFERENT `B226AC009`×villagekids · DIFFERENT `B226AC110`×villagekids
      🔴 109 · 98 · 36 · 32 · 24 · 16 은 서로 다른 집합 — 합산하지 않는다
팔    BASE  = 변경 전(`brandModelCode: null`) → `recoverModelCodeFromDetail`
      LABEL = 승인 한 줄(`extractLabeledProductCode(description) ?? null`) → 같은 복구기
      🔴 두 팔 모두 **명시 재현** 한다 ⟹ 하니스가 팩토리 현재 동작과 **독립** 이다
결과  ① GT DIFFERENT → SAME 전환      **0**   ✅ CPO 핵심 통과 조건
      ② GT SAME 품번충돌 새 차단       **0**   ✅ (명단 공백 · `B226AB040` 포함 0)
      ③ GT SIMILAR verdict 변화        **0**
      ④ 미라벨 verdict 변화            **0**
      ⑤ 전 분모 verdict 변화           **0**   ⟹ 🔴 **순효과 0**
      ⑥ `brandModelCode` 칸 추가 공급  **10**  (열화·덮어쓰기 **0**)
      BASE 팔에서 이미 복구된 쌍 **22**(그중 GT 라벨 11) ⟹ 🟢 운영 복구기가 살아 있다
산출물 `__tests__/preserved/mllc-01-labeled-code-counterfactual.json`
하니스 `__tests__/mllc-01-labeled-code-counterfactual.test.ts`(10 tests)
```

### ② 🟢 승인 변경은 **중복이 아니다**(그러나 이득은 잠재적이다)

```
운영 복구기 `recoverModelCodeFromDetail`(model-code-from-detail.ts:68)은
  `product-url-facts.ts:621`(PLAIN_HTML) · `:428`(SHOPIFY_JSON)에서 **이미 돈다**
🔴 그런데 그 함수는 품번 **«모양»**(`\bB\d{3}[A-Z]{2}\d{3}\b`)만 읽는다 ⟹
   다른 브랜드의 실제 품번을 **읽지 못한다**(실측: `WK21A165` · `WK21W97` ·
   `AW26MS185` · `BJ87` · `BJ35-SS26` · `BJ11-SS26` · `SS25-250`)
🟢 라벨 앵커는 모양과 무관하므로 그 공백 **10건** 을 메운다(전부 미라벨)
🔴🔴 그래도 verdict 는 **0건** 바뀐다 — 원상품 코드와 **정확히 일치** 한 2건
   (`WK21A165` · `WK21W97` · junioredition × Wynken)은 `MODEL_CODE` **3점을 실제로 얻었는데**
   `BRAND_UNCONFIRMED` 가 SAME 을 막았다(등록부 4개 밖 브랜드) ⟹ **이득은 잠재적** 이다
⟹ 🔵 **구속 조건은 품번이 아니라 브랜드 등록부** 라는 것이 이 측정의 결론이다
```

### ③ 🔴 중단 사유 — 기존 계약 4건이 「변경 전 상태」를 고정한다

```
candidate-code-parity-01.test.ts    C-1   「PLAIN_HTML 후보 품번은 여전히 하드코딩 null」
core-2ab-evidence-source-meaning    AB-S1 「`productFactsFromListing` 의 빈 칸은 **다섯**」
core-2ac-plain-html-parity          AC-6  「`brandModelCode` 는 여전히 하드코딩 null」
core-2j-identity-field-purity       A     「brandModelCode 생산자 **여섯** · 후보 경로 **둘**」
🟢 네 건 전부 **의도된 변경에 의한 FAIL** 이고 제품 결함이 아니다
🟢 AB-S1 주석이 그 설계 의도를 직접 적는다 — 「남은 다섯은 **열 때마다 줄어야 하고
   «조용히» 줄면 안 된다**」 · 선례는 CORE-2AC(일곱 → 다섯으로 앵커 **갱신·강화**)
🔴 그러나 그 갱신은 **계약 수정** 이고 CPO §3 STEP D 가 「임의 수정 금지 · 중단」으로
   못 박았다 ⟹ **CTO 가 수정하지 않았다**
```

### ④ 🟡 재개에 필요한 것 — **CPO 승인 1건**

```
승인 대상  위 계약 **4 앵커의 갱신·강화**(브랜드 품번 칸을 「라벨 전용으로 채운다」로 ·
          나머지 **넷**(materialText · fitText · ageRangeText · sizeLabels)은 **그대로 잠근다**)
🟢 그 승인만 있으면 남은 작업은 **한 줄 구현 + 앵커 4건 갱신 + 회귀** 이고,
   반사실·계약 뼈대·산출물은 **이미 있다**(재조사·재측정 0)
🔴 승인 전에는 착수하지 않는다
🔴 그리고 **등록부 밖 브랜드 문제는 이 승인으로 해결되지 않는다** — ②의 2건이 그 증거다
```

### ⑤ 🔴 내가 틀려서 고친 하니스 결함 2건 (그대로 적는다)

```
⒜ 구현 후 BASE 팔이 **바뀐 팩토리를 그대로 써서** 반사실이 동어반복이 됐다
   (A-4 가 조용히 「통과」로 뒤집혔다) ⟹ BASE 를 변경 전 동작으로 **명시 재현** 하게 고쳤다
⒝ 🔴 더 중요 — `originFacts` 의 `?? base.brandModelCode` 폴백이 구현 후
   **원상품 설명의 라벨 코드** 를 끌어와 `originCode === null` 인 쌍의 판정을 바꿨다
   ⟹ 두 팔이 함께 흔들려 델타가 오염됐다(**A-3 가 FAIL 로 잡았다**)
   🟢 운영 원상품 facts 는 `productFactsFromIdentityDna`(origin-facts.ts:44)가 만들고
      이 팩토리를 쓰지 않으므로 **하니스 결함** 이다 ⟹ 폴백을 제거했다
```

---

## 🔵🔵🔵 §0-FLOW01. **[2026-11-21] `MI-IDENTITY-DATA-FLOW-01` — 구조적 원인 확정 · 조사 단계 종료**

🔴 **CPO 가 이 단계를 종료했다.** 🔴 **같은 현황을 다시 조사하지 않는다.** 운영 코드 **0** · DB **0** · 배포 **0**.

### ① 🟢🟢 확정된 구조적 원인 — 반복 관측 셋이 하나로 설명된다

```
🔴 원인은 「상세설명이 판정기에 전달되지 않는 것」이 **아니다** —
   `ProductFacts` 에 `description`·`evidence` 칸이 **있고** 판정기 입력까지 **도달한다**.
🔴🔴 원인은 **판매처별 `ProductFacts` 생성 경로의 비대칭** 이다:
   Shopify  `productFactsFromShopifyProduct`(seller-facts.ts:179)
            :247 `extractLabeledProductCode(description)` 로 **설명에서 품번을 복구** ·
            materialText·fitText 조건부 추출
   Listing  `productFactsFromListing`(seller-facts.ts:371) — **같은 설명을 입력받고도**
            `brandModelCode: null`(:380) · `materialText: null`(:388) · `fitText: null` ·
            `ageRangeText: null` · `sizeLabels: []` **고정**
   판정기    **Contract P2**(product-facts.ts:801-803)가 `description`·`evidence` 읽기를 금지 ·
            `evidence` 소비처는 설명/요약 **3파일** 뿐(판정기 grep **0**)
점수표(cross-seller.ts 실측) TITLE 2|1 · MODEL_CODE 3|2 · CATEGORY/COLOR/MATERIAL/FIT/
            AUDIENCE/SIZE/IMAGE 각 1 · 정원 SAME ≥5 · PRESUMED_SAME ≥3(IMAGE·1점 TITLE 제외)
⟹ 🔴 Listing 후보는 **최대 7점**(품번 3 + 보조 4)을 잃는다 ⟹ 남는 최대 **4~5**
⟹ 🔴🔴 **PRESUMED_SAME(3) 에는 쉽게 닿고 SAME(5) 에는 거의 못 닿는다**
   그리고 blocker 는 **SAME 게이트만** 막으므로 전부 PRESUMED_SAME 으로 고인다
🟢 이 하나로 설명되는 것 — 「GT DIFFERENT 13/13 저장 PRESUMED_SAME」 · 「국내 SAME 0」 ·
   「MDCP-01 CONTROL 4/24 · A1 PRESUMED_SAME 9/24 · SAME 0」
🔴 **영향률은 미측정** 이다 — 운영 후보 전체에서 경로별 비중을 세지 않았다(추정 금지)
```

### ② 유실·미사용 지점(유형별 · 코드 위치)

```
STRUCTURING_GAP  Listing 팩토리 5칸 null 고정                seller-facts.ts:380·388
STRUCTURING_GAP  Smallable 팩토리가 `description` 칸 미제공    seller-facts.ts:511-552
CONSUMPTION_GAP  Contract P2 — 설명·evidence 읽기 금지        product-facts.ts:801-803
CONSUMPTION_GAP  BRAND 는 **점수 0**(blocker 발화/해제 전용)   cross-seller.ts 축 목록
EXTRACTION_GAP   `confirmBrandCodeInEvidence` 건초더미 = title·url·sku  domestic-identifiers.ts:185
EXTRACTION_GAP   등록부 밖 브랜드는 전건 UNKNOWN(등록부 4건)  brand-alias.ts
PERSISTENCE_GAP  `candidate_reviews`·`product_snapshots` 에 후보 facts/description 칸 **0**
NO_GAP           설명 확보·전달 · MODEL_CODE/TITLE 점수 반영 · tier 산출
```

### ③ 🔴 CPO 결정 — 둘 다 지금 하지 않는다

```
Smallable `description` 칸 추가   **보류** — 근거 표시 개선일 뿐 **판정 정확도 개선이 아니다**
동결 순위 1~4 변경                **승인 보류** — 기존 보호 계약과 오판 방지 조건이 있다
```

### ④ 🔵 다음 방향(CPO 확정) — **Listing 경로의 구조화 정보 부족 해결** · 원칙 5

```
① 판매처 SKU 와 실제 모델코드를 혼동하지 않는다
② 소재·핏 등 추출 근거가 불확실하면 **UNKNOWN 을 유지** 한다
③ 설명 원문을 **무조건 판정 입력으로 풀어주지 않는다**
④ 기존 SAME / DIFFERENT 보호 기준을 유지한다
⑤ 기존 **B-38 NO-GO 를 우회하거나 되살리지 않는다**
🔴 필요한 정책 변경은 **별도 승인 없이 진행하지 않는다** · 범위는 **CPO 가 지정** 한다
```

### ⑤ 🟡 CPO 판단 재료 1건 (CTO 제안 아님 · 재추진 안 했다)

```
B-38 재개 조건은 「일반 품번 불일치 GT DIFFERENT 표본」이었고, 이 트랙이 그 표본 **2건** 을 찾았다 —
  `cemarose.ca` 설명 품번 **B226AC031** · `tinyapple.net` **B226AC142**
  (원상품 B226AC009 · 둘 다 GT DIFFERENT)
🟢 `compareModelCode(AC009, AC031)` 은 공통 접두 6자 후 분기 ⟹ **conflict(보호 방향)** 이다
🔴 비용은 `B226AB040`(GT SAME · AC↔AB 라인)이 함께 막히는 **기존에 측정된 교환** 이다
🔴 CTO 는 이것을 **열지 않았다** — 사실만 기록한다
```

---

## 🔵🔵🔵 §0-MDCP01. **[2026-11-20] `MI-DESCRIPTION-COMPARISON-01` — 상세설명 비교 효과 · 측정 종료**

🔴 **CPO 지시(상세설명 비교로 국내 동일상품 매칭이 개선되는지 측정)의 산출이다.**
🟢 운영 코드 **0줄** · HTTP **0** · 수집 **0** · verdict 저장 **0** · 정책(SAME 기준 · 2출처 ·
blocker · 가격 자격 · 이미지) **전부 0** · `ProductFacts` 운영 연결 **0**.

### ① 🔴🔴 먼저 — 그 측정은 **이미 있었고, 그 CONTROL 이 실패했다**

```
기존 산출물  `preserved/mi-composite-identity-eval.json`
            조합 7개(BRAND·MODEL_CODE·PRODUCT_NAME 및 조합) × base/desc · 분모 **16** ·
            `changedPairs` **0** ⟹ 「상세설명 효과 0」으로 읽힐 수 있었다
🔴 그 산출물의 `control` 이 **reproduced 1 / mismatched 15** 다
⟹ 헌장 §5-B: **CONTROL 이 실패하면 그 숫자를 전략 판단에 쓰지 않는다**
⟹ 🔴 「효과 0」은 **결론이 아니었다**(= 하니스가 운영을 재현하지 못한 상태의 값)
```

### ② 🟢 CONTROL 실패의 원인 — **둘로 갈렸다**

```
⒜ 🟢 **복구 가능** — 하니스가 후보 브랜드를 «판정기에 넘기지 않았다»
   `mi-composite-identity-eval.test.ts:78-84` `candidateFacts()` 가
   `productFactsFromListing({title,url,description})` 로만 만든다(**brand 없음**)
   ⟹ `brandKnown` false ⟹ 전건 `BRAND_UNCONFIRMED` ⟹ 축이 `{CATEGORY:1}` 로 붕괴
   ⟹ 운영 저장 `PRESUMED_SAME`(≥3축) 대신 **`SIMILAR`**(≥1축)
   🔴 그 하니스는 후보 브랜드를 **이미 텍스트에서 읽고 있었다**(`brandFromText`) —
      자기 지표에만 쓰고 판정기에 되먹이지 않았다. **그것이 버그다**
⒝ 🔴 **복구 불가** — fixture 에 **후보측 구조화 facts(색상·소재·대상)가 없다**
   미재현 **15건이 전부 축 1개**(`{CATEGORY:1}`)인데 운영은 같은 쌍에서 ≥3축을 얻었다
   ⟹ 기존 자료로는 메울 수 없다 — **측정불가**(0 이 아니다)
```

### ③ 측정 — BASELINE 은 **운영 저장 verdict** 이고 내가 계산하지 않았다

```
분모  109 fixture → 운영 저장분(`candidate_reviews` GT 37) 조인 **45** →
      ∩ 양쪽 상세설명 **24**   🔴 109 · 16 · 39 · 24 는 서로 다른 집합(합산 금지)
상세설명 확보율(109 기준)  원상품 **92** · 후보 **98** · 양쪽 **82**
팔 셋  A0 현 하니스 모양 / A1 **복구**(후보 brand 되먹임) / A2 **상세설명 비교**
CONTROL 재현   A0 **2/24** → A1 **4/24** → A2 2/24
🔴🔴 **복구 후에도 4/24 다** ⟹ 이 분모의 «효과 수치» 를 전략 판단에 쓰지 않는다
verdict 분포  A0 {PRESUMED_SAME 7 · SIMILAR 17} · A1 {9 · 15} · A2 {7 · **SAME 2** · 15}
```

### ④ 그래도 «관측» 된 것 — 🔴 결론이 아니라 관측이다

```
🟢 품번 확인 **+4** — 설명을 품번 건초더미에 더하면 `confirmBrandCodeInEvidence` 가 4건 더 확인
🟢 GT **SAME 2건** 이 `MODEL_CODE` **3점** 을 얻어 SAME 으로 올라갔다
   junioredition.com × B226AC009 · B226AC033 — 둘 다 품번이 **설명에만** 있는 `DESCRIPTION_ONLY`
   A1 {TITLE 2 · CATEGORY 1} → A2 {TITLE 2 · **MODEL_CODE 3** · CATEGORY 1}
🟢 GT DIFFERENT → SAME **0건**
🔴 브랜드 신규 획득 **0** — 별칭 등록부가 **4개 브랜드** 뿐이다(brand-alias.ts) ·
   「설명에 브랜드가 없다」가 **아니다**
```

### ⑤ 🔴🔴 **그러나 이것이 기존 REJECT 를 «뒤집지 않는다»**

```
기존 REJECT(§0-RESULT) — 같은 레버(설명 품번)를 20쌍·4호스트에서 재서
  **실제 이득 1 ↔ GT DIFFERENT 오염 2**(`cemarose.ca` · `tinyapple.net`) ⟹ 전체 기각
🔴 그 **두 호스트가 이 분모에 없고, 있을 수도 없다** —
  109 fixture 에서 cemarose 1건·tinyapple 3건이 **양쪽 설명 0 · 운영 저장분 조인 0**
⟹ 🔴 **내 「오염 0」은 안전의 증거가 아니라 «분모의 성질» 이다**
⟹ 🔴 같은 레버를 다시 열려면 **그 두 호스트가 든 분모** 가 필요하다(현재 확보 불가)
```

### ⑥ 운영 연결 최소 변경 범위 (🔴 구현 0 · CPO 승인 사안)

```
변경 지점 **한 곳** — `confirmBrandCodeInEvidence`(domestic-identifiers.ts:185)의 건초더미
  `title · url · sku` 에 **후보 상세설명을 더한다**
🔴 그 레버는 `a-identity-axis.test.ts`(6 tests)가 **기각 결론으로 잠그고 있다**
   ⟹ 연결은 **계약 개정을 동반** 하고 CPO 승인 사안이다
🔴 그리고 ②⒝(후보 구조화 facts 부재)는 그 연결과 **무관하게 남는다** —
   `§A-MI-2` 의 재개 조건(후보 원문 · HTTP 429)과 **같은 벽** 이다
```

### ⑦ 산출물 · 검증

```
산출물  `preserved/mdcp-01-description-comparison-control.json`
        (분모 · CONTROL 3팔 · verdict 분포 · 효과 · **limitations 5** · minimalOperationalChange · rows 24)
계약    `__tests__/mdcp-01-description-comparison-control.test.ts` — **8 tests**
        A(CONTROL) 4 · B(효과·오염 0 절대조건) 3 · C(산출물 보존) 1
음성대조 복구 지점(후보 brand 되먹임)을 되돌리면 **A-2 가 1 FAIL** → 복구 후 8/8
```

---

## 🔵🔵🔵 §0-MDC01. **[2026-11-20] `MI-DOMESTIC-CONTROL-01` — 가격 자격 CONTROL · 코드 0줄**

🔴 **CPO 지시(국내 동일상품 매칭 다음 과제 확정)의 산출이다.** 🔴 **재조사 금지.**
🟢 운영 코드 **0줄** · DB 쓰기 **0** · HTTP **0** · 정책(threshold·정원·blocker 집합·가격 자격) **0**.

### ① 왜 이 과제였나 — backlog 분류 결과

```
① 국내 후보 공급        🔴 **CPO 동결** — 「공급을 다시 재지 않는다」 · 남은 칸은
                       `NO_TITLE_OVERLAP` **정책 질문** 하나(memory 2026-10-22)
② precision/recall 분모  🔴 분모 확장용 HTTP **불승인** · A군 후보 원문 **0/33**
③ 판정 구분 근거         🟡 보류 — 후보측 원문 **HTTP 429**(호스트 12곳)가 선행 블로커
④ 가격 비교 대상 제한     🟢 **여기가 열려 있었다** — 「유입」이 **tier 로만** 주장돼 있었다
⑤ MI 화면 전달          🟢 종결(배포 `d28d01c9`)
⟹ ④ 가 유일하게 **기존 자료 · HTTP 0 · 정책 변경 0** 으로 검증 가능했다
```

### ② 🔴🔴 정정한 것 — 인수인계 ⑦의 「핵심 수치」가 틀렸다

```
🔴 적혀 있던 것   「GT DIFFERENT 13/13 저장 PRESUMED_SAME · 그중 **10건 tier
                 COMPARISON**(= 가격 비교 **유입**)」
🟢 실측          tier COMPARISON 은 **11건** · 그 11건은 금액 자격 퍼널 **③에서 전건 탈락**
🔴 오독의 이름    `priceTier` 는 **관측/분류** 이고 **가격 자격이 아니다**
                 (memory `tier-is-not-price-eligibility` 가 기록한 **그 오독의 두 번째 재발**)
🟢 자격 owner    `summarizeCandidateOverseasPrices`(candidate-market.ts:516) 퍼널 5단 —
                 ① tier EXCLUDED ② verdict ∉{SAME,PRESUMED_SAME}
                 ③ blockers ∩ `PRICE_DISQUALIFYING_BLOCKERS` ④ 금액 없음 ⑤ priceStatus
🔴 ⑤ 미측정      `candidate_reviews` 에 `price_status` **칸이 없다** ⟹ ①~④ 까지다
                 (⑤는 **더 좁히는** 방향이라 「오염 0」 결론은 뒤집히지 않는다)
```

### ③ 측정 — 운영 저장분 `candidate_reviews` 전수 (분모 **39**)

```
GT 라벨 39 = DIFFERENT **15** · SAME **23** · SIMILAR **1**   (조인 키 `(origin_code, candidate_url)`)
금액 축 유입   DIFFERENT **0/15** · SAME **4/23** · SIMILAR **1/1**
DIFFERENT 탈락 사유   ③ 관측된 차이 blocker **11** · ④ 금액 없음 **4**
통과 집합 5건의 GT    SAME 4 · SIMILAR 1 · **DIFFERENT 0**  ⟹ 🟢 **오염 0**
🔴 분모를 합산하지 않는다 — 109쌍 fixture · 16쌍 양쪽전문 · 이 **39행** 은 서로 다른 집합이다
🔴 저장 금액에 **×100 꼴 이상치**(CAD 27100 · USD 12700 …)가 있다 — 🟢 판정에는 영향 0
   (그 행들은 ③에서 막힌다) · 기존 기록과 같은 현상
```

### ④ 🔴🔴 새로 확정한 사실 — **국내/해외 비대칭** (고치지 않았다)

```
해외 축   `summarizeCandidateOverseasPrices` 가 `blockers` 를 받아 ③에서 막는다
국내 축   `market-intelligence.ts:332·333` 이 **tier 둘만** 본다 —
          버킷 타입 `PriceObservationRecord`(pricing/price-history.ts:24)에
          🔴 **`blockers` 칸이 애초에 없다** ⟹ 구조적으로 그 필터를 가질 수 없다
🔴 반사실  같은 11건이 **국내 시장이었다면 tier 만으로 전건 유입된다**
🟢 현재 실제 오염은 **0** — GT 라벨 39행 중 `market === "KR"` 이 **0건**
   🔴 「안전하다」가 아니라 **「그 모양의 표본이 없다」**(측정불가 ≠ 안전)
🔴🔴 **좁히면 손실이 난다 — 그래서 CTO 가 고르지 않았다**
   human **SAME** 인데 그 차단축을 든 행이 **2건** 실재한다 ⟹ 국내에 같은 필터를 넣으면
   **정답 2건이 금액에서 사라진다**(기존 실측: 국내 레코드 1 → 0 · 비스킷 ₩88,000)
⟹ 🟡 **precision ↔ recall 교환이고 CPO 판단 사안** 이다
```

### ⑤ 산출물 · 검증

```
산출물   `apps/admin/src/app/api/price-history/_lib/__tests__/preserved/
          mdc-01-price-eligibility-control.json`(GT 39행 + 분모 + 측정 범위 + 관측)
계약     `__tests__/mdc-01-price-eligibility-control.test.ts` — **12 tests**
         A(오염) 5 · B(비대칭) 4 · C(손실·owner) 3 · 🟢 운영 집계기를 **직접 호출** 한다
음성대조  M1 차단축 목록에서 `BRAND_MISMATCH` 제거 → **4 FAIL**
         M2 집계기 ③ 분기의 `continue` 제거 → **4 FAIL**
         M3 `PriceObservationRecord` 에 `blockers` 칸 추가 → **1 FAIL**
         🟢 세 파일 전부 **바이트 동일 복구**(`git diff` 비어 있음) → 12/12 재통과
🔴 기존 계약과 중복이 아니다 — `brand-conflict-price-real`(브랜드축 · TEMP 덤프라
   머신 밖에서는 SKIP) · `stage7-2`(손으로 만든 레코드)에는 **GT 라벨 교차와
   국내 비대칭 단언이 없다**
```

### ⑥ 🔵 다음 한 수 (CPO 판단 1건 · CTO 작업 없음)

```
🟡 결정 필요 — 「국내 금액 축에 「관측된 차이」 필터를 넣을 것인가」
   넣으면   DIFFERENT 11건의 잠재 유입이 닫힌다 ↔ 🔴 human SAME **2건** 이 사라진다
   안 넣으면 현재 오염 **0** 유지 ↔ 🔴 KR 표본이 생기면 그때 유입된다
🔴 CTO 는 둘 중 아무것도 구현하지 않았다 — 계약이 **현재 상태를 사실로 고정** 했을 뿐이다
🔴 그리고 ③축(판정 구분 근거)을 열려면 **후보측 원문 확보**(HTTP 429)가 선행이다
```

---

# [이전 기록] §B-38 실행 (🔴 **종결됨** — 아래는 근거 보존이다)

> 🟢 **진입 문서는 여전히 하나다** — 공식 진입점 `docs/START-HERE.md` 의 **§0-NOW(311줄)가 이 문서를 가리킨다**(2026-11-20).
> 🔴 **이 문서 하나로 시작한다.** 전략 재조사·재논의·확인 질문 없이 **STEP 1 부터** 실행한다.
> 🔴 이미 확정된 전략·동결 정책·대상을 다시 묻지 않는다.
> 🟢 상세 이력은 `docs/CTO-SESSION-START.DRAFT.md` §B-18~§B-38 에 있다 — **막혔을 때만** 연다.

---

## 0-NEXT. 🔵🔵🔵 **[2026-11-20] 다음 WU = 복합 식별 근거 평가 · PHASE 1 «완료» · 분모 확정**

🔴 전략 상시 규칙은 `docs/CTO-SESSION-START.DRAFT.md` **§A-MI** 다. 🔴 **PHASE 1 을 다시 하지 않는다.**

```
🟢🟢 **직전 보고의 「후보측 원문 미확보」를 정정한다** — 그것은 **DB/운영 저장** 축의 사실이고
   **평가용 원문은 이미 있다**(수집 0 · 429 무관):
   `fixtures/mi-reeval-03-keyword-input.json` **109쌍** (`pairs[]` · humanGt 내장)
   칸  origin.{title,description,descriptionKo,brand,color,material} · candidate.{title,description}
   확보 원상품 **92/109** · 후보 **98/109** · **양쪽 82/109**

🔴🔴 **그러나 GT 라벨과 교차하면 평가 분모는 «16» 이다**(= B16 집합과 동일):
   GT SAME      20 → 양쪽전문 **6**     🔴 회수 분모가 **6** 이다
   GT DIFFERENT 15 → 양쪽전문 **9**     🟢 오염 시험대는 9
   GT SIMILAR    1 → 양쪽전문 **1**
   미라벨       73 → 양쪽전문 66        🔴 **0 이 아니라 측정불가**
   호스트  junioredition(SAME 2·SIMILAR 1) · null(SAME 4 · 🔴 도메인 공백) ·
          **designerkidswear(DIFFERENT 2 ← CPO 지정 대조군)** · kidbizkid 2 ·
          shoppiccoliandco 2 · folkberlin 1 · petitemaisonkids 1 · nickis 1
🔴 분모 합산 금지 — 109 · 16 · A군 7 · IDENTITY_AXIS 26 은 **서로 다른 집합** 이다
```

🔴🔴 **그래서 PHASE 4 의 한계를 먼저 적는다** — 어떤 조합이든 **SAME 회수 분모가 6** 이다.
🟢 반대로 **DIFFERENT 오염 검출력은 9** 라 **기각 판정은 신뢰할 수 있다**(CPO 기준이 「오염 0」이므로).
⟹ 🔴 「복합 근거가 recall 을 올린다」는 **이 분모로 입증할 수 없다**. 입증 가능한 것은
   **「오염을 일으키지 않는다」** 와 **「6쌍에서 몇 건을 회수한다」** 까지다.

### 🔵 다음 세션의 첫 명령 (PHASE 2 · 조사 0)

```
대상    위 16쌍 · 대조군 designerkidswear.com 2건
방법    🔴 운영 owner 를 그대로 부른다(재구현 금지 · §5-B)
        품번  `confirmBrandCodeInEvidence`(domestic-identifiers.ts:199) ← 건초더미에 **설명 추가**
        브랜드 `brandsCompatible` + `brand-alias.ts`
        상품명 `coreTitleTokens`(cross-seller.ts)
산출    조합 8개 × {분모 · 평가가능 · SAME회수 · DIFFERENT오염 · SIMILAR오인 · 미측정 · 호스트별}
보존    🟢 `preserved/` 에 쓴다 — 🔴 `fixtures/` 에 두면 사용자 계약이 FAIL 한다
금지    429 우회 · UA 변경 · 어댑터 신설 · DB schema · 운영 연결 · 설명 품번 단독 SAME 승격
```

---

## 0-RESULT. 🔴🔴 **[2026-11-20 집행 완료] STEP 1 끝남 · 수정안 «기각» — 다시 하지 않는다**

```
원인 확정 🟢 `junioredition.com × B226AC033` 은 품번이 **설명에만** 있다(`DESCRIPTION_ONLY`)
          운영 확인 owner `confirmBrandCodeInEvidence`(match.ts:635)의 건초더미가
          **title · url · sku 셋**(domestic-identifiers.ts:185)이라 **설명을 보지 않는다**
          ⟹ 품번 축 인정 0 ⟹ 정원 5 미달 ⟹ `PRESUMED_SAME`
대조군    🟢 같은 원상품의 `tiptoeboutique.com` 은 품번이 **URL** 에 있어 그대로 `SAME`
기각 사유 🔴 그 레버(설명 품번 단독 확인)는 **이미 측정·REJECT** 됐다 —
          20쌍 · 4호스트 · **실제 이득 1 ↔ GT DIFFERENT 오염 2**(cemarose.ca · tinyapple.net)
          ⟹ 이 문서 §1 절대 기준(「대조군 DIFFERENT 유지」)에 **2건 실패** ⟹ 전체 기각
잠금      🟢 `a-identity-axis.test.ts`(6 tests PASS)가 그 결론을 기계로 잠근다
남은 길   🔴 네 레버 전부 닫혔다(제목토큰 · 설명품번 · 선행문자없는품번 · 원상품측복구)
          🟡 열려 있는 것은 **복합 근거**(브랜드+품번+상품명을 설명에서 «함께» 문맥 검증)이고
             선행 조건은 **후보측 원문 확보** 다 — 🔴 지금 **HTTP 429 호스트 12곳** 이 막는다
```

🔵 **MI 식별 전략 상시 규칙은 `docs/CTO-SESSION-START.DRAFT.md` §A-MI 다**(CPO 확정 2026-11-20).
🔴🔴🔴 **[CPO 최종 결정 2026-11-20] 운영 연결 NO-GO — B-38 트랙 종결.**
   `productFactsFromListing` 품번 복구는 **연결하지 않는다** · AC↔AB 는 `AGE-LINE-POLICY-01` +
   기존 계약 **9건** 으로 **잠긴 것으로 종결** · 🔴 **같은 경로 재조사 금지 · 새 조사 WU 금지** ·
   재개 조건은 **일반 품번 불일치 GT DIFFERENT 표본 확보** 하나다(전문 §0).
🔵 **상세설명 품번의 계약 충돌·개정안은 `docs/MI-DESCRIPTION-CODE-CONTRACT-PROPOSAL.md` 다**
   — 🔴 변경 지점이 **`productFactsFromListing`(seller-facts.ts:380) `brandModelCode: null`** 한 줄로
   특정됐다(Shopify 팩토리 `:247` 은 **이미** 설명에서 라벨 품번을 복구한다 · 팩토리 비대칭).
   🔴 운영 연결은 **CPO 보류** · 선행 조건 둘은 그 문서 §5 에 있다.
🔴 아래 STEP 1~5 는 **집행 기록으로 보존** 한다 — 재실행 지시가 아니다.

---

## 0. 이번 세션의 목표 — 한 건

**`junioredition.com × B226AC033` 의 해외 MI 판정을 바로잡거나, 근거에 따라 수정안을 기각한다.**

```
수정 → KIDS 전체 회귀 → 셀러 화면 E2E → Production 검증   ← 하나의 통합 작업
```
🔴 분석 보고서를 더 만드는 세션이 **아니다**. 🔴 새 WU 를 만들지 않는다.

---

## 1. 🔴🔴 합격·기각 조건 (절대 기준)

```
① Human SAME       → 시스템 **SAME**            대상 `junioredition.com × B226AC033`
② Human DIFFERENT  → 시스템 **DIFFERENT 유지**   대조군 `designerkidswear.com`(Stone Island)
🔴 둘 중 하나라도 실패하면 **수정안 전체를 기각** 한다.
🔴 SAME 숫자 증가 · 후보 수 증가 · 평균 점수 향상은 **합격 기준이 아니다.**
🔴 잘못된 SAME 을 **하나라도** 만들면 실패다.
```

---

## 2. 이미 확정된 진단 (재조사 금지)

| 영역 | B226AC033 실측 | 판정 |
|---|---|---|
| 🇰🇷 국내 후보 | URL 은 있었고 **수집에서 죽었다**(HTTP_429 → TimeoutError) | **수집 문제** · 🔴 **금지 축**(약관·429·어댑터) |
| 🌎 해외 후보 | 후보 **6** · **SAME 0 · PRESUMED_SAME 6** · 가격 **6 보유** | 🔴🔴 **MI 판단 문제 ← 이번 수정 지점** |
| 💰 가격 | `PRESUMED_SAME` 은 가격 자격 집합에 **포함** · 화면에 GBP/CAD/USD 표시됨 | 🟢 **정상 · 손대지 않는다** |
| 🖥 셀러 연결 | 실제 가격 표시 확인됨 | 🟢 **정상 · 손대지 않는다** |

🟢 대상 후보의 기존 상태 — `brandAxis` **MATCH** · `state` **CORRECT** · Human GT **SAME** · 시스템 **PRESUMED_SAME**.

---

## 3. STEP 1 — 축·blockers 추출 (첫 명령)

### 운영 판정 owner (추측 금지 · 이름 확정됨)

```
packages/crawler/src/comparison-search/cross-seller.ts   `compareCrossSellerProducts(`
packages/crawler/src/comparison-search/match.ts:581      `withConfidence(query, candidates)`
packages/crawler/src/comparison-search/match-truth.ts:74 `deriveMatchTruth(`
```
🔴 **운영 순서대로** 부른다 — `withConfidence` 가 확인 배선(`confirmBrandCodeInEvidence`)을
돌리므로 `compareCrossSellerProducts` 를 **직접만** 부르면 **운영 값이 아니다**(CORE-2I 선례).

### 근거 자료 4개 (실재 확인됨 · 경로 그대로 사용)

```
apps/admin/src/app/api/price-history/_lib/__tests__/fixtures/wu-059-gt-facts.json   원상품 facts(origins S1~S6)
docs/MI-KIDS-CODE-NAME-CAUSES.json                                                  원인 코드(code.cause · name.cause · axis*)
apps/admin/src/app/api/price-history/_lib/__tests__/preserved/a-identity-axis.json  축 상태(26쌍)
docs/MI-BRAND-TITLE-FILL-FINAL.json                                                 Human SAME 라벨 근거(B226AC033 2행)
```
🔴 조인 키는 **(originCode, candidateUrl)** 다 — 도메인·URL 단독 조인은 **어긋난다**(실측).

### 뽑아야 할 것

```
blockers 전수 · 축별 MATCH / MISMATCH / UNKNOWN · **SAME 정원 집계**
🔴 정원 규칙 — `SAME_MIN_AXES` **5** · `PRESUMED_SAME_MIN_AXES` **3** ·
   `IMAGE` 제외 · **1점 `TITLE`** 제외(기전: 축 배열 필터 `axis.axis !== "IMAGE" && !(TITLE && points===1)`)
🔴 「모른다 ↔ 달랐다」를 가른다 — 관찰된차이 9종만 `OBSERVED_DIFFERENCE_BLOCKERS` 이고
   `BRAND_UNCONFIRMED` · `COLOR_VARIANT` 는 **보류** 다 · `SIZE_SYSTEM` 은 어휘에만 있고 **push 0**
⟹ **SAME 을 막는 축(또는 복합 원인) 하나를 특정** 한다
```

---

## 4. STEP 2~5 (변경 금지)

```
STEP 2 공통 MI 수정   원인이 확인된 경우에만 · 기존 축·기존 증거만 · 사이트 예외 0 · 새 증거 생성 0
STEP 3 KIDS 전체 회귀  대상 SAME 확인 · 대조군 DIFFERENT 유지 확인 · 다른 상품 회귀 0
STEP 4 셀러 화면 E2E  **마운트 DOM** 기준 · 판정 ↔ 표시 일치 · 결함 없으면 UI 수정 0
STEP 5 Production     배포 · 대상/대조군 실제 판정 확인 · 🔴 미확인은 **NOT VERIFIED** 로 적는다
```

---

## 5. 🔴 돌아가지 않는 영역

```
검색 쿼리 연구·A/B · 국내 후보 탐색 반복 조사 · 국내 수집(약관·429·어댑터·우회) ·
가격 계산·가격 적격성 · 정상 확인된 셀러 연결·UI · 닫힌 과거 평가 재실행 · 새 WU 생성
🔴 국내 수집 문제와 해외 MI 판정 문제를 **분리** 한다. 이번은 **해외 MI 판정 한 건** 이다.
```

---

## 6. 동결·보호 (CEO 승인 없이 변경 금지)

```
`SAME_MIN_AXES = 5` · `PRESUMED_SAME_MIN_AXES = 3` · `IMAGE` 정원 제외 · **1점 TITLE** 정원 제외
설명문만으로 SAME 승격 금지 · 이미지 단독 SAME 금지 · 품번 충돌 무시 금지 ·
제목 토큰 → `brandModelCode` 승격 금지(REJECT 선례 `32a0f374` · 계약 11건) ·
사이트 전용 예외 금지 · 가격 정책·G6 변경 금지 · `isCollectionBlocked` 변경 금지 ·
DB 스키마·migration 금지 · `git add .` 금지 · 사용자 수정 파일 보존
보호 문서  `docs/START-HERE.md` · `docs/CEO-GT-LEDGER-2026-11-08.md` · `CLAUDE.md` · `docs/STANDARD-V1.md`
frozen     `mi-locale-link-01` = **7b093ef4**(수정·병합·배포 금지)
```

---

## 7. 시작 기준선 (다르면 **차이를 보고**한다 · 임의 정리 금지)

```
작업트리 **121건**(사용자 수정+untracked) · CTO 미커밋 **0**
origin/main **f7ad9d26** · ahead/behind **0 0** · 운영 코드 변경 **0** · Production **200**
frozen **7b093ef4** · G6 동결 · SAME 기준 동결 · 가격 로직 동결 · 약관 게이트 동결
```

### 실행 명령 참고

```
단위 테스트  cd apps/admin && npx vitest run <파일>
타입         cd apps/admin && npx tsc --noEmit -p tsconfig.json         (기준 0)
전체 회귀     cd apps/admin && npx vitest run \
  --exclude "src/app/pipeline/__tests__/golf01-wire-page-chain.test.ts" \
  --exclude "../../packages/crawler/src/comparison-search/__tests__/kids-locale-link-integration-design.test.ts"
🔴 그 두 파일은 **사용자 untracked 테스트** 이고 기준선에서 이미 실패한다(내 변경과 무관 · 손대지 않는다)
🟢 기준선 숫자 — 928 files / 11,451 passed / 0 failed
```

---

## 8. 최종 보고 형식 (한 번에)

```
A 원인   실제 blocker · 축별 상태 · SAME 을 막은 **코드 경로** · 원본↔후보 근거 비교
B 수정   변경 파일 · 변경한 공통 로직 · 변경 전후 판정 차이 · 사이트 예외 여부
C 검증   대상 SAME 결과 · **대조군 DIFFERENT 결과** · KIDS 회귀 · 셀러 E2E · Production
D 안전성  threshold/동결/가격/약관 변경 여부 · 보호 문서·사용자 파일 보존 · frozen 영향
E Git    커밋 SHA · 변경 파일 · 테스트 명령과 결과 · 배포 여부 · Production 근거
F 판정   **PASS** / **REJECT**(①② 중 하나라도 실패) / **BLOCKED**(명확한 장애)
🔴 부분 완료를 전체 완료로 적지 않는다. 코드 변경·테스트·배포·실제 동작 확인을 **구분** 한다.
```

---

## 9. 🔴 이 트랙에서 반복된 함정 (다음 세션이 먼저 읽는다)

```
① **칸 이름을 추측하지 않는다** — 타입·운영 코드에서 **읽고** 쓴다(이 트랙에서 12번 틀렸다)
② **운영 호출 순서를 그대로 베낀다** — 함수를 직접만 부르면 배선이 빠진다(§5-B)
③ **주석을 근거로 단언하지 않는다** — 주석 제거 후 사라지는 이름이 실재한다(`coreAxisCount`)
④ 🔴 주석 제거 정규식 `//[^\n]*` 은 **`https://` 의 `//` 를 먹는다** ⟹ URL 단언은 **원문** 으로
⑤ **금지 토큰은 런타임에 조립** 한다 — 리터럴로 적으면 **내 목록이 내 파일을 잡는다**(7번 났다)
⑥ **조인 키를 버리지 않는다** — 산출물에 `originCode` 를 남긴다(없으면 되짚을 수 없다)
⑦ **「측정불가」를 0 으로 적지 않는다** · 분모와 측정 범위를 같이 적는다
⑧ 가드가 내 변경을 막으면 **가드를 풀지 말고 이름을 옮긴다**
```

---

**이번 세션 종료 상태:** 수정 지점 특정 및 실행 준비 완료 — **제품 작업 완료가 아니다.**
**다음 세션 목표:** 대상 페어의 MI 판정 수정 + 전체 검증 완료, **또는** 근거에 따른 기각.
