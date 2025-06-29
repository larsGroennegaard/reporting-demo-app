// app/api/report/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Read the configuration object sent from our frontend
  const config = await request.json();

  // --- MOCK DATA GENERATION ---
  // This is where we will eventually generate SQL and query BigQuery[cite: 4].
  // For now, we'll return different hardcoded data based on the selected outcome
  // to simulate a real backend.

  let mockData = {};

  if (config.outcome === 'NewBiz') {
    mockData = {
      totalValue: "$1,280,500",
      influencedValue: "$850,000",
      totalDeals: 88,
    };
  } else if (config.outcome === 'SQL') {
    mockData = {
      totalValue: "$12,450,100",
      influencedValue: "$9,120,000",
      totalDeals: 450,
    };
  } else { // MQL
    mockData = {
      totalValue: "N/A",
      influencedValue: "N/A",
      totalDeals: 12530,
    };
  }

  // Return the mock data as a JSON response
  return NextResponse.json(mockData);
}