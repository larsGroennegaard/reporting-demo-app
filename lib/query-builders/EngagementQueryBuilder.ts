// lib/query-builders/EngagementQueryBuilder.ts

const sanitizeForSql = (value: string) => value.replace(/'/g, "\\'");

const getTimePeriodClause = (timePeriod: string, timestampColumn: string = 'e.timestamp'): string => {
  // ... (this function is correct and remains the same)
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
        return ` AND ${timestampColumn} >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH))`;
    case 'last_6_months':
        return ` AND ${timestampColumn} >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH))`;
    case 'last_12_months':
        return ` AND ${timestampColumn} >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH))`;
    default:
      return ` AND ${timestampColumn} >= TIMESTAMP('${now.getFullYear()}-01-01') AND ${timestampColumn} < TIMESTAMP('${now.getFullYear() + 1}-01-01')`;
  }
};

const getDateRangeForQuery = (timePeriod: string): { startDate: string, endDate: string } => {
    // ... (this function is correct and remains the same)
    const now = new Date();
    let startDate: Date, endDate: Date;

    switch (timePeriod) {
        case 'this_month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'last_month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
        case 'this_quarter':
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
            break;
        case 'last_quarter':
            const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
            startDate = new Date(now.getFullYear(), lastQuarter * 3, 1);
            endDate = new Date(now.getFullYear(), lastQuarter * 3 + 3, 0);
            break;
        case 'this_year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
            break;
        case 'last_year':
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            endDate = new Date(now.getFullYear() - 1, 11, 31);
            break;
        case 'last_3_months':
            startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 2);
            startDate.setDate(1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'last_6_months':
            startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 5);
            startDate.setDate(1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'last_12_months':
            startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 11);
            startDate.setDate(1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        default:
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
    }
    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    };
};

const getFunnelLengthClause = (funnelLength: string | undefined, touchTimestampCol: string, stageTimestampCol: string): string => {
    if (!funnelLength || funnelLength === 'unlimited') return '';
    const days = parseInt(funnelLength, 10);
    if (!isNaN(days) && days > 0) return ` AND TIMESTAMP_DIFF(${stageTimestampCol}, ${touchTimestampCol}, DAY) <= ${days}`;
    return '';
};


export class EngagementQueryBuilder {
    // ... (constructor, buildWhereClause, and buildKpiQuery are correct and remain the same)
    private projectId: string;
    private eventsTable: string;
    private attributionTable: string;
    private companiesTable: string;
    private config: any;
    private whereClause: string;

    constructor(projectId: string, config: any) {
        this.projectId = projectId;
        this.eventsTable = `\`${projectId}.dreamdata_demo.events\``;
        this.attributionTable = `\`${projectId}.dreamdata_demo.attribution\``;
        this.companiesTable = `\`${projectId}.dreamdata_demo.companies\``;
        this.config = config;
        this.whereClause = this.buildWhereClause();
    }
    
    private buildWhereClause(): string {
        const { dataConfig } = this.config;
        let filterClauses = '';
        if (dataConfig.filters?.selectedChannels?.length > 0) {
            filterClauses += ` AND e.session.channel IN (${dataConfig.filters.selectedChannels.map((c: string) => `'${sanitizeForSql(c)}'`).join(',')})`;
        }
        if (dataConfig.filters?.eventNames?.length > 0) {
            filterClauses += ` AND e.event_name IN (${dataConfig.filters.eventNames.map((e: string) => `'${sanitizeForSql(e)}'`).join(',')})`;
        }
        if (dataConfig.filters?.signals?.length > 0) {
            filterClauses += ` AND EXISTS (SELECT 1 FROM UNNEST(e.signals) s WHERE s.name IN (${dataConfig.filters.signals.map((s: string) => `'${sanitizeForSql(s)}'`).join(',')}))`;
        }
        if (dataConfig.filters?.url) {
            filterClauses += ` AND e.event.url_clean LIKE '%${sanitizeForSql(dataConfig.filters.url)}%'`;
        }
        return `WHERE 1=1 ${getTimePeriodClause(this.config.dataConfig.timePeriod)}`;
    }

    buildKpiQuery(): string {
        const { kpiCards, dataConfig } = this.config;
        if (!kpiCards || kpiCards.length === 0) return '';
        
        const hasBase = kpiCards.some((k: any) => ['companies','contacts','events','sessions'].includes(k.metric));
        const hasInfluenced = kpiCards.some((k: any) => k.metric.startsWith('influenced_'));
        const hasAttributed = kpiCards.some((k: any) => k.metric.startsWith('attributed_'));

        let ctes = [];
        let finalSelects = [];
        let finalFromParts = new Set<string>();
        
        ctes.push(`FilteredSessions AS (SELECT DISTINCT dd_session_id FROM ${this.eventsTable} e ${this.whereClause})`);

        if (hasBase) {
            const baseSelects = kpiCards.filter((k:any) => ['companies','contacts','events','sessions'].includes(k.metric)).map((k:any) => {
                if(k.metric === 'companies') return 'COUNT(DISTINCT e.dd_company_id) AS companies';
                if(k.metric === 'contacts') return 'COUNT(DISTINCT e.dd_contact_id) AS contacts';
                if(k.metric === 'events') return 'COUNT(DISTINCT e.dd_event_id) AS events';
                if(k.metric === 'sessions') return 'COUNT(DISTINCT e.dd_session_id) AS sessions';
                return '';
            }).join(', ');
            ctes.push(`BaseMetrics AS (SELECT ${baseSelects} FROM ${this.eventsTable} e WHERE e.dd_session_id IN (SELECT dd_session_id FROM FilteredSessions))`);
            finalSelects.push('b.*');
            finalFromParts.add('BaseMetrics AS b');
        }
        
        if (hasInfluenced) {
            const funnelClause = getFunnelLengthClause(dataConfig.funnelLength, 'e.timestamp', 's.timestamp');
            const influencedStages = Array.from(new Set(kpiCards.filter((k:any) => k.metric.startsWith('influenced_')).map((k:any) => k.metric.split('_')[1]))) as string[];
            
            if (influencedStages.length > 0) {
                const uniqueDealsClauses = influencedStages.map((stage: string) =>
                    `SELECT DISTINCT s.dd_stage_id, s.value, s.name FROM ${this.eventsTable} e, UNNEST(e.stages) s WHERE e.dd_session_id IN (SELECT dd_session_id FROM FilteredSessions) AND s.name = '${sanitizeForSql(stage)}'${funnelClause}`
                ).join(' UNION ALL ');

                ctes.push(`UniqueInfluencedDeals AS (${uniqueDealsClauses})`);
                const influencedSelects = kpiCards.filter((k:any) => k.metric.startsWith('influenced_')).map((k:any) => {
                    const [_, stage, type] = k.metric.split('_');
                    if (type === 'deals') return `COUNT(DISTINCT CASE WHEN name = '${sanitizeForSql(stage)}' THEN dd_stage_id END) AS ${k.metric}`;
                    if (type === 'value') return `SUM(CASE WHEN name = '${sanitizeForSql(stage)}' THEN value END) AS ${k.metric}`;
                    return '';
                }).join(', ');
                
                ctes.push(`AggregatedInfluenced AS (SELECT ${influencedSelects} FROM UniqueInfluencedDeals)`);
                finalSelects.push('i.*');
                finalFromParts.add('AggregatedInfluenced i');
            }
        }

        if (hasAttributed) {
             const funnelClause = getFunnelLengthClause(dataConfig.funnelLength, 'r.timestamp', 'r.stage.timestamp');
             const attributedSelects = kpiCards.filter((k:any) => k.metric.startsWith('attributed_')).map((k:any) => {
                const [_, stage, type] = k.metric.split('_');
                if (type === 'deals') return `SUM(CASE WHEN r.stage.name = '${sanitizeForSql(stage)}' THEN a.weight ELSE 0 END) AS ${k.metric}`;
                return '';
             }).join(', ');

             ctes.push(`AggregatedAttributed AS (SELECT ${attributedSelects} FROM ${this.attributionTable} r, UNNEST(attribution) a WHERE r.dd_session_id IN (SELECT dd_session_id FROM FilteredSessions) AND a.model = 'Data-Driven'${funnelClause})`);
             finalSelects.push('a.*');
             finalFromParts.add('AggregatedAttributed a');
        }
        
        if (finalSelects.length === 0) return '';
        return `WITH ${ctes.join(', ')} SELECT ${finalSelects.join(', ')} FROM ${Array.from(finalFromParts).join(', ')}`;
    }

    buildChartQuery(): string {
        const { chart, dataConfig } = this.config;
        if (!chart || (!chart.metric && (!chart.metrics || chart.metrics.length === 0))) return '';

        if (dataConfig.reportFocus === 'segmentation') {
            return this._buildSegmentationMultiMetricQuery();
        }

        if (chart.variant === 'time_series_segmented') {
            return this._buildTimeSeriesSingleMetricQuery();
        } else {
            return this._buildTimeSeriesMultiMetricQuery();
        }
    }
    
    private _getSegmentColumn(prop: string | undefined, tableAlias: string = 'e') {
        if (prop === 'companyCountry') return `c.properties.country`;
        if (prop === 'numberOfEmployees') return `c.properties.number_of_employees`;
        return `${tableAlias}.session.channel`;
    };
    
    private _buildTimeSeriesMultiMetricQuery(): string {
        // This method remains unchanged.
        const { chart, dataConfig } = this.config;
        const ctes = [];
        const finalSelects = [ `m.month` ];
        
        const { startDate, endDate } = getDateRangeForQuery(dataConfig.timePeriod);
        let mainFrom = `FROM (SELECT FORMAT_TIMESTAMP('%Y-%m-01', day) as month FROM UNNEST(GENERATE_DATE_ARRAY(DATE_TRUNC(DATE('${startDate}'), MONTH), DATE_TRUNC(DATE('${endDate}'), MONTH), INTERVAL 1 MONTH)) as day) m`;
        
        ctes.push(`FilteredSessions AS (SELECT DISTINCT dd_session_id FROM ${this.eventsTable} e ${this.whereClause})`);

        const baseMetrics = chart.metrics.filter((m: string) => ['sessions', 'events', 'contacts', 'companies'].includes(m));
        if (baseMetrics.length > 0) {
            const baseSelects = baseMetrics.map((m: string) => {
                if (m === 'companies') return `COUNT(DISTINCT e.dd_company_id) as companies`;
                return `COUNT(DISTINCT e.dd_${m.slice(0, -1)}_id) as ${m}`;
            }).join(', ');
            ctes.push(`BaseMonthly AS (SELECT FORMAT_TIMESTAMP('%Y-%m-01', DATE_TRUNC(e.timestamp, MONTH)) as month, ${baseSelects} FROM ${this.eventsTable} e WHERE e.dd_session_id IN (SELECT dd_session_id FROM FilteredSessions) GROUP BY 1)`);
            finalSelects.push(...baseMetrics.map((m: string) => `b.${m}`));
            mainFrom += ` LEFT JOIN BaseMonthly b ON m.month = b.month`;
        }

        const influencedMetrics = chart.metrics.filter((m: string) => m.startsWith('influenced_'));
        if (influencedMetrics.length > 0) {
             const influencedStages = Array.from(new Set(influencedMetrics.map((m: string) => m.split('_')[1])));
             const funnelClause = getFunnelLengthClause(dataConfig.funnelLength, 'e.timestamp', 's.timestamp');
             const infSelects = influencedMetrics.map((m: string) => {
                 const [_, stage, type] = m.split('_');
                 if(type === 'deals') return `COUNT(DISTINCT CASE WHEN s.name = '${sanitizeForSql(stage)}' THEN s.dd_stage_id END) AS ${m}`;
                 if(type === 'value') return `SUM(CASE WHEN s.name = '${sanitizeForSql(stage)}' THEN s.value END) AS ${m}`;
                 return ''
             }).join(', ');
             ctes.push(`InfluencedMonthly AS (SELECT FORMAT_TIMESTAMP('%Y-%m-01', DATE_TRUNC(e.timestamp, MONTH)) as month, ${infSelects} FROM ${this.eventsTable} e, UNNEST(e.stages) s WHERE e.dd_session_id IN (SELECT dd_session_id FROM FilteredSessions) AND s.name IN (${influencedStages.map(s=>`'${s}'`).join(',')}) ${funnelClause} GROUP BY 1)`);
             finalSelects.push(...influencedMetrics.map((m: string) => `i.${m}`));
             mainFrom += ` LEFT JOIN InfluencedMonthly i ON m.month = i.month`;
        }
        
        const attributedMetrics = chart.metrics.filter((m: string) => m.startsWith('attributed_'));
        if (attributedMetrics.length > 0) {
            const attributedStages = Array.from(new Set(attributedMetrics.map((m: string) => m.split('_')[1])));
            const funnelClause = getFunnelLengthClause(dataConfig.funnelLength, 'r.timestamp', 'r.stage.timestamp');
            const attrSelects = attributedMetrics.map((m: string) => {
                 const [_, stage, type] = m.split('_');
                 if(type === 'deals') return `SUM(CASE WHEN r.stage.name = '${sanitizeForSql(stage)}' THEN a.weight ELSE 0 END) AS ${m}`;
                 return ''
            }).join(', ');
            const attrWhere = `WHERE r.stage.name IN (${attributedStages.map(s=>`'${s}'`).join(',')}) AND r.dd_session_id IN (SELECT dd_session_id FROM FilteredSessions) AND a.model = 'Data-Driven' ${funnelClause}`;
            ctes.push(`AttributedMonthly AS (SELECT FORMAT_TIMESTAMP('%Y-%m-01', DATE_TRUNC(r.timestamp, MONTH)) as month, ${attrSelects} FROM ${this.attributionTable} r, UNNEST(attribution) a ${attrWhere} GROUP BY 1)`);
            finalSelects.push(...attributedMetrics.map((m: string) => `att.${m}`));
            mainFrom += ` LEFT JOIN AttributedMonthly att ON m.month = att.month`;
        }
        
        if (ctes.length === 1) return '';
        return `WITH ${ctes.join(', ')} SELECT ${finalSelects.join(', ')} ${mainFrom} ORDER BY m.month`;
    }

    private _buildTimeSeriesSingleMetricQuery(): string {
        // This method remains unchanged
        const { chart, dataConfig } = this.config;
        const metric = chart.metric;
        const segmentCol = this._getSegmentColumn(chart.breakdown);
        const needsCompanyJoin = ['companyCountry', 'numberOfEmployees'].includes(chart.breakdown);

        let fromClause = ``;
        let whereExtension = ``;
        let metricAggregation = ``;
        let timestampColumn = 'e.timestamp';
        let tableAlias = 'e';

        if (metric.startsWith('attributed_')) {
            const stage = metric.replace('attributed_', '').replace(/_deals/g, '');
            tableAlias = 'r';
            fromClause = `FROM ${this.attributionTable} r LEFT JOIN UNNEST(r.attribution) a ON a.model = 'Data-Driven'`;
            if(needsCompanyJoin) {
                fromClause += ` LEFT JOIN ${this.companiesTable} c ON r.dd_company_id = c.dd_company_id`;
            }
            whereExtension = `WHERE r.stage.name = '${sanitizeForSql(stage)}' AND r.dd_session_id IN (SELECT dd_session_id FROM ${this.eventsTable} e ${this.whereClause}) ${getFunnelLengthClause(dataConfig.funnelLength, 'r.timestamp', 'r.stage.timestamp')}`;
            metricAggregation = `SUM(a.weight)`;
            timestampColumn = 'r.timestamp';
        } else { 
            fromClause = `FROM ${this.eventsTable} e`;
            if(needsCompanyJoin) fromClause += ` LEFT JOIN ${this.companiesTable} c ON e.dd_company_id = c.dd_company_id`;
            whereExtension = this.whereClause;

            if (metric.startsWith('influenced_')) {
                const stage = metric.split('_')[1];
                fromClause += `, UNNEST(e.stages) AS s`;
                whereExtension += ` AND s.name = '${sanitizeForSql(stage)}' ${getFunnelLengthClause(dataConfig.funnelLength, 'e.timestamp', 's.timestamp')}`;
                metricAggregation = `COUNT(DISTINCT s.dd_stage_id)`;
            } else if (metric === 'sessions') {
                metricAggregation = 'COUNT(DISTINCT e.dd_session_id)';
            } else if (metric === 'companies') {
                metricAggregation = 'COUNT(DISTINCT e.dd_company_id)';
            } else if (metric === 'contacts') {
                metricAggregation = 'COUNT(DISTINCT e.dd_contact_id)';
            } else if (metric === 'events') {
                metricAggregation = 'COUNT(DISTINCT e.dd_event_id)';
            }
        }
        if (!metricAggregation) return '';

        const finalSegmentCol = this._getSegmentColumn(chart.breakdown, tableAlias);

        return `
            WITH TopSegments AS (
                SELECT ${finalSegmentCol} as segment
                ${fromClause}
                ${whereExtension} AND ${finalSegmentCol} IS NOT NULL
                GROUP BY segment ORDER BY ${metricAggregation} DESC LIMIT 5
            ),
            MonthlyData AS (
                SELECT FORMAT_TIMESTAMP('%Y-%m-01', DATE_TRUNC(${timestampColumn}, MONTH)) as month, ${finalSegmentCol} AS segment, ${metricAggregation} AS value
                ${fromClause}
                ${whereExtension}
                GROUP BY month, segment
            )
            SELECT md.month, md.segment, md.value FROM MonthlyData md JOIN TopSegments ts ON md.segment = ts.segment ORDER BY md.month
        `;
    }

    private _buildSegmentationMultiMetricQuery(): string {
        // THIS IS THE ONLY METHOD THAT HAS BEEN CHANGED
        const { chart, dataConfig } = this.config;
        const metrics = chart.metrics;
        if (!metrics || metrics.length === 0) return '';
        
        const ctes = [];
        const segmentCol = this._getSegmentColumn(chart.breakdown);
        const needsCompanyJoin = ['companyCountry', 'numberOfEmployees'].includes(chart.breakdown);

        let segmentFrom = `FROM ${this.eventsTable} e`;
        if (needsCompanyJoin) {
            segmentFrom += ` LEFT JOIN ${this.companiesTable} c ON e.dd_company_id = c.dd_company_id`;
        }
        
        ctes.push(`FilteredSessions AS (SELECT DISTINCT dd_session_id, ${segmentCol} AS segment ${segmentFrom} ${this.whereClause})`);
        ctes.push(`Segments AS (SELECT DISTINCT segment FROM FilteredSessions WHERE segment IS NOT NULL)`);

        const hasBase = metrics.some((m: string) => ['companies','contacts','events','sessions'].includes(m));
        const hasInfluenced = metrics.some((m: string) => m.startsWith('influenced_'));
        const hasAttributed = metrics.some((m: string) => m.startsWith('attributed_'));
        
        let finalSelects = ['s.segment'];
        let finalJoins = [];

        if (hasBase) {
            const baseSelects = metrics.filter((m: string) => ['companies','contacts','events','sessions'].includes(m)).map((m: string) => `COUNT(DISTINCT e.dd_${m === 'companies' ? 'company' : m.slice(0, -1)}_id) AS ${m}`).join(', ');
            ctes.push(`BaseBySegment AS (SELECT fs.segment, ${baseSelects} FROM FilteredSessions fs JOIN ${this.eventsTable} e ON fs.dd_session_id = e.dd_session_id GROUP BY 1)`);
            finalSelects.push(...metrics.filter((m: string) => ['companies','contacts','events','sessions'].includes(m)));
            finalJoins.push(`LEFT JOIN BaseBySegment b ON s.segment = b.segment`);
        }
        
        if (hasInfluenced) {
            const influencedStages = Array.from(new Set(metrics.filter((m: string) => m.startsWith('influenced_')).map((m: string) => m.split('_')[1])));
            const funnelClause = getFunnelLengthClause(dataConfig.funnelLength, 'e.timestamp', 's.timestamp');
            const infSelects = metrics.filter((m: string) => m.startsWith('influenced_')).map((m: string) => {
                const stage = m.split('_')[1];
                const type = m.split('_')[2];
                if (type === 'deals') return `COUNT(DISTINCT CASE WHEN s.name = '${sanitizeForSql(stage)}' THEN s.dd_stage_id END) AS ${m}`;
                if (type === 'value') return `SUM(CASE WHEN s.name = '${sanitizeForSql(stage)}' THEN s.value END) AS ${m}`;
                return '';
            }).join(', ');
            
            ctes.push(`InfluencedBySegment AS (SELECT fs.segment, ${infSelects} FROM FilteredSessions fs JOIN ${this.eventsTable} e ON fs.dd_session_id = e.dd_session_id, UNNEST(e.stages) s WHERE s.name IN (${influencedStages.map(s=>`'${s}'`).join(',')}) ${funnelClause} GROUP BY 1)`);
            finalSelects.push(...metrics.filter((m: string) => m.startsWith('influenced_')));
            finalJoins.push(`LEFT JOIN InfluencedBySegment i ON s.segment = i.segment`);
        }
        
        if (hasAttributed) {
             const attributedStages = Array.from(new Set(metrics.filter((m: string) => m.startsWith('attributed_')).map((m: string) => m.split('_')[1])));
             const funnelClause = getFunnelLengthClause(dataConfig.funnelLength, 'r.timestamp', 'r.stage.timestamp');
             const attrSelects = metrics.filter((m: string) => m.startsWith('attributed_')).map((m: string) => {
                 const stage = m.split('_')[1];
                 return `SUM(CASE WHEN r.stage.name = '${sanitizeForSql(stage)}' THEN a.weight ELSE 0 END) AS ${m}`;
             }).join(', ');

             ctes.push(`AttributedBySegment AS (SELECT fs.segment, ${attrSelects} FROM FilteredSessions fs JOIN ${this.attributionTable} r ON fs.dd_session_id = r.dd_session_id, UNNEST(r.attribution) a WHERE a.model = 'Data-Driven' AND r.stage.name IN (${attributedStages.map(s=>`'${s}'`).join(',')}) ${funnelClause} GROUP BY 1)`);
             finalSelects.push(...metrics.filter((m: string) => m.startsWith('attributed_')));
             finalJoins.push(`LEFT JOIN AttributedBySegment att ON s.segment = att.segment`);
        }
        
        if (ctes.length <= 2) return '';

        const primaryMetricForOrder = metrics[0];

        return `
            WITH ${ctes.join(',\n')}
            SELECT ${finalSelects.join(', ')}
            FROM Segments s
            ${finalJoins.join('\n')}
            ORDER BY ${primaryMetricForOrder} DESC NULLS LAST
            LIMIT 10
        `;
    }
}