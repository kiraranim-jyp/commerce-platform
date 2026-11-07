# 백로그 (CPO 확정 2026-11-07)

## BL-3 · 🔴🔴 **`D-2` 보안 계약 보완 — 「선언된 GRANT」가 아니라 «실효 권한» 을 검사한다** — P1

> 🔴🔴 **CPO 가 «별도 작업» 으로 분리했다.** 「현재 083 작업에 **무단으로 끼워 넣지 않습니다.**
> 별도 작업으로 분리하고 **영향 범위를 보고받겠습니다.**」 ⟹ 🔴 **이 세션에서 구현하지 않았다.**

### 왜 — 이번에 그 구멍을 실제로 통과했다
```
`supabase-grant-contract.test.ts` 의 **D-2** 는 `grant … to anon` **문장만** 정규식으로 본다.
🔴 그런데 Supabase `public` 스키마의 **DEFAULT PRIVILEGES** 는 새 표에
   `anon`/`authenticated`/`service_role` 에 **자동으로 전부** 부여한다 —
   **GRANT 문장이 한 줄도 없어도** 그렇게 된다.
⟹ 🔴🔴 `083` 1차본은 D-2 를 **통과했는데** 실효 권한은 `anon` 에
   DELETE · INSERT · **TRUNCATE** · UPDATE · SELECT · TRIGGER · REFERENCES **14건** 이었다
   (드라이런 안 `information_schema.role_table_grants` 실측).
🔴 그리고 **RLS 는 `TRUNCATE` 를 막지 못한다**(행 단위 필터다) ⟹ 표가 비워질 수 있었다.
🟢 발견 경로 — B-1/B-2 가 RLS·GRANT 부재로 **2 FAIL** 을 냈고, 그것을 고치다 실효 권한을 쟀다.
```

### CPO 가 지정한 보완 방향 **여섯**(그대로 적는다)
```
① `GRANT` 문장뿐 아니라 `information_schema`/PG 권한 카탈로그 기준 **실효 권한** 검사
② `anon` 의 두 테이블 권한이 **0** 인지 검사
③ `authenticated` 는 **`SELECT` 만** 보유하는지 검사
④ `TRUNCATE` · `REFERENCES` · `TRIGGER` 등 **RLS 로 보호되지 않는** 테이블 권한도 검사
⑤ **DEFAULT PRIVILEGES 로 자동 부여된** 권한도 테스트에서 검출
⑥ 다른 테이블·전역 DEFAULT PRIVILEGES 를 **변경하지 않는지** 회귀 검증
```

### 🔴 착수 시 먼저 풀어야 하는 문제 — **그 검사는 DB 가 필요하다**
```
🔴 현재 `supabase-grant-contract.test.ts` 는 **파일 검사** 다(네트워크 0 · DB 0).
   ①~⑤ 는 **실제 DB 조회** 를 요구하므로 **그 계약의 성질이 바뀐다** ⟹
   🔴 CI 에서 DB 없이 돌 때 **조용히 SKIP 되면 계약이 무력해진다**(이 저장소가 겪은 함정).
🟡 선택지(🔴 CTO 가 고르지 않았다) —
   ⒜ 게이트 환경변수를 둔 **별도 라이브 계약**(🔴 기본 SKIP 이면 평소에 안 돈다)
   ⒝ **적용 전 드라이런 하니스** 로 고정(🟢 이번에 쓴 `083-syntax-dryrun.mjs` 가 그 모양 ·
      🔴 새 표마다 손으로 돌려야 한다)
   ⒞ 파일 검사에 **「새 public 표는 `revoke` 를 반드시 적는다」** 를 더한다
      (🟢 네트워크 0 유지 · 🔴 실효 권한을 **직접** 보지는 못한다 — 프록시다)
🔴 영향 범위 — 기존 migration **30개가 LEGACY 면제** 다. ①을 전수로 돌리면 그 30개에서
   실효 권한 위반이 **다수** 나올 수 있다 ⟹ 🔴 **소급 수정은 CPO 금지**(그 계약 A-2) ⟹
   **신규 파일에만** 적용하는 경계를 먼저 정해야 한다.
```

🔴 **이 건은 `083` 적용과 독립이다** — 083 은 이미 `revoke` 로 실효 권한이 **실측 확인**됐다
(`anon` 0 · `authenticated` SELECT 1). BL-3 는 **다음 표가 같은 구멍에 빠지지 않게** 하는 일이다.

---

# 백로그 — Smallable 관련 (CPO 확정 2026-11-07)

> 🔴🔴 **이 건들은 `a0b3c08`(Smallable 현지통화) CLOSED 를 «다시 열기 위한 조건이 아니다».**
> CPO 명시: 「현재 CLOSED 판정을 재개하지 않는다.」 각각 **별도 이슈** 로 관리한다.
> 🟢 발견 경로 — `docs/PHASE2-SMALLABLE-LOCAL-CURRENCY-VERDICT.md` §8(부수 관측).
>
> **현재 상태 — 등록 2건 중 1건이 즉시 닫혔다**
> ```
> BL-1 Smallable 원본가격 행 부재   🟢 **CLOSED** — 「부재」가 **내 측정 오류** 였다(행 63 실재)
> BL-2 배송 가능 국가 가드 부재      🔴 **P1 유지** — 조사 미착수
> ```
> 🔴 BL-1 을 **CPO 표의 P1 으로 남기지 않는다** — 작업할 것이 없다(아래 정정 참조).

---

## BL-1 · ~~Smallable 원본가격 행 부재~~ → 🟢🟢 **CLOSED · 「부재」는 내 측정 오류였다**

🔴🔴 **등록 즉시 닫혔다.** CPO 원칙 ⒟(근거 없는 판정 금지)에 따라 **제목이 맞는지 1번 질의로
가른 결과**, 그 행은 **실재한다.** 🔴 그러므로 **P1 작업이 아니다.**

### 정정 (운영 DB 실측 · 2026-11-07)
```
🔴 내가 틀린 것 — 분모를 **`source_product_url` 축** 으로 셌다.
   `source_product_url ilike '%smallable%'` → 248행(4시장 × 62) · 원본 행 **0** 으로 보였다.
🟢 **`snapshot_id` 축** 으로 다시 세니 원본가격 행이 **63행 실재** 한다:
     market (원본) · source_label **ORIGIN_FX** · EUR · n **63** · with_url **0** · last 2026-10-29
   ⟹ 🔴 「행이 없다」가 아니라 **「그 행에 URL 이 없어서 내 질의가 못 센 것」** 이었다.
🟢 그리고 `with_url 0` 은 **설계대로** 다 — `buildCostBasisObservation`(`run-price-check.ts:222`)이
   `sourceProductUrl: probe?.sourceUrl ?? null` 이고, Smallable 은 **원본 probe 가 없다**
   (사이트별 probe 는 **시장 행** 을 만든다) ⟹ 원본 행은 URL 없이 선다.
🟢 부수 관측도 같은 성질이었다 — PHASE 2 §8 의 「`currency='JPY'` 중 host null 15행」.
```

### 🟢 그래서 남는 것
```
🔴 **작업 없음.** 추정·환산·대체를 할 이유가 애초에 없었다(값이 있다).
```

### 🔴🔴 **남겨야 하는 교훈**(CPO 가 문장으로 지정했다 — 그대로 적는다)

> `price_observations` 의 **원본가격 행** 을 `source_product_url` 만으로 집계하면
> **`source_product_url = NULL` 인 행이 누락될 수 있다.** 앞으로는
> **`snapshot_id` · observation type · source provenance 를 «함께» 확인** 해야 한다.

```
실제 적용 — 이 세 축을 같이 본다:
  `snapshot_id`         원상품 축(URL 이 없어도 행이 붙는다)
  observation type      `source`(SELLER_ORIGIN / DOMESTIC_SHOP / NAVER_SHOPPING)
  source provenance     `source_label`(**ORIGIN_FX** / KR_MARKET / **MARKET_PROBE**)
🟢 이번 건에서 그 셋을 같이 보자 답이 한 줄에 나왔다 —
   `(원본) · ORIGIN_FX · EUR · n 63 · with_url 0`
🔴 그리고 그 구분은 **의미가 다르다** — `MARKET_PROBE` 는 **원가가 아니다**
   (`run-price-check.ts:128` · 원가/마진/CASE 판정이 그 행을 원가로 읽지 않게 하는 표식).
```

```
🔴 그리고 CPO 처리 기준은 **그대로 유효** 하다(다른 판매처에서 진짜 부재가 나올 때를 위해):
   현재가를 정가로 **복사하지 않는다** — 할인 없는 상품에 **가짜 할인** 이 생긴다
   (`smallable-market-probe.ts:294-297` 이 `regularPrice: null` 로 둔 이유).
```

---

## BL-2 · Smallable **배송 가능 국가 가드 부재** — P1

### 관측된 사실
```
🟢 Shopify 축에는 가드가 **있다** — `marketMayBeObserved(shopMeta, marketCode)`
   (`shopify-market-probe.ts:124` · `/meta.json` 의 `ships_to_countries` 를 읽는다)
   🟢 그 가드가 실제로 일한다 — 「Bobo Choses 는 일본에 배송하지 않는다 → false」
      (계약 `global-source-price-policy.test.ts:173`)
   🔴 그것이 없으면 **배송하지 않는 나라에 프로브를 돌려 본국 가격이 그 나라 관측으로 저장** 된다
      (Bobo 실측: `?country=JP` ≡ `?country=XX` → EUR 75 스페인 가격)
🔴 **Smallable 경로에는 그에 해당하는 가드가 없다**(`probeSmallableMarkets` 전수 확인).
🔴 그리고 Smallable 이 유효 배송국가를 **선언하는지 확인되지 않았다** —
   PHASE 2 라이브(HTML 706KB)에서 `ships_to`/`shippingCountries`/`availableCountries`
   계열 선언 **0건**. 🔴 「선언하지 않는다」로 단정하지 않는다(별도 endpoint·쿠키 축 미조사).
🟡 Smallable 은 **네 국가에서 금액이 실제로 다르다**(fr 49~54 · 지역별 차이 실측) ⟹
   Bobo 의 「무시하고 본국 가격을 돌려준다」 모양과는 다르다. 🔴 그러나 그것이
   **배송 가능의 증거는 아니다**(§처리 기준).
```

### 🔴 처리 기준 (CPO 확정)
```
**배송 가능 여부를 확인할 수 있는 근거와 판정 기준부터 조사** 한다 — 구현이 먼저가 아니다.
🔴🔴 **국가별 가격이 관측된다는 사실만으로 그 국가에 배송할 수 있다고 판단하지 않는다.**
🔴 이것은 **가격 표시와 별도 문제** 다(CPO 명시) ⟹ 글로벌 시장 카드 문구 작업과 섞지 않는다.
```

### 🔴 이 건이 이미 한 번 영향을 줬다 (기록)
```
글로벌 시장 카드 문구 작업지시서(`docs/WORKORDER-GLOBAL-MARKET-CURRENCY-NOTE.md` §3-2)가
CPO 권장 문구의 「배송국가별 가격」을 **「배송국가를 지정해 조회한 가격」** 으로 바꿨다 —
🔴 우리가 Smallable 의 JP 배송 가능 여부를 **모르기 때문** 이다.
🟢 ⟹ BL-2 가 닫히면 그 문구를 다시 볼 수 있다(그때까지는 **우리가 한 행위만** 말한다).
```

---

## 🔴 두 건에 공통으로 적용되는 금지

```
❌ `a0b3c08` CLOSED 재개              ❌ `market_country` 의미 변경
❌ §F(국가→통화 하드코딩) 해제         ❌ 현재가 → 정가 복사 · 환산으로 메우기
❌ 「가격이 관측된다」를 「배송 가능」으로 읽기
🟢 PHASE 2 의 계약 10건은 **그대로 유지** 된다
   (`packages/crawler/src/__tests__/phase2-market-currency-is-not-site-fx.test.ts`)
```
