import { useState } from 'react';
import { Lock, ShieldCheck, ArrowRight, ShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, pin);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 -left-20 w-96 h-96 bg-primary-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-[1000px] grid grid-cols-1 md:grid-cols-2 bg-slate-900 rounded-[48px] overflow-hidden shadow-2xl border border-slate-800"
      >
        <div className="hidden md:flex flex-col p-12 bg-gradient-to-br from-primary-600 to-primary-800 text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
             <div className="absolute top-10 left-10"><ShoppingCart size={200} /></div>
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-12">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-xl">
                <ShoppingCart size={32} />
              </div>
              <span className="text-2xl font-black tracking-tighter">POS PRO</span>
            </div>
            <div className="mt-auto">
              <h2 className="text-5xl font-black leading-tight mb-6">Control Total <br/> de tu Negocio.</h2>
              <p className="text-primary-100 text-lg font-medium max-w-sm">
                La herramienta definitiva para la gestión de ventas, inventarios y analítica avanzada.
              </p>
            </div>
            <div className="mt-12 flex gap-4">
              <div className="flex -space-x-3">
                {[1,2,3].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-primary-600 bg-slate-200 overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?u=${i}`} alt="user" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-primary-200 font-bold self-center">
                +500 empresas ya confían en nosotros
              </p>
            </div>
          </div>
        </div>
        <div className="p-12 md:p-16 bg-slate-900 flex flex-col justify-center">
          <div className="mb-10 text-center md:text-left">
            <h1 className="text-3xl font-black text-white mb-3">Bienvenido</h1>
            <p className="text-slate-400 font-medium">Ingresa tus credenciales para acceder al panel.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Nombre de Usuario</label>
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500">
                  <ShieldCheck size={20} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-slate-800 border-2 border-slate-800 rounded-2xl text-white outline-none focus:border-primary-500 transition-all font-bold placeholder:text-slate-600"
                  placeholder="Ej. administrador"
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">PIN de Seguridad</label>
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  className="w-full pl-14 pr-6 py-4 bg-slate-800 border-2 border-slate-800 rounded-2xl text-white outline-none focus:border-primary-500 transition-all font-mono text-2xl tracking-[0.5em] placeholder:tracking-normal placeholder:text-slate-600"
                  maxLength={4}
                />
              </div>
            </div>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-400 text-sm font-bold bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 text-center"
              >
                {error}
              </motion.div>
            )}
            <button 
              type="submit"
              disabled={loading || !username || !pin}
              className="w-full bg-white hover:bg-primary-50 disabled:bg-slate-800 disabled:text-slate-600 text-slate-900 font-black py-5 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex justify-center items-center gap-3 mt-8"
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>ACCEDER AHORA <ArrowRight size={20} /></>
              )}
            </button>
          </form>
          <div className="mt-12 p-4 rounded-2xl bg-slate-800/50 border border-slate-700 text-center">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Acceso de Demostración</p>
            <p className="text-xs text-slate-400 font-mono">
              Admin: <span className="text-primary-400">admin / 1234</span> | Caja: <span className="text-primary-400">caja1 / 0000</span>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
