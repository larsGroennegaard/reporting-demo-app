// app/components/KpiCard.tsx

export default function KpiCard({ title, value }: { title: any, value: any }) {
  return (
    // Changed background to dark gray, adjusted text colors for contrast
    <div className="bg-gray-800 p-4 shadow rounded-lg text-center">
      <h3 className="text-sm font-medium text-gray-400">{title}</h3>
      <p className="mt-1 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}