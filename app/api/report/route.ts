// app/api/report/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// --- HELPER FUNCTIONS ---
const sanitizeForSql = (value: string) => value.replace(/'/g, "\\'");

const getTimePeriodClause = (timePeriod: string, timestampColumn: string = 'timestamp'): string => {
  const now = new Date();
  switch (timePeriod) {
    case 'this_month':
        return ` AND ${timestampColumn} >= TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), MONTH)) AND ${timestampColumn} < TIMESTAMP(DATE_ADD(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 1 MONTH))`;
    case 'this_quarter':
        return ` AND ${timestampColumn} >= TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), QUARTER)) AND ${timestampColumn} < TIMESTAMP(DATE_ADD(DATE_TRUNC(CURRENT_DATE(), QUARTER), INTERVAL 1 QUARTER))`;
    case 'this_year':
      return ` AND ${timestampColumn} >= TIMESTAMP('${now.getFullYear()}-01-01') AND ${timestampColumn} < TIMESTAMP('${now.getFullYear() + 1}-01-01')`;
    case 'last_month':
       return ` AND ${timestampColumn} >= TIMESTAMP(DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH)) AND ${timestampColumn} < TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), MONTH))`;
    case 'last_quarter':
      return ` AND ${timestampColumn} >= TIMESTAMP(DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 QUARTER), QUARTER)) AND ${timestampColumn} < TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), QUARTER))`;
    case 'last_year':
        return ` AND ${timestampColumn} >= TIMESTAMP(DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 YEAR), YEAR)) AND ${timestampColumn} < TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), YEAR))`;
    case 'last_3_months':
        return ` AND ${timestampColumn} >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH)) AND ${timestampColumn} < TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), MONTH))`;
    case 'last_6_months':
        return ` AND ${timestampColumn} >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)) AND ${timestampColumn} < TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), MONTH))`;
    case 'last_12_months':
        return ` AND ${timestampColumn} >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)) AND ${timestampColumn} < TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), MONTH))`;
    default:
      return '';
  }
};

const getFunnelLengthClause = (funnelLength: string | undefined, touchTimestampCol: string, stageTimestampCol: string): string => {
    if (!funnelLength || funnelLength === 'unlimited') {
        return '';
    }
    const days = parseInt(funnelLength, 10);
    if (!isNaN(days) && days > 0) {
        return ` AND TIMESTAMP_DIFF(${stageTimestampCol}, ${touchTimestampCol}, DAY) <= ${days}`;
    }
    return '';
};

const _buildEngagementFilterClauses = (config: any, eventsAlias: string = 'e'): string => {
  let filterClauses = '';
  if (config.filters?.selectedChannels?.length > 0) {
    filterClauses += ` AND ${eventsAlias}.session.channel IN (${config.filters.selectedChannels.map((c: string) => `'${sanitizeForSql(c)}'`).join(',')})`;
  }
  if (config.filters?.eventNames?.length > 0) {
    filterClauses += ` AND ${eventsAlias}.event_name IN (${config.filters.eventNames.map((e: string) => `'${sanitizeForSql(e)}'`).join(',')})`;
  }
  if (config.filters?.signals?.length > 0) {
    filterClauses += ` AND EXISTS (SELECT 1 FROM UNNEST(${eventsAlias}.signals) s WHERE s.name IN (${config.filters.signals.map((s: string) => `'${sanitizeForSql(s)}'`).join(',')}))`;
  }
  if (config.filters?.url) {
    filterClauses += ` AND ${eventsAlias}.event.url_clean LIKE '%${sanitizeForSql(config.filters.url)}%'`;
  }
  return filterClauses;
};

const buildEngagementWhereClause = (config: any, eventsAlias: string = 'e'): string => {
  const timeClause = getTimePeriodClause(config.timePeriod, `${eventsAlias}.timestamp`);
  const filterClauses = _buildEngagementFilterClauses(config, eventsAlias);
  return `WHERE 1=1${timeClause}${filterClauses}`;
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
    const attributionTable = `\`${projectId}.dreamdata_demo.attribution\``;


    if (config.reportArchetype === 'engagement_analysis') {
      const whereClause = buildEngagementWhereClause(config, 'e');
      
      const kpiQuery = _buildEngagementKpiQuery(config, eventsTable, attributionTable, whereClause);
      const chartQuery = _buildEngagementChartQuery(config, eventsTable, companiesTable, attributionTable, whereClause);

      const [[kpiResults]] = kpiQuery ? await bigquery.query(kpiQuery) : [[]];
      const [chartResults] = chartQuery ? await bigquery.query(chartQuery) : [[]];

      return NextResponse.json({ kpiData: kpiResults, chartData: chartResults });

    } else { // --- OUTCOME ANALYSIS LOGIC ---
      
      const hasFilters = config.selectedCountries?.length > 0 || config.selectedEmployeeSizes?.length > 0;
      const needsCompanyJoin = hasFilters || config.reportFocus === 'segmentation' || (config.reportFocus === 'time_series' && config.chartMode === 'single_segmented');
      
      let fromClause = `FROM ${stagesTable} s`;
      if (needsCompanyJoin) {
          fromClause += ` LEFT JOIN ${companiesTable} c ON s.dd_company_id = c.dd_company_id`;
      }
      
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

function _buildEngagementKpiQuery(config: any, eventsTable: string, attributionTable: string, whereClause: string): string {
    const hasBaseMetrics = config.metrics.base.length > 0;
    const hasInfluencedMetrics = Object.keys(config.metrics.influenced).length > 0;
    const hasAttributedMetrics = Object.keys(config.metrics.attributed).length > 0;

    if (!hasBaseMetrics && !hasInfluencedMetrics && !hasAttributedMetrics) return '';

    let ctes = [];
    let finalSelects = [];
    let finalFromParts = new Set<string>();
    
    ctes.push(`FilteredSessions AS (SELECT DISTINCT dd_session_id FROM ${eventsTable} e ${whereClause})`);

    if (hasBaseMetrics) {
      const baseSelects = config.metrics.base.map((m:string) => {
          if(m === 'companies') return 'COUNT(DISTINCT e.dd_company_id) AS companies';
          if(m === 'contacts') return 'COUNT(DISTINCT e.dd_contact_id) AS contacts';
          if(m === 'events') return 'COUNT(DISTINCT e.dd_event_id) AS events';
          if(m === 'sessions') return 'COUNT(DISTINCT e.dd_session_id) AS sessions';
          return '';
      }).filter(Boolean).join(', ');
      ctes.push(`BaseMetrics AS (SELECT ${baseSelects} FROM ${eventsTable} e WHERE e.dd_session_id IN (SELECT dd_session_id FROM FilteredSessions))`);
      finalSelects.push('b.*');
      finalFromParts.add('BaseMetrics AS b');
    }
    
    if (hasInfluencedMetrics) {
        const influencedStages = Object.keys(config.metrics.influenced);
        const funnelLengthClause = getFunnelLengthClause(config.funnelLength, 'e.timestamp', 's.timestamp');

        const uniqueDealsClauses = influencedStages.map(stage =>
            `SELECT DISTINCT s.dd_stage_id, s.value, s.name FROM ${eventsTable} e, UNNEST(e.stages) s WHERE e.dd_session_id IN (SELECT dd_session_id FROM FilteredSessions) AND s.name = '${sanitizeForSql(stage)}'${funnelLengthClause}`
        ).join(' UNION ALL ');

        ctes.push(`UniqueInfluencedDeals AS (${uniqueDealsClauses})`);

        const influencedSelects = Object.entries(config.metrics.influenced).flatMap(([stage, types]) =>
            (types as string[]).map(type => {
                const sanitizedStage = stage.replace(/\s/g, '_');
                if (type === 'deals') {
                    return `COUNT(DISTINCT CASE WHEN name = '${sanitizeForSql(stage)}' THEN dd_stage_id END) AS influenced_${sanitizedStage}_deals`;
                }
                if (type === 'value') {
                    return `SUM(CASE WHEN name = '${sanitizeForSql(stage)}' THEN value END) AS influenced_${sanitizedStage}_value`;
                }
                return '';
            })
        ).join(', ');

        ctes.push(`AggregatedInfluenced AS (SELECT ${influencedSelects} FROM UniqueInfluencedDeals)`);
        finalSelects.push('i.*');
        finalFromParts.add('AggregatedInfluenced i');
    }

    if (hasAttributedMetrics) {
        const attributedFunnelClause = getFunnelLengthClause(config.funnelLength, 'r.timestamp', 'r.stage.timestamp');
        const attributedSelects = Object.keys(config.metrics.attributed).map(stage => {
            const sanitizedStage = stage.replace(/\s/g, '_');
            return `SUM(CASE WHEN r.stage.name = '${sanitizeForSql(stage)}' THEN a.weight ELSE 0 END) AS attributed_${sanitizedStage}_deals`;
        }).join(', ');
        ctes.push(`AggregatedAttributed AS (SELECT ${attributedSelects} FROM ${attributionTable} r, UNNEST(attribution) a WHERE r.dd_session_id IN (SELECT dd_session_id FROM FilteredSessions) AND a.model = 'Data-Driven'${attributedFunnelClause})`);
        finalSelects.push('a.*');
        finalFromParts.add('AggregatedAttributed a');
    }
    
    return `WITH ${ctes.join(', ')} SELECT ${finalSelects.join(', ')} FROM ${Array.from(finalFromParts).join(', ')}`;
}


function _buildEngagementChartQuery(config: any, eventsTable: string, companiesTable: string, attributionTable: string, whereClause: string): string {
    const rawChartMetrics = config.chartMode === 'single_segmented' ? [config.singleChartMetric] : config.multiChartMetrics;
    const chartMetrics: string[] = Array.isArray(rawChartMetrics) ? rawChartMetrics.filter((m): m is string => typeof m === 'string' && m.length > 0) : [];
    if (chartMetrics.length === 0) return '';

    const getSegmentColumn = (prop: string, tableAlias: string = 'e') => {
        if (prop === 'companyCountry') return 'c.properties.country';
        if (prop === 'numberOfEmployees') return 'c.properties.number_of_employees';
        if (tableAlias === 'r') return 'r.session.channel';
        return `${tableAlias}.session.channel`;
    };
    
    const isTimeSeries = config.reportFocus === 'time_series';

    if (!isTimeSeries) { // Logic for Segmentation Focus
        const segmentCol = getSegmentColumn(config.segmentationProperty);
        const needsCompanyJoin = ['companyCountry', 'numberOfEmployees'].includes(config.segmentationProperty);
        let fromClause = `FROM ${eventsTable} e`;
        if (needsCompanyJoin) fromClause += ` LEFT JOIN ${companiesTable} c ON e.dd_company_id = c.dd_company_id`;
        
        const getMetricAggregation = (metric: string) => {
            if (metric.startsWith('attributed_')) return `SUM(CASE WHEN r.stage.name = '${sanitizeForSql(metric.replace('attributed_', '').replace(/_/g, ' '))}' THEN a.weight ELSE 0 END)`;
            if(metric === 'companies') return `COUNT(DISTINCT e.dd_company_id)`;
            if(metric === 'contacts') return `COUNT(DISTINCT e.dd_contact_id)`;
            if(metric === 'events') return `COUNT(DISTINCT e.dd_event_id)`;
            if(metric === 'sessions') return `COUNT(DISTINCT e.dd_session_id)`;
            return 'NULL';
        }
        
        const hasAttributed = chartMetrics.some(m => m.startsWith('attributed_'));
        let finalWhere = whereClause;

        if (hasAttributed) {
            fromClause = `FROM ${attributionTable} r JOIN ${eventsTable} e ON r.dd_session_id = e.dd_session_id JOIN UNNEST(r.attribution) a`;
            if (needsCompanyJoin) fromClause += ` LEFT JOIN ${companiesTable} c ON e.dd_company_id = c.dd_company_id`;
            finalWhere = `WHERE r.dd_session_id IN (SELECT dd_session_id FROM FilteredSessions) AND a.model = 'Data-Driven'`;
        }

        const primaryMetricAggregation = getMetricAggregation(chartMetrics[0]);
        const chartSelects = chartMetrics.map((m: string) => getMetricAggregation(m) + ' AS ' + m.replace(/\s/g, '_')).filter(m => !m.includes('NULL')).join(', ');
        
        const sessionsCte = hasAttributed ? `WITH FilteredSessions AS (SELECT DISTINCT dd_session_id FROM ${eventsTable} e ${whereClause})` : '';

        return chartSelects ? `
          ${sessionsCte}
          ${sessionsCte ? ',' : 'WITH'} AllSegments AS (
            SELECT ${segmentCol} as segment, ${chartSelects}
            ${fromClause}
            ${finalWhere}
            GROUP BY segment
            HAVING segment IS NOT NULL
          )
          SELECT * FROM AllSegments
          ORDER BY ${primaryMetricAggregation.split(' AS ')[0]} DESC
          LIMIT 10
        ` : '';

    } else { // Logic for Time Series Focus
        const influencedFunnelClause = getFunnelLengthClause(config.funnelLength, 'e.timestamp', 's.timestamp');
        const attributedFunnelClause = getFunnelLengthClause(config.funnelLength, 'r.timestamp', 'r.stage.timestamp');

        if (config.chartMode === 'single_segmented') {
            const metric = config.singleChartMetric;
            
            if (metric.startsWith('attributed_')) {
                const rawStage = metric.replace('attributed_', '').replace(/_deals/g, '');
                const needsCompanyJoin = ['companyCountry', 'numberOfEmployees'].includes(config.segmentationProperty);
                const segmentCol = getSegmentColumn(config.segmentationProperty, needsCompanyJoin ? 'c' : 'r');

                const filteredSessionsCTE = `FilteredSessions AS (
                    ${buildEngagementWhereClause(config, 'e').replace('WHERE', 'SELECT DISTINCT e.dd_session_id FROM ' + eventsTable + ' e WHERE')}
                )`;

                let fromClauseForAttribution = `FROM ${attributionTable} r LEFT JOIN UNNEST(r.attribution) a`;
                if(needsCompanyJoin) {
                    fromClauseForAttribution += ` LEFT JOIN ${companiesTable} c ON r.dd_company_id = c.dd_company_id`;
                }
                const whereClauseForAttribution = `WHERE a.model = 'Data-Driven' AND r.stage.name = '${sanitizeForSql(rawStage)}' AND r.dd_session_id IN (SELECT dd_session_id FROM FilteredSessions)${getFunnelLengthClause(config.funnelLength, 'r.timestamp', 'r.stage.timestamp')}`;

                const metricAggregation = `SUM(a.weight)`;

                return `
                    WITH ${filteredSessionsCTE},
                    TopSegments AS (
                        SELECT ${segmentCol} AS segment
                        ${fromClauseForAttribution}
                        ${whereClauseForAttribution} AND ${segmentCol} IS NOT NULL
                        GROUP BY segment ORDER BY ${metricAggregation} DESC LIMIT 10
                    ),
                    MonthlyData AS (
                        SELECT DATE_TRUNC(r.timestamp, MONTH) AS month, ${segmentCol} AS segment, ${metricAggregation} AS value
                        ${fromClauseForAttribution}
                        ${whereClauseForAttribution}
                        GROUP BY month, segment
                    )
                    SELECT FORMAT_TIMESTAMP('%Y-%m-%d', md.month) AS month, md.segment, md.value
                    FROM MonthlyData AS md
                    INNER JOIN TopSegments AS ts ON md.segment = ts.segment
                    ORDER BY month, value DESC
                `;

            } else { // Handle base and influenced metrics
                const segmentCol = getSegmentColumn(config.segmentationProperty, 'e');
                const needsCompanyJoin = ['companyCountry', 'numberOfEmployees'].includes(config.segmentationProperty);
                let fromClause = `FROM ${eventsTable} e`;
                if (needsCompanyJoin) fromClause += ` LEFT JOIN ${companiesTable} c ON e.dd_company_id = c.dd_company_id`;
                
                let metricAggregation = '';
                let whereExtension = '';
                
                if (metric.startsWith('influenced_')) {
                    const rawStage = metric.replace('influenced_', '').replace(/_deals/g, '');
                    const stageAlias = `s_${rawStage.replace(/\s/g, '_')}`;
                    fromClause += ` LEFT JOIN UNNEST(e.stages) AS ${stageAlias} ON ${stageAlias}.name = '${sanitizeForSql(rawStage)}'`;
                    metricAggregation = `COUNT(DISTINCT ${stageAlias}.dd_stage_id)`;
                    whereExtension = getFunnelLengthClause(config.funnelLength, 'e.timestamp', `${stageAlias}.timestamp`);
                } else {
                    if (metric === 'companies') metricAggregation = 'COUNT(DISTINCT e.dd_company_id)';
                    else if (metric === 'contacts') metricAggregation = 'COUNT(DISTINCT e.dd_contact_id)';
                    else if (metric === 'events') metricAggregation = 'COUNT(DISTINCT e.dd_event_id)';
                    else if (metric === 'sessions') metricAggregation = 'COUNT(DISTINCT e.dd_session_id)';
                }
                
                if (!metricAggregation) return '';
    
                return `
                    WITH TopSegments AS (
                        SELECT ${segmentCol} AS segment
                        ${fromClause}
                        ${whereClause}${whereExtension} AND ${segmentCol} IS NOT NULL
                        GROUP BY segment ORDER BY ${metricAggregation} DESC LIMIT 10
                    ),
                    MonthlyData AS (
                        SELECT DATE_TRUNC(e.timestamp, MONTH) AS month, ${segmentCol} AS segment, ${metricAggregation} AS value
                        ${fromClause}
                        ${whereClause}${whereExtension}
                        GROUP BY month, segment
                    )
                    SELECT FORMAT_TIMESTAMP('%Y-%m-%d', md.month) AS month, md.segment, md.value
                    FROM MonthlyData AS md
                    INNER JOIN TopSegments AS ts ON md.segment = ts.segment
                    ORDER BY month, value DESC
                `;
            }
        } else { // multi_metric
             const baseChartMetrics = chartMetrics.filter((m: string) => !m.startsWith('influenced_') && !m.startsWith('attributed_'));
             const influencedChartMetrics = chartMetrics.filter((m: string) => m.startsWith('influenced_'));
             const attributedChartMetrics = chartMetrics.filter((m: string) => m.startsWith('attributed_'));
             const ctes = [];
             let finalSelects = [`FORMAT_TIMESTAMP('%Y-%m-%d', month) as month`];
             let fromParts: { alias: string, cteName: string }[] = [];
             
             if(baseChartMetrics.length > 0) {
                 const baseSelects = baseChartMetrics.map((m: string) => {
                     if (m === 'companies') return `COUNT(DISTINCT dd_company_id) AS companies`;
                     if (m === 'contacts') return `COUNT(DISTINCT dd_contact_id) AS contacts`;
                     if (m === 'events') return `COUNT(DISTINCT dd_event_id) AS events`;
                     if (m === 'sessions') return `COUNT(DISTINCT dd_session_id) AS sessions`;
                     return '';
                 }).join(', ');
                 ctes.push(`MonthlyBaseMetrics AS (SELECT DATE_TRUNC(timestamp, MONTH) AS month, ${baseSelects} FROM ${eventsTable} e ${whereClause} GROUP BY 1)`);
                 fromParts.push({ alias: 'mbm', cteName: 'MonthlyBaseMetrics' });
                 finalSelects.push(...baseChartMetrics.map((m: string) => `COALESCE(mbm.${m}, 0) AS ${m}`));
             }
             if(influencedChartMetrics.length > 0) {
                const influencedStages = Array.from(new Set(influencedChartMetrics.map((m: string) => m.replace('influenced_', '').replace(/_deals/g, ''))));
                const stageFilter = `s.name IN (${influencedStages.map((s: string) => `'${sanitizeForSql(s)}'`).join(',')})`;
                ctes.push(`MonthlyInfluencedDeals AS (SELECT DISTINCT DATE_TRUNC(e.timestamp, MONTH) AS month, s.dd_stage_id, s.name FROM ${eventsTable} e, UNNEST(e.stages) AS s ${whereClause} AND ${stageFilter}${influencedFunnelClause})`);
                const influencedSelects = influencedChartMetrics.map((m: string) => {
                    const rawStage = m.replace('influenced_', '').replace(/_deals/g, '');
                    const alias = m.replace(/\s/g, '_');
                    return `COUNT(DISTINCT CASE WHEN name = '${sanitizeForSql(rawStage)}' THEN dd_stage_id END) AS ${alias}`;
                }).join(', ');
                ctes.push(`AggregatedInfluencedMetrics AS (SELECT month, ${influencedSelects} FROM MonthlyInfluencedDeals GROUP BY 1)`);
                fromParts.push({ alias: 'aim', cteName: 'AggregatedInfluencedMetrics' });
                finalSelects.push(...influencedChartMetrics.map((m: string) => `COALESCE(aim.${m.replace(/\s/g, '_')}, 0) AS ${m.replace(/\s/g, '_')}`));
             }
            if(attributedChartMetrics.length > 0) {
                 const attributedStages = Array.from(new Set(attributedChartMetrics.map((m: string) => m.replace('attributed_', '').replace(/_deals/g, ''))));
                 // THE FIX: Corrected the typo from r.stage..name to r.stage.name
                 const stageFilter = `r.stage.name IN (${attributedStages.map((s: string) => `'${sanitizeForSql(s)}'`).join(',')})`;
                 ctes.push(`FilteredSessions AS (SELECT DISTINCT dd_session_id FROM ${eventsTable} e ${whereClause})`);
                 const attributedSelects = attributedChartMetrics.map((m: string) => {
                    const rawStage = m.replace('attributed_', '').replace(/_deals/g, '');
                    const alias = m.replace(/\s/g, '_');
                    return `SUM(CASE WHEN r.stage.name = '${sanitizeForSql(rawStage)}' THEN a.weight ELSE 0 END) as ${alias}`;
                 }).join(', ');
                 ctes.push(`MonthlyAttributedMetrics AS (SELECT DATE_TRUNC(r.timestamp, MONTH) AS month, ${attributedSelects} FROM ${attributionTable} r, UNNEST(attribution) a WHERE r.dd_session_id IN (SELECT dd_session_id FROM FilteredSessions) AND a.model = 'Data-Driven' AND ${stageFilter}${attributedFunnelClause} GROUP BY 1)`);
                fromParts.push({ alias: 'attrm', cteName: 'MonthlyAttributedMetrics' });
                finalSelects.push(...attributedChartMetrics.map((m: string) => `COALESCE(attrm.${m.replace(/\s/g, '_')}, 0) AS ${m.replace(/\s/g, '_')}`));
            }

            if (fromParts.length > 0) {
                let finalFrom = `${fromParts[0].cteName} ${fromParts[0].alias}`;
                let finalJoins = fromParts.slice(1).map((part, i) => {
                    const prevPart = fromParts[i];
                    return `FULL OUTER JOIN ${part.cteName} ${part.alias} ON ${prevPart.alias}.month = ${part.alias}.month`;
                }).join(' ');

                const coalesceColumns = fromParts.map(p => `${p.alias}.month`).join(', ');
                finalSelects[0] = `FORMAT_TIMESTAMP('%Y-%m-%d', COALESCE(${coalesceColumns})) as month`;
                
                return `WITH ${ctes.join(', ')} SELECT ${finalSelects.join(', ')} FROM ${finalFrom} ${finalJoins} ORDER BY month`;
            }
            return '';
        }
    }
}
