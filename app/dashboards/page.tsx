// app/dashboards/page.tsx
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, ChevronRight, PlusCircle } from 'lucide-react';
import CreateDashboardDialog from '../components/CreateDashboardDialog';

interface Dashboard {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const fetchDashboards = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/dashboards');
      if (!response.ok) throw new Error('Failed to fetch dashboards');
      const data = await response.json();
      setDashboards(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboards();
  }, []);

  const handleCreateDashboard = async (name: string, description: string) => {
    try {
        await fetch('/api/dashboards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description }),
        });
        fetchDashboards(); // Refresh the list
    } catch (error) {
        console.error('Failed to create dashboard:', error);
    }
  };

  return (
    <>
      <CreateDashboardDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={handleCreateDashboard}
      />
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Dashboards</h1>
          <button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
            <PlusCircle size={16} />
            Create Dashboard
          </button>
        </div>
        {isLoading ? (
          <p className="text-gray-400">Loading dashboards...</p>
        ) : dashboards.length > 0 ? (
          <ul className="space-y-4">
            {dashboards.map((dash) => (
              <li key={dash.id}>
                <Link href={`/dashboard/${dash.id}`}>
                    <div className="flex items-center justify-between rounded-md bg-gray-800 p-4 transition-colors hover:bg-gray-700">
                    <div className="flex items-center gap-4">
                        <LayoutDashboard className="h-6 w-6 text-indigo-400" />
                        <div>
                        <p className="font-semibold text-white">{dash.name}</p>
                        {dash.description && <p className="text-sm text-gray-400">{dash.description}</p>}
                        </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-500" />
                    </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400">You have no dashboards yet. Create one to get started.</p>
        )}
      </div>
    </>
  );
}