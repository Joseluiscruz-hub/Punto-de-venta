import GlassCard from '../../components/common/GlassCard';

export default function ClientsView() {
  return (
    <div className="p-8 h-full flex flex-col gap-6 bg-slate-50 overflow-auto">
      <GlassCard>
        <h1 className="text-2xl font-bold mb-2">Clientes</h1>
        <p className="text-slate-600">Administra cuentas por cobrar, historial de compras y niveles de cliente.</p>
        {/* TODO: Implementar cuentas por cobrar, historial y etiquetas */}
      </GlassCard>
    </div>
  );
}
