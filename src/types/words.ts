export interface WordMeaning {
  meaning: string;
  example: string;
  partOfSpeech: string;
}

export interface Word {
  word: string;
  meaning: string;
  example: string;
  partOfSpeech: string;
  additionalMeanings?: string; // JSON stringified WordMeaning[]
  embedding: number[] | null;
  createdAt: string; // ISO 8601 string, easier to serialize over JSON than a Neo4j DateTime object
  userId: string;
}

export interface CreateWordInput {
  word: string;
  meaning: string;
  example: string;
  partOfSpeech: string;
  additionalMeanings?: string;
  userId: string;
}

export interface UpdateWordInput {
  meaning?: string;
  example?: string;
  partOfSpeech?: string;
  additionalMeanings?: string;
}