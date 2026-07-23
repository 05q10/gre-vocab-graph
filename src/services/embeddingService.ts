import { pipeline, FeatureExtractionPipeline, env } from "@xenova/transformers";

// Set cache directory to /tmp for Vercel serverless environment (read-only filesystem workaround)
env.cacheDir = '/tmp';

const MODEL_NAME = process.env.EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2";

// The pipeline takes several seconds to initialize (loading model weights
// into memory). We cache the loaded pipeline in module scope so it's only
// created once per process, not once per request/call.
let embedderPromise: Promise<FeatureExtractionPipeline> | null = null;

function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedderPromise) {
    embedderPromise = pipeline("feature-extraction", MODEL_NAME) as Promise<FeatureExtractionPipeline>;
  }
  return embedderPromise;
}

/**
 * Generates a 384-dimension embedding vector from the given text.
 * Combines meaning + example before calling this, per the project's
 * intelligent-relationship-pipeline design (STEP 1).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const embedder = await getEmbedder();

  const output = await embedder(text, {
    pooling: "mean",   // averages token-level embeddings into one sentence-level vector
    normalize: true,   // scales the vector to unit length, required for cosine similarity to behave correctly
  });

  // output.data is a Float32Array; Neo4j's driver and JSON both want a plain number array
  return Array.from(output.data as Float32Array);
}

/**
 * Convenience helper matching the project's spec: embeddings are generated
 * from meaning + example, never from the word alone.
 */
export function buildEmbeddingInput(meaning: string, example: string): string {
  return `${meaning.trim()} ${example.trim()}`;
}