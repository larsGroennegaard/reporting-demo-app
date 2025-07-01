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

const buildEngagementWhereClause = (config: any, eventsAlias: string = 'e'): string => {
  let whereClauses = `WHERE 1=1 ${getTimePeriodClause(config.timePeriod, `${eventsAlias}.timestamp`)}`;
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


    if (config.reportArchetype === 'engagement_analysis') {
      const whereClause = buildEngagementWhereClause(config, 'e');
      
      const kpiQuery = _buildEngagementKpiQuery(config, eventsTable, whereClause);

      // --- Chart Query Logic ---
      let chartQuery = '';
      const rawChartMetrics = config.chartMode === 'single_segmented' ? [config.singleChartMetric] : config.multiChartMetrics;
      const chartMetrics: string[] = Array.isArray(rawChartMetrics) ? rawChartMetrics.filter((m): m is string => typeof m === 'string' && m.length > 0) : [];
      
      const getMetricSelect = (metric: string, isBreakdownChart: boolean = false) => {
        const alias = isBreakdownChart ? 'value' : metric.replace(/\s/g, '_');
        if (metric.startsWith('influenced_') && metric.endsWith('_deals')) {
            const rawStage = metric.replace('influenced_', '').replace(/_deals/g, '');
            const sanitizedStageAlias = rawStage.replace(/\s/g, '_');
            return `COUNT(DISTINCT s_${sanitizedStageAlias}.dd_stage_id) AS ${alias}`;
        }
        if(metric === 'companies') return `COUNT(DISTINCT e.dd_company_id) AS ${alias}`;
        if(metric === 'contacts') return `COUNT(DISTINCT e.dd_contact_id) AS ${alias}`;
        if(metric === 'events') return `COUNT(DISTINCT e.dd_event_id) AS ${alias}`;
        if(metric === 'sessions') return `COUNT(DISTINCT e.dd_session_id) AS ${alias}`;
        return '';
      }

      const getMetricAggregation = (metric: string) => {
        if (metric.startsWith('influenced_') && metric.endsWith('_deals')) {
            const rawStage = metric.replace('influenced_', '').replace(/_deals/g, '');
            const sanitizedStageAlias = rawStage.replace(/\s/g, '_');
            return `COUNT(DISTINCT s_${sanitizedStageAlias}.dd_stage_id)`;
        }
        if(metric === 'companies') return `COUNT(DISTINCT e.dd_company_id)`;
        if(metric === 'contacts') return `COUNT(DISTINCT e.dd_contact_id)`;
        if(metric === 'events') return `COUNT(DISTINCT e.dd_event_id)`;
        if(metric === 'sessions') return `COUNT(DISTINCT e.dd_session_id)`;
        return 'NULL';
      }
      
      if (config.reportFocus === 'segmentation' && chartMetrics.length > 0) {
        const needsCompanyJoin = true;
        let fromClause = `FROM ${eventsTable} e`;
        if (needsCompanyJoin) fromClause += ` LEFT JOIN ${companiesTable} c ON e.dd_company_id = c.dd_company_id`;
        
        const primaryMetricAggregation = getMetricAggregation(chartMetrics[0]);
        const segmentCol = config.segmentationProperty === 'companyCountry' ? 'c.properties.country' : 'c.properties.number_of_employees';
        const chartSelects = chartMetrics.map((m: string) => getMetricSelect(m)).filter(Boolean).join(', ');
        
        chartQuery = `
          WITH AllSegments AS (
            SELECT ${segmentCol} as segment, ${chartSelects}
            ${fromClause}
            ${whereClause}
            GROUP BY segment
            HAVING segment IS NOT NULL
          )
          SELECT * FROM AllSegments
          ORDER BY ${primaryMetricAggregation} DESC
          LIMIT 10
        `;

      } else if (config.reportFocus === 'time_series' && chartMetrics.length > 0) {
        if (config.chartMode === 'single_segmented') {
            const metric = config.singleChartMetric;
            const segmentCol = config.segmentationProperty === 'companyCountry' ? 'c.properties.country' : 'c.properties.number_of_employees';
            let fromClause = `FROM ${eventsTable} e LEFT JOIN ${companiesTable} c ON e.dd_company_id = c.dd_company_id`;
            let metricAggregation = getMetricAggregation(metric);

            if (metric.startsWith('influenced_')) {
                const rawStage = metric.replace('influenced_', '').replace(/_deals/g, '');
                const sanitizedStageAlias = rawStage.replace(/\s/g, '_');
                fromClause += ` LEFT JOIN UNNEST(e.stages) AS s_${sanitizedStageAlias} ON s_${sanitizedStageAlias}.name = '${sanitizeForSql(rawStage)}'`;
            }

            chartQuery = `
                WITH TopSegments AS (
                    SELECT ${segmentCol} AS segment
                    ${fromClause}
                    ${whereClause}
                    AND ${segmentCol} IS NOT NULL
                    GROUP BY segment
                    ORDER BY ${metricAggregation} DESC
                    LIMIT 10
                ),
                MonthlyData AS (
                    SELECT
                        DATE_TRUNC(e.timestamp, MONTH) AS month,
                        ${segmentCol} AS segment,
                        ${metricAggregation} AS value
                    ${fromClause}
                    ${whereClause}
                    GROUP BY month, segment
                )
                SELECT
                    FORMAT_TIMESTAMP('%Y-%m-%d', md.month) AS month,
                    md.segment,
                    md.value
                FROM MonthlyData AS md
                INNER JOIN TopSegments AS ts ON md.segment = ts.segment
                ORDER BY month, value DESC
            `;
        } else { // multi_metric
             const baseChartMetrics = chartMetrics.filter((m: string) => !m.startsWith('influenced_'));
             const influencedChartMetrics = chartMetrics.filter((m: string) => m.startsWith('influenced_'));
             const ctes = [];
             let finalSelects = [`FORMAT_TIMESTAMP('%Y-%m-%d', month) as month`];
             let finalFrom = '';
             let finalJoin = '';
             if(baseChartMetrics.length > 0) {
                 const baseSelects = baseChartMetrics.map((m: string) => {
                     if(m === 'companies') return `COUNT(DISTINCT dd_company_id) AS companies`;
                     if(m === 'contacts') return `COUNT(DISTINCT dd_contact_id) AS contacts`;
                     if(m === 'events') return `COUNT(DISTINCT dd_event_id) AS events`;
                     if(m === 'sessions') return `COUNT(DISTINCT dd_session_id) AS sessions`;
                     return '';
                 }).join(', ');
                 ctes.push(`MonthlyBaseMetrics AS (SELECT DATE_TRUNC(timestamp, MONTH) AS month, ${baseSelects} FROM ${eventsTable} e ${whereClause} GROUP BY 1)`);
                 finalFrom = 'MonthlyBaseMetrics mbm';
                 finalSelects.push(...baseChartMetrics.map((m: string) => `COALESCE(mbm.${m}, 0) AS ${m}`));
             }
             if(influencedChartMetrics.length > 0) {
                const influencedStages = Array.from(new Set(influencedChartMetrics.map((m: string) => m.replace('influenced_', '').replace(/_deals|_value/, ''))));
                const stageFilter = `s.name IN (${influencedStages.map((s: string) => `'${sanitizeForSql(s)}'`).join(',')})`;
                ctes.push(`MonthlyInfluencedDeals AS (SELECT DISTINCT DATE_TRUNC(e.timestamp, MONTH) AS month, s.dd_stage_id, s.name, s.value FROM ${eventsTable} e, UNNEST(e.stages) AS s ${whereClause} AND ${stageFilter})`);
                const influencedSelects = influencedChartMetrics.map((m: string) => {
                    const rawStage = m.replace('influenced_', '').replace(/_deals|_value/, '');
                    const type = m.endsWith('deals') ? 'deals' : 'value';
                    const alias = m.replace(/\s/g, '_');
                    if (type === 'deals') return `COUNT(DISTINCT CASE WHEN name = '${sanitizeForSql(rawStage)}' THEN dd_stage_id END) AS ${alias}`;
                    return `SUM(CASE WHEN name = '${sanitizeForSql(rawStage)}' THEN value END) AS ${alias}`;
                }).join(', ');
                ctes.push(`AggregatedInfluencedMetrics AS (SELECT month, ${influencedSelects} FROM MonthlyInfluencedDeals GROUP BY 1)`);
                if(!finalFrom) {
                    finalFrom = 'AggregatedInfluencedMetrics aim';
                } else {
                    finalJoin = `FULL OUTER JOIN AggregatedInfluencedMetrics aim ON mbm.month = aim.month`;
                    finalSelects[0] = `FORMAT_TIMESTAMP('%Y-%m-%d', COALESCE(mbm.month, aim.month)) as month`;
                }
                finalSelects.push(...influencedChartMetrics.map((m: string) => `COALESCE(aim.${m.replace(/\s/g, '_')}, 0) AS ${m.replace(/\s/g, '_')}`));
             }
             chartQuery = ctes.length > 0 ? `WITH ${ctes.join(', ')} SELECT ${finalSelects.join(', ')} FROM ${finalFrom} ${finalJoin} ORDER BY month` : '';
        }
      }

      const [[kpiResults]] = kpiQuery ? await bigquery.query(kpiQuery) : [[]];
      const [chartResults] = chartQuery ? await bigquery.query(chartQuery) : [[]];
      return NextResponse.json({ kpiData: kpiResults, chartData: chartResults });

    } else { // --- OUTCOME ANALYSIS LOGIC ---
      const hasFilters = config.selectedCountries?.length > 0 || config.selectedEmployeeSizes?.length > 0;
      const needsCompanyJoin = hasFilters || config.reportFocus === 'segmentation' || (config.reportFocus === 'time_series' && config.chartMode === 'single_segmented');
      let fromClause = `FROM ${stagesTable} s`;
      if (needsCompanyJoin) fromClause += ` LEFT JOIN ${companiesTable} c ON s.dd_company_id = c.dd_company_id`;
      let whereClause = `WHERE 1=1 ${getTimePeriodClause(config.timePeriod, 's.timestamp')}`;
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
        const primaryMetricAlias = config.multiChartMetrics[0]?.replace(/\s/g, '_');
        const chartSelects = config.multiChartMetrics.map((metric: string) => {
            const sanitizedAlias = metric.replace(/\s/g, '_');
            const [rawStage, type] = metric.split(/_(deals|value)$/);
            if (type === 'deals') return `COUNT(DISTINCT CASE WHEN s.stage_name = '${sanitizeForSql(rawStage)}' THEN s.dd_stage_id ELSE NULL END) AS ${sanitizedAlias}`;
            if (type === 'value') return `SUM(CASE WHEN s.stage_name = '${sanitizeForSql(rawStage)}' THEN s.value ELSE 0 END) AS ${sanitizedAlias}`;
            return '';
        }).join(', ');
        chartQuery = chartSelects ? `
            WITH AllSegments AS (SELECT ${segmentCol} as segment, ${chartSelects} ${fromClause} ${whereClause} GROUP BY segment HAVING segment IS NOT NULL)
            SELECT * FROM AllSegments ORDER BY ${primaryMetricAlias} DESC LIMIT 10
        ` : '';
      } else { // time_series
        const monthSelect = `FORMAT_TIMESTAMP('%Y-%m-%d', DATE_TRUNC(s.timestamp, MONTH)) as month`;
        if (config.chartMode === 'single_segmented') {
          const [rawStage] = config.singleChartMetric.split(/_(deals|value)$/);
          const type = config.singleChartMetric.endsWith('_deals') ? 'deals' : 'value';
          const metricSelect = type === 'deals' ? `COUNT(DISTINCT s.dd_stage_id)` : `SUM(s.value)`;
          const segmentCol = config.segmentationProperty === 'companyCountry' ? 'c.properties.country' : 'c.properties.number_of_employees';
          chartQuery = `
            WITH TopSegments AS (
                SELECT ${segmentCol} as segment 
                ${fromClause}
                ${whereClause} AND s.stage_name = '${sanitizeForSql(rawStage)}' AND ${segmentCol} IS NOT NULL
                GROUP BY segment ORDER BY ${metricSelect} DESC LIMIT 10
            ),
            MonthlyData AS (
                SELECT ${monthSelect}, ${segmentCol} as segment, ${metricSelect} as value
                ${fromClause}
                ${whereClause} AND s.stage_name = '${sanitizeForSql(rawStage)}'
                GROUP BY month, segment
            )
            SELECT md.month, md.segment, md.value FROM MonthlyData md JOIN TopSegments ts ON md.segment = ts.segment ORDER BY md.month
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

function _buildEngagementKpiQuery(config: any, eventsTable: string, whereClause: string): string {
    const hasBaseMetrics = config.metrics.base.length > 0;
    const hasInfluencedMetrics = Object.keys(config.metrics.influenced).length > 0;
    if (!hasBaseMetrics && !hasInfluencedMetrics) return '';

    let ctes = [];
    if (hasBaseMetrics) {
      const baseSelects = config.metrics.base.map((m:string) => {
          if(m === 'companies') return 'COUNT(DISTINCT dd_company_id) AS companies';
          if(m === 'contacts') return 'COUNT(DISTINCT dd_contact_id) AS contacts';
          if(m === 'events') return 'COUNT(DISTINCT dd_event_id) AS events';
          if(m === 'sessions') return 'COUNT(DISTINCT dd_session_id) AS sessions';
          return '';
      }).filter(Boolean).join(', ');
      ctes.push(`BaseMetrics AS (SELECT ${baseSelects} FROM ${eventsTable} e ${whereClause})`);
    }
    if (hasInfluencedMetrics) {
      ctes.push(`InfluencedDeals AS (SELECT DISTINCT s.dd_stage_id, s.name, s.value FROM ${eventsTable} e, UNNEST(e.stages) AS s ${whereClause})`);
    }
    
    const finalSelects = [
      ...(hasBaseMetrics ? config.metrics.base.map((m:string) => `bm.${m}`) : []),
      ...Object.entries(config.metrics.influenced).flatMap(([stage, types]) => 
        (types as string[]).map(type => {
          const sanitizedStage = stage.replace(/\s/g, '_');
          if (type === 'deals') return `COUNT(DISTINCT CASE WHEN id.name = '${sanitizeForSql(stage)}' THEN id.dd_stage_id END) AS influenced_${sanitizedStage}_deals`;
          if (type === 'value') return `SUM(CASE WHEN id.name = '${sanitizeForSql(stage)}' THEN id.value END) AS influenced_${sanitizedStage}_value`;
          return '';
        })
      )
    ].filter(Boolean);

    const finalFrom = hasBaseMetrics && hasInfluencedMetrics ? 'BaseMetrics AS bm, InfluencedDeals AS id' : (hasBaseMetrics ? 'BaseMetrics AS bm' : 'InfluencedDeals AS id');
    const finalGroupBy = hasBaseMetrics ? `GROUP BY ${config.metrics.base.map((m:string) => `bm.${m}`).join(',')}` : '';

    return `WITH ${ctes.join(', ')} SELECT ${finalSelects.join(', ')} FROM ${finalFrom} ${finalGroupBy}`;
}