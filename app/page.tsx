// app/page.tsx
"use client"; // Add this at the top to make the component interactive

import { useState } from 'react'; // Import useState to manage our selections
import KpiCard from './components/KpiCard';

export default function HomePage() {
  // State to track which KPIs are visible.
  // We set them all to 'true' by default.
  const [visibleKpis, setVisibleKpis] = useState({
    companies: true,
    visitors: true,
    sqlValue: true,
    sqlDeals: true,
    newbizValue: true,
    newbizDeals: true,
  });

  // This function handles changes to the checkboxes
  const handleKpiCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setVisibleKpis(prev => ({
      ...prev,
      [name]: checked,
    }));
  };

  return (
    <main className="flex h-screen bg-gray-100 font-sans">
      {/* Left Configuration Pane */}
      <div className="w-1/3 max-w-sm p-6 bg-white shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Report Configuration</h2>
        
        {/* KPI Card Configuration */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">KPI Cards</h3>
          <div className="space-y-2">
            {/* Each checkbox is now linked to our state */}
            <label className="flex items-center space-x-2">
              <input type="checkbox" name="companies" checked={visibleKpis.companies} onChange={handleKpiCheckboxChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              <span>Companies</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" name="visitors" checked={visibleKpis.visitors} onChange={handleKpiCheckboxChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              <span>Visitors</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" name="sqlValue" checked={visibleKpis.sqlValue} onChange={handleKpiCheckboxChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              <span>Attributed SQL Value</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" name="sqlDeals" checked={visibleKpis.sqlDeals} onChange={handleKpiCheckboxChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              <span>Attributed SQL Deals</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" name="newbizValue" checked={visibleKpis.newbizValue} onChange={handleKpiCheckboxChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              <span>Attributed Newbiz Value</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" name="newbizDeals" checked={visibleKpis.newbizDeals} onChange={handleKpiCheckboxChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              <span>Attributed Newbiz Deals</span>
            </label>
          </div>
        </div>
      </div>

      {/* Right Report Canvas */}
      <div className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Your Report</h1>
        
        {/* KPI Cards Section - now they render based on the state */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {visibleKpis.companies && <KpiCard title="Companies" value="1,250" />}
          {visibleKpis.visitors && <KpiCard title="Visitors" value="15,840" />}
          {visibleKpis.sqlValue && <KpiCard title="Attributed SQL Value" value="$450,120" />}
          {visibleKpis.sqlDeals && <KpiCard title="Attributed SQL Deals" value="128" />}
          {visibleKpis.newbizValue && <KpiCard title="Attributed Newbiz Value" value="$1,280,500" />}
          {visibleKpis.newbizDeals && <KpiCard title="Attributed Newbiz Deals" value="88" />}
        </div>

        {/* We will add the Chart and Table back later */}
        <div className="space-y-8">
        </div>
      </div>
    </main>
  );
}