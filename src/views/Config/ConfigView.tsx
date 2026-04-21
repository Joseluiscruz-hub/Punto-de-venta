import GlassCard from '../../components/common/GlassCard';

export default function ConfigView() {
  return (
    <div className="p-8 h-full flex flex-col gap-6 bg-slate-50 overflow-auto">
      <GlassCard>
        <h1 className="text-2xl font-bold mb-2">Configuración</h1>
        <p className="text-slate-600">Parámetros globales, usuarios, roles y configuración fiscal.</p>
        {/* TODO: Implementar formularios de tienda, usuarios y parámetros fiscales */}
      </GlassCard>
    </div>
  );
}
