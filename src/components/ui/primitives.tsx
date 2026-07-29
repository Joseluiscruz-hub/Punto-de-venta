import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { cx } from '../../utils/helpers';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger';

const buttonClasses: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
};

const badgeClasses: Record<BadgeTone, string> = {
  neutral: 'status-pill',
  success: 'status-pill status-pill-success',
  warning: 'status-pill status-pill-warning',
  danger: 'status-pill status-pill-danger',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', icon, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cx(buttonClasses[variant], className)} {...props}>
      {icon}
      {children}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tooltip?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tooltip, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={tooltip ?? label}
      className={cx('top-icon-button', className)}
      {...props}
    />
  );
});

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { leadingIcon, className, ...props },
  ref,
) {
  if (!leadingIcon) {
    return <input ref={ref} className={cx('input-premium', className)} {...props} />;
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{leadingIcon}</span>
      <input ref={ref} className={cx('input-premium pl-10', className)} {...props} />
    </div>
  );
});

export const SelectInput = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectInput({ className, ...props }, ref) {
    return <select ref={ref} className={cx('input-premium', className)} {...props} />;
  },
);

interface PanelProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
}

export function Panel({ children, className, header }: PanelProps) {
  return (
    <section className={cx('data-panel', className)}>
      {header}
      {children}
    </section>
  );
}

interface PanelHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}

export function PanelHeader({ title, subtitle, action, icon }: PanelHeaderProps) {
  return (
    <div className="data-panel-header">
      <div className="min-w-0">
        <h2 className="data-panel-title flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="data-panel-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

interface SegmentedOption<T extends string> {
  key: T;
  label: ReactNode;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  ariaLabel: string;
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cx('segmented-control', className)} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={value === option.key}
          onClick={() => onChange(option.key)}
          className={cx('segmented-option', value === option.key && 'segmented-option-active')}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="text-[0.65rem] text-slate-400">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

interface StatusBadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  title?: string;
}

export function StatusBadge({ children, tone = 'neutral', className, title }: StatusBadgeProps) {
  return (
    <span className={cx(badgeClasses[tone], className)} title={title}>
      {children}
    </span>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx('flex h-full flex-col items-center justify-center p-8 text-center', className)}
    >
      <span className="empty-icon">{icon}</span>
      <p className="mt-4 text-sm font-bold text-slate-700 dark:text-slate-300">{title}</p>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
