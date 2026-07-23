export interface Word {
  word: string;
  meaning: string;
  example: string;
  partOfSpeech: string;
  embedding: number[] | null;
  createdAt: string; // ISO 8601 string, easier to serialize over JSON than a Neo4j DateTime object
}

export interface CreateWordInput {
  word: string;
  meaning: string;
  example: string;
  partOfSpeech: string;
}

export interface UpdateWordInput {
  meaning?: string;
  example?: string;
  partOfSpeech?: string;
}