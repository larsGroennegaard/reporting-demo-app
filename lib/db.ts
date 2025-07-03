// lib/db.ts
import { Redis } from '@upstash/redis';

// Redis.fromEnv() is a convenient method that automatically reads the
// connection details from the environment variables.
const redis = Redis.fromEnv();

const REPORTS_KEY = 'saved_reports';

interface SavedReport {
  id: string;
  name: string;
  description?: string;
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

// Function to update an existing report
export async function updateReport(id: string, name: string, description: string): Promise<SavedReport | null> {
    const reports = await getAllReports();
    const reportIndex = reports.findIndex(r => r.id === id);
    if (reportIndex === -1) return null;

    reports[reportIndex] = { ...reports[reportIndex], name, description };
    await redis.set(REPORTS_KEY, reports);
    return reports[reportIndex];
}

// Function to delete a report by ID
export async function deleteReport(id: string): Promise<boolean> {
    const reports = await getAllReports();
    const updatedReports = reports.filter(r => r.id !== id);

    if (reports.length === updatedReports.length) return false;

    await redis.set(REPORTS_KEY, updatedReports);
    return true;
}