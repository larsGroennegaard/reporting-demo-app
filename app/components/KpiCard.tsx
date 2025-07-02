// app/components/KpiCard.tsx

export default function KpiCard({ title, value }: { title: any, value: any }) {
  
  let displayValue = value;

  if (typeof value === 'number') {
    // Check if the title suggests it's a currency
    if (title.toLowerCase().includes('value')) {
      displayValue = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } 
    // Check if it's a float (like attributed deals) and round it
    else if (value % 1 !== 0) {
      displayValue = value.toFixed(2);
    }
    // It's an integer, format with commas for readability
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
