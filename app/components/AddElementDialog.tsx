// app/components/AddElementDialog.tsx
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
} from '@/components/ui/dialog';
import { BarChart2, CheckCircle2 } from 'lucide-react';

interface SavedReport {
  id: string;
  name: string;
  config: any;
  createdAt: string;
}

interface AddElementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onElementSelect: (reportConfig: any, elementType: 'kpi' | 'chart' | 'table', kpiMetric?: string) => void;
}

export default function AddElementDialog({ open, onOpenChange, onElementSelect }: AddElementDialogProps) {
  const [step, setStep] = useState(1);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [availableElements, setAvailableElements] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      const fetchReports = async () => {
        try {
          const res = await fetch('/api/reports');
          const data = await res.json();
          setReports(data);
        } catch (error) {
          console.error("Failed to fetch reports for dialog:", error);
        }
      };
      fetchReports();
    } else {
      // Reset state when dialog closes
      setStep(1);
      setSelectedReport(null);
      setAvailableElements([]);
    }
  }, [open]);

  useEffect(() => {
    if (selectedReport) {
      const config = selectedReport.config;
      const elements: any[] = [];
      
      // Add KPI cards
      config.kpiCardConfig.forEach((kpi: any) => elements.push({
        type: 'kpi',
        name: `KPI: ${kpi.metric.replace(/_/g, ' ')}`,
        metric: kpi.metric,
      }));

      // Add Chart
      elements.push({ type: 'chart', name: 'Chart' });
      
      // Add Table
      elements.push({ type: 'table', name: 'Table' });
      
      setAvailableElements(elements);
      setStep(2);
    }
  }, [selectedReport]);

  const handleElementClick = (element: any) => {
    if (selectedReport) {
      onElementSelect(selectedReport.config, element.type, element.metric);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === 1 ? 'Step 1: Select a Report' : `Step 2: Select an Element from "${selectedReport?.name}"`}</DialogTitle>
          <DialogDescription>
            {step === 1 
                ? 'Choose the report you want to pull an element from.'
                : 'Choose the specific chart, table, or KPI to add to your dashboard.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-2 max-h-96 overflow-y-auto">
            {step === 1 ? (
                reports.map(report => (
                    <button key={report.id} onClick={() => setSelectedReport(report)} className="w-full text-left p-3 flex items-center gap-3 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors">
                        <BarChart2 className="h-5 w-5 text-indigo-400 shrink-0" />
                        <span className="flex-grow">{report.name}</span>
                    </button>
                ))
            ) : (
                availableElements.map(element => (
                     <button key={element.name} onClick={() => handleElementClick(element)} className="w-full text-left p-3 flex items-center gap-3 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors">
                        <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
                        <span className="flex-grow">{element.name}</span>
                    </button>
                ))
            )}
        </div>
        
        {step === 2 && (
             <DialogFooter>
                <Button variant="outline" onClick={() => setStep(1)}>Back to Reports</Button>
            </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}