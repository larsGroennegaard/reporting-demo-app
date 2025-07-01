// app/api/chat/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Helper function to read files from the ai_context directory
async function readAIContextFile(filename: string): Promise<string> {
  try {
    const filepath = path.join(process.cwd(), 'ai_context', filename);
    return await fs.readFile(filepath, 'utf-8');
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    // Return an empty string or a specific error message if the file is critical
    return `/* Error: Could not load ${filename} */`;
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new NextResponse(JSON.stringify({ error: 'GEMINI_API_KEY environment variable not set.' }), { status: 500 });
  }

  const body = await request.json();
  const { query, kpiData, chartData } = body;

  if (!query) {
    return new NextResponse(JSON.stringify({ error: 'Query is required.' }), { status: 400 });
  }

  // --- Step 2: Generate Natural Language Answer ---
  // If kpiData is present, we are in the second step of the workflow.
  if (kpiData) {
    const summaryPrompt = `
      Based on the following data, provide a concise, natural language answer to the user's question.
      Keep the answer to 1-3 sentences.

      User's Question: "${query}"

      KPI Data:
      ${JSON.stringify(kpiData, null, 2)}

      Chart/Table Data Summary:
      The chart/table contains ${chartData?.length || 0} rows of data.
      ${chartData?.length > 0 ? `The primary segments are: ${
        Array.from(new Set(chartData.map((d: any) => d.segment || d.month)))
        .slice(0, 5).join(', ')}` : ''}
      
      Answer:
    `;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: summaryPrompt }] }] })
      });
      const result = await response.json();
      const answer = result.candidates[0]?.content?.parts[0]?.text || "I was unable to generate a summary for this report.";
      return NextResponse.json({ answer });

    } catch (error) {
      console.error("Error calling Gemini API for summary:", error);
      return new NextResponse(JSON.stringify({ error: 'Failed to generate summary.' }), { status: 500 });
    }
  }

  // --- Step 1: Generate Report Configuration ---
  // If kpiData is not present, we are in the first step.
  else {
    const configRules = await readAIContextFile('config_rules.md');

    // REFINED PROMPT: This prompt is now simpler and relies entirely on the config_rules.md file for context.
    const systemPrompt = `
      ${configRules}

      User's Question: "${query}"

      Now, generate the JSON configuration object that answers this question based on the rules and schemas provided above.
    `;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
      });

      const result = await response.json();
      
      const rawText = result.candidates[0]?.content?.parts[0]?.text || '{}';
      const jsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

      const config = JSON.parse(jsonText);
      
      if (config.kpiCardConfig && Array.isArray(config.kpiCardConfig)) {
        config.kpiCardConfig.forEach((card: any, index: number) => {
            card.id = Date.now() + index;
        });
      }

      return NextResponse.json({ config });

    } catch (error) {
      console.error("Error generating or parsing config:", error);
      return new NextResponse(JSON.stringify({ error: 'Failed to generate report configuration.' }), { status: 500 });
    }
  }
}
