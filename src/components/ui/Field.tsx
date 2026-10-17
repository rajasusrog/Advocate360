import React from 'react';

export interface FieldProps {
  label: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({
  label,
  error,
  helpText,
  required = false,
  children,
  className = ''
}) => {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
        {label}
        {required && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-red-600 font-medium">{error}</p>
      ) : helpText ? (
        <p className="text-[11px] text-slate-500">{helpText}</p>
      ) : null}
    </div>
  );
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ error, className = '', ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={`w-full px-3 py-2 text-xs font-sans text-slate-900 bg-white border ${
        error ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-slate-900'
      } rounded-md shadow-2xs focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors ${className}`}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ error, className = '', ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={`w-full px-3 py-2 text-xs font-serif italic text-slate-900 bg-white border ${
        error ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-slate-900'
      } rounded-md shadow-2xs focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors resize-none ${className}`}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';
