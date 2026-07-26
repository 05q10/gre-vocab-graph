import { NextResponse } from 'next/server';
import { driver } from '../../../lib/neo4j';
import { Word, UserWord } from '../../../types/words';
import { RelationshipType } from '../../../types/relationship';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET() {
  const sessionUser = await getServerSession(authOptions);
  if (!sessionUser || !sessionUser.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = sessionUser.user.id;
  
  const session = driver.session();
  try {
    const nodes = new Map<string, { id: string; data: UserWord }>();
    const edges: { id: string; source: string; target: string; type: RelationshipType; confidence: number }[] = [];

    // Query 1: Get words with relationships (only between words the user is learning)
    const relResult = await session.run(
      `
      MATCH (u:User {id: $userId})-[ra:LEARNING]->(a:Word)
      MATCH (u)-[rb:LEARNING]->(b:Word)
      MATCH (a)-[r]->(b)
      RETURN a, ra, r, b, rb
      `,
      { userId }
    );

    relResult.records.forEach(record => {
      const a = record.get('a').properties as Word;
      const ra = record.get('ra').properties;
      const b = record.get('b').properties as Word;
      const rb = record.get('rb').properties;
      const r = record.get('r');

      if (!nodes.has(a.word)) {
        nodes.set(a.word, { id: a.word, data: { ...a, userId, remarks: ra.remarks, addedAt: ra.addedAt } });
      }
      if (!nodes.has(b.word)) {
        nodes.set(b.word, { id: b.word, data: { ...b, userId, remarks: rb.remarks, addedAt: rb.addedAt } });
      }

      edges.push({
        id: `${a.word}-${r.type}-${b.word}`,
        source: a.word,
        target: b.word,
        type: r.type as RelationshipType,
        confidence: r.properties.confidence || 1.0,
      });
    });

    // Query 2: Get isolated nodes (words the user is learning that have no global relationships to *other* words the user is learning)
    const isolatedResult = await session.run(
      `
      MATCH (u:User {id: $userId})-[ra:LEARNING]->(a:Word)
      WHERE NOT EXISTS {
         MATCH (a)-[]-(b:Word)<-[:LEARNING]-(u)
      }
      RETURN a, ra
      `,
      { userId }
    );

    isolatedResult.records.forEach(record => {
      const a = record.get('a').properties as Word;
      const ra = record.get('ra').properties;
      if (!nodes.has(a.word)) {
        nodes.set(a.word, { id: a.word, data: { ...a, userId, remarks: ra.remarks, addedAt: ra.addedAt } });
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
