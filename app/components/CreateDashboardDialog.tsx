// app/components/CreateDashboardDialog.tsx
"use client";

import { useState } from 'react';
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

interface CreateDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, description: string) => void;
}

export default function CreateDashboardDialog({ open, onOpenChange, onSave }: CreateDashboardDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSaveClick = () => {
    if (name.trim()) {
      onSave(name, description);
      onOpenChange(false);
      setName('');
      setDescription('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Dashboard</DialogTitle>
          <DialogDescription>
            Give your new dashboard a name and an optional description.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dashboard Name (e.g., Q2 Marketing Performance)"
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
            Create Dashboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}