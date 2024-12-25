import path from "path";
import fs from "fs";
import OpenAI from "openai";

function getAllMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    console.error(`Directory does not exist: ${dir}`);
    return [];
  }

  console.log(`Scanning for markdown files in: ${dir}`);
  let results: string[] = [];

  try {
    const list = fs.readdirSync(dir);

    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        results = results.concat(getAllMarkdownFiles(filePath));
      } else if (file.toLowerCase().endsWith('.md')) {
        console.log(`Found markdown file: ${filePath}`);
        results.push(filePath);
      }
    }
  } catch (err) {
    console.error(`Error scanning directory ${dir}:`, err);
  }

  return results;
}


export async function buildVectorDatabase(kbPath: string, dbPath: string, client: OpenAI) {
  console.log("Building vector database from knowledge base...");

  // Ensure dbPath ends with vectors.json
  const vectorsFile = path.join(dbPath, 'vectors.json');

  // Create the database directory if it doesn't exist
  fs.mkdirSync(dbPath, { recursive: true });

  // Try to load existing vectors
  let existingVectors = [];
  try {
    if (fs.existsSync(vectorsFile)) {
      existingVectors = JSON.parse(fs.readFileSync(vectorsFile, 'utf8'));
      // Validate vector dimensions
      if (existingVectors.length > 0 && existingVectors[0].embedding.length !== 3072) {
        console.log("Existing vectors have incorrect dimensions. Rebuilding database...");
        fs.unlinkSync(vectorsFile);
      } else {
        return { vectors: existingVectors };
      }
    }
  } catch (err) {
    console.warn("Could not load existing vectors, creating new database");
  }
  // Get markdown files from the knowledge base path
  const files = getAllMarkdownFiles(kbPath);
  console.log(`Found ${files.length} markdown files in knowledge base at ${kbPath}`);
  if (files.length === 0) {
    console.warn(`No markdown files found in the knowledge base directory: ${kbPath}`);
    return { vectors: [] };
  }

  const documents = [];
  for (const filePath of files) {
    console.log(`Processing file: ${filePath}`);
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf8");
      console.log(`Read content from file: ${filePath}`);
    } catch (err) {
      console.error(`Error reading file ${filePath}:`, err);
      continue;
    }

    documents.push({
      text: content,
      fileName: path.relative(kbPath, filePath),
    });
  }

  if (documents.length > 0) {
    // Generate embeddings using OpenAI
    const embeddings = [];
    for (const doc of documents) {
      // split document into chunks per second level header, or a maximum of 4000 tokens with 400 token overlap
      // split doc into level 2 headers only ("##")
      const contextualChunkDoc = doc.text.split('## ').map((chunk, index) => ({
        ...doc,
        text: `Filename:${doc.fileName}\n Chunk: ${chunk}`,
      }));

      for (const doc of contextualChunkDoc) {
        const response = await client.embeddings.create({
          model: "text-embedding-3-large",
          input: doc.text,
          dimensions: 3072
        });
        embeddings.push({
          text: doc.text,
          fileName: doc.fileName,
          embedding: response.data[0].embedding,
        });
      }
    }

    // Save to file
    fs.writeFileSync(vectorsFile, JSON.stringify(embeddings));
    console.log("Vector database built and saved.");
    return { vectors: embeddings };
  } else {
    console.warn("No documents were added to the database.");
    return { vectors: [] };
  }
}

export async function searchKnowledgeBase(
  query: string,
  dbPath: string,
  kbPath: string,
  client: OpenAI
) {
  try {
    const { vectors } = await buildVectorDatabase(kbPath, dbPath, client);

    if (!vectors || vectors.length === 0) {
      throw new Error("No vectors found in database");
    }

    // Generate embedding for the query
    const queryResponse = await client.embeddings.create({
      model: "text-embedding-3-large",
      input: query,
      dimensions: 3072
    });
    const queryEmbedding = queryResponse.data[0].embedding;


    // Compute cosine similarity and sort results
    const results = vectors
      .map((doc: { text: string; fileName: string; embedding: number[] }) => ({
        ...doc,
        similarity: cosineSimilarity(queryEmbedding, doc.embedding)
      })).sort((a: { similarity: number }, b: { similarity: number }) => a.similarity - b.similarity)
      .slice(0, 15);

    return results.map((result: { fileName: string; text: string }) => 
      `Filename: ${result.fileName}/n Content: ${result.text}`
    );
  } catch (error) {
    console.error("Error searching knowledge base:", error);
    return [];
  }
}

// Utility function to compute cosine similarity
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error("Vectors must be the same length");
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

export async function retrieveRelevantDocs(query: string, vectors: any[], client: OpenAI) {
  try {
    const queryResponse = await client.embeddings.create({
      model: "text-embedding-3-large",
      input: query,
      dimensions: 3072
    });
    const queryEmbedding = queryResponse.data[0].embedding;

    console.log({
      vector: vectors, similarity: vectors
        .map(doc => ({
          ...doc,
          similarity: cosineSimilarity(queryEmbedding, doc.embedding)
        }))
    });
    const results = vectors
      .map(doc => ({
        text: doc.text,
        similarity: cosineSimilarity(queryEmbedding, doc.embedding)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    return results.map(result => result.text);
  } catch (error) {
    console.error("Error retrieving relevant documents:", error);
    return [];
  }
}
