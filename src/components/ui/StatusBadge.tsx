import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Info, ShieldCheck } from 'lucide-react';

export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'pending';

export interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  showIcon?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = 'neutral',
  showIcon = true,
  className = ''
}) => {
  const variantMap: Record<StatusVariant, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
    success: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      icon: <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" aria-hidden="true" />
    },
    warning: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      icon: <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" aria-hidden="true" />
    },
    error: {
      bg: 'bg-red-50',
      text: 'text-red-800',
      border: 'border-red-200',
      icon: <XCircle className="w-3 h-3 text-red-600 shrink-0" aria-hidden="true" />
    },
    info: {
      bg: 'bg-blue-50',
      text: 'text-blue-800',
      border: 'border-blue-200',
      icon: <Info className="w-3 h-3 text-blue-600 shrink-0" aria-hidden="true" />
    },
    pending: {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-200',
      icon: <Clock className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
    },
    neutral: {
      bg: 'bg-slate-100',
      text: 'text-slate-800',
      border: 'border-slate-200',
      icon: <ShieldCheck className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
    }
  };

  const current = variantMap[variant] || variantMap.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xs border text-[11px] font-medium font-mono uppercase tracking-wider ${current.bg} ${current.text} ${current.border} ${className}`}
    >
      {showIcon && current.icon}
      <span>{status}</span>
    </span>
  );
};
