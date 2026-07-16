import path from "node:path";

const root = process.env.IMAGE_STORAGE_ROOT ?? "storage";
const logsRoot = process.env.IMAGE_LOGS_ROOT ?? "logs";

export const storagePaths = {
  root,
  cache: path.join(root, "cache"),
  tmp: path.join(root, "tmp"),
  downloadsOriginal: path.join(root, "original"),
  classified: (type: string) => path.join(root, "classified", type.toLowerCase()),
  processed: (type: string) => path.join(root, "processed", type.toLowerCase()),
  optimized: (format: "jpg" | "png" | "webp") => path.join(root, "optimized", format),
  metadata: path.join(root, "metadata"),
  logs: (stage: string) => path.join(logsRoot, stage),
};
