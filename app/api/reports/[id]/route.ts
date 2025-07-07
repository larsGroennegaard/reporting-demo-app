// app/api/reports/[id]/route.ts
import { NextResponse } from 'next/server';
import { getReport, updateReport, deleteReport } from '@/lib/db';

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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updatedReport = await updateReport(id, body);

    if (updatedReport) {
      return NextResponse.json(updatedReport);
    } else {
      return new NextResponse(JSON.stringify({ error: 'Report not found' }), { status: 404 });
    }
  } catch (error) {
    console.error("Failed to update report:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(JSON.stringify({ error: 'Failed to update report', details: errorMessage }), { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const success = await deleteReport(id);

        if (success) {
            return new NextResponse(null, { status: 204 }); // No Content
        } else {
            return new NextResponse(JSON.stringify({ error: 'Report not found' }), { status: 404 });
        }
    } catch (error) {
        console.error("Failed to delete report:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return new NextResponse(JSON.stringify({ error: 'Failed to delete report', details: errorMessage }), { status: 500 });
    }
}