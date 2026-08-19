import { readFileSync } from "fs";
import { extractFromJsonLd } from "@commerce/crawler/src/product-data-extractor";

const path = process.argv[2];
if (!path) {
  console.error("usage: tsx verify-smallable-price-fix.ts <html-file>");
  process.exit(1);
}
const html = readFileSync(path, "utf-8");
const result = extractFromJsonLd(html);
console.log(JSON.stringify(result, null, 2));
