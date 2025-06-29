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

    const queryParams: { outcome: string; country?: string } = {
      outcome: config.outcome,
    };

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

    let countryFilter = '';
    if (config.companyCountry && config.companyCountry !== 'all') {
      countryFilter = `AND c.properties.country = @country`;
      queryParams.country = config.companyCountry;
    }

    const sqlQuery = `
      SELECT
        ROUND(SUM(s.value), 2) AS totalValue,
        COUNT(DISTINCT s.dd_stage_id) as totalDeals,
        ROUND(SUM(s.value), 2) AS influencedValue
      FROM
        \`${projectId}.dreamdata_demo.stages\` AS s
        LEFT JOIN \`${projectId}.dreamdata_demo.companies\` AS c ON s.dd_company_id = c.dd_company_id
      WHERE
        s.stage_name = @outcome
        ${timeFilter}
        ${countryFilter}
    `;

    const options = {
      query: sqlQuery,
      location: 'EU',
      params: queryParams,
    };
    
    console.log("--- Executing BigQuery Query ---");
    console.log("SQL:", options.query);
    console.log("Params:", options.params);
    
    const [rows] = await bigquery.query(options);

    console.log("--- Raw Result from BigQuery ---");
    console.log(rows);

    const result = rows[0] || {};
    // Parse the data into numbers and return them directly.
    // The frontend KpiCard component will handle the currency formatting.
    const numericResult = {
        totalValue: parseFloat(result.totalValue || 0),
        totalDeals: parseInt(result.totalDeals || '0', 10),
        influencedValue: parseFloat(result.influencedValue || 0)
    };
    
    return NextResponse.json(numericResult);

  } catch (error) {
    console.error("BigQuery query failed:", error);
    return new NextResponse(JSON.stringify({ error: 'Failed to query database' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}