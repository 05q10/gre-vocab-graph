import { addWord } from "../src/services/wordPipeline";
import { driver } from "../src/lib/neo4j";

const seedWords = [
  { word: "Anomaly" },
  { word: "Normal" },
  { word: "Ebullient" },
];

async function main() {
  console.log("Seeding graph with baseline words...");
  for (const w of seedWords) {
    const result = await addWord(w);
    console.log(`  ${w.word}: ${result.relationshipsCreated} relationships`);
  }

  console.log("\nAdding target word 'Aberration'...");
  const result = await addWord({
    word: "Aberration",
  });
  console.log(`  Aberration: ${result.relationshipsCreated} relationships created`);

  await driver.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});