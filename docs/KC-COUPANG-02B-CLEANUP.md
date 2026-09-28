# KC-COUPANG-02B — 보안 후처리 (조사 통로 폐쇄)

> CPO 지시(2026-09-28): 「기능 작업이 아니라 보안 cleanup 이므로 KC-03 구현과
> 섞지 말고 별도 후처리로 닫는 게 맞습니다.」 5단계 전부 실행·검증.

## 🔴 CPO 지적이 옳았습니다

> 「새로 발급한 `DEBUG_COUPANG_PROBE_TOKEN` 이 기존 `coupang-product-get-raw`
>  에도 사용됨 → 그러면 **조사 라우트 전용 토큰이라는 보안 경계가 아닙니다.**」

맞습니다. 제가 조사용으로 토큰을 회전시키면서 **운영 목적의 프로브까지 같이
열었고**, 그 사실을 02B 보고서에 「보너스」처럼 적었습니다. 편의를 경계 위에
올려 둔 것입니다.

---

## 실행·검증 결과

| # | 항목 | 결과 |
|---|---|---|
| ① | `registration_attempts` 요약 route 제거 | 🟢 `coupang-notice-history/`(route·summarize) + 테스트 삭제 |
| ② | 임시 debug token 폐기 | 🟢 `DEBUG_COUPANG_PROBE_TOKEN` Production 에서 **제거** |
| ③ | 운영 프로브를 별도 토큰으로 분리 | 🟢 `DEBUG_COUPANG_PRODUCT_PROBE_TOKEN` 신규 |
| ④ | route 삭제 후 응답 확인 | 🟢 **404** (토큰 없이 / 아무 토큰으로 둘 다) |
| ⑤ | Production 환경변수 잔존 확인 | 🟢 옛 이름 **0건** |

### ④ 실측 — 🔴 401 이 아니라 404 입니다

```
GET /api/debug/coupang-notice-history        토큰 없이     HTTP 404
GET /api/debug/coupang-notice-history        아무 토큰으로  HTTP 404
GET /api/debug/coupang-product-get-raw       틀린 토큰     HTTP 404
```

지시에는 「삭제 후 401 확인」이라고 돼 있었는데, **라우트 자체가 없어지면
Next 가 404 를 냅니다.** 401 은 「라우트는 있는데 못 들어간다」는 뜻이라 삭제된
상태에서는 나올 수 없습니다 — **404 가 더 닫힌 상태**입니다. 지시를 그대로
따르지 않고 실제 결과를 적습니다.

### ⑤ 실측

```
$ npx vercel env ls production | grep DEBUG_
DEBUG_COUPANG_PRODUCT_PROBE_TOKEN   Encrypted   Production   4m ago   ← 신규(분리)
DEBUG_LOTTEON_PROBE_TOKEN           Encrypted   Production   2d ago
DEBUG_NAVER_PROBE_TOKEN             Encrypted   Production   42d ago
DEBUG_NAVIGATE_TOKEN                Encrypted   Production   62d ago

DEBUG_COUPANG_PROBE_TOKEN  →  0건
```

---

## 토큰을 «누가 갖고 있는가»

| 토큰 | 상태 |
|---|---|
| `DEBUG_COUPANG_PROBE_TOKEN` (조사용) | 🟢 **폐기.** 값도 세션 스크래치패드에서 삭제 |
| `DEBUG_COUPANG_PRODUCT_PROBE_TOKEN` (운영) | 🟡 **CTO 가 보유** — 세션 스크래치패드에만. 저장소·대화·커밋 어디에도 없음 |

🔴 ②를 CTO 가 보유하는 것은 **CPO 지시 ③의 「기존 운영 목적에 맞는」** 을 따른
것입니다(그 목적 = `commerce-6-phase-f5` 의 **P1-2 쿠팡 UPDATE capability 실측**,
세 번 막혀 있던 항목). **필요 없다고 판단하시면 한 줄로 회전시킵니다** —
`vercel env rm` 후 CPO 가 원하는 값으로 `add` 하면 제 사본은 즉시 무용해집니다.

그리고 조사에 쓴 **응답 사본(50건 요약 JSON)도 삭제**했습니다. 결론은
`COMMERCE-COMMON-KC-COUPANG-02B.md` 의 집계표로만 남아 있고, 그 표에는
전화번호·상품명·주소가 들어 있지 않습니다.

---

## 고치지 «않은» 것

과거 완료 문서 3건(`commerce-3`·`commerce-4`·`commerce-6`)이 옛 토큰 이름을
언급합니다. **고치지 않았습니다** — 그 문서들은 «그때 그랬다»는 기록이고,
이름만 바꾸면 당시 상황을 잘못 전하게 됩니다. 대신 이 문서가 변경 시점과
이유를 적습니다.

---

## 검증

`admin 372 파일 · 5021 테스트 PASS` · `tsc 0` · 배포 Ready · 작업트리 깨끗.
(조사 라우트 테스트 27→31건이 함께 삭제돼 5048 → 5021 입니다.)
