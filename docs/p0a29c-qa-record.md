# P0-A.29-C QA 기록 — 동일상품 유력 후보 육안 확인 UI

- 커밋: `561401b`
- 일자: 2026-09-19

## 통과

| 항목 | 결과 |
|---|---|
| `tsc --noEmit` | 0 |
| `lint` | 61 → 61 (증가 0) |
| 전체 테스트 | 2,434 pass / 192 files |
| 신규 테스트 | 11건 (`candidate-comparison.test.ts`) |
| 판정·가격 경로 변경 | **0줄** (변경 파일은 UI 3개 + 신규 2개) |

## 🔴 확정하지 못한 채 남긴 것 — 테스트 flake

전체 스위트를 **4회** 돌렸다.

```
1회차  2 failed / 2,432 passed
2회차  전부 통과
3회차  전부 통과
4회차  전부 통과
```

1회차에서 깨진 **2건의 파일명을 잡지 못했다**. 2회차부터 재현되지 않아
실패 출력이 남지 않았다.

- 깨진 것들은 `CommerceWorkspace` 를 통째로 렌더하는 무거운 jsdom 테스트
  군으로 «보인다» — 그 군은 단건 1.5~2.8초가 정상이다.
- 타임아웃 flake 로 **추정하지만 확정하지 못했다.**
- 이 변경은 UI 렌더 전용이고 판정·가격 경로를 건드리지 않았으므로
  «즉시 코드 문제» 라고 볼 근거도 부족하다.

CEO 판단(2026-09-19): 「확정된 flake 도 아니므로 QA 기록에 그대로 남겨둔다.」

**재현되면 그때 파일명을 잡아 고친다.** 이 문단을 지우는 조건은
원인을 특정했을 때뿐이다.

## 자동 테스트로 덮지 못한 것

- **이미지 로드 실패 폴백**(`onError`) — 코드와 2026-09-19 HTTP 실측으로만
  확인. 실제 브라우저 렌더링은 육안 확인이 필요하다.
  실측: 국내 `foretforet` · `bobochoses-kr`, 해외 `junioredition`,
  원상품 `bobochoses` → 4곳 전부 `200` · `https` · Referer 붙여도 차단 없음.
- **Production 번들에 신규 코드가 실렸는지** — `/pipeline` 이 인증 게이트
  (307 → `/login`)이고 배포별 URL 은 Vercel SSO 뒤에 있어 HTTP 로 확인 불가.
  자세한 것은 아래.

## Production 배포 확인 (P0-A.29-C-FINAL)

| 단계 | 결과 |
|---|---|
| ① `origin/main` HEAD = `561401b` | ✅ |
| ② Production deployment 존재 | ✅ GitHub deployment `6538713317` |
| ③ deployment commit = `561401b` | ✅ |
| ④ state | ✅ `success` (GitHub deployment_status + 커밋의 Vercel status) |
| ⑤ Production URL 이 신규 코드를 제공하는지 | 🔴 **확인 못 함** |

⑤ 를 확인하지 못한 이유 — 억지로 PASS 하지 않는다:

- `https://ttaejyo.vercel.app/` → `200` (사이트는 살아 있다)
- `https://ttaejyo.vercel.app/pipeline` → `307` → `/login` (인증 게이트)
- 배포별 URL `ttaejyo-5t4hjrlqh-…vercel.app` → `302` → `vercel.com/sso-api`
  (정적 자산까지 보호됨)
- `vercel` CLI 는 자격증명이 없다. 로그인 플로우는 진행하지 않았다.

즉 **④ 까지는 기계로 증명되고, ⑤ 는 로그인한 사람의 화면에서만 증명된다.**
사장님이 화면에서 후보 카드를 보는 순간이 곧 ⑤ 의 증명이다.
