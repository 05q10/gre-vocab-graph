import { NextResponse } from 'next/server';
import { driver } from '../../../lib/neo4j';
import { Word } from '../../../types/words';
import { RelationshipType } from '../../../types/relationship';

export async function GET() {
  const session = driver.session();
  try {
    const nodes = new Map<string, { id: string; data: Word }>();
    const edges: { id: string; source: string; target: string; type: RelationshipType; confidence: number }[] = [];

    // Query 1: Get words with relationships and the relationships themselves
    const relResult = await session.run(
      `MATCH (a:Word)-[r]->(b:Word) RETURN a, r, b`
    );

    relResult.records.forEach(record => {
      const a = record.get('a').properties as Word;
      const b = record.get('b').properties as Word;
      const r = record.get('r');

      if (!nodes.has(a.word)) {
        nodes.set(a.word, { id: a.word, data: a });
      }
      if (!nodes.has(b.word)) {
        nodes.set(b.word, { id: b.word, data: b });
      }

      edges.push({
        id: `${a.word}-${r.type}-${b.word}`,
        source: a.word,
        target: b.word,
        type: r.type as RelationshipType,
        confidence: r.properties.confidence || 1.0,
      });
    });

    // Query 2: Get isolated nodes
    const isolatedResult = await session.run(
      `MATCH (a:Word) WHERE NOT (a)--() RETURN a`
    );

    isolatedResult.records.forEach(record => {
      const a = record.get('a').properties as Word;
      if (!nodes.has(a.word)) {
        nodes.set(a.word, { id: a.word, data: a });
      }
    });

    return NextResponse.json({
      nodes: Array.from(nodes.values()),
      edges: edges
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching graph:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    await session.close();
  }
}
