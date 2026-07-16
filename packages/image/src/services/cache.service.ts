import fs from "node:fs";
import path from "node:path";
import { storagePaths } from "../utils/storage-paths.util";

export interface CacheRecord {
  file: string;
  fileName: string;
  sourceUrl: string;
  contentHash: string;
  bytes: number;
}

/** URL의 SHA256 해시로 캐시를 조회해, 이미 처리된 이미지는 재다운로드하지 않는다. */
export class ImageCache {
  private readonly manifestPath: string;
  private readonly manifest: Record<string, CacheRecord>;

  constructor(cacheDir: string = storagePaths.cache) {
    fs.mkdirSync(cacheDir, { recursive: true });
    this.manifestPath = path.join(cacheDir, "downloads.json");
    this.manifest = fs.existsSync(this.manifestPath)
      ? (JSON.parse(fs.readFileSync(this.manifestPath, "utf-8")) as Record<string, CacheRecord>)
      : {};
  }

  get(urlHash: string): CacheRecord | undefined {
    return this.manifest[urlHash];
  }

  set(urlHash: string, record: CacheRecord): void {
    this.manifest[urlHash] = record;
  }

  persist(): void {
    fs.writeFileSync(this.manifestPath, JSON.stringify(this.manifest, null, 2));
  }
}
