import { useState, useEffect } from 'react';
import { Settings, Save, Store, MapPin, Phone, Shield, DollarSign, Percent, UserCog, Database, Trash2 } from 'lucide-react';
import { BackendAPI } from '../../api/backend';
import type { StoreConfig } from '../../models/types';
import SurfaceCard from '../../components/common/GlassCard';

export default function ConfigView() {
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    BackendAPI.getConfig().then(setConfig);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setIsSaving(true);
    try {
      await BackendAPI.saveConfig(config);
      alert('Configuración guardada correctamente');
    } catch (error) {
      alert('Error al guardar configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const clearDatabase = () => {
    if (confirm('¿Estás SEGURO de que deseas borrar todos los datos? Esta acción es irreversible.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  if (!config) return null;

  return (
    <div className="p-8 h-full flex flex-col space-y-8 bg-bg overflow-y-auto custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary p-2.5 rounded-2xl shadow-lg shadow-primary/20">
              <Settings size={24} className="text-bg" />
            </div>
            <h1 className="text-3xl font-black text-text-strong tracking-tight uppercase">Configuración del Sistema</h1>
          </div>
          <p className="text-text-secondary font-medium">Parámetros globales y administración de infraestructura</p>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-3 px-10 bg-primary text-bg font-black h-14 rounded-xl hover:bg-primary-dark transition-enterprise uppercase tracking-widest text-xs shadow-xl shadow-primary/20"
        >
          <Save size={20} /> {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Información de la Sucursal */}
        <div className="lg:col-span-2 space-y-8">
          <SurfaceCard className="p-10">
             <div className="flex items-center gap-3 mb-8">
                <Store size={20} className="text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-text-strong">Datos de la Sucursal</h3>
             </div>
             
             <form className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1">Nombre Comercial</label>
                   <div className="relative">
                      <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                      <input 
                        type="text" 
                        value={config.name}
                        onChange={(e) => setConfig({...config, name: e.target.value})}
                        className="w-full h-12 bg-surface-1 border border-border-subtle rounded-xl pl-12 pr-4 text-xs font-bold outline-none focus:border-primary transition-enterprise"
                      />
                   </div>
                </div>

                <div className="space-y-3">
                   <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1">Identificación Fiscal (RFC)</label>
                   <div className="relative">
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                      <input 
                        type="text" 
                        value={config.taxId}
                        onChange={(e) => setConfig({...config, taxId: e.target.value})}
                        className="w-full h-12 bg-surface-1 border border-border-subtle rounded-xl pl-12 pr-4 text-xs font-bold outline-none focus:border-primary transition-enterprise"
                      />
                   </div>
                </div>

                <div className="md:col-span-2 space-y-3">
                   <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1">Dirección Física</label>
                   <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                      <input 
                        type="text" 
                        value={config.address}
                        onChange={(e) => setConfig({...config, address: e.target.value})}
                        className="w-full h-12 bg-surface-1 border border-border-subtle rounded-xl pl-12 pr-4 text-xs font-bold outline-none focus:border-primary transition-enterprise"
                      />
                   </div>
                </div>

                <div className="space-y-3">
                   <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1">Teléfono de Contacto</label>
                   <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                      <input 
                        type="text" 
                        value={config.phone}
                        onChange={(e) => setConfig({...config, phone: e.target.value})}
                        className="w-full h-12 bg-surface-1 border border-border-subtle rounded-xl pl-12 pr-4 text-xs font-bold outline-none focus:border-primary transition-enterprise"
                      />
                   </div>
                </div>
             </form>
          </SurfaceCard>

          <SurfaceCard className="p-10">
             <div className="flex items-center gap-3 mb-8">
                <DollarSign size={20} className="text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-text-strong">Impuestos y Divisa</h3>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1">Símbolo de Divisa</label>
                   <input 
                     type="text" 
                     value={config.currency}
                     onChange={(e) => setConfig({...config, currency: e.target.value})}
                     className="w-full h-12 bg-surface-1 border border-border-subtle rounded-xl px-4 text-xs font-black text-primary outline-none focus:border-primary"
                   />
                </div>

                <div className="space-y-3">
                   <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1">Tasa de Impuesto (%)</label>
                   <div className="relative">
                      <Percent className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                      <input 
                        type="number" 
                        value={config.taxRate}
                        onChange={(e) => setConfig({...config, taxRate: Number(e.target.value)})}
                        className="w-full h-12 bg-surface-1 border border-border-subtle rounded-xl px-4 text-xs font-black outline-none focus:border-primary"
                      />
                   </div>
                </div>
             </div>
          </SurfaceCard>
        </div>

        {/* Mantenimiento y Roles */}
        <div className="space-y-8">
           <SurfaceCard className="p-8">
              <div className="flex items-center gap-3 mb-6">
                 <UserCog size={20} className="text-text-secondary" />
                 <h3 className="text-sm font-black uppercase tracking-widest text-text-strong">Roles Activos</h3>
              </div>
              <div className="space-y-3">
                 <div className="flex items-center justify-between p-3 bg-surface-2 rounded-xl border border-border-subtle">
                    <span className="text-xs font-bold">Administrador</span>
                    <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded">Total</span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-surface-2 rounded-xl border border-border-subtle">
                    <span className="text-xs font-bold">Cajero</span>
                    <span className="text-[10px] font-black text-text-secondary bg-surface-1 px-2 py-0.5 rounded">Venta</span>
                 </div>
              </div>
           </SurfaceCard>

           <SurfaceCard className="p-8 border-error/20 bg-error/5">
              <div className="flex items-center gap-3 mb-6">
                 <Database size={20} className="text-error" />
                 <h3 className="text-sm font-black uppercase tracking-widest text-error">Zona de Peligro</h3>
              </div>
              <p className="text-[10px] font-medium text-text-secondary mb-6 leading-relaxed">
                 Acciones críticas de mantenimiento del sistema. Estas operaciones borrarán datos persistentes.
              </p>
              <button 
                onClick={clearDatabase}
                className="w-full h-12 bg-error text-white font-black rounded-xl hover:bg-error/80 transition-enterprise flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
              >
                 <Trash2 size={16} /> Purgar Base de Datos
              </button>
           </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
