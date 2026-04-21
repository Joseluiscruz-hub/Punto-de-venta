import { motion } from 'framer-motion';

interface SurfaceCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  level?: 1 | 2;
}

export default function SurfaceCard({ children, className = '', onClick, level = 1 }: SurfaceCardProps) {
  return (
    <motion.div
      whileHover={onClick ? { y: -2, borderColor: 'rgba(24, 179, 167, 0.4)' } : {}}
      onClick={onClick}
      className={`
        ${level === 1 ? 'bg-surface-1' : 'bg-surface-2'}
        border border-border-subtle rounded-2xl
        transition-enterprise
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
