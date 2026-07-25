import { driver } from "../src/lib/neo4j";

async function initSchema() {
  const session = driver.session();
  try {
    try {
      await session.run(`DROP CONSTRAINT word_unique IF EXISTS`);
      console.log("✓ Old global uniqueness constraint on Word.word dropped");
    } catch (e: any) {
      // Ignore if it doesn't exist or other minor errors
      console.log("Old constraint drop skipped or didn't exist");
    }

    await session.run(`
      CREATE CONSTRAINT word_user_unique IF NOT EXISTS
      FOR (w:Word) REQUIRE (w.word, w.userId) IS UNIQUE
    `);
    console.log("✓ Composite uniqueness constraint on Word(word, userId) created");

    await session.run(`
      CREATE VECTOR INDEX word_embeddings IF NOT EXISTS
      FOR (w:Word) ON (w.embedding)
      OPTIONS {
        indexConfig: {
          \`vector.dimensions\`: 384,
          \`vector.similarity_function\`: 'cosine'
        }
      }
    `);
    console.log("✓ Vector index word_embeddings created");
  } finally {
    await session.close();
    await driver.close();
  }
}

initSchema()
  .then(() => {
    console.log("Schema initialization complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Schema initialization failed:", err);
    process.exit(1);
  });