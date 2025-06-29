// app/page.tsx
"use client"; 

import { useState } from 'react';
import KpiCard from './components/KpiCard';

export default function HomePage() {
  const [outcome, setOutcome] = useState('NewBiz');
  const [timePeriod, setTimePeriod] = useState('this_year');
  const [companyCountry, setCompanyCountry] = useState('all');

  return (
    // Changed main background to dark gray, default text to light gray
    <main className="flex h-screen bg-gray-900 text-gray-300 font-sans">
      
      {/* Left Configuration Pane */}
      <div className="w-1/3 max-w-sm p-6 bg-gray-800 shadow-lg overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-white">Report Configuration</h2>
        
        <div className="mb-6">
          <label htmlFor="reportType" className="block text-sm font-medium text-gray-400">Report Type</label>
          <p id="reportType" className="text-lg font-semibold text-indigo-400">Outcome Analysis</p>
        </div>

        <div className="space-y-6">
          <div>
            <label htmlFor="outcome" className="block text-sm font-medium text-gray-400">
              Outcome
            </label>
            {/* Added dark-theme classes to the select element */}
            <select
              id="outcome"
              name="outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="MQL">MQL</option>
              <option value="SQL">SQL</option>
              <option value="NewBiz">NewBiz</option>
            </select>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2 text-gray-100">Filters</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="timePeriod" className="block text-sm font-medium text-gray-400">
                  Time Period
                </label>
                <select
                  id="timePeriod"
                  name="timePeriod"
                  value={timePeriod}
                  onChange={(e) => setTimePeriod(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  <option value="this_year">This Year</option>
                  <option value="last_quarter">Last Quarter</option>
                  <option value="last_month">Last Month</option>
                </select>
              </div>
              <div>
                <label htmlFor="companyCountry" className="block text-sm font-medium text-gray-400">
                  Company Country
                </label>
                <select
                  id="companyCountry"
                  name="companyCountry"
                  value={companyCountry}
                  onChange={(e) => setCompanyCountry(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  <option value="all">All Countries</option>
                  <option value="usa">USA</option>
                  <option value="germany">Germany</option>
                  <option value="uk">United Kingdom</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Report Canvas */}
      <div className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-6 text-white">Your Report</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <KpiCard title="Companies" value="1,250" />
          <KpiCard title="Visitors" value="15,840" />
          <KpiCard title="Attributed SQL Value" value="$450,120" />
          <KpiCard title="Attributed SQL Deals" value="128" />
          <KpiCard title="Attributed Newbiz Value" value="$1,280,500" />
          <KpiCard title="Attributed Newbiz Deals" value="88" />
        </div>
        <div className="space-y-8">
          {/* We will add the Chart and Table back later */}
        </div>
      </div>
    </main>
  );
}