import neo4j from "neo4j-driver";
import { driver } from "../lib/neo4j";
import { Word, UserWord, CreateWordInput, UpdateWordInput } from "../types/words";

/**
 * Creates or matches a shared Word node. Does NOT generate or store an embedding —
 * that's handled separately by the embedding service (Phase 7/8).
 */
export async function createWord(input: CreateWordInput): Promise<Word> {
  const session = driver.session();
  try {
    const result = await session.run(
      `
      MERGE (w:Word {word: $word})
      ON CREATE SET 
        w.meaning = $meaning,
        w.example = $example,
        w.partOfSpeech = $partOfSpeech,
        w.additionalMeanings = $additionalMeanings,
        w.embedding = null,
        w.createdAt = $createdAt
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
  } finally {
    await session.close();
  }
}

/**
 * Links a shared word node to a specific user with their personal remarks.
 */
export async function linkWordToUser(word: string, userId: string, remarks?: string): Promise<UserWord> {
  const session = driver.session();
  try {
    const result = await session.run(
      `
      MATCH (w:Word {word: $word})
      MATCH (u:User {id: $userId})
      MERGE (u)-[r:LEARNING]->(w)
      ON CREATE SET 
        r.remarks = $remarks,
        r.addedAt = $addedAt
      ON MATCH SET
        r.remarks = CASE WHEN $remarks IS NOT NULL THEN $remarks ELSE r.remarks END
      RETURN w, r
      `,
      {
        word,
        userId,
        remarks: remarks || null,
        addedAt: new Date().toISOString(),
      }
    );
    
    if (result.records.length === 0) {
      throw new Error(`Word "${word}" not found.`);
    }

    const w = result.records[0].get("w").properties as Word;
    const r = result.records[0].get("r").properties;
    return { ...w, userId, remarks: r.remarks, addedAt: r.addedAt };
  } finally {
    await session.close();
  }
}

/**
 * Fetches a single word by exact name for a specific user. 
 */
export async function getWordByName(word: string, userId: string): Promise<UserWord | null> {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User {id: $userId})-[r:LEARNING]->(w:Word {word: $word}) RETURN w, r`,
      { word, userId }
    );
    if (result.records.length === 0) return null;
    const w = result.records[0].get("w").properties as Word;
    const r = result.records[0].get("r").properties;
    return { ...w, userId, remarks: r.remarks, addedAt: r.addedAt };
  } finally {
    await session.close();
  }
}

/**
 * Fetches a single word from the global dictionary without user context.
 */
export async function getGlobalWordByName(word: string): Promise<Word | null> {
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
 * Updates only the fields provided. 
 */
export async function updateWord(
  word: string,
  userId: string,
  updates: UpdateWordInput
): Promise<UserWord | null> {
  const session = driver.session();
  try {
    const setClauses: string[] = [];
    const relSetClauses: string[] = [];
    const params: Record<string, unknown> = { word, userId };

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
    if (updates.remarks !== undefined) {
      relSetClauses.push("r.remarks = $remarks");
      params.remarks = updates.remarks;
    }

    if (setClauses.length === 0 && relSetClauses.length === 0) {
      return getWordByName(word, userId);
    }

    const setQuery = [
      setClauses.length > 0 ? `SET ${setClauses.join(", ")}` : "",
      relSetClauses.length > 0 ? `SET ${relSetClauses.join(", ")}` : ""
    ].filter(Boolean).join(" ");

    const result = await session.run(
      `
      MATCH (u:User {id: $userId})-[r:LEARNING]->(w:Word {word: $word})
      ${setQuery}
      RETURN w, r
      `,
      params
    );

    if (result.records.length === 0) return null;
    const w = result.records[0].get("w").properties as Word;
    const r = result.records[0].get("r").properties;
    return { ...w, userId, remarks: r.remarks, addedAt: r.addedAt };
  } finally {
    await session.close();
  }
}

/**
 * Deletes a user's relationship to a word.
 */
export async function deleteWord(word: string, userId: string): Promise<boolean> {
  const session = driver.session();
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $userId})-[r:LEARNING]->(w:Word {word: $word})
      DELETE r
      RETURN count(r) AS deletedCount
      `,
      { word, userId }
    );
    return result.records[0].get("deletedCount").toNumber() > 0;
  } finally {
    await session.close();
  }
}

/**
 * Simple substring search across word and meaning, case-insensitive.
 */
export async function searchWords(query: string, userId: string, limit = 10): Promise<UserWord[]> {
  const session = driver.session();
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $userId})-[r:LEARNING]->(w:Word)
      WHERE toLower(w.word) CONTAINS toLower($query)
         OR toLower(w.meaning) CONTAINS toLower($query)
      RETURN w, r
      ORDER BY w.word
      LIMIT $limit
      `,
      { query, userId, limit: neo4j.int(Math.floor(limit)) }
    );
    return result.records.map((record) => {
        const w = record.get("w").properties as Word;
        const r = record.get("r").properties;
        return { ...w, userId, remarks: r.remarks, addedAt: r.addedAt };
    });
  } finally {
    await session.close();
  }
}

/**
 * Overwrites the embedding on an existing Word node.
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
 * Finds the top-N most semantically similar existing words in the global dictionary.
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
        topK: neo4j.int(Math.floor(topK) + 1),
        embedding,
        excludeWord
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

/**
 * Counts how many relationships a specific word has with OTHER words in the user's learning list.
 */
export async function countUserRelationships(word: string, userId: string): Promise<number> {
  const session = driver.session();
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $userId})-[ra:LEARNING]->(a:Word {word: $word})
      MATCH (u)-[rb:LEARNING]->(b:Word)
      WHERE a <> b
      MATCH (a)-[r]-(b)
      RETURN count(DISTINCT r) as relCount
      `,
      { word, userId }
    );
    return result.records[0].get("relCount").toNumber();
  } finally {
    await session.close();
  }
}

/**
 * Finds the top-N most semantically similar words specifically from the user's existing vocabulary.
 */
export async function findNearestUserNeighbors(
  userId: string,
  embedding: number[],
  excludeWord: string,
  minScore: number,
  topK = 15
): Promise<SimilarWord[]> {
  const session = driver.session();
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $userId})-[:LEARNING]->(node:Word)
      WHERE node.word <> $excludeWord AND node.embedding IS NOT NULL
      WITH node, vector.similarity.cosine(node.embedding, $embedding) AS score
      WHERE score >= $minScore
      RETURN node, score
      ORDER BY score DESC
      LIMIT $topK
      `,
      {
        userId,
        minScore,
        topK: neo4j.int(Math.floor(topK)),
        embedding,
        excludeWord
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