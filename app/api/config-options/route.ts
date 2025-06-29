// app/api/config-options/route.ts
import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Helper function to run a query and flatten the result into a simple array
async function fetchDistinctValues(bigquery: BigQuery, query: string, fieldName: string) {
  const [rows] = await bigquery.query(query);
  // The result is an array of objects, e.g., [{channel: 'Direct'}, {channel: 'Organic'}].
  // We map it to a simple array of strings: ['Direct', 'Organic']
  return rows.map(row => row[fieldName]).filter(Boolean); // filter(Boolean) removes any null/undefined values
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

    // Define all the queries you provided
    const queries = {
      stageNames: {
        query: `SELECT DISTINCT stage_name FROM ${datasetPrefix}.stages\``,
        field: 'stage_name'
      },
      channels: {
        query: `SELECT DISTINCT session.channel FROM ${datasetPrefix}.events\``,
        field: 'channel'
      },
      sources: {
        query: `SELECT DISTINCT session.source FROM ${datasetPrefix}.events\``, // Assuming session.source
        field: 'source'
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

    // Run all queries in parallel for efficiency
    const [
      stageNames,
      channels,
      sources,
      countries,
      employeeBuckets
    ] = await Promise.all([
      fetchDistinctValues(bigquery, queries.stageNames.query, queries.stageNames.field),
      fetchDistinctValues(bigquery, queries.channels.query, queries.channels.field),
      fetchDistinctValues(bigquery, queries.sources.query, queries.sources.field),
      fetchDistinctValues(bigquery, queries.countries.query, queries.countries.field),
      fetchDistinctValues(bigquery, queries.employeeBuckets.query, queries.employeeBuckets.field),
    ]);

    // Return all the option lists in a single JSON object
    return NextResponse.json({
      outcomes: stageNames.sort(),
      countries: countries.sort(),
      // We can add channels, sources, etc. here as we build the UI for them
    });

  } catch (error) {
    console.error("Failed to fetch config options:", error);
    return new NextResponse(JSON.stringify({ error: 'Failed to fetch config options' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}