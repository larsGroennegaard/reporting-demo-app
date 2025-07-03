// app/dashboards/page.tsx
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, ChevronRight, PlusCircle, Trash2, Edit } from 'lucide-react';
import CreateDashboardDialog from '../components/CreateDashboardDialog';
import EditDashboardDialog from '../components/EditDashboardDialog';
import { Button } from '@/components/ui/button';

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
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);

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
        fetchDashboards();
    } catch (error) {
        console.error('Failed to create dashboard:', error);
    }
  };

  const handleSaveEdit = async (id: string, name: string, description: string) => {
    try {
        await fetch(`/api/dashboards/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description }),
        });
        fetchDashboards();
    } catch (error) {
        console.error('Failed to update dashboard:', error);
    }
    setEditingDashboard(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this dashboard? This action cannot be undone.')) {
        try {
            await fetch(`/api/dashboards/${id}`, { method: 'DELETE' });
            fetchDashboards();
        } catch (error) {
            console.error('Failed to delete dashboard:', error);
        }
    }
  };

  return (
    <>
      <CreateDashboardDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={handleCreateDashboard}
      />
      <EditDashboardDialog
        dashboard={editingDashboard}
        open={!!editingDashboard}
        onOpenChange={(isOpen) => !isOpen && setEditingDashboard(null)}
        onSave={handleSaveEdit}
      />
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Dashboards</h1>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
            <PlusCircle size={16} />
            Create Dashboard
          </Button>
        </div>
        {isLoading ? (
          <p className="text-gray-400">Loading dashboards...</p>
        ) : dashboards.length > 0 ? (
          <ul className="space-y-4">
            {dashboards.map((dash) => (
              <li key={dash.id} className="flex items-center justify-between rounded-md bg-gray-800 p-4 transition-colors hover:bg-gray-700 group">
                <Link href={`/dashboard/${dash.id}`} className="flex-grow min-w-0">
                  <div className="flex items-center gap-4">
                    <LayoutDashboard className="h-6 w-6 text-indigo-400" />
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{dash.name}</p>
                      {dash.description && <p className="text-sm text-gray-400 truncate">{dash.description}</p>}
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-2 pl-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => setEditingDashboard(dash)} className="h-8 w-8">
                        <Edit size={16} />
                    </Button>
                     <Button variant="ghost" size="icon" onClick={() => handleDelete(dash.id)} className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive">
                        <Trash2 size={16} />
                    </Button>
                    <ChevronRight className="h-5 w-5 text-gray-500" />
                </div>
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