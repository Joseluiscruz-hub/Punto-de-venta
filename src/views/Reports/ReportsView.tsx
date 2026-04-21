import GlassCard from '../../components/common/GlassCard';

export default function ReportsView() {
  return (
    <div className="p-8 h-full flex flex-col gap-6 bg-slate-50 overflow-auto">
      <GlassCard>
        <h1 className="text-2xl font-bold mb-2">Reportes y Auditoría</h1>
        <p className="text-slate-600">Panel visual de rentabilidad, auditoría de inventario y rotación de producto.</p>
        {/* TODO: Implementar dashboards y reportes con recharts */}
      </GlassCard>
    </div>
  );
}
