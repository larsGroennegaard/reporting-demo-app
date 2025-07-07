// config/outcomePanelConfig.ts

export const outcomePanelConfig = [
  {
    id: 'timePeriod',
    label: 'Time Period',
    type: 'select',
    section: 'filters',
    options: [
        { value: 'this_month', label: 'This Month' },
        { value: 'this_quarter', label: 'This Quarter' },
        { value: 'this_year', label: 'This Year' },
        { value: 'last_month', label: 'Last Month' },
        { value: 'last_quarter', label: 'Last Quarter' },
        { value: 'last_year', label: 'Last Year' },
        { value: 'last_3_months', label: 'Last 3 Months' },
        { value: 'last_6_months', label: 'Last 6 Months' },
        { value: 'last_12_months', label: 'Last 12 Months' },
    ],
  },
  {
    id: 'selectedCountries',
    label: 'Company Country',
    type: 'multiselect',
    section: 'filters',
    optionsSource: 'countryOptions',
    placeholder: 'Select countries...',
  },
  {
    id: 'selectedEmployeeSizes',
    label: 'Number of Employees',
    type: 'multiselect',
    section: 'filters',
    optionsSource: 'employeeOptions',
    placeholder: 'Select sizes...',
  },
  {
    id: 'metrics',
    label: 'Metrics / KPIs',
    type: 'metric-group',
    section: 'kpis',
    optionsSource: 'stageOptions',
  },
  {
    id: 'chartAndTable',
    type: 'chart-table-settings',
    section: 'visualizations',
  },
];