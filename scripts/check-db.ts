import { loadEnvConfig } from '@next/env';
import path from 'path';

loadEnvConfig(process.cwd());

async function check() {
  const { driver } = await import('../src/lib/neo4j');
  const session = driver.session();
  try {
    const res = await session.run(`
      MATCH (u:User)-[r:LEARNING]->(w:Word)
      RETURN u.id as user, count(r) as count
    `);
    console.log("LEARNING edges by user:");
    console.log(res.records.map(r => ({ user: r.get('user'), count: r.get('count').toNumber() })));
    
    const res2 = await session.run(`MATCH (w:Word) RETURN count(w) as c`);
    console.log("Total Word nodes:", res2.records[0].get('c').toNumber());
    
    const res3 = await session.run(`MATCH (u:User) RETURN u.id as id, u.email as email`);
    console.log("Users:", res3.records.map(r => ({ id: r.get('id'), email: r.get('email') })));
    
    const res4 = await session.run(`MATCH (w:Word) WHERE w.userId IS NOT NULL RETURN count(w) as c`);
    console.log("Words still tied to userId (unmigrated):", res4.records[0].get('c').toNumber());

  } finally {
    await session.close();
    await driver.close();
  }
}
check().catch(console.error);
