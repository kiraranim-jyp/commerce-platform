# @commerce/browser

Playwright 기반 브라우저 자동화 코어. Chromium 싱글톤 브라우저, 컨텍스트 생성, 세션(storageState) 저장/재사용, 네이버 로그인 및 스마트스토어 이동을 제공합니다.

## 구성

- `browser.config.ts` — `.env` 기반 설정 로더 (`BROWSER_HEADLESS`, `BROWSER_STORAGE_DIR`, `NAVER_LOGIN_ID`, `NAVER_LOGIN_PASSWORD`)
- `browser.service.ts` — Chromium 브라우저 싱글톤 (`browserService.launch()` / `.close()`)
- `browser.context.ts` — `BrowserContext` / `Page` 생성 헬퍼
- `storage.manager.ts` — 세션(storageState) 저장/조회/삭제
- `naver/naver.auth.ts` — `login()`, `logout()`, `saveSession()`, `loadSession()`, `isLoggedIn()`
- `naver/naver.navigator.ts` — `gotoSellerCenter()`, `gotoProductList()`, `gotoProductCreate()`

## 환경변수

```
BROWSER_HEADLESS=true
BROWSER_STORAGE_DIR=storage/sessions
NAVER_LOGIN_ID=
NAVER_LOGIN_PASSWORD=
```

## 사용 예

```ts
import { createContext, login, hasSavedSession, loadSession, gotoProductCreate } from "@commerce/browser";

let context = hasSavedSession() ? await loadSession() : await createContext();
const page = await context.newPage();

if (!hasSavedSession()) {
  const result = await login(page);
  if (!result.success) throw new Error(result.error);
}

await gotoProductCreate(page);
```

세션이 이미 저장되어 있으면(`storage/sessions/naver.json`) `loadSession()`으로 재로그인 없이 재사용합니다.

## 알려진 제약

- `naver.navigator.ts`의 메뉴 텍스트/선택자는 실제 로그인 세션으로 검증되지 않았습니다. 네이버 UI가 자주 바뀌므로 실 계정으로 첫 실행 시 확인이 필요합니다.
- 네이버 로그인은 신규 기기/IP에서 캡차 또는 2단계 인증을 요구할 수 있습니다. 이 경우 `BROWSER_HEADLESS=false`로 실행해 수동으로 인증을 완료한 뒤 `saveSession()`으로 세션을 저장하면, 이후에는 자동 로그인 없이 세션 재사용만으로 동작합니다.
