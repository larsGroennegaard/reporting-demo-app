// app/api/config-options/route.ts
import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

async function fetchDistinctValues(bigquery: BigQuery, query: string, fieldName: string) {
  const [rows] = await bigquery.query(query);
  return rows.map(row => row[fieldName]).filter(Boolean);
}

export async function GET() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || '{}');
    const projectId = process.env.GCP_PROJECT_ID;

    if (!projectId) {
      throw new Error("GCP_PROJECT_ID environment variable not set.");
    }

    const bigquery = new BigQuery({
      projectId: projectId,
      credentials: credentials,
    });

    const datasetPrefix = `\`${projectId}.dreamdata_demo`;

    const queries = {
      stageNames: {
        query: `SELECT DISTINCT stage_name FROM ${datasetPrefix}.stages\``,
        field: 'stage_name'
      },
      countries: {
        query: `SELECT DISTINCT properties.country FROM ${datasetPrefix}.companies\``,
        field: 'country'
      },
      employeeBuckets: {
        query: `SELECT DISTINCT properties.number_of_employees FROM ${datasetPrefix}.companies\``,
        field: 'number_of_employees'
      }
    };

    const [
      stageNames,
      countries,
      employeeBuckets
    ] = await Promise.all([
      fetchDistinctValues(bigquery, queries.stageNames.query, queries.stageNames.field),
      fetchDistinctValues(bigquery, queries.countries.query, queries.countries.field),
      fetchDistinctValues(bigquery, queries.employeeBuckets.query, queries.employeeBuckets.field),
    ]);

    // NEW: Added employeeBuckets to the returned object
    return NextResponse.json({
      outcomes: stageNames.sort(),
      countries: countries.sort(),
      employeeBuckets: employeeBuckets.sort(), 
    });

  } catch (error) {
    console.error("Failed to fetch config options:", error);
    return new NextResponse(JSON.stringify({ error: 'Failed to fetch config options' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}