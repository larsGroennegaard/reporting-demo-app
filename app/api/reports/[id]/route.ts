// app/api/reports/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { savedReports } from '@/lib/db'; // Import the shared array

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> } 
) {
  try {
    const { id } = await params; // Await the promise to get the id
    
    // Now searching in our shared in-memory "database"
    const report = savedReports.find(r => r.id === id);

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