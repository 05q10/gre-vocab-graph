import OpenAI from "openai";

const LLAMA_API_KEY = process.env.LLAMA_API_KEY;

if (!LLAMA_API_KEY) {
  throw new Error("Missing LLAMA_API_KEY. Check .env.local against .env.example.");
}

export const llama = new OpenAI({
  apiKey: LLAMA_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export const LLAMA_MODEL = "llama-3.1-8b-instant";