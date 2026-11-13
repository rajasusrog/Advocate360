import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Info, ShieldCheck } from 'lucide-react';

export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'pending';
export type StatusTone = 'navy' | 'gold' | 'success' | 'warning' | 'danger' | 'neutral';

export interface StatusBadgeProps {
  status?: string;
  label?: string;
  variant?: StatusVariant;
  tone?: StatusTone;
  showIcon?: boolean;
  className?: string;
}

const TONE_TO_VARIANT: Record<StatusTone, StatusVariant> = {
  navy: 'info',
  gold: 'warning',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  neutral: 'neutral',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  variant,
  tone,
  showIcon = true,
  className = '',
}) => {
  const resolvedVariant: StatusVariant =
    variant || (tone ? TONE_TO_VARIANT[tone] : 'neutral');
  const resolvedText = status || label || '';

  const variantMap: Record<StatusVariant, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
    success: {
      bg: 'bg-[#ECFDF5]',
      text: 'text-[#15803D]',
      border: 'border-[#BBF7D0]',
      icon: <CheckCircle2 className="w-3 h-3 text-[#15803D] shrink-0" aria-hidden="true" />,
    },
    warning: {
      bg: 'bg-[#FFFBEB]',
      text: 'text-[#825F11]',
      border: 'border-[#FDE68A]',
      icon: <AlertTriangle className="w-3 h-3 text-[#C49A36] shrink-0" aria-hidden="true" />,
    },
    error: {
      bg: 'bg-[#FEF2F2]',
      text: 'text-[#B91C1C]',
      border: 'border-[#FECACA]',
      icon: <XCircle className="w-3 h-3 text-[#B91C1C] shrink-0" aria-hidden="true" />,
    },
    info: {
      bg: 'bg-[#0B1426]/5',
      text: 'text-[#0B1426]',
      border: 'border-[#0B1426]/15',
      icon: <Info className="w-3 h-3 text-[#0B1426] shrink-0" aria-hidden="true" />,
    },
    pending: {
      bg: 'bg-[#F6F5F1]',
      text: 'text-[#475569]',
      border: 'border-[#E2DFD7]',
      icon: <Clock className="w-3 h-3 text-[#C49A36] shrink-0" aria-hidden="true" />,
    },
    neutral: {
      bg: 'bg-[#F6F5F1]',
      text: 'text-[#0B1426]',
      border: 'border-[#E2DFD7]',
      icon: <ShieldCheck className="w-3 h-3 text-[#475569] shrink-0" aria-hidden="true" />,
    },
  };

  const current = variantMap[resolvedVariant] || variantMap.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-semibold font-sans whitespace-nowrap ${current.bg} ${current.text} ${current.border} ${className}`}
    >
      {showIcon && current.icon}
      <span>{resolvedText}</span>
    </span>
  );
};
