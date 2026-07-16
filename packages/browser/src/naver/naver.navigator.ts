import type { Page } from "playwright";
import { loadBrowserConfig } from "../browser.config";

/**
 * NOTE: 스마트스토어센터 메뉴 텍스트/구조는 실 로그인 세션에서 검증되지 않았습니다.
 * Naver UI가 자주 바뀌므로, 실제 계정으로 첫 실행 시 선택자를 재확인하세요.
 */

export async function gotoSellerCenter(page: Page): Promise<void> {
  const config = loadBrowserConfig();
  await page.goto(config.naver.sellerCenterUrl, { waitUntil: "domcontentloaded" });
}

export async function gotoProductList(page: Page): Promise<void> {
  await gotoSellerCenter(page);
  await page.getByRole("link", { name: "상품관리" }).click();
  await page.getByRole("link", { name: "상품 조회/수정" }).click();
  await page.waitForLoadState("networkidle");
}

export async function gotoProductCreate(page: Page): Promise<void> {
  await gotoSellerCenter(page);
  await page.getByRole("link", { name: "상품관리" }).click();
  await page.getByRole("link", { name: "상품등록" }).click();
  await page.waitForLoadState("networkidle");
}
