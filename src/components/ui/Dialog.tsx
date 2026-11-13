import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md'
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1426]/60 backdrop-blur-2xs animate-in fade-in duration-150">
      <div 
        className={`w-full bg-white border border-[#E2DFD7] rounded-xl shadow-xl text-[#0B1426] overflow-hidden flex flex-col ${maxWidthClasses[maxWidth]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="p-4 sm:p-5 border-b border-[#E2DFD7] flex items-start justify-between gap-3 bg-[#FAF9F6]">
          <div className="space-y-0.5">
            <h3 id="dialog-title" className="font-sans font-bold text-lg text-[#0B1426]">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-[#4B5565] font-sans">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#4B5565] hover:text-[#0B1426] hover:bg-[#EFECE4] rounded-lg transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto max-h-[calc(80vh-120px)] space-y-4 text-sm font-sans">
          {children}
        </div>

        {footer && (
          <div className="p-4 bg-[#FAF9F6] border-t border-[#E2DFD7] flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
