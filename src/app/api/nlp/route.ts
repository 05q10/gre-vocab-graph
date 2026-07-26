import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseNlpPrompt } from '../../../services/nlpService';
import { getWordByName, searchWords, findNearestNeighbors } from '../../../services/wordService';
import { addWord } from '../../../services/wordPipeline';
import { createRelationship } from '../../../services/relationshipService';
import { generateEmbedding, buildEmbeddingInput } from '../../../services/embeddingService';
import { driver } from '../../../lib/neo4j';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export const maxDuration = 60; // Llama calls + pipeline might take time

const RequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(500, 'Prompt too long'),
});

function normalize(word: string) {
  return word.trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const sessionUser = await getServerSession(authOptions);
    if (!sessionUser || !sessionUser.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = sessionUser.user.id;
    const body = await request.json();
    const validatedData = RequestSchema.parse(body);

    const intent = await parseNlpPrompt(validatedData.prompt);

    if (intent.intent === 'UNKNOWN') {
      return NextResponse.json({
        success: false,
        message: "Didn't understand that as a command or query. Try rephrasing.",
      });
    }

    if (intent.intent === 'ADD_RELATIONSHIPS') {
      let createdEdges = 0;
      let skippedEdges = 0;
      const ingestedWords: string[] = [];
      const errors: string[] = [];

      // Extract all unique words and normalize
      const uniqueWords = new Set<string>();
      intent.edges.forEach((edge) => {
        uniqueWords.add(normalize(edge.source));
        uniqueWords.add(normalize(edge.target));
      });

      // Ensure all words exist, ingesting missing ones
      for (const wordStr of uniqueWords) {
        try {
          const existing = await getWordByName(wordStr, userId);
          if (!existing) {
            await addWord({ word: wordStr, userId });
            ingestedWords.push(wordStr);
          }
        } catch (e: any) {
          // If a word fails to ingest (e.g. LLM meaning generation fails), we log it
          errors.push(`Failed to process word "${wordStr}": ${e.message}`);
        }
      }

      // Create relationships for edges where both words exist
      for (const edge of intent.edges) {
        const src = normalize(edge.source);
        const tgt = normalize(edge.target);
        
        try {
          const srcNode = await getWordByName(src, userId);
          const tgtNode = await getWordByName(tgt, userId);
          
          if (srcNode && tgtNode) {
            const res = await createRelationship(srcNode.word, tgtNode.word, edge.type, 1.0);
            if (res.success && res.isNew) {
              createdEdges++;
            } else if (res.success && !res.isNew) {
              skippedEdges++;
            }
          }
        } catch (e: any) {
          errors.push(`Failed edge ${src}-${tgt}: ${e.message}`);
        }
      }

      let msg = `${createdEdges} relationship(s) added.`;
      if (skippedEdges > 0) msg += ` ${skippedEdges} already existed.`;
      if (ingestedWords.length > 0) msg += ` Ingested ${ingestedWords.length} new word(s).`;
      if (errors.length > 0) msg += ` (${errors.length} errors).`;

      return NextResponse.json({
        success: true,
        type: 'COMMAND',
        message: msg,
        createdEdges,
        skippedEdges,
        ingestedWords,
        errors,
      });
    }

    if (intent.intent === 'QUERY_GRAPH') {
      const limit = intent.limit || 5;
      
      if (intent.queryType === 'RELATIONSHIP' && intent.sourceWord && intent.relationship) {
        const sourceWord = normalize(intent.sourceWord);
        const session = driver.session();
        try {
          // Symmetric query for the specific relationship
          const result = await session.run(
            `
            MATCH (u:User {id: $userId})-[:LEARNING]->(w1:Word)
            MATCH (u)-[:LEARNING]->(w2:Word)
            MATCH (w1)-[r:${intent.relationship}]-(w2)
            WHERE toLower(w1.word) = toLower($sourceWord)
            RETURN w2
            LIMIT $limit
            `,
            { sourceWord, userId, limit: parseInt(limit as any) }
          );
          const words = result.records.map((r) => r.get('w2').properties.word as string);
          
          if (words.length === 0) {
             return NextResponse.json({
               success: true,
               type: 'QUERY',
               results: [],
               message: `No ${intent.relationship.replace('_', ' ').toLowerCase()} found for "${sourceWord}".`
             });
          }

          return NextResponse.json({
            success: true,
            type: 'QUERY',
            results: words,
            message: `Found ${words.length} result(s).`
          });
        } finally {
          await session.close();
        }
      }

      if (intent.queryType === 'SEMANTIC' && intent.queryText) {
        // Generate embedding for query text and search
        try {
           const embedding = await generateEmbedding(intent.queryText);
           // We can use findNearestNeighbors. It requires an excludeWord, we pass empty string so nothing is excluded.
           const results = await findNearestNeighbors(embedding, "", limit);
           const words = results.map(r => r.word.word);
           
           if (words.length === 0) {
             return NextResponse.json({
               success: true,
               type: 'QUERY',
               results: [],
               message: `No semantic matches found.`
             });
           }
           
           return NextResponse.json({
             success: true,
             type: 'QUERY',
             results: words,
             message: `Found ${words.length} semantic match(es).`
           });
        } catch (e: any) {
           return NextResponse.json({
             success: false,
             message: `Semantic search failed: ${e.message}`
           });
        }
      }
      
      return NextResponse.json({
        success: false,
        message: "Query was missing required parameters."
      });
    }

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: 'Invalid input prompt.', details: (error as any).errors || (error as any).issues },
        { status: 400 }
      );
    }
    console.error('NLP API Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error processing NLP command.' }, { status: 500 });
  }
}
