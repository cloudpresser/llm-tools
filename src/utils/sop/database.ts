import * as lancedb from "@lancedb/lancedb";
import OpenAI from "openai";
import * as fs from 'fs';
import * as path from 'path';
import { Schema, Field, FixedSizeList, Float32, Utf8 } from 'apache-arrow';

export async function initializeDatabase(dbPath: string) {
  const db = await lancedb.connect(dbPath);
  let table;
  
  const schema = new Schema([
    new Field('vector', new FixedSizeList(1536, new Field('item', new Float32()))),
    new Field('content', new Utf8()),
    new Field('fileName', new Utf8())
  ]);

  try {
    table = await db.openTable("vectors");
    // Verify table schema
    const tableSchema = await table.schema();
    const vectorField = tableSchema.fields.find((field: any) => field.name === 'vector');
    if (!vectorField || vectorField.type !== 'float32[1536]') {
      // Drop and recreate if schema is invalid
      await db.dropTable("vectors");
      table = await db.createTable("vectors", [], { schema });
    }
  } catch {
    console.log("Creating new vectors table...");
    table = await db.createTable("vectors", [], { schema });
  }
  return table;
}

export async function buildVectorDatabase(table: any, kbPath: string, client: OpenAI) {
  console.log("Building vector database from knowledge base...");
  const files = fs.readdirSync(kbPath).filter(file => file.endsWith(".md"));
  const vectors = [];

  for (const file of files) {
    const filePath = path.join(kbPath, file);
    const content = fs.readFileSync(filePath, "utf8");

    try {
      const embedding = await (client as OpenAI).embeddings.create({
        input: content,
        model: "text-embedding-3-small"
      });

      const vector = embedding.data?.[0]?.embedding;
      
      if (vector && vector.length === 1536) {
        vectors.push({
          vector,
          content,
          fileName: file
        });
      } else {
        console.warn(`Invalid embedding for file ${file}: incorrect dimension or format`);
      }
    } catch (error) {
      console.error(`Error generating embedding for file ${file}:`, error);
    }
  }

  await table.add(vectors);
}

export async function searchKnowledgeBase(query: string, kbPath: string, dbPath: string, client: OpenAI) {
  try {
    const db = await lancedb.connect(dbPath);
    let table;
    
    try {
      table = await db.openTable("vectors");
      // Check if table is empty
      const count = await table.countRows();
      if (count <= 1) { // Only has dummy row
        console.log("Building initial vector database...");
        await buildVectorDatabase(table, kbPath, client);
      }
    } catch (error) {
      console.log("Initializing vector database...");
      table = await initializeDatabase(dbPath);
      await buildVectorDatabase(table, kbPath, client);
    }

    const results = await retrieveRelevantDocs(query, table, client);
    return results;
  } catch (error) {
    console.error("Error searching knowledge base:", error);
    throw error; // Propagate error for better debugging
  }
}

export async function retrieveRelevantDocs(query: string, table: any, client: OpenAI) {
  try {
    const queryEmbedding = await client.embeddings.create({
      input: query,
      model: "text-embedding-3-small"
    });

    const embedding = queryEmbedding.data?.[0]?.embedding;
    
    if (!embedding || embedding.length !== 1536) {
      console.error("Failed to generate valid embedding for query");
      return [];
    }

    const results = await table.search(embedding)
      .limit(5)
      .execute();
    
    // Debug the results structure
    console.log('Search results structure:', JSON.stringify(results, null, 2));
    
    if (!Array.isArray(results)) {
      console.warn("Search results are not in expected format");
      return [];
    }
    
    return results
      .filter(row => row && typeof row === 'object' && 'content' in row)
      .map(row => row.content as string);
  } catch (error) {
    console.error("Error retrieving relevant documents:", error);
    return [];
  }
}
