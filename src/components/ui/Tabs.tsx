import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-1 p-1 bg-[#EFECE4] rounded-xl overflow-x-auto ${className}`} role="tablist">
      {tabs.map((t) => {
        const isActive = activeTab === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={`px-3.5 py-2 text-xs font-semibold font-sans rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              isActive
                ? 'bg-[#0B1426] text-white shadow-xs'
                : 'text-[#4B5565] hover:text-[#0B1426] hover:bg-white/70'
            }`}
          >
            {t.icon && <span className={`shrink-0 ${isActive ? 'text-[#C49A36]' : 'text-[#4B5565]'}`}>{t.icon}</span>}
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded-md ${
                isActive ? 'bg-white/15 text-white' : 'bg-white text-[#0B1426]'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
