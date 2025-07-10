// app/api/chat/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// --- Default Config Objects for Validation ---
const defaultEngagementConfig = {
    reportArchetype: 'engagement_analysis',
    name: 'New Engagement Report',
    description: '',
    dataConfig: {
        timePeriod: 'this_year',
        reportFocus: 'time_series',
        metrics: { base: [], influenced: {}, attributed: {} },
        funnelLength: 'unlimited',
        filters: { selectedChannels: [], eventNames: [], signals: [], url: '' },
    },
    kpiCards: [],
    chart: { title: 'Chart', variant: 'time_series_line', metrics: [], metric: '', breakdown: 'channel' },
    table: { title: 'Data Table', variant: 'time_series_by_metric' },
};

const defaultOutcomeConfig = {
    reportArchetype: 'outcome_analysis',
    name: 'New Outcome Report',
    description: '',
    dataConfig: {
        timePeriod: 'this_year',
        reportFocus: 'time_series',
        metrics: {},
        selectedCountries: [],
        selectedEmployeeSizes: [],
    },
    kpiCards: [],
    chart: { title: 'Chart', variant: 'time_series_line', metrics: [], metric: '', breakdown: 'companyCountry' },
    table: { title: 'Data Table', variant: 'time_series_by_metric' },
};


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
  console.log("\n--- New Chat Request ---");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY environment variable not set.");
    return new NextResponse(JSON.stringify({ error: 'GEMINI_API_KEY environment variable not set.' }), { status: 500 });
  }

  const body = await request.json();
  const { query, kpiData, chartData, config } = body;
  console.log(`Received query: "${query}"`);

  if (!query) {
    return new NextResponse(JSON.stringify({ error: 'Query is required.' }), { status: 400 });
  }
  
  const modelName = 'gemini-2.5-flash';

  // --- Step 2: Generate Natural Language Answer ---
  if (kpiData) {
    console.log("Entering Step 2: Generating natural language summary.");
    const summaryPrompt = `
      Based on the user's question and the following data and configuration, provide a concise, natural language answer.
      Keep the answer to 1-3 sentences.
      
      User's Question: "${query}"
      
      Configuration Used:
      ${JSON.stringify(config, null, 2)}

      KPI Data: 
      ${JSON.stringify(kpiData, null, 2)}
      
      Chart/Table Data Summary: The chart/table contains ${chartData?.length || 0} rows of data.
      
      Answer:
    `;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: summaryPrompt }] }] })
      });
      const result = await response.json();
      
      if (!result.candidates || result.candidates.length === 0) {
          console.error("Gemini summary response is missing candidates. Full response:", JSON.stringify(result, null, 2));
          throw new Error("Invalid response structure from Gemini API for summary.");
      }

      const answer = result.candidates[0]?.content?.parts[0]?.text || "I was unable to generate a summary for this report.";
      console.log("Successfully generated summary:", answer);
      return NextResponse.json({ answer });

    } catch (error) {
      console.error("Error calling Gemini API for summary:", error);
      return new NextResponse(JSON.stringify({ error: 'Failed to generate summary.' }), { status: 500 });
    }
  }

  // --- Step 1: Generate Report Configuration ---
  else {
    console.log("Entering Step 1: Generating report configuration.");
    try {
        console.log("Fetching dynamic config options...");
        const internalApiUrl = new URL('/api/config-options', request.url).toString();
        const optionsResponse = await fetch(internalApiUrl, {
            headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_SECRET_KEY || '' }
        });
        if (!optionsResponse.ok) throw new Error('Failed to fetch dynamic config options');
        const dynamicOptions = await optionsResponse.json();
        console.log("Successfully fetched dynamic options.");

        const dynamicContext = buildDynamicContext(dynamicOptions);
        const configRulesTemplate = await readAIContextFile('config_rules.md');

        const systemPrompt = configRulesTemplate
            .replace('{{DYNAMIC_PROMPT_CONTEXT}}', dynamicContext)
            + `\n\nUser's Question: "${query}"`;
        
        console.log("--- Sending Prompt to Gemini ---");
        // console.log(systemPrompt); // This line has been commented out
        console.log("-----------------------------");

        const payload = {
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        console.log("Full response object from Gemini:", JSON.stringify(result, null, 2));

        if (!result.candidates || result.candidates.length === 0) {
            throw new Error("Invalid response structure from Gemini API. No candidates found.");
        }
        
        let aiConfig;
        const rawText = result.candidates[0]?.content?.parts[0]?.text || '{}';
        
        try {
            aiConfig = JSON.parse(rawText);
            console.log("Successfully parsed JSON config from AI.");
        } catch (e) {
            console.error("This should not happen, but failed to parse guaranteed JSON:", e);
            throw new Error("Failed to parse the JSON response from the AI.");
        }

        if (!aiConfig || !aiConfig.reportArchetype) {
            throw new Error("AI response is valid JSON but is missing the required 'reportArchetype' key.");
        }
        
        // Deep merge the AI config with the correct default
        let finalConfig;
        if (aiConfig.reportArchetype === 'outcome_analysis') {
            finalConfig = {
                ...defaultOutcomeConfig,
                ...aiConfig,
                dataConfig: {
                    ...defaultOutcomeConfig.dataConfig,
                    ...(aiConfig.dataConfig || {})
                },
                chart: { ...defaultOutcomeConfig.chart, ...(aiConfig.chart || {}) },
                table: { ...defaultOutcomeConfig.table, ...(aiConfig.table || {}) },
            };
        } else {
            finalConfig = {
                ...defaultEngagementConfig,
                ...aiConfig,
                dataConfig: {
                    ...defaultEngagementConfig.dataConfig,
                    ...(aiConfig.dataConfig || {}),
                    metrics: {
                        ...defaultEngagementConfig.dataConfig.metrics,
                        ...(aiConfig.dataConfig?.metrics || {})
                    },
                    filters: {
                        ...defaultEngagementConfig.dataConfig.filters,
                        ...(aiConfig.dataConfig?.filters || {})
                    }
                },
                chart: { ...defaultEngagementConfig.chart, ...(aiConfig.chart || {}) },
                table: { ...defaultEngagementConfig.table, ...(aiConfig.table || {}) },
            };
        }

        console.log("Final, validated config object being sent to frontend:", JSON.stringify(finalConfig, null, 2));
        return NextResponse.json({ config: finalConfig });

    } catch (error) {
        console.error("Error in chat config generation:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return new NextResponse(JSON.stringify({ error: 'Failed to generate report configuration.', details: errorMessage }), { status: 500 });
    }
  }
}