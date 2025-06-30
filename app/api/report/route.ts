// app/api/report/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// --- HELPER FUNCTIONS ---
const sanitizeForSql = (value: string) => value.replace(/'/g, "\\'");

const getTimePeriodClause = (timePeriod: string, timestampColumn: string = 'timestamp'): string => {
  const now = new Date();
  switch (timePeriod) {
    case 'this_year':
      return ` AND ${timestampColumn} >= TIMESTAMP('${now.getFullYear()}-01-01') AND ${timestampColumn} < TIMESTAMP('${now.getFullYear() + 1}-01-01')`;
    case 'last_quarter':
      return ` AND ${timestampColumn} >= TIMESTAMP(DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 QUARTER), QUARTER)) AND ${timestampColumn} < TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), QUARTER))`;
    case 'last_month':
       return ` AND ${timestampColumn} >= TIMESTAMP(DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH)) AND ${timestampColumn} < TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), MONTH))`;
    default:
      return '';
  }
};

// --- MAIN API HANDLER ---
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== process.env.NEXT_PUBLIC_API_SECRET_KEY) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const config = await request.json();
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || '{}');
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) { throw new Error("GCP_PROJECT_ID environment variable not set."); }
    const bigquery = new BigQuery({ projectId, credentials });
    
    const stagesTable = `\`${projectId}.dreamdata_demo.stages\``;
    const companiesTable = `\`${projectId}.dreamdata_demo.companies\``;

    if (config.reportArchetype === 'engagement_analysis') {
      // Return empty for now as we are focusing on Outcome Analysis
      return NextResponse.json({ kpiData: {}, chartData: [] });

    } else { // --- OUTCOME ANALYSIS LOGIC ---
      
      const hasFilters = config.selectedCountries?.length > 0 || config.selectedEmployeeSizes?.length > 0;
      const needsCompanyJoin = hasFilters || config.reportFocus === 'segmentation' || (config.reportFocus === 'time_series' && config.chartMode === 'single_segmented');
      
      let fromClause = `FROM ${stagesTable} s`;
      if (needsCompanyJoin) {
          fromClause += ` LEFT JOIN ${companiesTable} c ON s.dd_company_id = c.dd_company_id`;
      }
      
      let whereClause = "WHERE 1=1";
      whereClause += getTimePeriodClause(config.timePeriod, 's.timestamp');
      if(config.selectedCountries?.length > 0) whereClause += ` AND c.properties.country IN (${config.selectedCountries.map((c:string) => `'${sanitizeForSql(c)}'`).join(',')})`;
      if(config.selectedEmployeeSizes?.length > 0) whereClause += ` AND c.properties.number_of_employees IN (${config.selectedEmployeeSizes.map((s:string) => `'${sanitizeForSql(s)}'`).join(',')})`;
      
      const kpiSelects = Object.entries(config.selectedMetrics).flatMap(([stage, types]) =>
        (types as string[]).map(type => {
          const sanitizedAlias = `${stage.replace(/\s/g, '_')}_${type}`;
          if (type === 'deals') return `COUNT(DISTINCT CASE WHEN s.stage_name = '${sanitizeForSql(stage)}' THEN s.dd_stage_id ELSE NULL END) AS ${sanitizedAlias}`;
          if (type === 'value') return `SUM(CASE WHEN s.stage_name = '${sanitizeForSql(stage)}' THEN s.value ELSE 0 END) AS ${sanitizedAlias}`;
          return '';
        })
      ).join(', ');
      
      const kpiQuery = kpiSelects ? `SELECT ${kpiSelects} ${fromClause} ${whereClause}` : '';

      let chartQuery = '';
      if (config.reportFocus === 'segmentation') {
        const segmentCol = config.segmentationProperty === 'companyCountry' ? 'c.properties.country' : 'c.properties.number_of_employees';
        // FIX: Build selects based on chart settings, not all available metrics
        const chartSelects = config.multiChartMetrics.map((metric: string) => {
            const sanitizedAlias = metric.replace(/\s/g, '_');
            const [rawStage, type] = metric.split(/_(deals|value)$/);
            if (type === 'deals') return `COUNT(DISTINCT CASE WHEN s.stage_name = '${sanitizeForSql(rawStage)}' THEN s.dd_stage_id ELSE NULL END) AS ${sanitizedAlias}`;
            if (type === 'value') return `SUM(CASE WHEN s.stage_name = '${sanitizeForSql(rawStage)}' THEN s.value ELSE 0 END) AS ${sanitizedAlias}`;
            return '';
        }).join(', ');

        chartQuery = chartSelects ? `SELECT ${segmentCol} as segment, ${chartSelects} ${fromClause} ${whereClause} GROUP BY segment HAVING segment IS NOT NULL ORDER BY segment` : '';
      } else { // time_series
        // FIX: Format the timestamp to a string to avoid date parsing issues on the frontend
        const monthSelect = `FORMAT_TIMESTAMP('%Y-%m-%d', DATE_TRUNC(s.timestamp, MONTH)) as month`;

        if (config.chartMode === 'single_segmented') {
          const [rawStage, type] = config.singleChartMetric.split(/_(deals|value)$/);
          const metricSelect = type === 'deals' ? `COUNT(DISTINCT s.dd_stage_id)` : `SUM(s.value)`;
          const segmentCol = config.segmentationProperty === 'companyCountry' ? 'c.properties.country' : 'c.properties.number_of_employees';
          chartQuery = `
            SELECT ${monthSelect}, ${segmentCol} as segment, ${metricSelect} as value
            ${fromClause}
            ${whereClause} AND s.stage_name = '${sanitizeForSql(rawStage)}'
            GROUP BY month, segment HAVING segment IS NOT NULL ORDER BY month
          `;
        } else { // multi_metric
          const chartSelects = config.multiChartMetrics.map((metric: string) => {
            const sanitizedAlias = metric.replace(/\s/g, '_');
            const [rawStage, type] = metric.split(/_(deals|value)$/);
            if (type === 'deals') return `COUNT(DISTINCT CASE WHEN s.stage_name = '${sanitizeForSql(rawStage)}' THEN s.dd_stage_id ELSE NULL END) AS ${sanitizedAlias}`;
            if (type === 'value') return `SUM(CASE WHEN s.stage_name = '${sanitizeForSql(rawStage)}' THEN s.value ELSE 0 END) AS ${sanitizedAlias}`;
            return '';
          }).join(', ');
          chartQuery = chartSelects ? `SELECT ${monthSelect}, ${chartSelects} ${fromClause} ${whereClause} GROUP BY month ORDER BY month` : '';
        }
      }

      const [[kpiResults]] = kpiQuery ? await bigquery.query(kpiQuery) : [[]];
      const [chartResults] = chartQuery ? await bigquery.query(chartQuery) : [[]];
      
      return NextResponse.json({ kpiData: kpiResults, chartData: chartResults });
    }

  } catch (error) {
    console.error("Failed to process report request:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: 'Failed to process report request', details: errorMessage }), { status: 500 });
  }
}