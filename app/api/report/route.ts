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

    const queryParams: any = { outcome: config.outcome };

    let timeFilter = '';
    // ... (time filter logic remains the same)
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

    let employeeFilter = '';
    if (config.numberOfEmployees && config.numberOfEmployees !== 'all') {
      employeeFilter = `AND c.properties.number_of_employees = @numberOfEmployees`;
      queryParams.numberOfEmployees = config.numberOfEmployees;
    }

    // --- QUERY 1: For KPI Cards (Aggregate Data) ---
    const kpiQuery = `
      SELECT
        ROUND(SUM(s.value), 2) AS totalValue,
        COUNT(DISTINCT s.dd_stage_id) as totalDeals,
        ROUND(SUM(s.value), 2) AS influencedValue
      FROM \`${projectId}.dreamdata_demo.stages\` AS s
      LEFT JOIN \`${projectId}.dreamdata_demo.companies\` AS c ON s.dd_company_id = c.dd_company_id
      WHERE s.stage_name = @outcome ${timeFilter} ${countryFilter} ${employeeFilter}`;

    // --- QUERY 2: For Chart (Time-Series Data) ---
    const timeSeriesQuery = `
      SELECT
        DATE_TRUNC(s.timestamp, MONTH) AS month,
        ROUND(SUM(s.value), 2) AS value
      FROM \`${projectId}.dreamdata_demo.stages\` AS s
      LEFT JOIN \`${projectId}.dreamdata_demo.companies\` AS c ON s.dd_company_id = c.dd_company_id
      WHERE s.stage_name = @outcome ${timeFilter} ${countryFilter} ${employeeFilter}
      GROUP BY month ORDER BY month ASC`;

    const kpiOptions = { query: kpiQuery, location: 'EU', params: queryParams };
    const timeSeriesOptions = { query: timeSeriesQuery, location: 'EU', params: queryParams };

    console.log("--- Executing KPI Query ---", kpiOptions.query, kpiOptions.params);
    console.log("--- Executing Time Series Query ---", timeSeriesOptions.query, timeSeriesOptions.params);
    
    // Run both queries in parallel
    const [kpiResult, timeSeriesResult] = await Promise.all([
        bigquery.query(kpiOptions),
        bigquery.query(timeSeriesOptions)
    ]);
    
    const [kpiRows] = kpiResult;
    const [timeSeriesRows] = timeSeriesResult;

    console.log("--- KPI Result ---", kpiRows);
    console.log("--- Time Series Result ---", timeSeriesRows);

    const kpiData = {
        totalValue: parseFloat(kpiRows[0]?.totalValue || 0),
        totalDeals: parseInt(kpiRows[0]?.totalDeals || '0', 10),
        influencedValue: parseFloat(kpiRows[0]?.influencedValue || 0)
    };

    // Format the time-series data for the chart
    const chartData = timeSeriesRows.map(row => ({
        // Format the month for display, e.g., "Jan 2025"
        month: new Date(row.month.value).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        value: parseFloat(row.value)
    }));

    // Return both sets of data
    return NextResponse.json({ kpiData, chartData });

  } catch (error) {
    console.error("BigQuery query failed:", error);
    return new NextResponse(JSON.stringify({ error: 'Failed to query database' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}