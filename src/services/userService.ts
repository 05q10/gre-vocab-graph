import { driver } from "../lib/neo4j";
import { User, CreateUserInput, UpdateUserInput } from "../types/user";

export async function getUserById(id: string): Promise<User | null> {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User {id: $id}) RETURN u`,
      { id }
    );
    if (result.records.length === 0) return null;
    return result.records[0].get("u").properties as User;
  } finally {
    await session.close();
  }
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const session = driver.session();
  try {
    const result = await session.run(
      `
      CREATE (u:User {
        id: $id,
        name: $name,
        email: $email,
        gradeOrAge: $gradeOrAge,
        purpose: $purpose,
        createdAt: $createdAt
      })
      RETURN u
      `,
      {
        id: input.id,
        name: input.name,
        email: input.email,
        gradeOrAge: input.gradeOrAge || null,
        purpose: input.purpose || null,
        createdAt: new Date().toISOString(),
      }
    );
    return result.records[0].get("u").properties as User;
  } finally {
    await session.close();
  }
}

export async function updateUser(id: string, updates: UpdateUserInput): Promise<User | null> {
  const session = driver.session();
  try {
    const setClauses: string[] = [];
    const params: Record<string, unknown> = { id };

    if (updates.gradeOrAge !== undefined) {
      setClauses.push("u.gradeOrAge = $gradeOrAge");
      params.gradeOrAge = updates.gradeOrAge;
    }
    if (updates.purpose !== undefined) {
      setClauses.push("u.purpose = $purpose");
      params.purpose = updates.purpose;
    }

    if (setClauses.length === 0) {
      return getUserById(id);
    }

    const result = await session.run(
      `
      MATCH (u:User {id: $id})
      SET ${setClauses.join(", ")}
      RETURN u
      `,
      params
    );
    if (result.records.length === 0) return null;
    return result.records[0].get("u").properties as User;
  } finally {
    await session.close();
  }
}
