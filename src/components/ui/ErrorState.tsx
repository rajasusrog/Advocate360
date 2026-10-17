import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading record details...',
  className = ''
}) => {
  return (
    <div className={`p-8 text-center space-y-3 bg-white border border-slate-200 rounded-lg ${className}`}>
      <Loader2 className="w-6 h-6 animate-spin text-slate-700 mx-auto" />
      <p className="text-xs font-mono text-slate-600">{message}</p>
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Operation Error',
  message,
  onRetry,
  className = ''
}) => {
  return (
    <div className={`p-4 bg-red-50 border border-red-200 rounded-lg text-red-900 text-xs font-sans space-y-2 ${className}`}>
      <div className="flex items-center gap-2 font-bold text-red-800">
        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
        <span>{title}</span>
      </div>
      <p className="text-red-700 leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-900 font-medium text-[11px] rounded-md border border-red-300 cursor-pointer"
        >
          Retry
        </button>
      )}
    </div>
  );
};
