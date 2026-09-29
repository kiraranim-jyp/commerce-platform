# CHILDREN-FASHION-COMMERCE-FINAL-CHECK-02-R1 — 배선은 증명했고 Production 은 아니다

> 🔴 **등급을 섞지 않는다.**
> `[LOCALLY VERIFIED]` — 로컬 하니스로 세 빌더를 «같은 상품» 으로 실행한 결과
> `[NOT PRODUCTION VERIFIED]` — 실제 상품의 현재 값 · 실제 Production payload · readiness DOM
>
> 외부 호출 0 · CREATE 0 · `/api/lotteon/register` 0 · 리포지터리 코드 변경 0 ·
> migration 0 · 새 Common 필드 0. (임시 하니스는 실행 후 삭제 · `git status` clean)

---

## 0. 왜 A(브라우저)를 폐기했는가 — 실행으로 확인한 벽

```
연결된 브라우저                0개
apps/admin/.env.local          QA_PROXY_TO_PROD · OCI_PROXY_URL   ← 둘뿐
Supabase·네이버·쿠팡·롯데ON 자격증명   🔴 전부 ABSENT
세 미리보기 라우트              requireRegistrationAccess (인증 + workspace 소유)
```
`coupang/payload-preview/route.ts:43` 이 그 가드다(CPO 지시 Commerce-6 C-1c).
QA 프록시는 **secret 문제만** 풀고 **인증은 풀지 않는다.** → A 폐기, B 로 완료.

---

## 1. ① 사용한 상품 — 🔴 실제 스냅샷이 아니다

```
[NOT PRODUCTION VERIFIED]
로컬 fixture 하나. 실제 product_snapshots 레코드가 아니다.
값은 저장소 테스트 fixture 에 남아 있는 «실측 흔적» 으로 채웠다:
  Bobo Choses S.L. · 스페인 · 면 100% · Grey Melange · 120g · 30도 이하 손세탁
  itemName "아동용 반팔 티셔츠" · modelName 빈칸 · recommendedAge 빈칸 · importer 빈칸
```
🔴 `modelName`·`recommendedAge`·`importer` 를 **일부러 비웠다** — 크롤러가 채우지
않는 칸이라 그것이 실제 상황에 가깝다. 채워 넣으면 「되는 것처럼」 보인다.

판매자 공통 7칸도 실측 흔적을 썼다: `규하맘샵` · `해외 구매대행으로 A/S 불가` ·
`규하맘샵AS` · `+821046458306` · `소비자분쟁해결기준에 따름` ·
`KC마크 없이 구매대행 가능한 품목` · `스페인`.

---

## 2. ⑦ Common → 3 Commerce 실제 매핑 `[LOCALLY VERIFIED]`

| 값 | Common 원천 | SmartStore (실측 목적지) | Coupang | LotteON | 판정 |
|---|---|---|---|---|---|
| 제조자 | 공용 `resolveManufacturer` | `kids.manufacturer` = `Bobo Choses S.L.` · `manufacturerName` | `manufacture` = `Bobo Choses S.L.` | 고시 `0070` = `Bobo Choses S.L.` | 🟢 **셋 다 일치** |
| — | `seller_settings.manufacturer`(`규하맘샵`) | ❌ 안 나감 | ❌ **안 나감** | ❌ 금지 | 🟡 **죽은 배선(실증)** |
| A/S 안내문 | `asContactNumber` | `kids.afterServiceDirector` **+** `afterServiceInfo.afterServiceGuideContent` | 고시 필드 | ❌ **미사용** | 🟡 중복 1 · 죽은 배선 1 |
| A/S 업체명 | `asCompanyName` | — | — | `0090` | 🟢 정상 |
| A/S 전화 | `asPhoneNumber` | ❌ (`companyContactNumber` 사용) | ❌ (안내문 사용) | `0090` | 🔴 **출처 3채널 불일치**(HOLD) |
| 품질보증 | `qualityGuarantee` | `kids.warrantyPolicy` | 고시 필드 | `0080` | 🟢 정상 |
| 원산지 | `defaultCountryOfOrigin` | `originAreaInfo.originAreaCode` = `0200037` | 고시/속성 | `0060` = `스페인` | 🟢 정상 |
| KC | `kcExemptionText` / confirmation | 선언(`certificationTargetExcludeContent`) | 고시 텍스트 | `0200` + `sftyAthnLst` | 🔴 정책 확인 필요 |

### 🟢 실측으로 확인된 셋 (이번 작업의 핵심 증거)

```
① releaseDateText = "상품 상세페이지 참조"
   → 0220 의 네이버 해법이 «실제로 payload 에 나간다». 문의의 근거가 강해졌다.
② Coupang manufacture = "Bobo Choses S.L."  (≠ "규하맘샵")
   → seller_settings.manufacturer 가 제조자로 «가지 않는다» 는 것을 값으로 증명했다.
③ channelProductDisplayStatusType = "SUSPENSION"
   → SmartStore CREATE 가 즉시 노출되지 않는다는 안전장치를 payload 로 확인.
```

### 🔴 그리고 네이버는 `1830` 대응 필드를 «보내지 않는다»

`numberLimit` 이 payload 에 **없다**(타입에만 있고 대입 0건 — 값이 있어도 안 나간다).
→ `1830` 은 롯데ON 만의 요구라는 앞 스프린트 판정이 **payload 로 재확인**됐다.

---

## 3. ⑧ 누락 / 중복 / 이중계산 `[LOCALLY VERIFIED]`

| # | 유형 | 내용 | 등록 차단 |
|---|---|---|---|
| 1 | 죽은 배선 | `seller_settings.manufacturer` → 쿠팡 컨텍스트에 실려 가지만 payload 에 없다 | ❌ 아님 |
| 2 | 죽은 배선 | `asContactNumber` → 롯데ON facts 로 가지만 소비 항목 0건 | ❌ 아님 |
| 3 | **중복** | 같은 안내문이 네이버 payload **두 곳**에 나간다 — `kids.afterServiceDirector` 와 `afterServiceInfo.afterServiceGuideContent` | ❌ 아님(스펙상 둘 다 필수) |
| 4 | 설정 게이트 불일치 | 쿠팡 설정 체크리스트가 「제조자(수입자)」를 요구하는데 payload 는 공용 resolver 가 정한다 | ❌ `recommended` |
| 5 | 같은 정보·다른 처리 | 치수 없음 → 네이버 `size` = **참조 문구** / 롯데ON `0780` = **중량 폴백**(`120g`) | ❌ 아님 |

**이중계산 — 없음.** 가격은 `computeVariantFinalPriceKrw` 하나를 공유하고
`priceBreakdown` 이 Master 한 곳에만 있다. 세 payload 의 가격이 `143500` 으로 동일.

🔴 **4·5 는 「발견했으니 고친다」로 가지 않는다** — CPO 지시대로 기록만 한다.
`DEAD SETTING / CLEANUP CANDIDATE / NON-BLOCKING`.

---

## 4. ④ 롯데ON 13항목 — 하향 반영 + 실행 근거 `[LOCALLY VERIFIED]`

하니스가 실제로 낸 `status` 를 그대로 적는다(`resolveLotteOnNotice("23", …)`).

| 코드 | 항목 | 실행 결과 | CPO 판정 | 근거 |
|---|---|---|---|---|
| `0210` | 품명·모델명 | `NEEDS_INPUT` | 🟡 **PARTIAL** | `notice-resolve.ts:172` — 품명·모델명 **둘 다** 필요. modelName 빈칸 → 「SKU 를 모델명으로 대신 쓰지 않는다」 |
| `0200` | KC 인증정보 | `NEEDS_INPUT` | 🔴 **BLOCKED** | `:144` — 실제 인증서 값 |
| `0780` | 크기·중량 | `FILLED` `120g` | 🟢 SOURCE CANDIDATE | `:158` — 치수 없어 **중량 폴백**이 동작 |
| `0020` | 색상 | `FILLED` `Grey Melange` | 🟢 AUTO | `:126` |
| `0410` | 재질 | `FILLED` `면 100%` | 🟢 AUTO | `:128` |
| `0790` | 사용연령 | `NEEDS_INPUT` | 🟡 **SOURCE CANDIDATE** | `:137` — 「옵션의 `6-7 Years` 를 사용연령으로 바꾸지 않는다」 |
| `1830` | 크기·체중 한계 | `BLOCKED` | 🔴 **BLOCKED** | `:216` |
| `0220` | 출시년월 | `BLOCKED` | 🔴 **BLOCKED** | `:212` |
| `0070` | 제조자·수입자 | `FILLED` `Bobo Choses S.L.` | 🟡 **PARTIAL** | `:164` — importer 빈칸이라 **구분자 `/` 가 아예 안 나왔다.** 둘 다 있을 때만 우리가 정한 표기가 나간다 |
| `0060` | 제조국 | `FILLED` `스페인` | 🟢 AUTO | `:130` |
| `0800` | 취급방법·**안전표시** | `FILLED` `30도 이하 손세탁` | 🟡 **PARTIAL** | `:132` — 안전표시 source 없음. 🔴 **부족한데 FILLED 로 나간다** |
| `0080` | 품질보증 | `FILLED` `소비자분쟁해결기준에 따름` | 🟢 CLOSED | `:151` |
| `0090` | A/S 책임자·전화 | `FILLED` `규하맘샵AS / +821046458306` | 🟢 CLOSED | `:183` |

🔴 **`0800` 이 가장 조용한 위험이다** — `PARTIAL` 인데 상태가 `FILLED` 라서 화면에
아무 신호가 없다. 등록을 막지 않으므로 지금 고치지 않되, **「FILLED = 충족」이
아니라는 예**로 기록한다([[kc-value-is-not-verification]] 과 같은 종류).

---

## 5. ⑥ blocker 최종 표기

```
필드 기준 5개 / 정책·문의 기준 2개 축

Axis A  상품정보제공고시   0220 · 1830                     → LOTTEON-PRODUCT-NOTICE-INQUIRY-01
Axis B  KC / 구매대행      0200 · sftyAthnLst · impPrxCd    → LOTTEON-KC-INQUIRY-01

품질/소스 보완 대상 (blocker 아님)   0210 · 0790 · 0800 · 0070
CLOSED                              0080 · 0090
AUTO 가능                           0020 · 0410 · 0060 · 0780
```

---

## 6. ③④⑤ payload — 확보 범위와 한계

```
[LOCALLY VERIFIED]
SmartStore  buildNaverProductPayload  → 조립 성공 · 고시 KIDS 블록 전체 확인
LotteON     buildLotteOnPayload       → 조립 성공 (🔴 라우트 미호출 · 87 미호출)
Coupang     buildCoupangPayload       → 조립 성공

[NOT PRODUCTION VERIFIED]
🔴 쿠팡 «고시» 목적지 — notices: [] 로 비었다.
   쿠팡 고시 필드 이름은 카테고리 메타 조회(외부 API)가 줘야 정해진다.
   그래서 A/S·품질보증·KC·원산지가 쿠팡 고시의 «어느 칸» 에 들어가는지는
   로컬에서 확인할 수 없다. 🔴 가짜 categoryMeta 를 만들어 채우지 않았다.
실제 상품의 현재 값 · 실제 Production payload · readiness DOM  — 전부 미확인
```

---

## 7. ⑨ CEO Production CREATE 체크리스트 (참고 · 지금 실행 아님)

CPO PRE-CHECK 통과 후에만. **지금 요청하지 않는다.**

```
전제  Axis A · Axis B 문의 답변 도착 → 롯데ON 판정 갱신
      (SmartStore/Coupang 은 문의와 무관하게 CREATE 가능)

① /settings 판매자 정보 7칸이 채워져 있는지 확인
② 상품 파이프라인에서 대상 아동의류 선택
③ SmartStore 탭 → payload 미리보기로 «값» 확인 → 등록
      신규는 channelProductDisplayStatusType=SUSPENSION 으로 떨어진다(노출 안 됨)
      노출은 별도 전환이며 이 단계에 포함하지 않는다
④ Coupang 탭 → 미리보기 → 등록 → SAVED 확인
      승인요청은 이 단계에 포함하지 않는다
⑤ LotteON 탭 → 🔴 등록 버튼 금지(블로커 해소 전)
⑥ 등록 후 각 채널에서 상품 조회로 실제 반영 확인
```

---

## 8. ⑩ Regression

```
listing  758/758 PASS   (임시 하니스 삭제 후 재실행)
admin   5166/5166 PASS  (이번 턴 시작 시 측정)
git status  clean · sync 0/0
```

---

## 9. 최종 상태

```
Common Commerce 구조   PASS            (배선 LOCALLY VERIFIED · 매핑 일치 확인)
SmartStore             NOT PRODUCTION VERIFIED — payload 조립은 확인 · CREATE 미실행
Coupang                NOT PRODUCTION VERIFIED — 고시 목적지 로컬 확인 불가
LotteON                BLOCKED — 외부 문의 2축 (필드 5개)
Google Extension       NOT STARTED
```

🔴 **「아동의류 3-Commerce 등록 완료」가 아니다.**
현재 단계는 **「공통 Commerce 구조 및 LotteON blocker 분석 완료」** 다.

---

## 10. 이번에 «하지 않은» 것

외부 호출 0 · CREATE 0 · register 0 · 브라우저 확장 요청 0 · CEO 캡처 요청 0 ·
리포지터리 코드 변경 0 · migration 0 · 새 Common 필드 0(`releaseDate` ·
`sizeWeightLimit` · `safetyMark` · `importer` · KC 전부) · 가짜 `categoryMeta` 0 ·
죽은 배선 임의 제거 0 · `settings-status` 수정 0 · 합성 fixture 를 Production
증거로 표기 0.
