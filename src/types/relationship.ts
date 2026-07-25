export const RELATIONSHIP_TYPES = [
  "SYNONYM_OF",
  "ANTONYM_OF",
  "SIMILAR_TO",
  "CONFUSED_WITH",
  "RELATED_TO",
] as const;


export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export interface DetectedRelationship {
  target: string;
  type: RelationshipType;
  confidence: number;
}