import fs from "node:fs";
import path from "node:path";
import type { ClassifiedImage } from "@commerce/shared";
import { storagePaths } from "../utils/storage-paths.util";
import type { DownloadedImage } from "./downloader.service";
import type { ImageClassifierProvider } from "../types/provider.types";

export async function classifyAndSort(
  images: DownloadedImage[],
  classifier: ImageClassifierProvider,
): Promise<ClassifiedImage[]> {
  const results: ClassifiedImage[] = [];

  for (const image of images) {
    const { type, confidence } = await classifier.classify(image.file);

    const destDir = storagePaths.classified(type);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(image.file, path.join(destDir, image.fileName));

    results.push({ file: image.fileName, type, confidence });
  }

  return results;
}
