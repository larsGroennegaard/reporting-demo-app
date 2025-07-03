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
import { BarChart2, CheckCircle2, Type } from 'lucide-react';

interface SavedReport {
  id: string;
  name: string;
  config: any;
  createdAt: string;
}

interface AddElementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onElementSelect: (elementType: 'kpi' | 'chart' | 'table' | 'textbox', reportConfig?: any, kpiMetric?: string) => void;
}

export default function AddElementDialog({ open, onOpenChange, onElementSelect }: AddElementDialogProps) {
  const [step, setStep] = useState(1);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [availableElements, setAvailableElements] = useState<any[]>([]);

  useEffect(() => {
    if (open && step === 1) {
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
    }
    if (!open) {
      setStep(1);
      setSelectedReport(null);
    }
  }, [open, step]);

  useEffect(() => {
    if (selectedReport) {
      const config = selectedReport.config;
      const elements: any[] = [];
      
      config.kpiCardConfig.forEach((kpi: any) => elements.push({
        type: 'kpi',
        name: `KPI: ${kpi.metric.replace(/_/g, ' ')}`,
        metric: kpi.metric,
      }));
      elements.push({ type: 'chart', name: 'Chart' });
      elements.push({ type: 'table', name: 'Table' });
      
      setAvailableElements(elements);
      setStep(2);
    }
  }, [selectedReport]);

  const handleElementClick = (element: any) => {
    if (selectedReport) {
      onElementSelect(element.type, selectedReport.config, element.metric);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === 1 ? 'Add an Element' : `Select from "${selectedReport?.name}"`}</DialogTitle>
          <DialogDescription>
            {step === 1 
                ? 'Choose a report to add an element from, or add a new text box.'
                : 'Choose the specific chart, table, or KPI.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-2 max-h-96 overflow-y-auto">
            {step === 1 ? (
                <>
                    <button onClick={() => onElementSelect('textbox')} className="w-full text-left p-3 flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors text-white">
                        <Type className="h-5 w-5 shrink-0" />
                        <span className="flex-grow font-semibold">Add a Text Box</span>
                    </button>
                    <div className="border-b border-gray-700 my-4"></div>
                    {reports.map(report => (
                        <button key={report.id} onClick={() => setSelectedReport(report)} className="w-full text-left p-3 flex items-center gap-3 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors">
                            <BarChart2 className="h-5 w-5 text-indigo-400 shrink-0" />
                            <span className="flex-grow">{report.name}</span>
                        </button>
                    ))}
                </>
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
                <Button variant="outline" onClick={() => { setStep(1); setSelectedReport(null); }}>Back</Button>
            </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}