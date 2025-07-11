// app/components/KpiCard.tsx

export default function KpiCard({ title, value }: { title: any, value: any }) {
  
  let displayValue = value;

  if (typeof value === 'number') {
    if (title.toLowerCase().includes('value')) {
      displayValue = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } 
    else if (value % 1 !== 0) {
      displayValue = value.toFixed(2);
    }
    else {
      displayValue = new Intl.NumberFormat('en-US').format(value);
    }
  }

  return (
    <div className="bg-gray-800 p-4 shadow rounded-lg text-center">
      <h3 className="text-sm font-medium text-gray-400">{title}</h3>
      <p className="mt-1 text-3xl font-semibold text-white">{displayValue}</p>
    </div>
  );
}