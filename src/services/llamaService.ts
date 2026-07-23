import { z } from "zod";
import { llama, LLAMA_MODEL } from "./../lib/llama";
import { RELATIONSHIP_TYPES, DetectedRelationship } from "./../types/relationship";
import { Word } from "./../types/words";

const LlamaResponseSchema = z.object({
  relationships: z.array(
    z.object({
      target: z.string(),
      type: z.enum(RELATIONSHIP_TYPES),
      confidence: z.number().min(0).max(1),
    })
  ),
});

function buildPrompt(target: Word, candidates: Word[]): string {
  const candidateList = candidates
    .map(
      (c, i) =>
        `${i + 1}. "${c.word}" (${c.partOfSpeech}) — ${c.meaning} Example: ${c.example}`
    )
    .join("\n");

  return `You are a lexicographer analyzing GRE vocabulary words for semantic relationships.

TARGET WORD:
"${target.word}" (${target.partOfSpeech}) — ${target.meaning}
Example: ${target.example}

CANDIDATE WORDS (compare TARGET against each one):
${candidateList}

For each candidate that has a genuine relationship to the target, classify it using EXACTLY one of these types:
- SYNONYM_OF: means nearly the same thing, interchangeable in most contexts
- ANTONYM_OF: means the opposite
- SIMILAR_TO: overlapping meaning and could sometimes substitute for each other, but with a clear shade of difference (NOT for words that are opposites, unrelated, or merely in the same topic area)
- CONFUSED_WITH: commonly mistaken for the target due to spelling/sound, despite having a different meaning
- ROOT_RELATED: shares a Latin/Greek root or morpheme with the target
- DERIVED_FROM: one word is morphologically built from the other (e.g. a prefix/suffix added)
- RELATED_TO: belongs to the same general theme, domain, or category as the target, without close meaning overlap — use this instead of SIMILAR_TO whenever the connection is topical rather than a near-match in meaning

Do not use SIMILAR_TO for words that are opposites of each other — use ANTONYM_OF for those, even if they also share a topic.

CRITICAL INSTRUCTION: You must be an EXTREMELY STRICT lexicographer. If two words are only vaguely related, share a very broad category (e.g. "they are both emotions" or "they both describe behavior"), or are just "kind of" similar, you MUST OMIT THEM. Only create a relationship if it is strong enough to appear in a high-quality thesaurus or dictionary cross-reference.

Most candidates will have NO meaningful relationship to the target word — this is normal and expected. Only include a candidate in your response if you are genuinely confident a real, strong relationship exists. It is perfectly correct to return an empty relationships array. Do NOT force a relationship type onto a candidate just because it appeared in the list!

For CONFUSED_WITH specifically: only use this if the two words are ACTUALLY similar in spelling or pronunciation (e.g. 'affect' vs 'effect', 'complement' vs 'compliment'). Do not use CONFUSED_WITH for words that merely share a topic or a vague semantic connection — that likely belongs under RELATED_TO instead, or should be omitted entirely if the connection is too weak.

Respond with ONLY valid JSON, no markdown formatting, no explanation, in exactly this shape:
{
  "relationships": [
    { "target": "ExactWordFromCandidateList", "type": "SIMILAR_TO", "confidence": 0.85 }
  ]
}`;
}

/**
 * Sends the target word + its candidate shortlist (from Phase 9's vector
 * search) to Llama, and returns only relationships that pass validation:
 *   - valid JSON shape (zod schema)
 *   - type is one of the 7 allowed enum values
 *   - target word actually exists in the candidate list (case-insensitive)
 *   - confidence is a number between 0 and 1
 * Anything else is silently dropped, per the spec's STEP 6.
 */
export async function detectRelationships(
  target: Word,
  candidates: Word[]
): Promise<DetectedRelationship[]> {
  if (candidates.length === 0) return [];

  const completion = await llama.chat.completions.create({
    model: LLAMA_MODEL,
    messages: [{ role: "user", content: buildPrompt(target, candidates) }],
    temperature: 0.2, // low temperature: we want consistent classification, not creative variation
    response_format: { type: "json_object" }, // Groq enforces valid JSON syntax at the API level
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("Llama returned non-JSON content:", raw);
    return [];
  }

  const result = LlamaResponseSchema.safeParse(parsed);
  if (!result.success) {
    console.error("Llama response failed schema validation:", result.error.issues);
    return [];
  }

  // Cross-check every "target" against the actual candidate list —
  // the LLM can still hallucinate a word that was never offered to it.
  const candidateWords = new Set(candidates.map((c) => c.word.toLowerCase()));

  return result.data.relationships.filter((r) =>
    candidateWords.has(r.target.toLowerCase())
  );
}

const WordDetailsSchema = z.object({
  meaning: z.string().min(1),
  example: z.string().min(1),
  partOfSpeech: z.enum(['Noun', 'Verb', 'Adjective', 'Adverb', 'Other']),
});

export async function generateWordDetails(word: string): Promise<{
  meaning: string;
  example: string;
  partOfSpeech: string;
}> {
  const prompt = `Provide the most common GRE-relevant meaning, a natural example sentence using the word, and its part of speech for the word: ${word}. 

Respond with ONLY valid JSON in exactly this shape:
{
  "meaning": "string",
  "example": "string",
  "partOfSpeech": "Noun" // must be one of: Noun, Verb, Adjective, Adverb, Other
}`;

  const completion = await llama.chat.completions.create({
    model: LLAMA_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error(`Could not generate details for "${word}" — try again`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Could not generate details for "${word}" — try again`);
  }

  const result = WordDetailsSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Could not generate details for "${word}" — try again`);
  }

  return result.data;
}