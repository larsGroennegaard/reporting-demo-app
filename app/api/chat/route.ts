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
    return `/* Error: Could not load ${filename} */`;
  }
}

// Function to dynamically build the context for the LLM
function buildDynamicContext(options: any): string {
    let context = "## 3. Dynamic Value Mappings\n\n";
    context += "Here are the available values for the filters you can use. You must use the exact string values from these lists.\n\n";

    if (options.outcomes) {
        context += `### Stage Names\n- **Available values**: ${JSON.stringify(options.outcomes)}\n`;
        context += `- **Synonyms**: If the user says "pipeline" or "sales qualified", use the "SQL" stage. If they say "newbiz" or "won deals", use the "NewBiz" stage.\n\n`;
    }
    if (options.channels) {
        context += `### Channels\n- **Available values**: ${JSON.stringify(options.channels)}\n`;
        context += `- **Categories**: If the user says "marketing channels", use ["Paid Search", "Paid Social", "Organic Search", "Organic Social", "Emails", "Referral", "Display"]. If they say "paid channels", use ["Paid Search", "Paid Social", "Display"].\n\n`;
    }
    if (options.countries) {
        context += `### Company Countries\n- **Available values**: A list of valid country names. Example: "United States", "Germany".\n\n`;
    }
    if (options.employeeBuckets) {
        context += `### Employee Sizes\n- **Available values**: ${JSON.stringify(options.employeeBuckets)}\n\n`;
    }
     if (options.eventNames) {
        context += `### Event Names\n- **Available values**: ${JSON.stringify(options.eventNames)}\n\n`;
    }
    if (options.signalNames) {
        context += `### Signals\n- **Available values**: ${JSON.stringify(options.signalNames)}\n\n`;
    }

    return context;
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
  if (kpiData) {
    const summaryPrompt = `
      Based on the following data, provide a concise, natural language answer to the user's question.
      Keep the answer to 1-3 sentences.
      User's Question: "${query}"
      KPI Data: ${JSON.stringify(kpiData, null, 2)}
      Chart/Table Data Summary: The chart/table contains ${chartData?.length || 0} rows of data.
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
  else {
    try {
        // Fetch all dynamic values from our config-options endpoint
        const internalApiUrl = new URL('/api/config-options', request.url).toString();
        const optionsResponse = await fetch(internalApiUrl, {
            headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_SECRET_KEY || '' }
        });
        if (!optionsResponse.ok) throw new Error('Failed to fetch dynamic config options');
        const dynamicOptions = await optionsResponse.json();

        // Dynamically build the context string
        const dynamicContext = buildDynamicContext(dynamicOptions);

        const configRulesTemplate = await readAIContextFile('config_rules.md');

        // Inject the full dynamic context into the rules template
        const systemPrompt = configRulesTemplate
            .replace('{{DYNAMIC_PROMPT_CONTEXT}}', dynamicContext)
            + `\n\nUser's Question: "${query}"\n\nNow, generate the JSON configuration object that answers this question.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
        });

        const result = await response.json();
        
        let config;
        try {
            const rawText = result.candidates[0]?.content?.parts[0]?.text || '{}';
            const jsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            config = JSON.parse(jsonText);
        } catch (e) {
            console.error("Failed to parse JSON from AI:", e);
            throw new Error("AI returned malformed JSON");
        }

        if (!config) throw new Error("AI returned an empty config");
        if (!config.kpiCardConfig) config.kpiCardConfig = [];
        config.kpiCardConfig.forEach((card: any, index: number) => { card.id = Date.now() + index; });

        return NextResponse.json({ config });

    } catch (error) {
        console.error("Error in chat config generation:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return new NextResponse(JSON.stringify({ error: 'Failed to generate report configuration.', details: errorMessage }), { status: 500 });
    }
  }
}
