// app/reports/page.tsx
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart2, ChevronRight } from 'lucide-react';

interface SavedReport {
  id: string;
  name: string;
  config: any; // You can define a more specific type if needed
  createdAt: string;
}

export default function ReportsPage() {
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch('/api/reports');
        if (!response.ok) {
          throw new Error('Failed to fetch reports');
        }
        const data = await response.json();
        setSavedReports(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, []);

  if (isLoading) {
    return <div className="p-8 text-white">Loading reports...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Saved Reports</h1>
      {savedReports.length > 0 ? (
        <ul className="space-y-4">
          {savedReports.map((report) => (
            <li key={report.id}>
              <Link href={`/report/${report.id}`}>
                <div className="flex items-center justify-between rounded-md bg-gray-800 p-4 transition-colors hover:bg-gray-700">
                  <div className="flex items-center gap-4">
                    <BarChart2 className="h-6 w-6 text-indigo-400" />
                    <div>
                      <p className="font-semibold text-white">{report.name}</p>
                      <p className="text-sm text-gray-400">
                        Saved on {new Date(report.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-400">You have no saved reports.</p>
      )}
    </div>
  );
}