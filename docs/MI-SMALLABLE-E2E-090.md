# WU-090 — Smallable 실사용 E2E 검증 (CEO 육안 테스트 준비)

> 🔴 CPO 지시 2026-10-19. 「Smallable E2E 검증 **하나만** · 전용 parser ❌ ·
> header-overflow fallback 재변경 ❌ · 가격 게이트/`matchLevel`/8축/AI/Registry ❌」

---

# WU-090 FINAL

## 0. 결론 — 🟢 **두 경로 모두 작동한다.** 🔴 **단 CPO 의 테스트 시나리오를 정정해야 한다**

```
🔴🔴 **Smallable URL 이 들어가는 경로는 «둘» 이고 서로 다른 코드를 탄다.**
   그래서 「새 상품 분석」으로 테스트하면 **WU-084 가 고친 자리를 보지 못한다.**
```

## 1. 🔴🔴 경로 분기 — **먼저 확정한 것**

| | 「새 상품 분석」(원상품) | 「다시 분석」 후보 URL 입력칸 |
|---|---|---|
| route | `/api/pipeline` | `POST /api/price-history/check` |
| owner | **`universalExtract`** | `collectUrlCandidatePool` → `factsFromProductUrl` |
| fetch | site-strategy(**shopify·prestashop 둘뿐**) → 그 외는 **Playwright `launchChromium`** | `fetchPlainHtmlWithFinalUrl` → **`fetchWithDomainRateLimit`** |
| Smallable | 🟢 **Playwright 경로**(헤더 상한 없음) | 🔴 **여기가 `UND_ERR_HEADERS_OVERFLOW` 였다** |
| WU-084 적용 | ❌ **무관** | 🟢 **바로 그 자리** |

🔴 **즉 WU-016 이 기록한 「Smallable UNREACHABLE」은 «후보 경로» 였다.**
원상품 경로는 Playwright 라 **애초에 그 문제가 없었다.**

## 2~4. 실측 — 두 경로 모두 🟢

### ⒜ 원상품 경로 (`universalExtract` · LIVE 실행)
```
strategy  {"json-ld":1,"open-graph":1,"shopify":0,"next-data":0,"dom-scan":13,…}
title     "Bobo Choses Organic Cotton T-shirt | Ecru"
brand     **"Bobo Choses"**
price     **{ amount: 50, currency: "EUR" }**
images    **6**
🔴 로그에 `TimeoutError` 가 섞였다 — 일부 전략이 타임아웃했지만 **전체는 성공** 했다.
```

### ⒝ 후보 URL 경로 (`factsFromProductUrl` · WU-083/084 실측)
```
status      UNREACHABLE → **OK**      fetchPath PLAIN_HTML   httpCalls **1**
brand       **"Bobo Choses"**         price **{ 82673, KRW }**
modelCode   **null**(WU-083 REJECT 유지 — 품번을 만들지 않았다)
```

## 5. 🔴🔴 **같은 URL 인데 경로마다 통화가 다르다** (관측 · 수정 0)

```
원상품 경로(Playwright)       **EUR 50**
후보 경로(fetch + JSON-LD)    **KRW 82,673**
```

🟢 Smallable 이 **방문자에 따라 통화를 바꾼다** — 메모 `smallable-market-is-shipping-destination`
의 「market_code 는 **배송국가** 다」와 같은 계열이다. 🔴 **우리 버그가 아니다.**
🔴 그러나 **셀러가 같은 상품에서 두 통화를 볼 수 있다** — 사실로 기록한다.
🔴 **이번 WU 에서 고치지 않았다**(CPO 가 범위를 E2E 하나로 제한했다).

## 6~7. 코드 변경 — **0**

```
Smallable 전용 parser **0** · header-overflow fallback 재변경 **0** ·
가격 게이트 0 · matchLevel 0 · 8축 0 · AI 0 · Registry 0 · 배포 **0**(테스트만 추가)
```
🔴 §7 의 「코드 변경이 필요하면」 조건에 해당하는 것을 **찾지 못했다** — 두 경로 모두 작동한다.

## 8. regression / typecheck / build / production

```
apps/admin  **597 files / 8,335 passed** / failed **0** (skipped 107)
typecheck **0**(🔴 한때 1 — owner 타입을 추측해 캐스팅했다 · `unknown` 경유로 고쳤다)
build **exit 0** · Production **200**
🟢 WU-084 수정(`b9cc740e`)은 **이미 배포돼 있다** — 이번 WU 는 배포를 만들지 않는다
```

---

## 🔴 Known Unknowns

```
① 🔴 **CTO 는 로그인 뒤 화면을 볼 수 없다**(메모 `production-payload-is-unreachable`).
   그래서 「Production UI 에서 Smallable 이 보인다」는 **CEO 만 확인할 수 있다**
② 🔴 원상품 경로의 `TimeoutError` 는 **일부 전략** 의 것이고 전체 결과는 나왔다 —
   그 전략이 무엇인지는 **가르지 않았다**
③ 🔴 통화 차이(EUR ↔ KRW)의 **원인을 단정하지 않았다**(IP·locale·헤더 중 무엇인지 미측정)
④ 🔴 Smallable 상품 **1건** 으로만 원상품 경로를 확인했다
⑤ 🔴 `modelCode` 는 여전히 **null** 이다 — Smallable 은 품번을 적지 않는다(WU-083 확정).
   ⟹ **동일상품 판정은 품번 축으로 되지 않는다.** 「분석된다」와 「SAME 이 된다」는 다르다
```

## 판정 — 🟢 **GO (CEO 육안 테스트 준비 완료)**

🔴 단 **Smallable 최종 CLOSED 는 CEO PASS 뒤** 다(CPO 방침 그대로).

---

## 🔴🔴 CEO 육안 테스트 — **두 경로를 «모두» 보셔야 합니다**

> 🔴 CPO 가 준 시나리오(「새 상품 분석 → Smallable URL」)는 **원상품 경로** 이고,
> **WU-084 가 고친 자리는 그것이 아닙니다.** 그래서 **B 를 꼭 같이** 봐 주십시오.

```
URL   https://ttaejyo.vercel.app/pipeline   (로그인 필요)

───────────────────────────────────────────────────────────────
A. 원상품 경로 — 「새 상품 분석」에 Smallable URL
───────────────────────────────────────────────────────────────
 ① 새 상품 분석 시작
 ② 시장조사 카테고리 선택(평소대로 · WU-082 에서 필수임이 확정됨)
 ③ 아래 URL 입력 후 분석
    https://www.smallable.com/en/product/bobo-choses-organic-cotton-t-shirt-ecru-bobo-choses-430700
 기대
   🟢 분석이 끝난다(오류/빈 화면 없음)
   🟢 상품명 **Bobo Choses Organic Cotton T-shirt … Ecru**
   🟢 브랜드 **Bobo Choses**
   🟢 가격이 **표시된다** — 🔴 **EUR 로 보일 수 있습니다**(아래 설명)
   🟢 이미지가 보인다(실측 6장)
   🟢 MI 패널·가격비교 화면이 **깨지지 않는다**

───────────────────────────────────────────────────────────────
B. 🔴 **후보 경로 — WU-084 가 고친 «바로 그 자리»**
───────────────────────────────────────────────────────────────
 ④ 아무 Bobo Choses 상품을 분석한 뒤 MI 패널에서 「🔄 다시 분석」
    (입력칸은 **2단 접힘 뒤** 에 있습니다 · WU-049-R)
 ⑤ 위 Smallable URL 을 **후보 URL 로** 붙여넣고 다시 분석
 기대
   🟢 그 후보가 **구역에 나타난다**(「🔗 직접 입력한 후보」)
   🟢 브랜드 **Bobo Choses** · 가격 **₩82,673 류**(KRW 로 보일 수 있습니다)
   🔴 **「UNREACHABLE」/「가져오지 못했습니다」가 뜨면 FAIL** ← 이것이 WU-084 의 핵심 확인
   🟢 시장 뱃지는 **없거나 「해외」가 아닙니다** — `.com`+KRW 라 **UNKNOWN** 이 정상입니다

───────────────────────────────────────────────────────────────
🔴 미리 알려 드리는 «정상» 동작 셋 — 이것을 FAIL 로 보지 마십시오
───────────────────────────────────────────────────────────────
 ① **통화가 A 와 B 에서 다를 수 있습니다**(A: EUR 50 · B: KRW 82,673).
    Smallable 이 방문자에 따라 통화를 바꾸기 때문이고 **우리 버그가 아닙니다**.
 ② **품번이 안 보입니다.** Smallable 페이지에 Bobo 품번(`B226AC112` 류)이
    **아예 없습니다**(WU-083 전수 확인). ⟹ **「동일상품」으로 확정되지 않을 수 있습니다.**
 ③ Smallable 후보가 **국내 가격비교에 들어가지 않습니다** — `.com` + KRW 는
    `UNKNOWN` 이고 그것이 올바른 동작입니다(WU-051 계약).

🔴 **FAIL 로 보셔야 하는 것**
   · A 에서 분석이 실패하거나 브랜드/가격/이미지가 **비어 있다**
   · B 에서 **UNREACHABLE** 또는 후보가 **아예 안 뜬다**
   · 기존 국내/해외 가격비교 구역이 **깨진다**
```

## CEO Action — **위 A·B 1회 확인** (그 뒤 CPO 가 Smallable 최종 CLOSED 판정)
