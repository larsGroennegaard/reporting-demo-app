// app/api/dashboards/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getAllDashboards, createDashboard } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const dashboards = await getAllDashboards();
    return NextResponse.json(dashboards);
  } catch (error) {
    console.error("Failed to fetch dashboards:", error);
    return new NextResponse(JSON.stringify({ error: 'Failed to fetch dashboards' }), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json();
    if (!name) {
      return new NextResponse(JSON.stringify({ error: 'Name is required' }), { status: 400 });
    }
    const newDashboard = await createDashboard(name, description);
    return NextResponse.json(newDashboard, { status: 201 });
  } catch (error) {
    console.error("Failed to create dashboard:", error);
    return new NextResponse(JSON.stringify({ error: 'Failed to create dashboard' }), { status: 500 });
  }
}