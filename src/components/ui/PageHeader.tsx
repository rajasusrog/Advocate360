import React from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  badgeText?: string;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badgeText,
  primaryAction,
  secondaryActions,
  children
}) => {
  return (
    <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-2xs mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          {badgeText && (
            <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-sm inline-block">
              {badgeText}
            </span>
          )}
          <h1 className="font-serif italic font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-xs sm:text-sm text-slate-600 font-sans leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {(primaryAction || secondaryActions) && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-auto">
            {secondaryActions}
            {primaryAction}
          </div>
        )}
      </div>

      {children && <div className="mt-4 pt-3 border-t border-slate-100">{children}</div>}
    </div>
  );
};
