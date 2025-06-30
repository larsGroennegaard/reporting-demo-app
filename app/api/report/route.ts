// app/api/report/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// --- HELPER FUNCTIONS ---

/**
 * Sanitizes a string for use in a SQL IN clause by escaping single quotes.
 * @param value The string to sanitize.
 * @returns The sanitized string.
 */
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

const buildEngagementWhereClause = (config: any, eventsAlias: string = 'e'): string => {
  let whereClauses = "WHERE 1=1";
  whereClauses += getTimePeriodClause(config.timePeriod, `${eventsAlias}.timestamp`);

  // FIX: Use sanitizer for all filter values
  if (config.filters?.eventNames?.length > 0) {
    whereClauses += ` AND ${eventsAlias}.event_name IN (${config.filters.eventNames.map((e: string) => `'${sanitizeForSql(e)}'`).join(',')})`;
  }
  if (config.filters?.signals?.length > 0) {
    whereClauses += ` AND EXISTS (SELECT 1 FROM UNNEST(${eventsAlias}.signals) s WHERE s.name IN (${config.filters.signals.map((s: string) => `'${sanitizeForSql(s)}'`).join(',')}))`;
  }
  if (config.filters?.url) {
    whereClauses += ` AND ${eventsAlias}.event.url_clean LIKE '%${sanitizeForSql(config.filters.url)}%'`;
  }
  return whereClauses;
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
    const eventsTable = `\`${projectId}.dreamdata_demo.events\``;


    // --- ROUTE BY REPORT ARCHETYPE ---
    if (config.reportArchetype === 'engagement_analysis') {
      const whereClause = buildEngagementWhereClause(config, 'e');
      
      let kpiSelects = new Set<string>();
      if(config.metrics.base.includes('companies')) kpiSelects.add('COUNT(DISTINCT e.dd_company_id) AS companies');
      if(config.metrics.base.includes('contacts')) kpiSelects.add('COUNT(DISTINCT e.dd_contact_id) AS contacts');
      if(config.metrics.base.includes('events')) kpiSelects.add('COUNT(DISTINCT e.dd_event_id) AS events');
      
      let influencedJoins = '';
      Object.keys(config.metrics.influenced).forEach(stage => {
          const sanitizedStage = stage.replace(/\s/g, '_');
          influencedJoins += ` LEFT JOIN UNNEST(e.stages) AS s_${sanitizedStage} ON s_${sanitizedStage}.name = '${sanitizeForSql(stage)}'`;
          if(config.metrics.influenced[stage].includes('deals')) kpiSelects.add(`COUNT(DISTINCT s_${sanitizedStage}.dd_stage_id) AS influenced_${sanitizedStage}_deals`);
          if(config.metrics.influenced[stage].includes('value')) kpiSelects.add(`SUM(s_${sanitizedStage}.value) AS influenced_${sanitizedStage}_value`);
      });

      const kpiQuery = kpiSelects.size > 0 ? `SELECT ${Array.from(kpiSelects).join(', ')} FROM ${eventsTable} AS e ${influencedJoins} ${whereClause}` : '';

      // Chart query logic would go here...
      const chartQuery = '';
      
      const [[kpiResults]] = kpiQuery ? await bigquery.query(kpiQuery) : [[]];
      const chartResults: any[] = []; // Placeholder

      return NextResponse.json({ kpiData: kpiResults, chartData: chartResults });

    } else { // --- OUTCOME ANALYSIS LOGIC ---
      
      const hasFilters = config.selectedCountries?.length > 0 || config.selectedEmployeeSizes?.length > 0;
      let fromClause = `FROM ${stagesTable} s`;
      if (hasFilters) {
          fromClause += ` LEFT JOIN ${companiesTable} c ON s.dd_company_id = c.dd_company_id`;
      }
      
      let whereClause = "WHERE 1=1";
      whereClause += getTimePeriodClause(config.timePeriod, 's.timestamp');
      // FIX: Use sanitizer for all filter values
      if(config.selectedCountries?.length > 0) whereClause += ` AND c.properties.country IN (${config.selectedCountries.map((c:string) => `'${sanitizeForSql(c)}'`).join(',')})`;
      if(config.selectedEmployeeSizes?.length > 0) whereClause += ` AND c.properties.number_of_employees IN (${config.selectedEmployeeSizes.map((s:string) => `'${sanitizeForSql(s)}'`).join(',')})`;
      
      // KPI Query
      const kpiSelects = Object.entries(config.selectedMetrics).flatMap(([stage, types]) =>
        (types as string[]).map(type => {
          // FIX: Sanitize stage name to create a valid SQL alias
          const sanitizedAlias = `${stage.replace(/\s/g, '_')}_${type}`;
          if (type === 'deals') return `COUNT(DISTINCT CASE WHEN s.stage_name = '${sanitizeForSql(stage)}' THEN s.dd_stage_id ELSE NULL END) AS ${sanitizedAlias}`;
          if (type === 'value') return `SUM(CASE WHEN s.stage_name = '${sanitizeForSql(stage)}' THEN s.value ELSE 0 END) AS ${sanitizedAlias}`;
          return '';
        })
      ).join(', ');
      
      const kpiQuery = `SELECT ${kpiSelects} ${fromClause} ${whereClause}`;

      // Chart Query
      let chartQuery = '';
      if (config.reportFocus === 'segmentation') {
        const segmentCol = config.segmentationProperty === 'companyCountry' ? 'c.properties.country' : 'c.properties.number_of_employees';
        chartQuery = `SELECT ${segmentCol} as segment, ${kpiSelects} ${fromClause} ${whereClause} GROUP BY segment HAVING segment IS NOT NULL ORDER BY segment`;
      } else { // time_series
        if (config.chartMode === 'single_segmented') {
          const [stage, type] = config.singleChartMetric.split('_');
          const metricSelect = type === 'deals' ? `COUNT(DISTINCT s.dd_stage_id)` : `SUM(s.value)`;
          const segmentCol = config.segmentationProperty === 'companyCountry' ? 'c.properties.country' : 'c.properties.number_of_employees';
          chartQuery = `
            SELECT DATE_TRUNC(s.timestamp, MONTH) as month, ${segmentCol} as segment, ${metricSelect} as value
            ${fromClause}
            ${whereClause} AND s.stage_name = '${sanitizeForSql(stage)}'
            GROUP BY month, segment HAVING segment IS NOT NULL ORDER BY month
          `;
        } else { // multi_metric
          const chartSelects = config.multiChartMetrics.map((metric: string) => {
            const [rawStage, type] = metric.split(/_(deals|value)$/);
            const sanitizedAlias = metric.replace(/\s/g, '_');
            if (type === 'deals') return `COUNT(DISTINCT CASE WHEN s.stage_name = '${sanitizeForSql(rawStage)}' THEN s.dd_stage_id ELSE NULL END) AS ${sanitizedAlias}`;
            if (type === 'value') return `SUM(CASE WHEN s.stage_name = '${sanitizeForSql(rawStage)}' THEN s.value ELSE 0 END) AS ${sanitizedAlias}`;
            return '';
          }).join(', ');
          chartQuery = `SELECT DATE_TRUNC(s.timestamp, MONTH) as month, ${chartSelects} ${fromClause} ${whereClause} GROUP BY month ORDER BY month`;
        }
      }

      const [[kpiResults]] = kpiSelects ? await bigquery.query(kpiQuery) : [[]];
      const [chartResults] = chartQuery ? await bigquery.query(chartQuery) : [[]];
      
      return NextResponse.json({ kpiData: kpiResults, chartData: chartResults });
    }

  } catch (error) {
    console.error("Failed to process report request:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: 'Failed to process report request', details: errorMessage }), { status: 500 });
  }
}