import GlassCard from '../../components/common/GlassCard';

export default function PurchasesView() {
  return (
    <div className="p-8 h-full flex flex-col gap-6 bg-slate-50 overflow-auto">
      <GlassCard>
        <h1 className="text-2xl font-bold mb-2">Órdenes de Compra</h1>
        <p className="text-slate-600">Aquí podrás gestionar órdenes de compra, sugeridos de resurtido y proveedores.</p>
        {/* TODO: Implementar tabla de órdenes, botón de sugeridos y CRUD de proveedores */}
      </GlassCard>
    </div>
  );
}
