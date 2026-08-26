import { searchChocoel, fetchChocoelProductPrice } from "../src/comparison-search/chocoel";

async function main() {
  for (const kw of ["니트", "바지", "셔츠"]) {
    const candidates = await searchChocoel(kw);
    console.log(`=== ${kw}: ${candidates.length} candidates ===`);
    console.log(JSON.stringify(candidates.slice(0, 2), null, 2));
  }

  const first = (await searchChocoel("바지"))[0];
  if (first) {
    console.log("=== detail price refresh for first 바지 candidate ===");
    console.log("url:", first.url);
    const detail = await fetchChocoelProductPrice(first.url);
    console.log(JSON.stringify(detail, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
