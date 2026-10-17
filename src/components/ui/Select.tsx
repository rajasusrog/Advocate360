import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ options, error, className = '', ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={`w-full px-3 py-2 text-xs font-sans text-slate-900 bg-white border ${
        error ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-slate-900'
      } rounded-md shadow-2xs focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors cursor-pointer ${className}`}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
});
Select.displayName = 'Select';
