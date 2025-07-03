// app/api/reports/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getAllReports, saveReport } from '@/lib/db';

// GET - To fetch all saved reports
export async function GET(request: NextRequest) {
  try {
    const reports = await getAllReports();
    return NextResponse.json(reports);
  } catch (error) {
    console.error("Failed to fetch reports:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: 'Failed to fetch reports', details: errorMessage }), { status: 500 });
  }
}

// POST - To save a new report
export async function POST(request: NextRequest) {
  try {
    const report = await request.json();
    await saveReport(report);
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("Failed to save report:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: 'Failed to save report', details: errorMessage }), { status: 500 });
  }
}