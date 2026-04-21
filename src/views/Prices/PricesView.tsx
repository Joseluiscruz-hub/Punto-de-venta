import GlassCard from '../../components/common/GlassCard';

export default function PricesView() {
  return (
    <div className="p-8 h-full flex flex-col gap-6 bg-slate-50 overflow-auto">
      <GlassCard>
        <h1 className="text-2xl font-bold mb-2">Gestión de Precios</h1>
        <p className="text-slate-600">Actualiza precios masivamente, gestiona márgenes y reglas de descuento.</p>
        {/* TODO: Implementar importación Excel, tabla de márgenes y reglas */}
      </GlassCard>
    </div>
  );
}
