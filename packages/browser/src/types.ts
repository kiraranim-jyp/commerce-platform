export interface BrowserConfig {
  headless: boolean;
  storageStateDir: string;
  naver: {
    loginId?: string;
    password?: string;
    loginUrl: string;
    sellerCenterUrl: string;
  };
}

export interface ContextOptions {
  storageStatePath?: string;
  userAgent?: string;
}

export interface LoginResult {
  success: boolean;
  sessionPath?: string;
  error?: string;
}
