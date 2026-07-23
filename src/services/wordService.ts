import neo4j from "neo4j-driver";
import { driver } from "../lib/neo4j";
import { Word, CreateWordInput, UpdateWordInput } from "../types/words";

/**
 * Creates a new Word node. Does NOT generate or store an embedding —
 * that's handled separately by the embedding service (Phase 7/8),
 * so this function stays fast, dependency-free, and easy to test.
 *
 * Throws if a word with the same name already exists (enforced by
 * the uniqueness constraint we created in Phase 5).
 */
export async function createWord(input: CreateWordInput): Promise<Word> {
  const session = driver.session();
  try {
    const result = await session.run(
      `
      CREATE (w:Word {
        word: $word,
        meaning: $meaning,
        example: $example,
        partOfSpeech: $partOfSpeech,
        additionalMeanings: $additionalMeanings,
        embedding: null,
        createdAt: $createdAt
      })
      RETURN w
      `,
      {
        word: input.word,
        meaning: input.meaning,
        example: input.example,
        partOfSpeech: input.partOfSpeech,
        additionalMeanings: input.additionalMeanings || null,
        createdAt: new Date().toISOString(),
      }
    );

    return result.records[0].get("w").properties as Word;
  } catch (err: any) {
    if (err.code === "Neo.ClientError.Schema.ConstraintValidationFailed") {
      throw new Error(`Word "${input.word}" already exists.`);
    }
    throw err;
  } finally {
    await session.close();
  }
}

/**
 * Fetches a single word by exact name. Returns null if not found —
 * callers decide whether that's a 404, not this function.
 */
export async function getWordByName(word: string): Promise<Word | null> {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (w:Word {word: $word}) RETURN w`,
      { word }
    );
    if (result.records.length === 0) return null;
    return result.records[0].get("w").properties as Word;
  } finally {
    await session.close();
  }
}

/**
 * Updates only the fields provided. Word itself is immutable by design —
 * renaming a word would orphan every relationship a human expects to
 * still point at "Aberration," so we don't support changing `word`.
 */
export async function updateWord(
  word: string,
  updates: UpdateWordInput
): Promise<Word | null> {
  const session = driver.session();
  try {
    const setClauses: string[] = [];
    const params: Record<string, unknown> = { word };

    if (updates.meaning !== undefined) {
      setClauses.push("w.meaning = $meaning");
      params.meaning = updates.meaning;
    }
    if (updates.example !== undefined) {
      setClauses.push("w.example = $example");
      params.example = updates.example;
    }
    if (updates.partOfSpeech !== undefined) {
      setClauses.push("w.partOfSpeech = $partOfSpeech");
      params.partOfSpeech = updates.partOfSpeech;
    }
    if (updates.additionalMeanings !== undefined) {
      setClauses.push("w.additionalMeanings = $additionalMeanings");
      params.additionalMeanings = updates.additionalMeanings;
    }

    if (setClauses.length === 0) {
      return getWordByName(word);
    }

    const result = await session.run(
      `
      MATCH (w:Word {word: $word})
      SET ${setClauses.join(", ")}
      RETURN w
      `,
      params
    );

    if (result.records.length === 0) return null;
    return result.records[0].get("w").properties as Word;
  } finally {
    await session.close();
  }
}

/**
 * Deletes a word and all its relationships (DETACH DELETE).
 * Returns true if a node was actually deleted, false if it didn't exist.
 */
export async function deleteWord(word: string): Promise<boolean> {
  const session = driver.session();
  try {
    const result = await session.run(
      `
      MATCH (w:Word {word: $word})
      DETACH DELETE w
      RETURN count(w) AS deletedCount
      `,
      { word }
    );
    return result.records[0].get("deletedCount").toNumber() > 0;
  } finally {
    await session.close();
  }
}

/**
 * Simple substring search across word and meaning, case-insensitive.
 * This is NOT the semantic/vector search from Phase 9 — this is the
 * plain-text search box on the UI (instant search, Phase 16).
 */
export async function searchWords(query: string, limit = 10): Promise<Word[]> {
  const session = driver.session();
  try {
    const result = await session.run(
      `
      MATCH (w:Word)
      WHERE toLower(w.word) CONTAINS toLower($query)
         OR toLower(w.meaning) CONTAINS toLower($query)
      RETURN w
      ORDER BY w.word
      LIMIT $limit
      `,
      { query, limit: neo4j.int(Math.floor(limit)) }
    );
    return result.records.map((r) => r.get("w").properties as Word);
  } finally {
    await session.close();
  }
}

/**
 * Overwrites the embedding on an existing Word node.
 * Separate from createWord so it can also be called when a word's
 * meaning/example is edited later (Phase 17) and the embedding goes stale.
 */
export async function storeEmbedding(word: string, embedding: number[]): Promise<void> {
  const session = driver.session();
  try {
    const result = await session.run(
      `
      MATCH (w:Word {word: $word})
      SET w.embedding = $embedding
      RETURN w
      `,
      { word, embedding }
    );
    if (result.records.length === 0) {
      throw new Error(`Cannot store embedding: word "${word}" not found.`);
    }
  } finally {
    await session.close();
  }
}
export interface SimilarWord {
  word: Word;
  score: number;
}

/**
 * Finds the top-N most semantically similar existing words to the given
 * embedding, using Neo4j's native vector index. This is the "narrow the
 * field" step — results feed into the Llama relationship-detection step
 * (Phase 10), never the LLM directly on the whole graph.
 *
 * excludeWord: pass the word being added so it doesn't match itself.
 */
export async function findNearestNeighbors(
  embedding: number[],
  excludeWord: string,
  topK = 25
): Promise<SimilarWord[]> {
  const session = driver.session();
  try {
    const result = await session.run(
      `
      CALL db.index.vector.queryNodes('word_embeddings', $topK, $embedding)
      YIELD node, score
      WHERE node.word <> $excludeWord
      RETURN node, score
      ORDER BY score DESC
      `,
      {
        // queryNodes needs a couple more candidates than we want back,
        // since we filter out excludeWord AFTER the index search —
        // otherwise a graph with few words could return fewer than topK.
        topK: neo4j.int(Math.floor(topK) + 1),
        embedding,
        excludeWord,
      }
    );

    return result.records.map((r) => ({
      word: r.get("node").properties as Word,
      score: r.get("score") as number,
    }));
  } finally {
    await session.close();
  }
}