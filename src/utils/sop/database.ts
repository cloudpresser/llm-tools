import * as lancedb from "@lancedb/lancedb";
import { Instructor } from "@instructor-ai/instructor";
import * as fs from 'fs';
import * as path from 'path';

export async function initializeDatabase(dbPath: string) {
  const db = await lancedb.connect(dbPath);
  let table;
  try {
    table = await db.openTable("vectors");
  } catch {
    const sampleData = [{
      vector: [],
      content: "",
      fileName: ""
    }];
    table = await db.createTable("vectors", sampleData, { mode: "overwrite" });
  }
  return table;
}

export async function buildVectorDatabase(table: any, kbPath: string, client: Instructor) {
  console.log("Building vector database from knowledge base...");
  const files = fs.readdirSync(kbPath).filter(file => file.endsWith(".md"));
  const vectors = [];

  for (const file of files) {
    const filePath = path.join(kbPath, file);
    const content = fs.readFileSync(filePath, "utf8");

    const embedding = await client.embeddings.create({
      input: content,
      model: "text-embedding-3-large"
    });

    vectors.push({
      vector: embedding.embeddings,
      content,
      fileName: file
    });
  }

  await table.add(vectors);
}

export async function retrieveRelevantDocs(query: string, table: any, client: Instructor) {
  const queryEmbedding = await client.embeddings.create({
    input: query,
    model: "text-embedding-3-large"
  });

  const results = await table.vectorSearch(queryEmbedding.embeddings).limit(5).toArray();
  return results.map(row => row.content);
}
