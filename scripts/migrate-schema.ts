import { loadEnvConfig } from '@next/env';
import path from 'path';

// Load .env.local to ensure we hit the Aura DB
loadEnvConfig(process.cwd());
console.log('NEO4J_URI is:', process.env.NEO4J_URI ? 'Present' : 'Missing');

async function runMigration() {
  const { driver } = await import('../src/lib/neo4j');
  const session = driver.session();
  console.log('Connecting to Neo4j database...');

  try {
    // 1. Fetch all old words (those with userId)
    console.log('Step 1: Identifying old word nodes...');
    const oldWordsRes = await session.run(`
      MATCH (w:Word)
      WHERE w.userId IS NOT NULL
      RETURN w
    `);

    const oldWords = oldWordsRes.records.map(r => r.get('w').properties);
    console.log(`Found ${oldWords.length} old user-specific word nodes.`);

    if (oldWords.length === 0) {
      console.log('No old nodes found to migrate.');
    }

    // 2. Create Global Words & Learning Edges
    console.log('Step 2: Creating global nodes and mapping user learning edges...');
    
    let globalWordsCreated = 0;
    let userEdgesCreated = 0;

    for (const oldWord of oldWords) {
      // 2a. Create Global Word Node (if doesn't exist)
      await session.run(`
        MERGE (g:Word {word: $word})
        ON CREATE SET 
          g.partOfSpeech = $pos,
          g.meaning = $meaning,
          g.example = $example,
          g.additionalMeanings = $additionalMeanings,
          g.embedding = $embedding,
          g.createdAt = $createdAt,
          g.updatedAt = $updatedAt
      `, {
        word: oldWord.word,
        pos: oldWord.partOfSpeech || null,
        meaning: oldWord.meaning || null,
        example: oldWord.example || null,
        additionalMeanings: oldWord.additionalMeanings || null,
        embedding: oldWord.embedding || null,
        createdAt: oldWord.createdAt || new Date().toISOString(),
        updatedAt: oldWord.updatedAt || new Date().toISOString()
      });
      globalWordsCreated++;

      // 2b. Map User -> Global Word with [:LEARNING]
      await session.run(`
        MATCH (u:User {id: $userId})
        MATCH (g:Word {word: $word})
        WHERE g.userId IS NULL
        MERGE (u)-[r:LEARNING]->(g)
        ON CREATE SET
          r.remarks = $remarks,
          r.addedAt = $createdAt
        ON MATCH SET
          r.remarks = $remarks
      `, {
        userId: oldWord.userId,
        word: oldWord.word,
        remarks: oldWord.remarks || '',
        createdAt: oldWord.createdAt || new Date().toISOString()
      });
      userEdgesCreated++;
    }
    
    console.log(`Mapped ${userEdgesCreated} edges to ${globalWordsCreated} (potentially merged) global words.`);

    // 3. Migrate Relationships
    console.log('Step 3: Re-mapping relationships...');
    const types = ['SYNONYM_OF', 'ANTONYM_OF', 'SIMILAR_TO', 'CONFUSED_WITH', 'RELATED_TO'];
    let relsMapped = 0;

    for (const relType of types) {
      const relRes = await session.run(`
        MATCH (old1:Word)-[r:${relType}]->(old2:Word)
        WHERE old1.userId IS NOT NULL AND old2.userId IS NOT NULL
        
        MATCH (g1:Word {word: old1.word}) WHERE g1.userId IS NULL
        MATCH (g2:Word {word: old2.word}) WHERE g2.userId IS NULL
        
        MERGE (g1)-[gr:${relType}]->(g2)
        ON CREATE SET gr.confidence = r.confidence, gr.createdAt = r.createdAt
        RETURN count(gr) as mappedCount
      `);
      relsMapped += relRes.records[0].get('mappedCount').toNumber();
    }
    console.log(`Migrated ${relsMapped} relationships to the global word layer.`);

    // 4. Cleanup old nodes
    console.log('Step 4: Deleting old user-specific nodes...');
    const deleteRes = await session.run(`
      MATCH (w:Word)
      WHERE w.userId IS NOT NULL
      DETACH DELETE w
      RETURN count(w) as deletedCount
    `);
    
    console.log(`Successfully deleted ${deleteRes.records[0].get('deletedCount').toNumber()} old nodes.`);
    
    // Also cleanup `userId` constraint or indexes if there were any, but usually we just leave schema alone if we didn't add it.
    
    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

runMigration().catch(console.error);
