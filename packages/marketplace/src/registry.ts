import { coupangAdapter } from "./adapters/coupang.adapter";
import { elevenstAdapter } from "./adapters/elevenst.adapter";
import { smartstoreAdapter } from "./adapters/smartstore.adapter";
import type { PlatformAdapter, PlatformId } from "./types";

/** 새 플랫폼을 추가할 때는 어댑터 파일 하나를 만들고 여기 한 줄만 추가하면 된다. */
export const PLATFORM_ADAPTERS: Record<PlatformId, PlatformAdapter> = {
  smartstore: smartstoreAdapter,
  coupang: coupangAdapter,
  elevenst: elevenstAdapter,
};

export const PLATFORM_ORDER: PlatformId[] = ["smartstore", "coupang", "elevenst"];
