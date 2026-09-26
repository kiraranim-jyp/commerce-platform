# Commerce-4 — 아동의류 Commerce 완료: 남은 것은 «누르는 일» 이다

> CTO 보고(2026-09-26). **코드 변경 0.** 재조사 0. 카테고리·비교사이트 확대 0.
> 추측 UPDATE 0. push 0.

## 0. 결론 — 남은 작업의 성격이 바뀌었다

```
코드로 할 수 있는 것   →  🔴 «없다». 세 채널의 CREATE 경로는 전부 구현·테스트 완료.
남은 것               →  실제 Production 등록 «실행» 과 그 결과 관찰.
누가                  →  🔴 CTO 는 할 수 없다(§2). CEO 가 눌러야 한다.
```

## 1. 채널별 Production 실적 — 저장소 «기록» 기준

| | CREATE 구현 | 🔴 Production 실등록 기록 | UPDATE |
|---|---|---|---|
**SmartStore** | ✅ | ✅ **있다** — `13713593585` (정상 등록) · 외 `13672230124` · `13672322468` · `13713032117` · `13664004406` | ✅ 구현·Production 검증 기록 있음 |
**Coupang** | ✅ | ✅ **있다** — `16394846257` (정상 등록) · 중복 3건(`16336681622` · `16338809221` · `16340176952`) | 🔴 UNKNOWN |
**LotteON** | ✅ | 🔴 **기록을 찾지 못했다** — 저장소 전체에 `spdNo` 실측 «예시가 하나도 없다» | 🔴 UNKNOWN |

근거: `docs/p0-channel-03-phase-d2-product-identity.md:141-143` ·
`docs/lotteon-commerce-sprint-2-survey.md:250`.

🔴 **「기록이 없다」는 「등록된 적 없다」의 증명이 아니다.** 다만 이 저장소는 실등록
번호를 반드시 기록해 왔고(SmartStore 6건 · Coupang 4건이 번호까지 남아 있다), LotteON 만
한 건도 없다. 그래서 **가장 가능성 높은 상태는 「아직 한 번도 성공하지 못했다」** 이고,
그것이 아동의류 Commerce 의 **유일한 큰 공백**이다.

### 🔴 1-1. 그래서 우선순위가 지시서와 다르다 — 이유를 적는다

지시서 순서는 SmartStore → Coupang → LotteON 이다. 그런데 기록을 보면 앞의 둘은 **실등록
번호가 이미 있고**, 세 번째만 없다. 지시서 원칙(「이미 Production PASS 인 것은 반복
테스트하지 않는다」)을 그대로 적용하면 **실질 P0 는 LotteON CREATE** 다.

## 2. 🔴 CTO 가 Production 을 실행할 수 없는 이유 — 둘 다 확인했다

### ① 자격증명이 없다

```
apps/admin/.env.local   QA_PROXY_TO_PROD · OCI_PROXY_URL
.env.local              VERCEL_OIDC_TOKEN
                        → Supabase · 네이버 · 쿠팡 · 롯데ON 자격증명 «전부 없음»
vercel env pull         Sensitive 값은 전부 ""(MI-6 확인)
```

등록 라우트는 전부 서버 전용 자격증명을 요구한다. 로컬에서 호출하면 `NOT_CONFIGURED` 로
끝난다 — 마켓에 닿지 않는다.

### ② 실등록은 되돌리기 어려운 «외부» 행위다

실제 마켓에 상품이 생긴다. 잘못 누르면 옛 상품이 남고 중복이 된다 — 이 스프린트가
내내 막아 온 사고 그 자체다(SmartStore 외부번호 6개 · 쿠팡 중복 3건). 🔴 **자격증명이
있더라도 명시적 승인 없이 눌러서는 안 되는 일**이다.

**→ 그래서 남은 전부가 「CEO 가 눌러야 하는 최종 테스트」에 해당한다.** 지시서가 허용한
바로 그 범주다.

## 3. CEO 실행 요청 — 🔴 **LotteON CREATE 하나만** (최소)

아동의류 상품 **1건**으로 충분하다. 목적은 「등록이 되는가」와 「우리 기록이 실제와
맞는가」 둘뿐이다.

```
① 아동의류 상품 하나를 고른다 (이미 스냅샷이 있는 것 아무거나)
② 롯데ON 탭 → [등록 정보 확인] → 통과하면 [채널 등록]
③ 결과 화면을 그대로 알려 주십시오
```

돌려주셔야 하는 것 — **번호와 문장뿐**(자격증명·토큰은 절대 보내지 마십시오):

| 무엇 | 왜 필요한가 |
|---|---|
`spdNo` (판매자상품번호) | `channel_products.external_product_id` 에 이 값이 들어갔는지 확인 |
`epdNo` (업체상품번호) | 🔴 저장하지 «않는» 값이다. 실제 응답에 오는지 확인하면 apiNo 93 조회 키 논의가 끝난다 |
`returnCode` | 「HTTP 200 ≠ 성공」이라 `0000` 인지 |
실패 시 `resultMessage` | 어느 필수값이 막았는지 |
롯데ON 판매자센터 화면 | 상품이 실제로 보이는지 · 승인 상태(`fnlAprvYn`) |

🔴 **성공하면 그 자리에서 두 가지가 동시에 확정된다** — ① LotteON CREATE 가 Production
에서 동작한다 ② `epdNo` 가 응답에 오는지. ②는 Commerce-3B/3C 에서 CPO 결정으로 올려 둔
항목이라, 이 한 번의 등록이 그 결정을 **불필요하게 만든다.**

### 3-1. 🔴 등록하지 «말아야» 하는 것

* **SmartStore 재등록** — 이미 실등록 번호가 여러 개다. 또 누르면 중복이 하나 더 생긴다.
  (라우트의 `resolveCreateGate` 가 막지만, 막힌 것을 확인하는 것이 목적이 아니다.)
* **Coupang 재등록** — 같은 이유. 이미 중복 3건이 있다.

## 4. Coupang·LotteON 「등록 후 수정 범위」 — 순서가 정해졌다

지시서: 「그 다음 실제 등록된 상품에 대해 수정 가능 범위를 확인한다」.

```
Coupang   등록된 sellerProductId 16394846257 로 GET 1회
          → probe 는 이미 있다(/api/debug/coupang-product-get-raw)
          → 🔴 막는 것은 DEBUG_COUPANG_PROBE_TOKEN «값» 뿐이다(비밀 → 요구하지 않는다)
          → 대안: CEO 가 그 라우트를 «한 번» 호출해 응답 본문을 주면 실측이 끝난다

LotteON   §3 이 성공한 뒤 apiNo 93 으로 sitmNoLst 확인(이미 구현됨:
          /api/lotteon/product-status) → 그 다음이 91/86 계약(문서 필요, Commerce-3C §D)
```

🔴 어느 쪽도 **추측으로 UPDATE 를 만들지 않는다.** 두 채널의 capability 는 그대로
UNKNOWN 이고, `EDIT_ADAPTERS` 에 등록하지 않았다(테스트가 위반을 막는다).

## 5. 3개 채널 공통 lifecycle 회귀 — 지금 상태

```
admin  4,353 / 316 파일  PASS   typecheck 0   build PASS
pricing  532 /  40 파일  PASS
listing  471 /  36 파일  PASS
crawler  467            PASS   (+ 사전 존재 스위트 로드 실패 1건)
```

lifecycle 계약은 이미 테스트로 고정돼 있다 — 재조사·재작성하지 않았다:

* `p0channel03-final-matrix.test.ts` — 세 채널 CREATE/UPDATE/RECREATE/NOOP/BLOCKED 매트릭스
* `commerce3-capability-parity.test.ts` — capability ↔ 어댑터 ↔ 문구 정합(위반 시 5건 실패)
* 채널별 `p0channel03-register-lifecycle.test.ts` 3개 — 「부르지 않는다」까지 고정

## 6. 이번 스프린트에서 한 일 / 하지 않은 일

| | |
|---|---|
한 일 | 채널별 Production 실적을 **기록에서** 확인 · 실질 P0 를 LotteON 으로 특정 · CEO 실행 최소 요청서 작성 |
코드 변경 | **0** — 근거 없이 만들 것이 없다 |
재조사 | **0** — Commerce-3/3B/3C/3D 결과를 그대로 썼다 |
카테고리·비교사이트 확대 | **0**(WOMEN_FASHION 등 전부 대기) |
추측 UPDATE | **0** |
MI 작업 | **0** |
push | **0** (미배포 14개) |

## 7. 🔴 CEO 에게 요청하는 것 — 한 건

**아동의류 상품 1건을 롯데ON 에 등록하고, §3 의 표에 있는 번호와 문장을 알려 주십시오.**
자격증명·토큰은 보내지 마십시오 — 필요한 것은 **응답의 번호와 메시지**뿐입니다.

그 결과가 오면 CTO 가 이어서 하는 일:

```
spdNo 가 왔다      → channel_products 에 들어갔는지 확인 · lifecycle 을 실측으로 닫는다
epdNo 가 왔다      → apiNo 93 조회 키 논의 종료(저장 여부를 근거로 결정)
실패했다           → resultMessage 로 막힌 필수값을 특정 → 그 부분만 최소 수정
```

🔴 그리고 **그때까지 LotteON UPDATE 는 만들지 않는다.** 등록이 되는지도 모르는 채널의
수정 기능을 먼저 만드는 것은 순서가 뒤집힌 일이다.

## 8. 최종 완료 기준 표 (지시서 §11)

🔴 **범례** — `A` 구현 완료 · `B` Production 검증 완료 · `C` 외부 계약 미확인(UNKNOWN) ·
`—` 해당 없음. 🔴 **`A` 와 `B` 를 섞어 적지 않는다.**

| 항목 | SmartStore | Coupang | LotteON |
|---|---|---|---|
CREATE | **A + B** (실등록 `13713593585` 외) | **A + B** (실등록 `16394846257`) | **A** · 🔴 **B 기록 없음** |
ChannelProduct | **A + B** | **A + B** | **A** · B 미확인 |
실제 등록 | **B** | **B** | 🔴 **미확인** |
가격 | **A + B** | **A** · 🔴 Seller 화면 확인 필요 | **A** · 미확인 |
옵션 | **A + B** | **A** · 🔴 Seller 화면 확인 필요 | **A** · 미확인 |
이미지 | **A + B** | **A** · 🔴 Seller 화면 확인 필요 | **A** · 미확인 |
상세 | **A + B** | **A** · 🔴 Seller 화면 확인 필요 | **A** · 미확인 |
KC/Compliance | **A + B** (KIDS 실등록 성공으로 정확성 증명) | **A** (카테고리 메타 기반) · 미확인 | **A** (`sftyAthnLst[]` 필수 반영) · 미확인 |
UPDATE | **A + B** (GET→보존→비교→PUT) | 🔴 **C — UNKNOWN 유지** | 🔴 **C — UNKNOWN 유지** |
RECREATE | **A + B** (동의 + `replaceChannelProductLink`) | **A** (카테고리 `NOT_SUPPORTED` → 유일한 길) · B 미확인 | **—** 🔴 발행 경로 없음(항상 BLOCKED) — 누락이 아니라 일치 |
BLOCKED | **A** (테스트 고정) | **A** (테스트 고정) | **A** (테스트 고정) |
Production | 🟢 **CREATE·UPDATE 검증됨** · 🔴 `ac421ce` 미검증 | 🟡 **CREATE 만** | 🔴 **없음** |

### 🔴 8-1. 「Seller 화면 확인 필요」가 왜 Coupang 에 몰려 있는가

Coupang 은 실등록 번호가 있으므로 API 가 받아들인 것은 **확인됐다**. 그러나 **가격·옵션·
이미지·상세·고시가 Seller 화면에서 «의도대로» 보이는지** 는 사람이 봐야 한다. 그리고
`fetchRegisteredCoupangCategory` 는 GET 에서 `displayCategoryCode` **한 칸만** 읽으므로
(의도된 최소 독해) 나머지는 코드로 대조할 수단이 없다.

## 9. Commerce 완료 판정 (지시서 §11)

```
A 구현 완료              SmartStore ✅   Coupang ✅   LotteON ✅
B Production 검증 완료    SmartStore 🟢   Coupang 🟡   LotteON 🔴
C 계약 미확인 UNKNOWN     —              Coupang UPDATE · LotteON UPDATE
```

🔴 **Commerce 를 「완료」로 판정하지 않는다.** 막는 것은 딱 둘이고, **둘 다 코드 문제가
아니다**:

```
① LotteON CREATE 가 Production 에서 «한 번도 확인되지 않았다»  → §3 (등록 1건)
② Coupang 등록 상품이 Seller 화면에서 «의도대로 보이는지»        → §10 CEO TEST 2
```

🔴 `C`(UNKNOWN 둘)는 **실패가 아니다** — 지시서 §7 대로 유지한다. 억지로 A/B 로
승격시키지 않았다.

## 10. CEO TEST — 🔴 한 번에 요청한다 (지시서 §9)

중간에 다시 묻지 않기 위해 **세 개를 함께** 올린다. 🔴 자격증명·토큰은 보내지 마십시오.

| | 무엇을 | 돌려주실 것 |
|---|---|---|
**TEST 1** 🔴 **LotteON 등록 1건** (아동의류) | 롯데ON 탭 → [등록 정보 확인] → [채널 등록] | `spdNo` · `epdNo` · `returnCode` · 실패 시 `resultMessage` · 판매자센터에 상품이 보이는지 · `fnlAprvYn` |
**TEST 2** Coupang **기등록 상품 화면 확인** (`16394846257`) | Wing 에서 그 상품 열기 | 가격 · 옵션 · 이미지 · 상세 · 고시 · 카테고리가 **의도대로인지** · 현재 상태(검수중/판매중) |
**TEST 3** SmartStore **기등록 상품 화면 확인** (`13713593585`) | 스마트스토어 센터에서 열기 | 같은 항목. 🔴 **재등록·재수정은 누르지 마십시오**(중복이 생깁니다) |

🔴 **TEST 1 만 「새로 누르는」 것**이고, 2·3 은 «보기» 다. 이미 Production PASS 인 것을
반복 테스트하지 않는다는 지시서 원칙 그대로다.

### 🔴 10-1. 왜 CTO 가 TEST 1 을 대신할 수 없는가

지시서는 「CTO 가 가능한 검증은 CTO 가 전부 수행한다」고 한다. 🔴 그런데 **등록 API 호출
자체가 불가능하다** — 로컬에 Supabase·네이버·쿠팡·롯데ON 자격증명이 하나도 없다(§2①).
즉 이것은 「Seller 화면 확인」이 아니라 **실행 자체가 막힌** 경우다. 숨기지 않고 적는다.
