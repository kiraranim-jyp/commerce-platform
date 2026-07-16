import type { BrowserContext, Page } from "playwright";
import { loadBrowserConfig } from "../browser.config";
import { createContext } from "../browser.context";
import { StorageManager } from "../storage.manager";
import type { LoginResult } from "../types";

const SESSION_NAME = "naver";

export async function login(page: Page): Promise<LoginResult> {
  const config = loadBrowserConfig();
  if (!config.naver.loginId || !config.naver.password) {
    return {
      success: false,
      error: "NAVER_LOGIN_ID / NAVER_LOGIN_PASSWORD 환경변수가 설정되지 않았습니다.",
    };
  }

  await page.goto(config.naver.loginUrl, { waitUntil: "domcontentloaded" });
  await page.fill("#id", config.naver.loginId);
  await page.fill("#pw", config.naver.password);
  await page.click(".btn_login");

  try {
    await page.waitForURL((url) => !url.href.includes("nidlogin.login"), { timeout: 15000 });
  } catch {
    return {
      success: false,
      error:
        "로그인이 완료되지 않았습니다. 캡차/2단계 인증이 나타났을 수 있습니다. " +
        "BROWSER_HEADLESS=false로 실행해 수동으로 인증을 완료한 뒤 saveSession()을 호출하세요.",
    };
  }

  if (!(await isLoggedIn(page))) {
    return { success: false, error: "로그인 후 세션 상태 확인에 실패했습니다." };
  }

  const sessionPath = await saveSession(page);
  return { success: true, sessionPath };
}

export async function logout(page: Page): Promise<void> {
  await page.goto("https://nid.naver.com/nidlogin.logout", { waitUntil: "domcontentloaded" });
  new StorageManager().remove(SESSION_NAME);
}

export async function saveSession(page: Page): Promise<string> {
  return new StorageManager().save(page.context(), SESSION_NAME);
}

export function hasSavedSession(): boolean {
  return new StorageManager().has(SESSION_NAME);
}

export async function loadSession(): Promise<BrowserContext> {
  const storage = new StorageManager();
  if (!storage.has(SESSION_NAME)) {
    throw new Error("저장된 네이버 세션이 없습니다. 먼저 login()을 호출하세요.");
  }
  return createContext({ storageStatePath: storage.path(SESSION_NAME) });
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies("https://naver.com");
  return cookies.some((cookie) => cookie.name === "NID_AUT");
}
