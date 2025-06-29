// app/api/report/route.ts
import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

export async function POST(request: Request) {
  const config = await request.json();

  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || '{}');
    const projectId = process.env.GCP_PROJECT_ID;

    const bigquery = new BigQuery({
      projectId: projectId,
      credentials: credentials,
    });

    // --- DYNAMIC SQL GENERATION ---

    // 1. Create a dynamic time filter based on the configuration
    let timeFilter = '';
    switch (config.timePeriod) {
      case 'last_month':
        timeFilter = `AND s.timestamp >= TIMESTAMP(DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH)) AND s.timestamp < TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), MONTH))`;
        break;
      case 'last_quarter':
        timeFilter = `AND s.timestamp >= TIMESTAMP(DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 QUARTER), QUARTER)) AND s.timestamp < TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), QUARTER))`;
        break;
      case 'this_year':
        timeFilter = `AND s.timestamp >= TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), YEAR)) AND s.timestamp < TIMESTAMP(DATE_ADD(DATE_TRUNC(CURRENT_DATE(), YEAR), INTERVAL 1 YEAR))`;
        break;
    }

    // 2. Build the main SQL query using the real table names and dynamic filters
    // NOTE: We are making an assumption that 'influencedValue' can be calculated from a column
    // and that 'totalDeals' is the count of distinct companies for that stage.
    // We will use placeholders for now.
    const sqlQuery = `
      SELECT
        FORMAT("%.2f", SUM(s.value)) as totalValue,
        FORMAT("%.2f", 0) as influencedValue,  -- Placeholder for influenced value
        COUNT(DISTINCT s.dd_company_id) as totalDeals
      FROM
        \`${projectId}.dreamdata_demo.stages\` AS s
      WHERE
        s.stage_name = @outcome
        ${timeFilter} 
    `;

    const options = {
      query: sqlQuery,
      location: 'EU', // Make sure this matches your dataset's location
      params: {
        outcome: config.outcome,
      },
    };
    
    // Execute the query and return the result
    const [rows] = await bigquery.query(options);
    return NextResponse.json(rows[0] || {});

  } catch (error) {
    console.error("BigQuery query failed:", error);
    return new NextResponse(JSON.stringify({ error: 'Failed to query database' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}