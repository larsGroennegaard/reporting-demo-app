// app/api/report/route.ts
import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// ... (buildMetricAggregation helper function remains the same) ...
const buildMetricAggregation = (metric: string, alias: string = ''): string => {
    const [stageName, metricType] = metric.split('_');
    const finalAlias = alias || metric;
    if (metricType === 'value') { return `ROUND(SUM(IF(s.stage_name = '${stageName}', s.value, 0)), 2) AS ${finalAlias}`; }
    return `COUNT(DISTINCT IF(s.stage_name = '${stageName}', s.dd_stage_id, NULL)) AS ${finalAlias}`;
};

export async function POST(request: Request) {
  // --- NEW: Security Check ---
  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== process.env.NEXT_PUBLIC_API_SECRET_KEY) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const config = await request.json();
  // ... (the rest of the function remains the same)
  const { selectedMetrics } = config;

  if (!selectedMetrics || Object.keys(selectedMetrics).length === 0) {
    return NextResponse.json({ kpiData: {}, chartData: [] });
  }

  try {
    // ... (the entire try/catch block remains the same as before)
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || '{}');
    const projectId = process.env.GCP_PROJECT_ID;
    const bigquery = new BigQuery({ projectId, credentials });
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
    const kpiMetricsToCalc = Object.entries(config.selectedMetrics).flatMap(([stage, types]) => (types as string[]).map(type => `${stage}_${type}`));
    const kpiSelections = kpiMetricsToCalc.length > 0 ? kpiMetricsToCalc.map(metric => buildMetricAggregation(metric)).join(',\n        ') : 'SELECT 1';
    const kpiQuery = `SELECT ${kpiSelections} ${fromAndJoins} ${whereClause}`;
    let timeSeriesQuery = '';
    if (config.chartMode === 'single_segmented') {
        const metricSql = buildMetricAggregation(config.singleChartMetric, 'value');
        const segmentSql = segmentationSqlMapping[config.segmentationProperty];
        timeSeriesQuery = `SELECT DATE_TRUNC(s.timestamp, MONTH) AS month, ${segmentSql} as segment, ${metricSql} ${fromAndJoins} ${whereClause} AND ${segmentSql} IS NOT NULL GROUP BY month, segment ORDER BY month ASC, segment ASC`;
    } else { 
        const multiMetricSelections = config.multiChartMetrics.map((metric: string) => buildMetricAggregation(metric)).join(',\n');
        timeSeriesQuery = `SELECT DATE_TRUNC(s.timestamp, MONTH) AS month, ${multiMetricSelections} ${fromAndJoins} ${whereClause} GROUP BY month ORDER BY month ASC`;
    }
    const kpiOptions = { query: kpiQuery, location: 'EU', params: queryParams };
    const timeSeriesOptions = { query: timeSeriesQuery, location: 'EU', params: queryParams };
    console.log("--- Executing Time Series Query ---", timeSeriesOptions.query, timeSeriesOptions.params);
    const [[kpiRows], [timeSeriesRows]] = await Promise.all([
        kpiMetricsToCalc.length > 0 ? bigquery.query(kpiOptions) : Promise.resolve([[]]),
        timeSeriesQuery ? bigquery.query(timeSeriesOptions) : Promise.resolve([[]]),
    ]);
    console.log("--- Time Series Result ---", timeSeriesRows);
    const kpiData = kpiRows[0] || {};
    const chartData = timeSeriesRows.map(row => ({
        ...row,
        month: row.month ? new Date(row.month.value).toISOString() : null,
    }));
    return NextResponse.json({ kpiData, chartData });
  } catch (error) {
    console.error("BigQuery query failed:", error);
    return new NextResponse(JSON.stringify({ error: 'Failed to query database' }), { status: 500 });
  }
}

// NOTE: segmentationSqlMapping needs to be defined for the second query
const segmentationSqlMapping: Record<string, string> = {
  companyCountry: 'c.properties.country',
  numberOfEmployees: 'c.properties.number_of_employees',
};