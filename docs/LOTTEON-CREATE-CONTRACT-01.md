# LOTTEON-CREATE-CONTRACT-01 — 등록 계약 Dry-run (2026-09-29)

> CTO 조사. **실제 CREATE 0회 · 기존 상품 변경 0건 · 새 write route 0개 · 코드 변경 0줄.**
> 기존 빌더를 «로컬에서» 돌려 payload 를 실제로 만들었고(네트워크 없음),
> 나머지는 저장소 문서·코드 근거만 썼다.
>
> 🔴 **[확정] · [UNKNOWN] · [추측]** 을 섞지 않는다. 근거 없는 칸은 UNKNOWN 이다.

---

## 🔴🔴 정정 (2026-09-29, 같은 날) — **§0·§3·§5 의 결론이 틀렸다**

아래 §5 는 「`pdArtlCd` 어휘를 얻을 수 없다 · 우리가 아는 코드는 2개뿐」이라고 적었다.
**사실이 아니다.** 저장소에 이미
[`packages/listing/src/lotteon/notice-schema.ts`](packages/listing/src/lotteon/notice-schema.ts)
가 있고, **품목 23 의 항목코드 13개가 전부 들어 있다.**

```
0210 품명및모델명 · 0200 KC인증정보 · 0780 크기,중량 · 0020 색상 · 0410 재질 ·
0790 사용연령 · 1830 크기ㆍ체중의한계 · 0220 동일모델출시년월 · 0070 제조자,수입자 ·
0060 제조국 · 0800 취급방법 · 0080 품질보증기준 · 0090 A/S책임자와전화번호
```

출처도 코드가 «스스로» 적고 있다 — `LOTTEON_NOTICE_SCHEMA_SOURCE`:
API 87 문서의 `pdItmsInfo` 설명란에 걸린 **LotteON 공식 PDF**
(`doc-pub.lotteon.com/...품목현행화_20221109_공유용.pdf`, 40품목 364행).
형제 테스트가 `noticeSchemaFor("23")` 의 길이 13 과 그 URL 을 고정하고 있다.

### 왜 틀렸나 — 🔴 **문서를 믿고 코드를 안 봤다**

`notice-schema.ts` 주석이 이미 이 오류를 적어 두었다:

> 우리는 「고시 항목코드를 얻을 길이 없다」고 **세 문서에 적었다.** 근거는
> `89 PD_ARTL_CD → rowCount 0` 한 줄이었는데, **그 그룹 이름은 우리가 지어낸
> 것**이었다. … 없는 게 맞았다 — 다만 이유가 달랐다. `pdArtlCd` 는 **공통코드가
> 아니다.** 그리고 롯데ON 은 품목별 항목표를 **공식 문서로 게시**하고 있었다.

나는 그 «세 문서» 를 근거로 §5 를 썼고, 정정한 코드를 읽지 않았다.
**이 저장소가 반복해서 경고해 온 함정** — 문서가 코드보다 낡았고, 낡은 쪽이 더
단정적으로 적혀 있었다.

### 그래서 진짜 막힘은 어디인가 [확정 · 코드 근거]

어휘가 아니라 **「담을 자리」** 다.
[`notice-resolve.ts`](packages/listing/src/lotteon/notice-resolve.ts) 가 13항목을
하나씩 풀고, 셋이 구조적으로 막힌다:

| 코드 | 항목 | 막힌 이유 |
|---|---|---|
| `0090` | A/S 책임자와 전화번호 | 🔴 **「A/S 업체명」 칸이 판매자 설정에 없다.** 연락처만으로는 고시가 요구하는 「업체명과 전화번호 «모두»」를 못 채운다. 업체명을 판매자명·제조사로 대신 넣지 않는다(CPO 금지) |
| `0220` | 동일모델의 출시년월 | 🔴 **담을 자리가 상품정보에 없다.** 시즌코드(`SS26`)를 출시년월로 바꾸지 않는다 |
| `1830` | 크기ㆍ체중의 한계 | 🔴 조건부 항목인데 **해당 없을 때 무엇을 적는지(공란/「해당없음」) 기준을 모른다** — 외부 확인 필요 |

나머지 10항목은 상품정보/판매자설정에서 «값이 있으면» 자동으로 채워진다
(`0020 0410 0060 0800 0790 0200 0080 0780 0070 0210`) — 없으면 `NEEDS_INPUT` 이지
BLOCKED 가 아니다.

그리고 별도 축으로 **`sftyAthnLst`(안전인증) BLOCKED** 가 그대로 남는다(§4).

### 정정된 결론

```
pdArtlCd 어휘            🟢 확보돼 있다 (공식 PDF · 품목 23 = 13개)
고시 13항목 중 3개        🔴 BLOCKED — 0090 · 0220 · 1830
  0090 · 0220  → 우리 스키마에 «칸이 없다» (내부 결정으로 열 수 있다)
  1830         → 외부 확인 필요 (해당 없을 때의 기재 기준)
sftyAthnLst(KC)          🔴 BLOCKED (별도 축)
실제 CREATE              🔴 여전히 BLOCKED — 다만 이유가 위 셋이다
```

🔴 **「CREATE BLOCKED」라는 결론은 유지되지만 이유가 완전히 다르다.** 다음 작업도
「어휘를 구한다」가 아니라 「세 항목의 자리를 만든다 + 하나를 문의한다」다.

---

## 0. 결론 먼저 — 🔴 **지금 CREATE 하면 실패한다**  ⚠️ 아래는 정정 «전» 기록이다

```
어린이제품(pdItmsCd=23)의 필수 고시 항목 13개를 채우려면
항목코드(pdArtlCd) 13개가 필요하다.
  우리가 아는 코드 = 2개  ("0020" 색상 · "0060" 제조국, 공식 문서 예시) [확정]
  공개 API 로 얻는 경로 = 없음                                        [확정]
```

그리고 그 실패는 **이미 한 번 관측됐다** — `returnCode 9999 · 「상품품목항목코드 필수값이
누락입니다」`([LOTTEON-CATEGORY-NOTICE-TRACE.md:140](docs/LOTTEON-CATEGORY-NOTICE-TRACE.md)) [확정].

→ **`LOTTEON-CREATE-PROD-VERIFY-01` 을 지금 열면 안 된다.** 선행 조건은 §5 다.

---

## 1. API 요청 계약 [확정]

```
POST https://openapi.lotteon.com/v1/openapi/product/v1/product/registration/request   (apiNo 87)
Authorization: Bearer <인증키>        (정적 키 · OAuth/서명 없음)
Accept: application/json · Accept-Language: ko · X-Timezone: GMT+09:00
Content-Type: application/json
```

본문: `{ spdLst: [ ...최대 500건 ] }` — **상품과 옵션(단품)이 «한 호출»** 에 실린다.
근거: `lotteon-commerce-sprint-2-survey.md:334-341,367,387,393`.

## 2. payload 구조 — 🔴 로컬 dry-run 으로 «실제로 만들어» 확인

`buildLotteOnPayload()`([build-payload.ts:328](packages/listing/src/lotteon/build-payload.ts))
를 아동의류 픽스처로 돌린 결과(실행 산출물):

```
최상위            spdLst
spdLst[0] 필드    41개 — adtnPdYn · ageLmtCd · cnclPsbYn · dcatLst · dmstOvsDvDvsCd ·
                  dpYn · dvCstPolNo · dvMnsCd · dvPdTypCd · dvProcTypCd · dvRgsprGrpCd ·
                  epnLst · itmLst · mdlNo · mfcrNm · oplcCd · owhpNo · pdItmsInfo ·
                  pdStatCd · pdTypCd · prstMsgPsbYn · prstPckPsbYn · purPsbQtyInfo ·
                  rtngPsbYn · rtngRtrvPsbYn · rtrpNo · scKwdLst · scatNo · sitmYn ·
                  slEndDttm · slStrtDttm · slTypCd · sndBgtDdInfo · sndBgtNday ·
                  spdNm · stkMgtYn · tdfDvsCd · trGrpCd · trNo · xchgPsbYn
itmLst[0] 필드    eitmNo · itmImgLst · rprtSitmYn · slPrc · sortSeq · stkQty
```

### 🔴 고시는 «중첩» 이다 — 최상위가 아니다 [확정 · dry-run]

```json
"pdItmsInfo": { "pdItmsCd": "01",
                "pdItmsArtlLst": [ { "pdArtlCd": "0020", "pdArtlCnts": "블루" } ] }
```

조사 초기에 `spdLst[0].pdItmsCd` 를 찾다가 `undefined` 를 보고 「없다」고 적을 뻔했다.
**검증은 통과하고 있었으므로 값은 있었고**, 자리가 `pdItmsInfo` 안이었다.

## 3. 항목별 판정

| 필드 | 상태 | 값/출처 |
|---|---|---|
| `oplcCd` 원산지 | 🟢 [확정] | 채널 설정. ISO alpha-2. 89 공통코드 `OPLC_CD` 239건 실응답. **자동 추론 안 함** |
| `tdfDvsCd` 과세 | 🟢 [확정] | 채널 설정(`"01"` 일반). 205 카테고리 응답의 `tdf_cd` 로 자동 선택 |
| `pdItmsCd` 품목 | 🟢 [확정] | 채널 설정. 어린이제품 = **`"23"`**(상수 `LOTTEON_NOTICE_ITEM_CODE_CHILDREN`) |
| `pdItmsArtlLst` | 🔴 **BLOCKED** | 구조는 확정, **코드 어휘가 없다** — §5 |
| `pdArtlCd` | 🔴 **BLOCKED** | 공식 예시 2개뿐(`0020` 색상 · `0060` 제조국). 🔴 **지어내지 않는다** |
| `pdArtlCnts` | 🟢 [확정] | 셀러 폼 또는 공통 상품정보에서 파생 |
| `scatNo` / `dcatLst` | 🟢 [확정] | 표준/전시 카테고리. 없으면 `CATEGORY_REQUIRED` 로 BLOCK |
| `trGrpCd` / `trNo` | 🟢 [확정] | 207 Identity 조회 |
| `owhpNo`·`rtrpNo`·`dvCstPolNo`·`dvRgsprGrpCd` | 🟢 [확정] | 셀러 설정(출고지/반품지/배송비정책/지역그룹) |
| `sftyAthnLst` 안전인증 | 🔴 **BLOCKED(23 한정)** | 어린이제품은 없으면 등록 불가 — §4 dry-run 실측 |
| `epdNo` | 🟢 [확정] | 우리가 보내는 업체상품번호. **선택** |
| `spdNo` | 🟢 [확정] | 쿠팡의 sellerProductId 자리. **등록 응답에서 온다** |
| `sitmNo` 단품번호 | 🟡 [확정된 제약] | **87 응답에 없다.** 93 목록조회의 `sitmNoLst` 로만 사후 획득 |

### 하드코딩 상수 [확정] — 근거 주석이 붙어 있는 것만

`slTypCd:"GNRL"` · `pdTypCd:"GNRL_GNRL"` · `pdStatCd:"NEW"` · `dpYn:"N"`(전시안함 — CEO 결정 2026-09-29, LOTTEON-FINAL-08) ·
`dmstOvsDvDvsCd:"DMST"` · `dvProcTypCd:"LO_ENTP"` · `dvPdTypCd:"GNRL"` ·
`dvMnsCd:"DPCL"` · `stkMgtYn:"Y"` · `adtnPdYn:"N"` · `ageLmtCd:"0"` ·
`prstPckPsbYn/prstMsgPsbYn:"N"` · 이미지 `epsrTypCd:"IMG"`/`epsrTypDtlCd:"IMG_SQRE"` ·
판매기간 = 현재+5년(KST).

## 4. Dry-run 검증 결과 — 필드 분류 [확정 · 실행 산출물]

### 빈 설정 → **BLOCKED 9 · MISSING 3**

```
trNo          BLOCKED IDENTITY_REQUIRED       scatNo/dcatLst  BLOCKED CATEGORY_REQUIRED
pdItmsCd      BLOCKED NOTICE_REQUIRED         pdItmsArtlLst   BLOCKED NOTICE_REQUIRED
owhpNo·rtrpNo·dvCstPolNo·dvRgsprGrpCd  BLOCKED SELLER_PLACE_REQUIRED
oplcCd · tdfDvsCd · slStrtDttm         MISSING
spdNm · slPrc · itmImgLst · epnLst · itmLst · itmStkQty · nldySndCloseTm  READY
```

🔴 **빈 값으로 「성공한 것처럼」 나가지 않는다** — 이것이 이번 dry-run 의 negative 증거다.

### 완전 설정(품목 01) → `ok:true · blocked:0 · missing:0`

### 🔴 어린이제품(품목 23) → `ok:false · blocked:1`

```
sftyAthnLst   BLOCKED   SAFETY_CERTIFICATION_REQUIRED
```

**아동의류는 안전인증 없이는 절대 통과하지 못한다** — 이 저장소의 주력 카테고리다.

### 분류 결론

```
AUTO                 상품명 · 가격 · 재고 · 이미지 · 상세 · 판매기간 · 하드코딩 상수
SELLER_CONFIRMATION  카테고리(표준/전시) · 원산지 · 과세 · 출고지/반품지/배송비정책 ·
                     품목코드 · 안전인증(KC)
BLOCKED/UNKNOWN      pdArtlCd 어휘 (→ pdItmsArtlLst 전체)
```

## 5. 🔴 유일한 진짜 막힘 — `pdArtlCd` 어휘

| 경로 | 결과 | 근거 |
|---|---|---|
| 89 공통코드 `PD_ARTL_CD` | **rowCount 0** | `P1-D-REAL-RESPONSE.md:182` [확정] |
| 205 카테고리 `pd_itms_list` | **비어 있음** | `LOTTEON-CATEGORY-NOTICE-TRACE.md:118-122` [확정] |
| 94 상품상세 조회 | **불가** — 등록 성공 0건이라 대상이 없다 | `P1-D-CLOSED.md:16-21` [확정] |
| 공개 문서 | 예시 2개뿐 | `PD-ARTL-CD-EXTERNAL-EVIDENCE.md:55-60` [확정] |

어린이제품 필수 **13개 항목**(소재·색상·치수·제조사·제조국·취급주의·권장연령·품명·
모델명·수입사·KC 인증유형·품질보증기준·A/S 책임자)은 **비공개 개정자료로 «이름» 만**
확인됐다 — **코드 값은 없다** [확정].

🔴 **코드를 지어내지 않는다.** 틀리면 소재 칸에 색상이 들어간 상품이 고객에게 나간다
(`PD-ARTL-CD-EXTERNAL-EVIDENCE.md:115`).

### 닫는 방법(추측 아님 — 가능한 경로만 나열)

```
ⓐ 판매자센터 화면에서 «사람이» 어린이제품 고시 항목표를 확인해 코드 13개를 받아 적는다
   → CEO/CPO 영역. API 로는 못 얻는다는 것이 위 표다.
ⓑ 롯데ON 에 항목코드 사전을 «문의» 해서 받는다.
ⓒ 🔴 등록을 먼저 해서 94 로 역추출 — 불가능하다. 등록이 그 코드를 요구한다(순환).
```

## 6. 응답·식별자 계약 [확정]

```json
{ "returnCode": "0000", "message": "정상",
  "data": [ { "epdNo": "<우리가 보낸 값>", "spdNo": "<롯데ON 할당>",
              "resultCode": "0000", "resultMessage": "정상" } ] }
```

🔴 **성공 판정 = `returnOk`(returnCode 0000) AND `spdNo` 존재** — 둘 다다.
HTTP 200 만으로 성공이라고 하지 않는다([register/route.ts:324](apps/admin/src/app/api/lotteon/register/route.ts)).
성공 시 `spdNo` 를 `channel_products.external_product_id` 에 저장한다.

**등록 후 확인**: 93 목록조회(`/product/list`)로 `spdNo` · `sitmNoLst` · `fnlAprvYn` ·
`slStatCd` 확인. 94 상세조회는 응답 실측이 «없다» [UNKNOWN].
**2단계 승인**(카테고리 + 상품정보)이 모두 끝나야 고객 화면에 노출된다 [확정].

## 7. 🔴 안전 발견 — register 라우트에 DRY_RUN 분기가 «없다»

[register/route.ts](apps/admin/src/app/api/lotteon/register/route.ts) 는 `ExecutionMode` 를
받지만 **DRY_RUN/PREVIEW 에서 외부 호출을 막는 분기가 없다.** 사전 검증을 통과하면
그대로 87 을 호출한다.

→ **「dry-run 모드로 register 를 부른다」는 길은 존재하지 않는다.** 그 역할은
`/api/lotteon/payload-preview` 가 한다(87 미호출 · 읽기 전용 조회만).
이번 조사에서 실제 CREATE 를 피한 방법도 **라우트를 아예 부르지 않고 빌더를 로컬에서
돌린 것**이다.

🔴 다음 사람이 「DRY_RUN 으로 한번 돌려보자」고 생각하는 순간 실제 등록이 나간다.
이 문장을 여기 남긴다.

## 8. UNKNOWN 목록 (구현하지 않는다)

```
pdArtlCd 코드 어휘(13개)        🔴 BLOCKED — §5
94 상품상세 응답 모양            UNKNOWN — 등록 0건이라 재 본 적 없음
sitmNo 등록 응답 포함 여부        확정: 포함되지 «않는다» (93 으로만)
안전인증(sftyAthnLst) 실제 payload 모양   UNKNOWN — 실등록 전례 없음
LotteON UPDATE(90)               UNKNOWN (범위 밖)
```

## 9. 이번 조사에서 하지 «않은» 것

실제 CREATE 0회 · 기존 상품 변경 0건 · 새 write route 0개 · 토큰 발급 0건 ·
코드 변경 0줄 · `pdArtlCd` 생성 0건 · 추측으로 채운 칸 0개.
