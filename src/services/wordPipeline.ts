import { createWord, storeEmbedding, findNearestNeighbors, getWordByName, getGlobalWordByName, linkWordToUser } from "./wordService";
import { generateEmbedding, buildEmbeddingInput } from "./embeddingService";
import { detectRelationships, generateWordDetails } from "./llamaService";
import { createRelationship } from "./relationshipService";
import { UserWord } from "./../types/words";

const CANDIDATE_POOL_SIZE = 15; // Only send the closest vector matches to the LLM to avoid weak relationships
const MIN_CONFIDENCE = 0.90;    // Require extremely high confidence to avoid hallucinated links
const MIN_VECTOR_SIMILARITY = 0.55; // Drop candidates mathematically proven to be unrelated before LLM sees them

export interface AddWordResult {
  word: UserWord;
  relationshipsCreated: number;
}

export interface AddWordInput {
  word: string;
  userId: string;
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
  const normalizedWord = input.word.trim().toLowerCase();
  
  // 1. Check if user already has this word in their list
  const existingUserWord = await getWordByName(normalizedWord, input.userId);
  if (existingUserWord) {
    throw new Error(`Word "${normalizedWord}" already exists in your list.`);
  }

  // 2. Check if word exists in the global dictionary
  let globalWord = await getGlobalWordByName(normalizedWord);
  let relationshipsCreated = 0;

  if (!globalWord) {
    // Word is completely new to the system. Generate definitions & embeddings.
    const generatedDetails = await generateWordDetails(normalizedWord);
    
    globalWord = await createWord({
      word: normalizedWord,
      userId: input.userId, // This will be ignored by createWord now, but satisfying type if needed, wait CreateWordInput has userId. We'll leave it.
      ...generatedDetails
    });

    const embeddingInput = buildEmbeddingInput(globalWord.meaning, globalWord.example);
    const embedding = await generateEmbedding(embeddingInput);
    await storeEmbedding(normalizedWord, embedding);
    globalWord.embedding = embedding;

    // Detect relationships only for newly added global words
    const rawCandidates = await findNearestNeighbors(embedding, normalizedWord, CANDIDATE_POOL_SIZE);
    const candidates = rawCandidates.filter(c => c.score >= MIN_VECTOR_SIMILARITY);

    if (candidates.length > 0) {
      const detected = await detectRelationships(
        globalWord,
        candidates.map((c) => c.word)
      );

      const confident = detected.filter((r) => r.confidence >= MIN_CONFIDENCE);
      const deduped = confident.reduce((acc, r) => {
        const existing = acc.get(r.target);
        if (!existing || r.confidence > existing.confidence) {
          acc.set(r.target, r);
        }
        return acc;
      }, new Map<string, (typeof confident)[number]>());

      for (const rel of deduped.values()) {
        const res = await createRelationship(normalizedWord, rel.target, rel.type, rel.confidence);
        if (res.success && res.isNew) relationshipsCreated++;
      }
    }
  }

  // 3. Link the word to the user (create the [:LEARNING] edge)
  const userWord = await linkWordToUser(normalizedWord, input.userId);

  return { word: userWord, relationshipsCreated };
}