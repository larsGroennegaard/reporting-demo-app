// app/api/reports/[id]/route.ts
import { NextResponse } from 'next/server';
import { getReport } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const report = await getReport(id);

    if (report) {
      return NextResponse.json(report);
    } else {
      return new NextResponse(JSON.stringify({ error: 'Report not found' }), { status: 404 });
    }
  } catch (error) {
    console.error("Failed to fetch report:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: 'Failed to fetch report', details: errorMessage }), { status: 500 });
  }
}