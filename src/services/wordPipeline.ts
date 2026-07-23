import { createWord, storeEmbedding, findNearestNeighbors } from "./wordService";
import { generateEmbedding, buildEmbeddingInput } from "./embeddingService";
import { detectRelationships, generateWordDetails } from "./llamaService";
import { createRelationship } from "./relationshipService";
import { Word } from "./../types/words";

const CANDIDATE_POOL_SIZE = 25; // top-N from vector search, per spec's "20-30" range
const MIN_CONFIDENCE = 0.65;      // relationships below this are discarded, not persisted

export interface AddWordResult {
  word: Word;
  relationshipsCreated: number;
}

export interface AddWordInput {
  word: string;
}

/**
 * The full "add a word" workflow described in the spec:
 *   1. Llama generates meaning, example, and partOfSpeech
 *   2. Persist the word
 *   3. Generate + store its embedding
 *   4. Vector search for the top candidate words
 *   5. Send candidates to Llama for relationship classification
 *   6. Filter by confidence threshold
 *   7. Dedupe by target word, keeping only the highest-confidence relationship
 *   8. Create validated, deduped relationship edges
 *
 * If a word has no existing neighbors yet (e.g. it's the very first word
 * in an empty graph), steps 4-8 are skipped gracefully — this is a normal
 * outcome, not an error.
 */
export async function addWord(input: AddWordInput): Promise<AddWordResult> {
  const generatedDetails = await generateWordDetails(input.word);
  
  const word = await createWord({
    word: input.word,
    ...generatedDetails
  });

  const embeddingInput = buildEmbeddingInput(word.meaning, word.example);
  const embedding = await generateEmbedding(embeddingInput);
  await storeEmbedding(input.word, embedding);

  const candidates = await findNearestNeighbors(embedding, input.word, CANDIDATE_POOL_SIZE);

  if (candidates.length === 0) {
    return { word: { ...word, embedding }, relationshipsCreated: 0 };
  }

  const detected = await detectRelationships(
    { ...word, embedding },
    candidates.map((c) => c.word)
  );

  // Filter out low-confidence relationships first.
  const confident = detected.filter((r) => r.confidence >= MIN_CONFIDENCE);

  // A word pair should only ever have ONE relationship type between them.
  // If Llama returned multiple classifications for the same target word
  // (e.g. both RELATED_TO and ANTONYM_OF to "Normal"), keep only the one
  // it was most confident about.
  const deduped = confident.reduce((acc, r) => {
    const existing = acc.get(r.target);
    if (!existing || r.confidence > existing.confidence) {
      acc.set(r.target, r);
    }
    return acc;
  }, new Map<string, (typeof confident)[number]>());

  let created = 0;
  for (const rel of deduped.values()) {
    const success = await createRelationship(input.word, rel.target, rel.type, rel.confidence);
    if (success) created++;
  }

  return { word: { ...word, embedding }, relationshipsCreated: created };
}