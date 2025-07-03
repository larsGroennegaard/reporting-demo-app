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

interface SaveReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
}

export default function SaveReportDialog({ open, onOpenChange, onSave }: SaveReportDialogProps) {
  const [reportName, setReportName] = useState('');

  const handleSaveClick = () => {
    if (reportName.trim()) {
      onSave(reportName);
      onOpenChange(false);
      setReportName('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Report</DialogTitle>
          <DialogDescription>
            Give your report a name to save it for later.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <input
            type="text"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            placeholder="e.g., Q1 Marketing Pipeline"
            className="w-full rounded-md border-input bg-background p-2 text-foreground shadow-inner focus:border-ring focus:ring-ring"
            onKeyDown={(e) => e.key === 'Enter' && handleSaveClick()}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSaveClick} disabled={!reportName.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}