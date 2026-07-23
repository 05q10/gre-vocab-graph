import { addWord } from "../src/services/wordPipeline";
import { findNearestNeighbors } from "../src/services/wordService";
import { deleteWord } from "../src/services/wordService";
import { driver } from "../src/lib/neo4j";

async function main() {
  const words = [
    { word: "Aberration" },
    { word: "Anomaly" },
    { word: "Ebullient" },
  ];

  try {
    const created = [];
    for (const w of words) {
      created.push(await addWord(w));
      console.log(`Added: ${w.word}`);
    }

    const target = created.find((w) => w.word.word === "Aberration")!;
    console.log("\nFinding neighbors of 'Aberration':");
    const neighbors = await findNearestNeighbors(target.word.embedding!, "Aberration", 5);

    for (const n of neighbors) {
      console.log(`  ${n.word.word.padEnd(12)} score: ${n.score.toFixed(4)}`);
    }
  } finally {
    for (const w of words) {
      await deleteWord(w.word);
    }
    await driver.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});