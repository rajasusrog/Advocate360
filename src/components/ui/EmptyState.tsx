import React from 'react';
import { FolderOpen } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <FolderOpen className="w-8 h-8 text-slate-400" />,
  title,
  description,
  action,
  className = ''
}) => {
  return (
    <div className={`p-8 sm:p-12 bg-white border border-slate-200 rounded-lg text-center space-y-4 shadow-2xs ${className}`}>
      <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-full mx-auto flex items-center justify-center">
        {icon}
      </div>
      <div className="max-w-md mx-auto space-y-1">
        <h3 className="font-serif italic font-bold text-lg text-slate-900">{title}</h3>
        <p className="text-xs text-slate-600 font-sans leading-relaxed">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};
