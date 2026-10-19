# WU-104 — 동일상품 5건 개별 trace (조사 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-19. 「URL 품번 **외에** brand/code/color/host/facts 로 **교차검증** ·
> 5건 **각각** 7단계 trace · **5/5 가 후단 도달했는지 확정**」

---

# WU-104 FINAL

## 0. 🔴🔴 **WU-103 의 「동일상품이 전부 통과했다」를 정정한다**

```
정밀 trace(한 건씩 개별 실행) 결과 — **후단(JUDGED) 도달 2 / 5**
🔴 WU-103 의 「JUDGED 1 + 3 = 4」는 **거친 집계** 였다(그 보고서가 적은 한계 ②가 맞았다).
```

## 1. 5건 전수 trace

| | 호스트 | ①AI | ②추출 | ③모양 | ④⑤facts | ⑥풀 | ⑦판정 |
|---|---|---|---|---|---|---|---|
| 1 | `bobochoses.com` (`/ko-kr/`) | 🟢 | 🟢 | PRODUCT_PAGE | OK | 🔴 — | 🔴 **자기참조 제외** |
| 2 | `search.shopping.naver.com` | 🟢 | 🔴 **탈락** | **LISTING_PAGE** | NOT_PRODUCT_URL | 🔴 — | 🔴 미도달 |
| 3 | `global.trenbe.com` | 🟢 | 🟢 | PRODUCT_PAGE | **OK** | 🟢 통과 | 🟢 **JUDGED / EXACT** |
| 4 | `www.skroutz.ro` | 🟢 | 🟢 | PRODUCT_PAGE | 🔴 **UNREACHABLE** | 🔴 — | 🔴 미도달 |
| 5 | `biskuit.kr` | 🟢 | 🟢 | PRODUCT_PAGE | **OK** | 🟢 통과 | 🟢 **JUDGED / COMPARISON** |

## 2. 🟢 분모를 정직하게 다시 가른다 — **유효 후보는 3건이다**

```
#1 은 **원상품 자신의 다른 로케일**(같은 호스트) ⟹ 🔴 「다른 판매처 후보」가 **아니다**
   🟢 운영이 `isSelfReferenceCandidate` 로 올바르게 뺐다. CPO 도 WU-103 에서 지적했다
#2 는 **네이버 검색 결과 페이지**(LISTING_PAGE) ⟹ 🔴 **상품 URL 이 아니다**
   🟢 ②가 올바르게 탈락시켰다
⟹ 🟢 **유효 동일상품 후보 = 3건** · 그중 **2건 JUDGED** · 🔴 **1건 손실 = UNREACHABLE**
```

## 3. 🟢🟢 ⑥ selection 소실은 **여전히 0 이다**

```
죽은 지점   ②추출 1(올바름) · ④fetch 1(UNREACHABLE) · 자기참조 1(올바름)
🟢 **⑥ candidate selection / ⑧ EVIDENCE_NOT_WORTHWHILE 에서 죽은 동일상품 = 0**
⟹ 🟢 WU-103 의 **핵심 결론은 유지** 된다. 바뀐 것은 **도달 건수** 다.
```

## 4. 🔴🔴 교차검증 결과 — **품번을 못 읽었는데 EXACT 가 났다**

| | code | brand | color | 판정 |
|---|---|---|---|---|
| 원상품 | **B226AC009** | Bobo Choses | light blue | — |
| `global.trenbe.com` | 🔴 **null** | BOBO CHOSES | shirt light blue | 🟢 **EXACT** |
| `biskuit.kr` | 🔴 **null** | 🔴 **비스킷**(샵 이름) | 🔴 null | 🟢 **COMPARISON** |

🔴 **둘 다 `facts.brandModelCode` 가 `null`** 이다 — **URL 에는 `b226ac009` 가 있는데도** 그렇다.
🟢 그런데 `trenbe` 가 **EXACT** 에 닿았다 ⟹ `confirmBrandCodeInEvidence`(WU-004 가
건초더미를 **title+url+sku** 로 넓힌 그 함수)가 **URL 에서 품번을 확인했다**는 증거다.
🟢 즉 **품번 추출이 null 이어도 판정은 URL 증거로 EXACT 에 닿는다.**

🔴 `biskuit.kr` 은 brand 가 **「비스킷」(샵 이름)** 인데도 **COMPARISON** 에 닿았다 —
🟢 WU-080/092 가 기록한 그 현상이 **판정을 막지 못했다**(막은 것은 EXACT 승격뿐이다).

## 5. 완료 조건에 대한 답

```
🔴 「5/5 후단 도달」은 **성립하지 않는다** — **2/5** 다.
🟢 그러나 **유효 분모 3건 중 2건**(66.7%)이고 🔴 손실 1건은 **UNREACHABLE**(외부 사이트
   접근 실패)이라 **우리 판정 로직의 손실이 아니다**.
🟢🟢 **「현재 파이프라인은 AI 가 발견한 동일상품을 후단에서 보존한다」는 ⑥/⑧ 축에서는
   확정된다**(소실 0/5). 🔴 단 **②③④ 에서는 보존되지 않는 경우가 있다**(검색URL·fetch 실패).
```

---

## 🔴 Known Unknowns

```
① 🔴 **표본 3건**(유효 분모)이다. 66.7% 를 서비스 지표로 쓰지 않는다
② 🔴 `skroutz.ro` 의 **UNREACHABLE 원인을 가르지 않았다** — 차단/타임아웃/헤더 중 무엇인지
   미측정(WU-084 의 헤더 overflow 일 가능성은 **확인하지 않았다**)
③ 🔴 S3·S6 의 동일상품은 **이번에도 다루지 않았다**(원상품 URL 미확보)
④ 🔴 「동일상품 5건」 자체가 **URL 품번 기반 하한** 이다(WU-103 ①) — 품번을 URL 에 안 쓰는
   동일상품은 **여전히 세지 못했다**
⑤ 🔴 `trenbe` 가 EXACT 인 것이 **올바른지는 사람이 확인하지 않았다**(Human GT 없음) —
   🟡 WU-093 GT 에 `global.trenbe.com` 이 **False EXACT 1건**(C06)으로 기록돼 있다.
   🔴 같은 호스트지만 **다른 상품** 이라 그 건과 섞지 않는다
```

## 판정 — 🟡 **⑥/⑧ 보존은 확정 · 「5/5」는 정정 · 전체 funnel 은 표본 부족**

```
🟢 **확정** — ⑥ candidate selection / ⑧ gate 가 동일상품을 버리지 않는다(0/5)
🔴 **정정** — WU-103 의 「동일상품 전부 통과」는 **2/5**(유효분모 2/3)
🔴 남은 손실은 ②(검색URL · 올바름) · ④(UNREACHABLE) · 자기참조(올바름) 이고
   **우리 판정 로직의 결함은 하나도 없다**
🔴 matching · Registry · threshold · discovery — **아무것도 구현하지 않았다**
```

## CEO Action — **없음**
