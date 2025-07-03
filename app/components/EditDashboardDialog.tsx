// app/components/EditDashboardDialog.tsx
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

interface Dashboard {
  id: string;
  name: string;
  description?: string;
}

interface EditDashboardDialogProps {
  dashboard: Dashboard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, name: string, description: string) => void;
}

export default function EditDashboardDialog({ dashboard, open, onOpenChange, onSave }: EditDashboardDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (dashboard) {
      setName(dashboard.name);
      setDescription(dashboard.description || '');
    }
  }, [dashboard]);

  const handleSaveClick = () => {
    if (dashboard && name.trim()) {
      onSave(dashboard.id, name, description);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Dashboard</DialogTitle>
          <DialogDescription>
            Update the name and description of your dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Q2 Marketing Performance"
            className="w-full rounded-md border-input bg-background p-2 text-foreground shadow-inner focus:border-ring focus:ring-ring"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a short description..."
            className="w-full rounded-md border-input bg-background p-2 text-foreground shadow-inner focus:border-ring focus:ring-ring"
            rows={3}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSaveClick} disabled={!name.trim()}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}