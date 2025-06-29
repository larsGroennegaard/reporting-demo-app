// app/api/report/route.ts
import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

export async function POST(request: Request) {
  const config = await request.json();
  const { selectedMetrics } = config;

  // Exit early if no metrics are selected
  if (!selectedMetrics || Object.keys(selectedMetrics).length === 0) {
    return NextResponse.json({ kpiData: {}, chartData: [] });
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || '{}');
    const projectId = process.env.GCP_PROJECT_ID;
    const bigquery = new BigQuery({ projectId, credentials });

    // --- DYNAMIC SQL GENERATION ---

    // 1. Build a list of all metrics to calculate, e.g., "NewBiz_value", "SQL_deals"
    const metricsToCalculate = Object.entries(config.selectedMetrics).flatMap(([stage, types]) =>
      (types as string[]).map(type => `${stage}_${type}`)
    );

    // 2. Create the conditional aggregation part of the SELECT clause
    // This creates a SUM or COUNT for each requested metric
    const selections = metricsToCalculate.map(metric => {
      const [stageName, metricType] = metric.split('_');
      if (metricType === 'value') {
        return `ROUND(SUM(IF(s.stage_name = '${stageName}', s.value, 0)), 2) AS ${metric}`;
      } else { // 'deals'
        return `COUNT(DISTINCT IF(s.stage_name = '${stageName}', s.dd_stage_id, NULL)) AS ${metric}`;
      }
    }).join(',\n        ');

    // 3. Generate filter clauses (same as before)
    const queryParams: any = {};
    let timeFilter = '';
    switch (config.timePeriod) {
        case 'last_month': timeFilter = `AND s.timestamp >= TIMESTAMP(DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH)) AND s.timestamp < TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), MONTH))`; break;
        case 'last_quarter': timeFilter = `AND s.timestamp >= TIMESTAMP(DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 QUARTER), QUARTER)) AND s.timestamp < TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), QUARTER))`; break;
        case 'this_year': timeFilter = `AND s.timestamp >= TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), YEAR)) AND s.timestamp < TIMESTAMP(DATE_ADD(DATE_TRUNC(CURRENT_DATE(), YEAR), INTERVAL 1 YEAR))`; break;
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
    
    const fromAndJoins = `FROM \`${projectId}.dreamdata_demo.stages\` AS s LEFT JOIN \`${projectId}.dreamdata_demo.companies\` AS c ON s.dd_company_id = c.dd_company_id`;
    const whereClause = `WHERE 1=1 ${timeFilter} ${countryFilter} ${employeeFilter}`;

    // 4. Build the two queries (KPI and Chart) using these dynamic parts
    const kpiQuery = `SELECT ${selections} ${fromAndJoins} ${whereClause}`;
    const timeSeriesQuery = `SELECT DATE_TRUNC(s.timestamp, MONTH) as month, ${selections} ${fromAndJoins} ${whereClause} GROUP BY month ORDER BY month ASC`;

    const kpiOptions = { query: kpiQuery, location: 'EU', params: queryParams };
    const timeSeriesOptions = { query: timeSeriesQuery, location: 'EU', params: queryParams };

    console.log("--- Executing KPI Query ---", kpiOptions.query);
    const [[kpiRows], [timeSeriesRows]] = await Promise.all([
        bigquery.query(kpiOptions),
        bigquery.query(timeSeriesOptions)
    ]);
    
    const kpiData = kpiRows[0] || {};
    const chartData = timeSeriesRows.map(row => ({
        ...row,
        month: row.month ? new Date(row.month.value).toISOString() : null,
    }));

    return NextResponse.json({ kpiData, chartData });

  } catch (error) {
    console.error("BigQuery query failed:", error);
    return new NextResponse(JSON.stringify({ error: 'Failed to query database' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}