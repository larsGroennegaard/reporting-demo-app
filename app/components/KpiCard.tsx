// app/components/KpiCard.tsx

export default function KpiCard({ title, value }: { title: any, value: any }) {
  
  let displayValue = value;

  // Check if the value is a number and the title suggests it's a currency
  if (typeof value === 'number' && title.toLowerCase().includes('value')) {
    displayValue = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  return (
    <div className="bg-gray-800 p-4 shadow rounded-lg text-center">
      <h3 className="text-sm font-medium text-gray-400">{title}</h3>
      <p className="mt-1 text-3xl font-semibold text-white">{displayValue}</p>
    </div>
  );
}