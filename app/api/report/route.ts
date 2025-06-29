// app/api/report/route.ts
import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Helper objects to map user-friendly names to actual SQL code
const metricSqlMapping: Record<string, string> = {
  totalValue: 'ROUND(SUM(s.value), 2)',
  totalDeals: 'COUNT(DISTINCT s.dd_stage_id)',
  influencedValue: 'ROUND(SUM(s.value), 2)', // Using total value as per your logic
};

const segmentationSqlMapping: Record<string, string> = {
  companyCountry: 'c.properties.country',
  numberOfEmployees: 'c.properties.number_of_employees',
};

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

    // --- Dynamic Filter Generation (remains the same) ---
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
    
    const fromClause = `FROM \`${projectId}.dreamdata_demo.stages\` AS s LEFT JOIN \`${projectId}.dreamdata_demo.companies\` AS c ON s.dd_company_id = c.dd_company_id`;
    const whereClause = `WHERE s.stage_name = @outcome ${timeFilter} ${countryFilter} ${employeeFilter}`;

    // --- Query 1: For KPI Cards (remains the same) ---
    const kpiQuery = `SELECT ROUND(SUM(s.value), 2) AS totalValue, COUNT(DISTINCT s.dd_stage_id) as totalDeals, ROUND(SUM(s.value), 2) AS influencedValue ${fromClause} ${whereClause}`;

    // --- NEW: Query 2: Dynamic Chart Query Builder ---
    let timeSeriesQuery = '';
    if (config.chartMode === 'single_segmented') {
        const metricSql = metricSqlMapping[config.chartMetric] || metricSqlMapping.totalValue;
        const segmentSql = segmentationSqlMapping[config.segmentationProperty] || segmentationSqlMapping.companyCountry;
        
        timeSeriesQuery = `
            SELECT DATE_TRUNC(s.timestamp, MONTH) AS month, ${segmentSql} as segment, ${metricSql} AS value
            ${fromClause} ${whereClause}
            GROUP BY month, segment ORDER BY month ASC, segment ASC
        `;
    } else { // 'multi_metric' mode
        let selectedMetricsSql = Object.entries(config.multiMetrics)
            .filter(([, isSelected]) => isSelected)
            .map(([metricName]) => `${metricSqlMapping[metricName]} AS ${metricName}`)
            .join(', ');

        if (!selectedMetricsSql) { // If no metrics selected, select one by default
            selectedMetricsSql = `${metricSqlMapping.totalValue} AS totalValue`;
        }

        timeSeriesQuery = `
            SELECT DATE_TRUNC(s.timestamp, MONTH) AS month, ${selectedMetricsSql}
            ${fromClause} ${whereClause}
            GROUP BY month ORDER BY month ASC
        `;
    }
    
    // --- Run Queries ---
    const kpiOptions = { query: kpiQuery, location: 'EU', params: queryParams };
    const timeSeriesOptions = { query: timeSeriesQuery, location: 'EU', params: queryParams };

    console.log("--- Executing Time Series Query ---", timeSeriesOptions.query, timeSeriesOptions.params);
    const [[kpiRows], [timeSeriesRows]] = await Promise.all([
        bigquery.query(kpiOptions),
        bigquery.query(timeSeriesOptions)
    ]);
    console.log("--- Time Series Result ---", timeSeriesRows);
    
    const kpiData = { /* ... kpi data processing remains the same ... */ 
        totalValue: parseFloat(kpiRows[0]?.totalValue || 0),
        totalDeals: parseInt(kpiRows[0]?.totalDeals || '0', 10),
        influencedValue: parseFloat(kpiRows[0]?.influencedValue || 0)
    };
    
    // The chart data now has a different structure, we pass it on directly
    const chartData = timeSeriesRows.map(row => ({
        ...row,
        month: row.month ? new Date(row.month.value).toISOString() : null, // Standardize date format
    }));

    return NextResponse.json({ kpiData, chartData });

  } catch (error) {
    console.error("BigQuery query failed:", error);
    return new NextResponse(JSON.stringify({ error: 'Failed to query database' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}