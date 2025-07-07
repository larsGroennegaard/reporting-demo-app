// app/reports/page.tsx
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart2, ChevronRight, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Report {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/reports');
      if (!response.ok) throw new Error('Failed to fetch reports');
      const data = await response.json();
      setReports(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this report?')) {
      try {
        await fetch(`/api/reports/${id}`, { method: 'DELETE' });
        fetchReports();
      } catch (error) {
        console.error('Failed to delete report:', error);
      }
    }
  };

  if (isLoading) {
    return <div className="p-8 text-white">Loading reports...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Reports</h1>
        <Link href="/report/new">
          <Button>Create New Report</Button>
        </Link>
      </div>
      {reports.length > 0 ? (
        <ul className="space-y-4">
          {reports.map((report) => (
            <li key={report.id} className="flex items-center justify-between rounded-md bg-gray-800 p-4 transition-colors hover:bg-gray-700 group">
              <Link href={`/report/${report.id}`} className="flex-grow min-w-0">
                <div className="flex items-center gap-4">
                  <BarChart2 className="h-6 w-6 text-indigo-400" />
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{report.name}</p>
                    {report.description && <p className="text-sm text-gray-400 truncate">{report.description}</p>}
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-2 pl-4 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Button variant="ghost" size="icon" onClick={() => handleDelete(report.id)} className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive">
                      <Trash2 size={16} />
                  </Button>
                  <ChevronRight className="h-5 w-5 text-gray-500" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-400">You have no saved reports.</p>
      )}
    </div>
  );
}