import { motion } from 'framer-motion';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full p-3 rounded-xl transition-enterprise relative group ${
        active 
          ? 'text-primary' 
          : 'text-text-secondary hover:text-text-strong hover:bg-surface-1'
      }`}
    >
      {active && (
        <motion.div
          layoutId="activeNavHighlight"
          className="absolute inset-0 bg-primary/5 border border-primary/20 rounded-xl"
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        />
      )}
      <span className={`relative z-10 ${active ? 'text-primary' : 'text-text-secondary group-hover:text-primary transition-colors'}`}>
        {icon}
      </span>
      <span className="relative z-10 font-bold text-[13px] tracking-tight">{label}</span>
      
      {active && (
        <motion.div 
          layoutId="activeNavIndicator"
          className="absolute right-3 w-1 h-1 bg-primary rounded-full"
        />
      )}
    </button>
  );
}
