import fs from "node:fs";
import { extractProductImages } from "@commerce/crawler";

if (fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}
import {
  CompositeClassifierProvider,
  GeminiClassifierProvider,
  ImglyRemoverProvider,
  ResolutionThumbnailSelector,
  RuleBaseClassifierProvider,
  SharpEnhancerProvider,
  SharpOptimizerProvider,
  runImagePipeline,
} from "@commerce/image";

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("사용법: pnpm --filter @commerce/scripts image-pipeline <상품 URL>");
    process.exit(1);
  }

  console.log(`[1/2] 이미지 URL 수집 중: ${url}`);
  const images = await extractProductImages(url);
  console.log(`  -> ${images.length}개 이미지 발견`);

  console.log("[2/2] 이미지 파이프라인 실행 중 (무료 Provider: Gemini -> RuleBase 폴백)...");
  const result = await runImagePipeline(url, url, images, {
    classifier: new CompositeClassifierProvider(
      new GeminiClassifierProvider(),
      new RuleBaseClassifierProvider(),
    ),
    backgroundRemover: new ImglyRemoverProvider(),
    enhancer: new SharpEnhancerProvider(),
    optimizer: new SharpOptimizerProvider(),
    thumbnailSelector: new ResolutionThumbnailSelector(),
  });

  console.log("완료:", result.metadataFile);
  console.log(JSON.stringify(result.metadata, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
