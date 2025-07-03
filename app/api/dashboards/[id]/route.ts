// app/api/dashboards/[id]/route.ts
import { NextResponse } from 'next/server';
import { getDashboard, updateDashboard, deleteDashboard } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dashboard = await getDashboard(id);
    if (dashboard) {
      return NextResponse.json(dashboard);
    } else {
      return new NextResponse(JSON.stringify({ error: 'Dashboard not found' }), { status: 404 });
    }
  } catch (error) {
    console.error(`Failed to fetch dashboard ${params}:`, error);
    return new NextResponse(JSON.stringify({ error: 'Failed to fetch dashboard' }), { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updatedDashboard = await updateDashboard(id, body);
    if (updatedDashboard) {
      return NextResponse.json(updatedDashboard);
    } else {
      return new NextResponse(JSON.stringify({ error: 'Dashboard not found' }), { status: 404 });
    }
  } catch (error) {
    console.error(`Failed to update dashboard ${params}:`, error);
    return new NextResponse(JSON.stringify({ error: 'Failed to update dashboard' }), { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await deleteDashboard(id);
    if (success) {
      return new NextResponse(null, { status: 204 });
    } else {
      return new NextResponse(JSON.stringify({ error: 'Dashboard not found' }), { status: 404 });
    }
  } catch (error) {
    console.error(`Failed to delete dashboard ${params}:`, error);
    return new NextResponse(JSON.stringify({ error: 'Failed to delete dashboard' }), { status: 500 });
  }
}