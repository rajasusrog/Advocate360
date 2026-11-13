import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold font-sans transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C49A36] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer motion-reduce:transition-none whitespace-nowrap shrink-0';

  const variantStyles = {
    primary: 'bg-[#0B1426] text-white hover:bg-[#14223D] active:bg-[#070E1B] shadow-xs',
    secondary: 'bg-[#C49A36] text-[#0B1426] hover:bg-[#B38B2D] active:bg-[#9E7923] shadow-xs',
    outline: 'border border-[#D5D0C5] bg-white text-[#0B1426] hover:bg-[#FAF9F6] active:bg-[#F6F5F1] shadow-2xs',
    ghost: 'text-[#4B5565] hover:bg-[#EFECE4]/70 hover:text-[#0B1426] active:bg-[#EFECE4]',
    destructive: 'bg-red-700 text-white hover:bg-red-800 active:bg-red-900 shadow-xs'
  };

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 min-h-[34px]',
    md: 'text-xs px-4 py-2 gap-2 min-h-[40px]',
    lg: 'text-sm px-5 py-2.5 gap-2 min-h-[44px]'
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
};
