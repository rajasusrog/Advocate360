import React from 'react';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No records found',
  onRowClick,
  className = ''
}: DataTableProps<T>) {
  return (
    <div className={`w-full overflow-x-auto border border-[#E2DFD7] rounded-xl shadow-2xs bg-white ${className}`}>
      <table className="w-full text-left text-sm font-sans border-collapse min-w-[600px] u360-table-numeric">
        <thead>
          <tr className="bg-[#FAF9F6] border-b border-[#E2DFD7] text-[11px] font-semibold uppercase tracking-wider text-[#4B5565]">
            {columns.map((col, idx) => (
              <th key={idx} className={`p-3.5 ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EFECE4] text-[#0B1426]">
          {data.length > 0 ? (
            data.map((row) => {
              const key = keyExtractor(row);
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`hover:bg-[#FAF9F6] transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className={`p-3.5 ${col.className || ''}`}>
                      {typeof col.accessor === 'function'
                        ? col.accessor(row)
                        : (row[col.accessor] as any)}
                    </td>
                  ))}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={columns.length} className="p-8 text-center text-[#4B5565] font-sans">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
