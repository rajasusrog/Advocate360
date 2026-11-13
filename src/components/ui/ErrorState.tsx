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
    <div className={`p-8 text-center space-y-3 bg-white border border-[#E2DFD7] rounded-xl ${className}`}>
      <Loader2 className="w-6 h-6 animate-spin text-[#0B1426] mx-auto" />
      <p className="text-xs font-medium text-[#4B5565]">{message}</p>
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
  title = 'Unable to load data',
  message,
  onRetry,
  className = ''
}) => {
  return (
    <div role="alert" className={`p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-sans space-y-2 ${className}`}>
      <div className="flex items-center gap-2 font-bold text-red-800">
        <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
        <span>{title}</span>
      </div>
      <p className="text-red-700 leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1.5 bg-white hover:bg-red-100 text-red-900 font-semibold text-xs rounded-lg border border-red-300 cursor-pointer"
        >
          Retry
        </button>
      )}
    </div>
  );
};
