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
  createdAt: string; // ISO 8601 string, when the word was first added to the global dictionary
}

export interface UserWord extends Word {
  userId: string;
  remarks?: string; // Extracted from the [:LEARNING] edge
  addedAt?: string; // Extracted from the [:LEARNING] edge
}

export interface CreateWordInput {
  word: string;
  meaning: string;
  example: string;
  partOfSpeech: string;
  additionalMeanings?: string;
  userId: string;
  remarks?: string;
}

export interface UpdateWordInput {
  meaning?: string;
  example?: string;
  partOfSpeech?: string;
  additionalMeanings?: string;
  remarks?: string;
}