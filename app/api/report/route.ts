// app/api/report/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// --- HELPER FUNCTIONS ---

/**
 * Creates a time period filter for BigQuery SQL.
 * @param timePeriod - The time period string (e.g., 'this_year', 'last_quarter').
 * @param timestampColumn - The name of the timestamp column in the table.
 * @returns A SQL WHERE clause string.
 */
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

/**
 * Builds the common WHERE clause for Engagement Analysis queries.
 * @param config - The report configuration object.
 * @returns A SQL WHERE clause string.
 */
const buildEngagementWhereClause = (config: any): string => {
  let whereClauses = "WHERE 1=1";
  whereClauses += getTimePeriodClause(config.timePeriod, 'e.timestamp');

  if (config.filters?.eventNames?.length > 0) {
    whereClauses += ` AND e.event_name IN (${config.filters.eventNames.map((e: string) => `'${e}'`).join(',')})`;
  }
  if (config.filters?.signals?.length > 0) {
    whereClauses += ` AND EXISTS (SELECT 1 FROM UNNEST(e.signals) s WHERE s.name IN (${config.filters.signals.map((s: string) => `'${s}'`).join(',')}))`;
  }
  if (config.filters?.url) {
    whereClauses += ` AND e.event.url_clean LIKE '%${config.filters.url}%'`;
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

    if (!projectId) {
      throw new Error("GCP_PROJECT_ID environment variable not set.");
    }

    const bigquery = new BigQuery({ projectId, credentials });
    const eventsTable = `\`${projectId}.dreamdata_demo.events\``;
    const companiesTable = `\`${projectId}.dreamdata_demo.companies\``;

    // --- Engagement Analysis Logic ---
    if (config.reportArchetype === 'engagement_analysis') {
      const whereClause = buildEngagementWhereClause(config);
      const allMetrics = [...config.metrics.base, ...Object.keys(config.metrics.influenced).flatMap((stage: string) => config.metrics.influenced[stage].map((type: string) => `influenced_${stage}_${type}`))]

      // --- KPI Query ---
      let kpiSelects = new Set<string>();
      if(config.metrics.base.includes('companies')) kpiSelects.add('COUNT(DISTINCT e.dd_company_id) AS companies');
      if(config.metrics.base.includes('contacts')) kpiSelects.add('COUNT(DISTINCT e.dd_contact_id) AS contacts');
      if(config.metrics.base.includes('events')) kpiSelects.add('COUNT(DISTINCT e.dd_event_id) AS events');
      
      let influencedJoins = '';
      Object.keys(config.metrics.influenced).forEach(stage => {
          const stageAlias = stage.replace(/\s/g, '');
          influencedJoins += ` LEFT JOIN UNNEST(e.stages) AS s_${stageAlias} ON s_${stageAlias}.name = '${stage}'`;
          if(config.metrics.influenced[stage].includes('deals')) kpiSelects.add(`COUNT(DISTINCT s_${stageAlias}.dd_stage_id) AS influenced_${stage}_deals`);
          if(config.metrics.influenced[stage].includes('value')) kpiSelects.add(`SUM(s_${stageAlias}.value) AS influenced_${stage}_value`);
      });

      const kpiQuery = `
        SELECT ${Array.from(kpiSelects).join(', ')}
        FROM ${eventsTable} AS e
        ${influencedJoins}
        ${whereClause}
      `;

      // --- Chart Query ---
      let chartQuery = '';
      if (config.reportFocus === 'segmentation') {
          const segmentCol = config.segmentationProperty === 'companyCountry' ? 'c.properties.country' : 'c.properties.number_of_employees';
          let chartSelects = new Set<string>();
          if(allMetrics.includes('companies')) chartSelects.add('COUNT(DISTINCT e.dd_company_id) AS companies');
          if(allMetrics.includes('contacts')) chartSelects.add('COUNT(DISTINCT e.dd_contact_id) AS contacts');
          if(allMetrics.includes('events')) chartSelects.add('COUNT(DISTINCT e.dd_event_id) AS events');

          chartQuery = `
              SELECT ${segmentCol} as segment, ${Array.from(chartSelects).join(', ')}
              FROM ${eventsTable} e LEFT JOIN ${companiesTable} c ON e.dd_company_id = c.dd_company_id
              ${whereClause}
              GROUP BY segment
              ORDER BY segment
          `;
      } else { // time_series
          if (config.chartMode === 'single_segmented') {
              const metric = config.singleChartMetric;
              const segmentCol = config.segmentationProperty === 'companyCountry' ? 'c.properties.country' : 'c.properties.number_of_employees';
              let metricSelect = '';
              if (metric === 'companies') metricSelect = 'COUNT(DISTINCT e.dd_company_id)';
              if (metric === 'contacts') metricSelect = 'COUNT(DISTINCT e.dd_contact_id)';
              if (metric === 'events') metricSelect = 'COUNT(DISTINCT e.dd_event_id)';
              // Add influenced logic here if needed

              chartQuery = `
                  SELECT DATE_TRUNC(e.timestamp, MONTH) as month, ${segmentCol} as segment, ${metricSelect} as value
                  FROM ${eventsTable} e LEFT JOIN ${companiesTable} c ON e.dd_company_id = c.dd_company_id
                  ${whereClause}
                  GROUP BY month, segment
                  ORDER BY month
              `;
          } else { // multi_metric
              let chartSelects = new Set<string>();
              config.multiChartMetrics.forEach((m: string) => {
                  if (m === 'companies') chartSelects.add('COUNT(DISTINCT e.dd_company_id) AS companies');
                  if (m === 'contacts') chartSelects.add('COUNT(DISTINCT e.dd_contact_id) AS contacts');
                  if (m === 'events') chartSelects.add('COUNT(DISTINCT e.dd_event_id) AS events');
              })
              chartQuery = `
                  SELECT DATE_TRUNC(e.timestamp, MONTH) as month, ${Array.from(chartSelects).join(', ')}
                  FROM ${eventsTable} e
                  ${whereClause}
                  GROUP BY month
                  ORDER BY month
              `;
          }
      }
      
      // Execute queries
      const [[kpiResults]] = await bigquery.query(kpiQuery);
      const [chartResults] = await bigquery.query(chartQuery);

      return NextResponse.json({ kpiData: kpiResults, chartData: chartResults });
    }

    // --- Fallback for Outcome Analysis or other types (currently does nothing) ---
    // The existing logic for Outcome Analysis would go here.
    // For now, we return empty data to prevent errors.
    const [[kpiResults]] = await bigquery.query(`SELECT 1 as test`);
    const [chartResults] = await bigquery.query(`SELECT 1 as test`);

    return NextResponse.json({ kpiData: {test: 1}, chartData: [{test: 1}] });

  } catch (error) {
    console.error("Failed to process report request:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: 'Failed to process report request', details: errorMessage }), { status: 500 });
  }
}