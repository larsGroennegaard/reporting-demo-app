// app/components/EditReportDialog.tsx
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

interface SavedReport {
  id: string;
  name: string;
  description?: string;
  config: any;
  createdAt: string;
}

interface EditReportDialogProps {
  report: SavedReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, name: string, description: string) => void;
}

export default function EditReportDialog({ report, open, onOpenChange, onSave }: EditReportDialogProps) {
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');

  useEffect(() => {
    if (report) {
      setReportName(report.name);
      setReportDescription(report.description || '');
    }
  }, [report]);

  const handleSaveClick = () => {
    if (report && reportName.trim()) {
      onSave(report.id, reportName, reportDescription);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-800 text-white border-gray-700">
        <DialogHeader>
          <DialogTitle>Edit Report</DialogTitle>
          <DialogDescription>
            Update the name and description of your report.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <input
            type="text"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            placeholder="e.g., Q1 Marketing Pipeline"
            className="w-full rounded-md border-gray-600 bg-gray-700 p-2 text-white shadow-inner focus:border-indigo-500 focus:ring-indigo-500"
          />
          <textarea
            value={reportDescription}
            onChange={(e) => setReportDescription(e.target.value)}
            placeholder="Add a short description..."
            className="w-full rounded-md border-gray-600 bg-gray-700 p-2 text-white shadow-inner focus:border-indigo-500 focus:ring-indigo-500"
            rows={3}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSaveClick} disabled={!reportName.trim()}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}