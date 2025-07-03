// lib/db.ts
import { Redis } from '@upstash/redis';

// The Upstash client will use the environment variables automatically
// added to your project when you connected the database.
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const REPORTS_KEY = 'saved_reports';

interface SavedReport {
  id: string;
  name: string;
  config: any;
  createdAt: string;
}

// Function to get all reports
export async function getAllReports(): Promise<SavedReport[]> {
  const reports = await redis.get<SavedReport[]>(REPORTS_KEY);
  return reports || [];
}

// Function to get a single report by ID
export async function getReport(id: string): Promise<SavedReport | null> {
  const reports = await getAllReports();
  return reports.find(r => r.id === id) || null;
}

// Function to save a new report
export async function saveReport(report: SavedReport): Promise<void> {
  const reports = await getAllReports();
  reports.push(report);
  await redis.set(REPORTS_KEY, reports);
}