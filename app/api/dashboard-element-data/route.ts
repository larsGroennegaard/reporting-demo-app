// app/api/dashboard-element-data/route.ts
import { NextResponse, NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const reportConfig = await request.json();

    if (!reportConfig) {
      return new NextResponse(JSON.stringify({ error: 'Report configuration is required' }), { status: 400 });
    }

    // This is the server-to-server call to the protected endpoint.
    // It safely includes the API key, which is not exposed to the browser.
    const response = await fetch(new URL('/api/v2/report', request.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.NEXT_PUBLIC_API_SECRET_KEY || '',
      },
      body: JSON.stringify(reportConfig),
    });

    if (!response.ok) {
      // Forward the error from the report API if something goes wrong
      const errorData = await response.text();
      return new NextResponse(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("Failed to proxy request for dashboard element data:", error);
    return new NextResponse(JSON.stringify({ error: 'Failed to process request' }), { status: 500 });
  }
}