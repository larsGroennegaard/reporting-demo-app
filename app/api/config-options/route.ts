// app/api/config-options/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

async function fetchDistinctValues(bigquery: BigQuery, query: string, fieldName: string) {
  const [rows] = await bigquery.query(query);
  return rows.map(row => row[fieldName]).filter(Boolean);
}


export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== process.env.NEXT_PUBLIC_API_SECRET_KEY) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || '{}');
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) { throw new Error("GCP_PROJECT_ID environment variable not set."); }
    const bigquery = new BigQuery({ projectId, credentials });
    const eventsTable = `\`${projectId}.dreamdata_demo.events\``;
    
    const queries = {
        stageNames: { query: `SELECT DISTINCT stage_name FROM \`${projectId}.dreamdata_demo.stages\` WHERE stage_name IS NOT NULL`, field: 'stage_name' },
        countries: { query: `SELECT DISTINCT properties.country FROM \`${projectId}.dreamdata_demo.companies\` WHERE properties.country IS NOT NULL`, field: 'country' },
        employeeBuckets: { query: `SELECT DISTINCT properties.number_of_employees FROM \`${projectId}.dreamdata_demo.companies\` WHERE properties.number_of_employees IS NOT NULL`, field: 'number_of_employees' },
        eventNames: { query: `SELECT DISTINCT event_name FROM ${eventsTable} WHERE event_name IS NOT NULL`, field: 'event_name' },
        signalNames: { query: `SELECT DISTINCT s.name FROM ${eventsTable}, UNNEST(signals) as s WHERE s.name IS NOT NULL`, field: 'name'},
        // ADDED: Query to get distinct channel names
        channels: { query: `SELECT DISTINCT session.channel FROM ${eventsTable} WHERE session.channel IS NOT NULL`, field: 'channel' }
    };

    const [ stageNames, countries, employeeBuckets, eventNames, signalNames, channels ] = await Promise.all([
      fetchDistinctValues(bigquery, queries.stageNames.query, queries.stageNames.field),
      fetchDistinctValues(bigquery, queries.countries.query, queries.countries.field),
      fetchDistinctValues(bigquery, queries.employeeBuckets.query, queries.employeeBuckets.field),
      fetchDistinctValues(bigquery, queries.eventNames.query, queries.eventNames.field),
      fetchDistinctValues(bigquery, queries.signalNames.query, queries.signalNames.field),
      fetchDistinctValues(bigquery, queries.channels.query, queries.channels.field),
    ]);

    return NextResponse.json({
      outcomes: stageNames.sort(),
      countries: countries.sort(),
      employeeBuckets: employeeBuckets.sort(),
      eventNames: eventNames.sort(),
      signalNames: signalNames.sort(),
      channels: channels.sort(),
    });

  } catch (error) {
    console.error("Failed to fetch config options:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: 'Failed to fetch config options', details: errorMessage }), { status: 500 });
  }
}