# WU-105 — `skroutz.ro` UNREACHABLE 원인 (조사 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-19. 「코드 ❌ · 배포 ❌ · AI ❌ · 그 URL **만** ·
> WU-084 의 `UND_ERR_HEADERS_OVERFLOW` 와 **같은 유형인지** · DNS / TLS / connection /
> timeout / HTTP / header overflow 를 **실제 error evidence 로** 구분 ·
> **「우리 fetcher 문제」와 「외부 사이트 접근 불가」를 분리**」

---

# WU-105 FINAL

## 0. 🟢🟢 결론 — **원인은 HTTP 403 이다. 사이트가 거부한다**

```
🔴 WU-084 의 header overflow 와 **다른 유형** 이다.
🟢 **우리 fetcher 문제가 아니다** — 연결·DNS·TLS 전부 정상이고 **서버가 403 을 준다**.
```

## 1. 축별 실측

| # | 축 | 결과 |
|---|---|---|
| ① | **DNS** | 🟢 **정상 해석** — `104.18.33.2` · `172.64.154.254`(Cloudflare 대역) |
| ② | **운영 owner** | `factsFromProductUrl` → **`UNREACHABLE`** · `httpCalls 1` · `PLAIN_HTML` |
| ③ | **raw fetch** | 🟢 **HTTP 403** · `text/html; charset=UTF-8` — 🔴 **예외가 아니다** |
| ④ | **`node:https` 16KB** | 🟢 **403** · 본문 **6,112 bytes** |
| ④ | **`node:https` 64KB** | 🟢 **403** · 본문 **6,112 bytes**(동일) |

🔴 **TLS / connection / timeout 오류는 «하나도» 관측되지 않았다** — 응답이 정상적으로 왔다.

## 2. 🔴 WU-084 와 같은 유형인가 — **아니다**

```
header overflow 의 판별식은 「16KB 로는 실패하고 64KB 로는 성공한다」 다.
🔴 여기서는 **둘 다 403** 이고 본문 크기도 **같다**(6,112 bytes).
⟹ 🔴 `UND_ERR_HEADERS_OVERFLOW` 가 **아니다.** WU-084 의 fallback 과 **무관** 하다.
```

## 3. 🔴 「우리 fetcher ↔ 외부 접근」 분리 — **외부 거부다**

```
운영 fetch owner(`fetchPlainHtmlWithFinalUrl`)는 `if (!response.ok) return null` 이다.
⟹ **403 → null → `UNREACHABLE`** 이고 🟢 **설계대로 동작했다**.
🟢 우리는 요청을 보냈고(httpCalls 1) 응답을 받았다. 🔴 **서버가 내용을 주지 않는다.**
```

## 4. 🔴 내 1차 판정 줄이 **틀렸고 정정한다**

```
🔴 하니스가 마지막에 「🟡 우리 쪽(상한을 올리면 받아진다)」이라고 출력했다.
   원인: 판정식이 `big.ok` 를 봤는데 그 `ok` 는 **「응답을 받았다」** 는 뜻이고
   **「200 이다」가 아니다**. 403 도 `ok: true` 로 세어졌다.
🟢 **정확한 판정은 「외부 사이트가 403 으로 거부한다」** 다.
🔴 그대로 보고했으면 **「우리 fetcher 를 고치면 된다」는 거짓 결론** 이었다.
```

## 5. 🔴 관측 하나 — 상태 이름이 부정확하다 (고치지 않았다)

```
`UNREACHABLE` 이라는 이름은 「닿지 못했다」로 읽힌다.
🔴 실제로는 **닿았고 403 을 받았다**. ⟹ 🟡 「거부됨(HTTP 4xx)」과 「닿지 못함」이
   **같은 status 로 뭉개진다**.
🔴 **고치지 않았다**(CPO: 코드 변경 0). 🔴 그리고 이것이 **얼마나 흔한지는 미측정** 이다 —
   WU-096 이 센 `UNREACHABLE 16건` 중 몇이 **4xx 거부** 인지 **가르지 않았다**.
```

---

## 🔴 Known Unknowns

```
① 🔴 **403 의 이유를 단정하지 않는다.** IP 가 Cloudflare 대역이고 본문이 6KB 라
   봇 차단으로 보이지만, 🔴 본문을 읽어 확인하지 않았고 **robots/약관도 확인하지 않았다**
② 🔴 **다른 UA/헤더로 우회 시도를 하지 않았다** — 그것은 「detection evasion」이고
   이 리포의 금지 방향이다(메모 `portal-scraping-blocked-by-terms` 계열)
③ 🔴 WU-096 의 `UNREACHABLE 16건` 중 **4xx 거부 비율은 미측정** 이다
④ 🔴 이 URL 의 상품이 **실제로 동일상품인지** 는 사람이 확인하지 않았다
   (URL 에 `b226ac009` 가 있다는 것이 유일한 근거다)
⑤ 🔴 측정은 **1회** 다 — 시간대/IP 에 따라 403 이 달라질 수 있다(재현 반복 안 했다)
```

## 판정 — 🟢 **원인 확정: HTTP 403(외부 거부) · 구현 0**

```
🟢 **확정** — DNS 🟢 · TLS/connection/timeout 오류 **0** · **HTTP 403** · header overflow **아니다**
🟢 **우리 fetcher 결함이 아니다** — `!response.ok → null` 은 설계대로다
🔴 **WU-084 와 연결하지 않는다**(CPO 지시대로 확인했고 **다른 유형** 이다)
🔴 우회·코드 변경 **아무것도 하지 않았다**
🟡 **관측 1건** — `UNREACHABLE` 이 「거부」와 「미도달」을 뭉갠다(미측정 · 고치지 않음)
```

## CEO Action — **없음**
