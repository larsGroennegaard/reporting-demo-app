// lib/query-builders/OutcomeQueryBuilder.ts

const sanitizeForSql = (value: string) => value.replace(/'/g, "\\'");

const getTimePeriodClause = (timePeriod: string, timestampColumn: string = 's.timestamp'): string => {
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

export class OutcomeQueryBuilder {
    private projectId: string;
    private stagesTable: string;
    private companiesTable: string;
    private config: any;

    constructor(projectId: string, config: any) {
        this.projectId = projectId;
        this.stagesTable = `\`${projectId}.dreamdata_demo.stages\``;
        this.companiesTable = `\`${projectId}.dreamdata_demo.companies\``;
        this.config = config;
    }

    private buildFromAndWhereClauses() {
        const { dataConfig } = this.config;
        const hasFilters = dataConfig.selectedCountries?.length > 0 || dataConfig.selectedEmployeeSizes?.length > 0;
        const needsCompanyJoin = hasFilters || dataConfig.reportFocus === 'segmentation' || this.config.chart.variant === 'time_series_segmented';

        let fromClause = `FROM ${this.stagesTable} s`;
        if (needsCompanyJoin) {
            fromClause += ` LEFT JOIN ${this.companiesTable} c ON s.dd_company_id = c.dd_company_id`;
        }

        let whereClause = `WHERE 1=1 ${getTimePeriodClause(dataConfig.timePeriod, 's.timestamp')}`;
        if (dataConfig.selectedCountries?.length > 0) {
            whereClause += ` AND c.properties.country IN (${dataConfig.selectedCountries.map((c: string) => `'${sanitizeForSql(c)}'`).join(',')})`;
        }
        if (dataConfig.selectedEmployeeSizes?.length > 0) {
            whereClause += ` AND c.properties.number_of_employees IN (${dataConfig.selectedEmployeeSizes.map((s: string) => `'${sanitizeForSql(s)}'`).join(',')})`;
        }
        
        return { fromClause, whereClause };
    }

    buildKpiQuery(): string {
        const { kpiCards } = this.config;
        if (!kpiCards || kpiCards.length === 0) return '';
        
        const { fromClause, whereClause } = this.buildFromAndWhereClauses();

        const kpiSelects = kpiCards.map((kpi: any) => {
            const [stage, type] = kpi.metric.split('_');
            if (type === 'deals') {
                return `COUNT(DISTINCT CASE WHEN s.stage_name = '${sanitizeForSql(stage)}' THEN s.dd_stage_id ELSE NULL END) AS ${kpi.metric}`;
            }
            if (type === 'value') {
                return `SUM(CASE WHEN s.stage_name = '${sanitizeForSql(stage)}' THEN s.value ELSE 0 END) AS ${kpi.metric}`;
            }
            return '';
        }).join(', ');
        
        return kpiSelects ? `SELECT ${kpiSelects} ${fromClause} ${whereClause}` : '';
    }

    buildChartQuery(): string {
        const { chart, dataConfig } = this.config;
        if (!chart) return '';

        const { fromClause, whereClause } = this.buildFromAndWhereClauses();

        if (dataConfig.reportFocus === 'segmentation') {
            const segmentCol = chart.breakdown === 'companyCountry' ? 'c.properties.country' : 'c.properties.number_of_employees';
            const chartSelects = chart.metrics.map((metric: string) => {
                const [stage, type] = metric.split('_');
                 if (type === 'deals') return `COUNT(DISTINCT CASE WHEN s.stage_name = '${sanitizeForSql(stage)}' THEN s.dd_stage_id ELSE NULL END) AS ${metric}`;
                 if (type === 'value') return `SUM(CASE WHEN s.stage_name = '${sanitizeForSql(stage)}' THEN s.value ELSE 0 END) AS ${metric}`;
                return '';
            }).join(', ');

            if (!chartSelects) return '';
            
            return `
                WITH AllSegments AS (SELECT ${segmentCol} as segment, ${chartSelects} ${fromClause} ${whereClause} GROUP BY segment HAVING segment IS NOT NULL)
                SELECT * FROM AllSegments ORDER BY ${chart.metrics[0]} DESC LIMIT 10
            `;
        }

        // Time Series Logic
        const monthSelect = `FORMAT_TIMESTAMP('%Y-%m-%d', DATE_TRUNC(s.timestamp, MONTH)) as month`;
        if (chart.variant === 'time_series_segmented') {
            const [stage, type] = chart.metric.split('_');
            const metricSelect = type === 'deals' ? `COUNT(DISTINCT s.dd_stage_id)` : `SUM(s.value)`;
            const segmentCol = chart.breakdown === 'companyCountry' ? 'c.properties.country' : 'c.properties.number_of_employees';

            return `
                WITH TopSegments AS (
                    SELECT ${segmentCol} as segment 
                    ${fromClause}
                    ${whereClause} AND s.stage_name = '${sanitizeForSql(stage)}' AND ${segmentCol} IS NOT NULL
                    GROUP BY segment ORDER BY ${metricSelect} DESC LIMIT 5
                ),
                MonthlyData AS (
                    SELECT ${monthSelect}, ${segmentCol} as segment, ${metricSelect} as value
                    ${fromClause}
                    ${whereClause} AND s.stage_name = '${sanitizeForSql(stage)}'
                    GROUP BY month, segment
                )
                SELECT md.month, md.segment, md.value FROM MonthlyData md JOIN TopSegments ts ON md.segment = ts.segment ORDER BY md.month
            `;
        } else { // time_series_line
            const chartSelects = chart.metrics.map((metric: string) => {
                const [stage, type] = metric.split('_');
                if (type === 'deals') return `COUNT(DISTINCT CASE WHEN s.stage_name = '${sanitizeForSql(stage)}' THEN s.dd_stage_id ELSE NULL END) AS ${metric}`;
                if (type === 'value') return `SUM(CASE WHEN s.stage_name = '${sanitizeForSql(stage)}' THEN s.value ELSE 0 END) AS ${metric}`;
                return '';
            }).join(', ');
            
            return chartSelects ? `SELECT ${monthSelect}, ${chartSelects} ${fromClause} ${whereClause} GROUP BY month ORDER BY month` : '';
        }
    }
}