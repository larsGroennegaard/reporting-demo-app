// app/api/ask/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { promises as fs } from 'fs';
import path from 'path';

const MAX_RETRIES = 2;

// Helper function to read context files
async function readAIContextFile(filename: string): Promise<string> {
  try {
    const filepath = path.join(process.cwd(), 'ai_context', filename);
    return await fs.readFile(filepath, 'utf-8');
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return `/* Error: Could not load ${filename} */`;
  }
}

// Helper to call Gemini API
async function callGemini(apiKey: string, prompt: string) {
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
        })
    });

    if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error("Gemini API Error:", errorText);
        throw new Error(`Failed to fetch from Gemini API. Status: ${geminiResponse.status}`);
    }

    const geminiResult = await geminiResponse.json();
    let text = geminiResult.candidates[0].content.parts[0].text;
    // Clean the response to remove any potential markdown fences
    text = text.replace(/^```sql\n|```$/g, '').trim();
    return text;
}


export async function POST(request: NextRequest) {
  console.log("\n--- [ASK API] New Request Received ---");
  const { query } = await request.json();
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const gcpProjectId = process.env.GCP_PROJECT_ID;

  if (!query) return new NextResponse(JSON.stringify({ error: 'Query is required.' }), { status: 400 });
  if (!geminiApiKey || !gcpProjectId) return new NextResponse(JSON.stringify({ error: 'Server configuration error.' }), { status: 500 });

  try {
    console.log("[ASK API] Step 1: Reading context files for SQL generation...");
    const [
        rules, customer, eventsSchema, stagesSchema, companiesSchema,
        attributionSchema, contactsSchema, spendSchema
    ] = await Promise.all([
        readAIContextFile('_rules.txt'),
        readAIContextFile('_customer.txt'),
        readAIContextFile('events_definition.json'),
        readAIContextFile('stages_definition.json'),
        readAIContextFile('companies_definition.json'),
        readAIContextFile('attribution_definition.json'),
        readAIContextFile('contacts_defintion.json'),
        readAIContextFile('spend_definition.json')
    ]);
    
    const basePrompt = `
      Based on the user's question and the provided context, generate a single, valid BigQuery SQL query.

      **CRITICAL INSTRUCTION:** Your response must be ONLY the raw SQL query text. Do not include any explanation, markdown formatting like \`\`\`sql, or any other characters. The output must be a string that can be executed directly against BigQuery without any modification.

      **Business Rules:**
      ${rules}

      **Customer Info:**
      ${customer}

      **Schemas:**
      Events: ${eventsSchema}
      Stages: ${stagesSchema}
      Companies: ${companiesSchema}
      Attribution: ${attributionSchema}
      Contacts: ${contactsSchema}
      Spend: ${spendSchema}
      
      **User's Question:** "${query}"
    `;

    let sql = '';
    let lastError: any = null;
    let retries = 0;

    while (retries <= MAX_RETRIES) {
        try {
            const prompt = retries === 0
                ? basePrompt
                : `I gave this prompt:\n${basePrompt}\n\nAnd received this SQL:\n${sql}\n\nWhen I attempted to run it, I got this error:\n${lastError.message}\n\nPlease carefully review the SQL and produce a working SQL query. Respond with ONLY the corrected raw SQL query.`;

            console.log(`[ASK API] Attempt ${retries + 1}: Calling Gemini to generate SQL...`);
            sql = await callGemini(geminiApiKey, prompt);
            console.log(`[ASK API] Attempt ${retries + 1}: Received SQL:`, sql);
            
            if (!sql || !sql.toUpperCase().includes('SELECT')) {
                throw new Error("Generated content is not a valid SQL query.");
            }

            console.log(`[ASK API] Attempt ${retries + 1}: Executing query in BigQuery...`);
            const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || '{}');
            const bigquery = new BigQuery({ projectId: gcpProjectId, credentials });
            
            const [rows] = await bigquery.query(sql);
            console.log(`[ASK API] BigQuery execution successful. Found ${rows.length} rows.`);

            const explanationPrompt = `
              Based on the user's question and the following result set from a SQL query, provide a concise, human-readable answer.
              Keep it to 1-3 sentences. Do not mention the query or the table.

              **User's Question:** "${query}"
              **Query Result (first 5 rows):**
              \`\`\`json
              ${JSON.stringify(rows.slice(0, 5), null, 2)}
              \`\`\`
            `;
            const explanation = await callGemini(geminiApiKey, explanationPrompt);
            console.log("[ASK API] Received explanation:", explanation);

            return NextResponse.json({ sql, explanation, data: rows });

        } catch (error: any) {
            console.error(`[ASK API] Attempt ${retries + 1} failed:`, error);
            lastError = error;
            retries++;
            if (retries > MAX_RETRIES) {
                console.error("[ASK API] Max retries reached. Failing.");
                throw lastError;
            }
        }
    }
    
    return new NextResponse(JSON.stringify({ error: 'Failed to generate and execute SQL after multiple attempts.', details: lastError?.message }), { status: 500 });

  } catch (error) {
    console.error("[ASK API] Final catch block:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return new NextResponse(JSON.stringify({ error: 'Failed to process your request.', details: errorMessage }), { status: 500 });
  }
}