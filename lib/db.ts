// lib/db.ts
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const REPORTS_KEY = 'saved_reports';
interface SavedReport {
  id: string;
  name: string;
  description?: string;
  config: any;
  createdAt: string;
}

const DASHBOARDS_KEY = 'dashboards';
interface DashboardItemLayout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
}
interface DashboardItem {
    id: string;
    reportConfig?: any; // Optional now
    elementType: 'chart' | 'table' | 'kpi' | 'textbox';
    kpiMetric?: string;
    content?: string; // For textbox content
    layout: DashboardItemLayout;
}
interface Dashboard {
  id: string;
  name: string;
  description?: string;
  items: DashboardItem[];
  createdAt: string;
}

// --- Report Functions ---
export async function getAllReports(): Promise<SavedReport[]> {
  const reports = await redis.get<SavedReport[]>(REPORTS_KEY);
  return reports || [];
}
export async function getReport(id: string): Promise<SavedReport | null> {
  const reports = await getAllReports();
  return reports.find(r => r.id === id) || null;
}
export async function saveReport(report: SavedReport): Promise<void> {
  const reports = await getAllReports();
  reports.push(report);
  await redis.set(REPORTS_KEY, reports);
}
export async function updateReport(id: string, reportData: Partial<SavedReport>): Promise<SavedReport | null> {
    const reports = await getAllReports();
    const reportIndex = reports.findIndex(r => r.id === id);
    if (reportIndex === -1) return null;
    reports[reportIndex] = { ...reports[reportIndex], ...reportData };
    await redis.set(REPORTS_KEY, reports);
    return reports[reportIndex];
}
export async function deleteReport(id: string): Promise<boolean> {
    const reports = await getAllReports();
    const updatedReports = reports.filter(r => r.id !== id);
    if (reports.length === updatedReports.length) return false;
    await redis.set(REPORTS_KEY, updatedReports);
    return true;
}

// --- Dashboard Functions ---
export async function getAllDashboards(): Promise<Dashboard[]> {
  const dashboards = await redis.get<Dashboard[]>(DASHBOARDS_KEY);
  return dashboards || [];
}
export async function getDashboard(id: string): Promise<Dashboard | null> {
  const dashboards = await getAllDashboards();
  return dashboards.find(d => d.id === id) || null;
}
export async function createDashboard(name: string, description?: string): Promise<Dashboard> {
  const dashboards = await getAllDashboards();
  const newDashboard: Dashboard = {
    id: Date.now().toString(),
    name,
    description: description || '',
    items: [],
    createdAt: new Date().toISOString(),
  };
  dashboards.push(newDashboard);
  await redis.set(DASHBOARDS_KEY, dashboards);
  return newDashboard;
}
export async function updateDashboard(id: string, updates: Partial<Dashboard>): Promise<Dashboard | null> {
  const dashboards = await getAllDashboards();
  const dashIndex = dashboards.findIndex(d => d.id === id);
  if (dashIndex === -1) return null;
  dashboards[dashIndex] = { ...dashboards[dashIndex], ...updates };
  await redis.set(DASHBOARDS_KEY, dashboards);
  return dashboards[dashIndex];
}
export async function deleteDashboard(id: string): Promise<boolean> {
  const dashboards = await getAllDashboards();
  const updatedDashboards = dashboards.filter(d => d.id !== id);
  if (dashboards.length === updatedDashboards.length) return false;
  await redis.set(DASHBOARDS_KEY, updatedDashboards);
  return true;
}