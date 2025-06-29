// app/api/report/route.ts
import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const segmentationSqlMapping: Record<string, string> = {
  companyCountry: 'c.properties.country',
  numberOfEmployees: 'c.properties.number_of_employees',
};

const buildMetricAggregation = (metric: string, alias: string = ''): string => {
    const [stageName, metricType] = metric.split('_');
    const finalAlias = alias || metric;
    if (metricType === 'value') { return `ROUND(SUM(IF(s.stage_name = '${stageName}', s.value, 0)), 2) AS \`${finalAlias}\``; }
    return `COUNT(DISTINCT IF(s.stage_name = '${stageName}', s.dd_stage_id, NULL)) AS \`${finalAlias}\``;
};

export async function POST(request: Request) {
  const config = await request.json();

  try {
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

    // --- UPDATED: Filter logic now handles arrays ---
    let countryFilter = '';
    if (config.selectedCountries && config.selectedCountries.length > 0) {
      countryFilter = `AND c.properties.country IN UNNEST(@countries)`;
      queryParams.countries = config.selectedCountries;
    }
    let employeeFilter = '';
    if (config.selectedEmployeeSizes && config.selectedEmployeeSizes.length > 0) {
      employeeFilter = `AND c.properties.number_of_employees IN UNNEST(@employeeSizes)`;
      queryParams.employeeSizes = config.selectedEmployeeSizes;
    }
    
    // ... (The rest of the query building and execution logic remains the same) ...
    const fromAndJoins = `FROM \`${projectId}.dreamdata_demo.stages\` AS s LEFT JOIN \`${projectId}.dreamdata_demo.companies\` AS c ON s.dd_company_id = c.dd_company_id`;
    const baseWhereClause = `WHERE 1=1 ${timeFilter} ${countryFilter} ${employeeFilter}`;
    
    let kpiData: any = {};
    let chartData: any[] = [];

    const kpiMetricsToCalc = Object.entries(config.selectedMetrics).flatMap(([stage, types]) => (types as string[]).map(type => `${stage}_${type}`));
    if (kpiMetricsToCalc.length > 0) {
        const kpiSelections = kpiMetricsToCalc.map(metric => buildMetricAggregation(metric)).join(',\n        ');
        const kpiQuery = `SELECT ${kpiSelections} ${fromAndJoins} ${baseWhereClause}`;
        const [[kpiResult]] = await bigquery.query({ query: kpiQuery, location: 'EU', params: queryParams });
        kpiData = kpiResult || {};
    }

    if (config.reportFocus === 'segmentation') {
        const segmentSql = segmentationSqlMapping[config.segmentationProperty];
        const multiMetricSelections = config.multiChartMetrics.map((metric: string) => buildMetricAggregation(metric)).join(',\n');
        if (multiMetricSelections) {
            const segmentationQuery = `SELECT ${segmentSql} as segment, ${multiMetricSelections} ${fromAndJoins} ${baseWhereClause} AND ${segmentSql} IS NOT NULL GROUP BY segment ORDER BY segment ASC`;
            const [segmentationRows] = await bigquery.query({ query: segmentationQuery, location: 'EU', params: queryParams });
            chartData = segmentationRows;
        }
    } else { 
        let timeSeriesQuery = '';
        if (config.chartMode === 'single_segmented') {
            const metricSql = buildMetricAggregation(config.singleChartMetric, 'value');
            const segmentSql = segmentationSqlMapping[config.segmentationProperty];
            timeSeriesQuery = `SELECT DATE_TRUNC(s.timestamp, MONTH) AS month, ${segmentSql} as segment, ${metricSql} ${fromAndJoins} ${baseWhereClause} AND ${segmentSql} IS NOT NULL GROUP BY month, segment ORDER BY month ASC, segment ASC`;
        } else {
            const multiMetricSelections = config.multiChartMetrics.map((metric: string) => buildMetricAggregation(metric)).join(',\n');
            if (multiMetricSelections) {
                timeSeriesQuery = `SELECT DATE_TRUNC(s.timestamp, MONTH) AS month, ${multiMetricSelections} ${fromAndJoins} ${baseWhereClause} GROUP BY month ORDER BY month ASC`;
            }
        }
        if (timeSeriesQuery) {
            const [timeSeriesRows] = await bigquery.query({ query: timeSeriesQuery, location: 'EU', params: queryParams });
            chartData = timeSeriesRows.map(row => ({...row, month: row.month ? new Date(row.month.value).toISOString() : null }));
        }
    }

    return NextResponse.json({ kpiData, chartData });
  } catch (error) {
    console.error("BigQuery query failed:", error);
    return new NextResponse(JSON.stringify({ error: 'Failed to query database' }), { status: 500 });
  }
}