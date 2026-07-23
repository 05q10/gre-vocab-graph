import { driver } from "./../lib/neo4j";
import { RelationshipType } from "./../types/relationship";

export interface RelationshipRecord {
  source: string;
  target: string;
  type: RelationshipType;
  confidence: number;
}

/**
 * Creates a single directed relationship edge between two existing words.
 * Uses MERGE (not CREATE) so re-running relationship detection on the same
 * pair doesn't produce duplicate parallel edges of the same type — instead
 * it updates the confidence if the edge already exists.
 *
 * Both nodes are matched by their unique `word` property; if either doesn't
 * exist, this silently does nothing (defense in depth — the candidate
 * cross-check in Phase 10 should already guarantee both exist).
 */
export async function createRelationship(
  sourceWord: string,
  targetWord: string,
  type: RelationshipType,
  confidence: number
): Promise<boolean> {
  const session = driver.session();
  try {
    const result = await session.run(
      `
      MATCH (source:Word {word: $sourceWord})
      MATCH (target:Word {word: $targetWord})
      MERGE (source)-[r:${type}]->(target)
      SET r.confidence = $confidence, r.createdAt = coalesce(r.createdAt, $now)
      RETURN r
      `,
      {
        sourceWord,
        targetWord,
        confidence,
        now: new Date().toISOString(),
      }
    );
    return result.records.length > 0;
  } finally {
    await session.close();
  }
}

/**
 * Deletes a relationship edge between two words.
 * If type is provided, it deletes only the relationship of that specific type.
 * If type is omitted, it deletes any relationships between the two words.
 */
export async function deleteRelationship(
  sourceWord: string,
  targetWord: string,
  type?: RelationshipType
): Promise<boolean> {
  const session = driver.session();
  try {
    let query = `
      MATCH (source:Word {word: $sourceWord})-[r]->(target:Word {word: $targetWord})
      DELETE r
      RETURN count(r) as deletedCount
    `;

    if (type) {
      query = `
        MATCH (source:Word {word: $sourceWord})-[r:${type}]->(target:Word {word: $targetWord})
        DELETE r
        RETURN count(r) as deletedCount
      `;
    }

    const result = await session.run(query, {
      sourceWord,
      targetWord,
    });
    
    return result.records[0].get('deletedCount').toNumber() > 0;
  } finally {
    await session.close();
  }
}