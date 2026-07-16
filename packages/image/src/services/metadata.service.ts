import fs from "node:fs";
import path from "node:path";
import type { ClassifiedImage, ProductMetadata } from "@commerce/shared";
import { storagePaths } from "../utils/storage-paths.util";

export interface MetadataInput {
  title: string;
  sourceUrl: string;
  thumbnail: string;
  productImages: string[];
  detailImages: string[];
  modelImages: string[];
  sizeChart: string[];
  classifications: ClassifiedImage[];
}

export function buildProductMetadata(input: MetadataInput): ProductMetadata {
  return {
    title: input.title,
    sourceUrl: input.sourceUrl,
    images: [...input.productImages, ...input.detailImages, ...input.modelImages],
    thumbnail: input.thumbnail,
    productImages: input.productImages,
    detailImages: input.detailImages,
    modelImages: input.modelImages,
    sizeChart: input.sizeChart,
    classifications: input.classifications,
  };
}

export function saveProductMetadata(
  metadata: ProductMetadata,
  outputDir: string = storagePaths.metadata,
): string {
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, "metadata.json");
  fs.writeFileSync(file, JSON.stringify(metadata, null, 2));
  return file;
}
