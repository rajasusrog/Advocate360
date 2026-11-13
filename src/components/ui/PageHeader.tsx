import React from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  badgeText?: string;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  subtitle,
  badgeText,
  primaryAction,
  secondaryActions,
  actions,
  children,
}) => {
  const resolvedDescription = description || subtitle;
  const resolvedActions = primaryAction || secondaryActions || actions;

  return (
    <div className="bg-white border border-[#E2DFD7] rounded-xl px-5 py-4 sm:px-6 sm:py-5 mb-6 shadow-2xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          {badgeText && (
            <span className="text-[11px] font-semibold tracking-wide text-[#825F11] bg-[#F7F1E1] border border-[#E6D39A] px-2.5 py-0.5 rounded-md inline-block">
              {badgeText}
            </span>
          )}
          <h1 className="font-sans font-bold text-2xl sm:text-3xl text-[#0B1426] tracking-tight">
            {title}
          </h1>
          {resolvedDescription && (
            <p className="text-sm text-[#4B5565] font-sans leading-relaxed">
              {resolvedDescription}
            </p>
          )}
        </div>

        {resolvedActions && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-auto">
            {secondaryActions}
            {primaryAction}
            {!primaryAction && !secondaryActions && actions}
          </div>
        )}
      </div>

      {children && <div className="mt-4 pt-4 border-t border-[#EFECE4]">{children}</div>}
    </div>
  );
};
