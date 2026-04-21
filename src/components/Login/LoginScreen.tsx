import { useState, useEffect } from 'react';
import { ShieldCheck, Lock, ArrowRight, Store, Wifi, Terminal, MapPin, UserCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { BackendAPI } from '../../api/backend';
import type { Money } from '../../models/types';
import { formatCurrency } from '../../utils/formatters';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState('CASHIER');
  const [branch, setBranch] = useState('Central');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Stats simulados para la columna izquierda
  const [stats, setStats] = useState({
    ventasHoy: 0 as Money,
    sucursales: 4,
    syncStatus: 'Sincronizado'
  });

  useEffect(() => {
    BackendAPI.getSales().then(sales => {
      const today = sales.filter(s => new Date(s.date).toDateString() === new Date().toDateString());
      setStats(prev => ({ ...prev, ventasHoy: today.reduce((sum, s) => sum + s.total, 0) }));
    });
    
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, pin);
    } catch (err: any) {
      setError(err.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex overflow-hidden text-text-strong font-sans">
      
      {/* Columna Izquierda (55%) - Branding & Stats */}
      <div className="hidden lg:flex lg:w-[55%] flex-col p-16 relative bg-surface-1 border-r border-border-subtle overflow-hidden">
        {/* Patrón sutil de fondo */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--color-primary) 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-20">
            <div className="bg-primary p-3 rounded-xl shadow-lg shadow-primary/20">
              <Store size={32} className="text-bg" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-black tracking-tighter">RETAIL OS</h1>
          </div>

          <div className="max-w-md">
            <h2 className="text-5xl font-black leading-[1.1] tracking-tight mb-8">
              Infraestructura <br/> total para <br/> su operación.
            </h2>
            <p className="text-text-secondary text-lg font-medium mb-16">
              Gestión centralizada de ventas, inventario y sucursales en tiempo real.
            </p>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-surface-2 p-6 rounded-2xl border border-border-subtle flex items-center gap-6">
                <div className="bg-primary/10 p-4 rounded-xl text-primary"><Terminal size={24} /></div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-text-secondary mb-1">Ventas Hoy</p>
                  <p className="text-2xl font-black">{formatCurrency(stats.ventasHoy)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-2 p-6 rounded-2xl border border-border-subtle flex items-center gap-4">
                  <div className="bg-surface-1 p-3 rounded-xl text-text-secondary"><MapPin size={20} /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-0.5">Sucursales</p>
                    <p className="text-lg font-black">{stats.sucursales} Activas</p>
                  </div>
                </div>
                <div className="bg-surface-2 p-6 rounded-2xl border border-border-subtle flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${isOnline ? 'bg-success/10 text-success' : 'bg-alert/10 text-alert'}`}>
                    <Wifi size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-0.5">Estado Sync</p>
                    <p className="text-lg font-black">{isOnline ? 'En Línea' : 'Offline'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto text-[10px] font-black tracking-[0.3em] text-text-secondary opacity-30 uppercase">
          Enterprise Edition v4.1.2 // Secure Core
        </div>
      </div>

      {/* Columna Derecha (45%) - Formulario */}
      <div className="w-full lg:w-[45%] flex flex-col items-center justify-center p-8 md:p-16 bg-bg">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-12">
            <h3 className="text-3xl font-black tracking-tight mb-2">Iniciar Turno</h3>
            <p className="text-text-secondary font-medium">Ingrese sus credenciales de operador.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-2 ml-1">Sucursal</label>
                <select 
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-4 py-4 bg-surface-1 border border-border-subtle rounded-xl text-sm font-bold text-text-strong outline-none focus:border-primary transition-enterprise"
                >
                  <option value="Central">Sucursal Central</option>
                  <option value="Norte">Plaza Norte</option>
                  <option value="Sur">Centro Comercial Sur</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-2 ml-1">Rol</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-4 bg-surface-1 border border-border-subtle rounded-xl text-sm font-bold text-text-strong outline-none focus:border-primary transition-enterprise"
                >
                  <option value="CASHIER">Cajero</option>
                  <option value="MANAGER">Gerente</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-2 ml-1">ID Operador</label>
              <div className="relative">
                <UserCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ID / Usuario"
                  className="w-full h-[56px] pl-14 pr-6 bg-surface-1 border border-border-subtle rounded-xl text-text-strong outline-none focus:border-primary transition-enterprise font-bold placeholder:text-text-secondary/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-2 ml-1">PIN de Seguridad</label>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  className="w-full h-[56px] pl-14 pr-6 bg-surface-1 border border-border-subtle rounded-xl text-text-strong outline-none focus:border-primary transition-enterprise font-mono text-2xl tracking-[0.5em] placeholder:tracking-normal placeholder:text-text-secondary/30"
                  maxLength={4}
                />
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-error/10 border border-error/20 text-error text-xs font-black uppercase text-center rounded-xl tracking-widest">
                {error}
              </motion.div>
            )}

            <div className="pt-4 space-y-4">
              <button 
                type="submit"
                disabled={loading || !username || !pin}
                className="w-full h-[64px] bg-primary hover:bg-primary-dark disabled:bg-surface-1 disabled:text-text-secondary/50 text-bg font-black rounded-xl shadow-xl shadow-primary/20 transition-enterprise flex justify-center items-center gap-3 uppercase tracking-widest"
              >
                {loading ? <div className="w-5 h-5 border-4 border-bg/20 border-t-bg rounded-full animate-spin"></div> : <>Abrir Caja <ArrowRight size={20} /></>}
              </button>

              <button 
                type="button"
                className="w-full h-[56px] bg-surface-1 hover:bg-surface-2 text-text-secondary font-bold rounded-xl border border-border-subtle transition-enterprise uppercase tracking-widest text-xs"
              >
                Continuar Offline
              </button>
            </div>
          </form>

          <div className="mt-12 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-40">
            <span className="flex items-center gap-2">
              <ShieldCheck size={14} /> Sistema Encriptado
            </span>
            <span>Estación: {isOnline ? 'Online' : 'Local'}</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
