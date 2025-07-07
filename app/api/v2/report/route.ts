// app/api/v2/report/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { OutcomeQueryBuilder } from '@/lib/query-builders/OutcomeQueryBuilder';
import { EngagementQueryBuilder } from '@/lib/query-builders/EngagementQueryBuilder';

export async function POST(request: NextRequest) {
  try {
    const config = await request.json();
    const projectId = process.env.GCP_PROJECT_ID;

    if (!projectId) {
      throw new Error("GCP_PROJECT_ID environment variable not set.");
    }
    
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || '{}');
    const bigquery = new BigQuery({ projectId, credentials });

    let kpiQuery = '';
    let chartQuery = '';

    if (config.reportArchetype === 'outcome_analysis') {
        const queryBuilder = new OutcomeQueryBuilder(projectId, config);
        kpiQuery = queryBuilder.buildKpiQuery();
        chartQuery = queryBuilder.buildChartQuery();
    } else if (config.reportArchetype === 'engagement_analysis') {
        const queryBuilder = new EngagementQueryBuilder(projectId, config);
        kpiQuery = queryBuilder.buildKpiQuery();
        chartQuery = queryBuilder.buildChartQuery();
    }
    
    const [[kpiResults]] = kpiQuery ? await bigquery.query(kpiQuery) : [[]];
    const [chartResults] = chartQuery ? await bigquery.query(chartQuery) : [[]];

    // Include the generated queries in the response for debugging
    return NextResponse.json({ 
        kpiData: kpiResults || {}, 
        chartData: chartResults || [],
        kpiQuery,
        chartQuery
    });

  } catch (error) {
    console.error("Failed to process report request:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: 'Failed to process report request', details: errorMessage }), { status: 500 });
  }
}