import { z } from "zod";
import { llama, LLAMA_MODEL } from "./../lib/llama";
import { RELATIONSHIP_TYPES, RelationshipType } from "./../types/relationship";

const NlpIntentSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("UNKNOWN"),
  }),
  z.object({
    intent: z.literal("ADD_RELATIONSHIPS"),
    edges: z.array(
      z.object({
        source: z.string(),
        target: z.string(),
        type: z.enum(RELATIONSHIP_TYPES),
      })
    ),
  }),
  z.object({
    intent: z.literal("QUERY_GRAPH"),
    queryType: z.enum(["SEMANTIC", "RELATIONSHIP"]),
    queryText: z.string().optional(),
    sourceWord: z.string().optional(),
    relationship: z.enum(RELATIONSHIP_TYPES).optional(),
    limit: z.number().default(5),
  }),
]);

export type NlpIntent = z.infer<typeof NlpIntentSchema>;

const systemPrompt = `You are an AI assistant that parses user natural language commands into strict JSON for a vocabulary graph database.
The graph only supports words connected by specific relationship types.

There are exactly 5 valid relationship types:
SYNONYM_OF, ANTONYM_OF, SIMILAR_TO, CONFUSED_WITH, RELATED_TO

If the user wants to ADD or CREATE relationships (e.g. "daunting is a synonym of intimidating and formidable"):
Respond with intent = ADD_RELATIONSHIPS and extract the edges.
Example:
{
  "intent": "ADD_RELATIONSHIPS",
  "edges": [
    { "source": "daunting", "target": "intimidating", "type": "SYNONYM_OF" },
    { "source": "daunting", "target": "formidable", "type": "SYNONYM_OF" }
  ]
}

If the user wants to FIND or SEARCH for words:
Respond with intent = QUERY_GRAPH.
If they ask for specific graph edges (e.g. "synonyms of happy", "antonyms of sad"), use queryType = "RELATIONSHIP", provide sourceWord and relationship.
Example:
{
  "intent": "QUERY_GRAPH",
  "queryType": "RELATIONSHIP",
  "sourceWord": "happy",
  "relationship": "SYNONYM_OF",
  "limit": 5
}
If they ask for meaning/semantics (e.g. "words that mean elated", "words related to cold temperatures"), use queryType = "SEMANTIC" and provide queryText.
Example:
{
  "intent": "QUERY_GRAPH",
  "queryType": "SEMANTIC",
  "queryText": "elated",
  "limit": 5
}

If the prompt is malformed, nonsensical, conversational ("hi", "who are you"), or does not clearly map to adding relationships or searching vocabulary:
Respond with intent = UNKNOWN.
Example:
{
  "intent": "UNKNOWN"
}

IMPORTANT CONSTRAINTS:
1. ONLY output valid JSON matching the exact schema.
2. For ADD_RELATIONSHIPS and RELATIONSHIP queries, the 'type' and 'relationship' MUST be one of the 5 allowed types.
3. Default limit for queries is 5.
`;

export async function parseNlpPrompt(userInput: string): Promise<NlpIntent> {
  try {
    const completion = await llama.chat.completions.create({
      model: LLAMA_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return { intent: "UNKNOWN" };
    }

    const parsed = JSON.parse(raw);
    const result = NlpIntentSchema.safeParse(parsed);
    
    if (!result.success) {
      console.error("NLP Parse schema validation failed", result.error.issues);
      return { intent: "UNKNOWN" };
    }

    return result.data;
  } catch (error) {
    console.error("Error in parseNlpPrompt:", error);
    return { intent: "UNKNOWN" };
  }
}
