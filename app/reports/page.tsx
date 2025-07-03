// app/reports/page.tsx
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart2, ChevronRight, Trash2, Edit } from 'lucide-react';
import EditReportDialog from '../components/EditReportDialog';

interface SavedReport {
  id: string;
  name: string;
  description?: string;
  config: any;
  createdAt: string;
}

export default function ReportsPage() {
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingReport, setEditingReport] = useState<SavedReport | null>(null);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/reports');
      if (!response.ok) throw new Error('Failed to fetch reports');
      const data = await response.json();
      setSavedReports(data);
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
        fetchReports(); // Refresh the list
      } catch (error) {
        console.error('Failed to delete report:', error);
      }
    }
  };

  const handleSaveEdit = async (id: string, name: string, description: string) => {
    try {
        await fetch(`/api/reports/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description }),
        });
        fetchReports(); // Refresh the list
    } catch (error) {
        console.error('Failed to update report:', error);
    }
    setEditingReport(null);
  };

  if (isLoading) {
    return <div className="p-8 text-white">Loading reports...</div>;
  }

  return (
    <>
      <EditReportDialog
        report={editingReport}
        open={!!editingReport}
        onOpenChange={(isOpen) => !isOpen && setEditingReport(null)}
        onSave={handleSaveEdit}
      />
      <div className="p-8">
        <h1 className="text-3xl font-bold text-white mb-8">Saved Reports</h1>
        {savedReports.length > 0 ? (
          <ul className="space-y-4">
            {savedReports.map((report) => (
              <li key={report.id} className="flex items-center justify-between rounded-md bg-gray-800 p-4 transition-colors hover:bg-gray-700 group">
                <Link href={`/report/${report.id}`} className="flex-grow">
                  <div className="flex items-center gap-4">
                    <BarChart2 className="h-6 w-6 text-indigo-400" />
                    <div>
                      <p className="font-semibold text-white">{report.name}</p>
                      {report.description && <p className="text-sm text-gray-400">{report.description}</p>}
                      <p className="text-xs text-gray-500">
                        Saved on {new Date(report.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingReport(report)} className="p-2 text-gray-400 hover:text-white"><Edit size={16} /></button>
                    <button onClick={() => handleDelete(report.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                    <ChevronRight className="h-5 w-5 text-gray-500" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400">You have no saved reports.</p>
        )}
      </div>
    </>
  );
}