export * from "./types";
export * from "./validation";
export * from "./registry";
export * from "./capabilities";
export * from "./field-capability-matrix";
export * from "./image-field";
export * from "./category-field";
export * from "./adapters/smartstore.adapter";
export * from "./adapters/coupang.adapter";
export * from "./adapters/elevenst.adapter";
// N-4.02 Part N/O(대표님 지시) — 11번가/ESM SOON 어댑터는 기존 ValidationResult
// 등과 이름이 겹쳐(payload-level vs field-level, 의미가 다르다) 최상위로
// 풀어내지 않고 네임스페이스로 감싼다 — 기존 export 표면을 절대 바꾸지 않는다.
export * as soonMarketplace from "./soon/index";
