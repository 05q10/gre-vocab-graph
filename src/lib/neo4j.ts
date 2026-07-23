import neo4j, { Driver } from "neo4j-driver";

const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USERNAME = process.env.NEO4J_USERNAME;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
  throw new Error(
    "Missing Neo4j environment variables. Check .env.local against .env.example."
  );
}

// Cache the driver on the Node global object so Next.js hot-reloading
// in development reuses the same connection pool instead of leaking
// a new one on every file save.
declare global {
  // eslint-disable-next-line no-var
  var __neo4jDriver: Driver | undefined;
}

function createDriver(): Driver {
  return neo4j.driver(
    NEO4J_URI as string,
    neo4j.auth.basic(NEO4J_USERNAME as string, NEO4J_PASSWORD as string),
    {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 10_000,
    }
  );
}

export const driver: Driver = global.__neo4jDriver ?? createDriver();

if (process.env.NODE_ENV !== "production") {
  global.__neo4jDriver = driver;
}

/**
 * Call once at startup (or from a health-check route) to confirm
 * the app can actually reach AuraDB, rather than failing later
 * on the first real query with a less obvious error.
 */
export async function verifyConnectivity(): Promise<void> {
  await driver.verifyConnectivity();
}