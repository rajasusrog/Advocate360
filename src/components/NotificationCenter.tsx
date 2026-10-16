import React, { useState } from 'react';
import { 
  Bell, 
  X, 
  CalendarCheck, 
  Bot, 
  MessageSquareText, 
  Clock, 
  DollarSign, 
  ShieldAlert,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { NotificationItem } from '../types';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tabId: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  onNavigateTab
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'n-1',
      category: 'hearing',
      title: 'Upcoming High Court Injunction Hearing',
      body: 'Order 39 hearing for Mylapore Ancestral Property Dispute posted for 2026-08-05 in Hall 18.',
      timestamp: '15 mins ago',
      isRead: false,
      linkTab: 'hearing',
      severity: 'high'
    },
    {
      id: 'n-2',
      category: 'ai_alert',
      title: 'AI Contradiction Flagged',
      body: 'Document Intelligence Agent found boundary discrepancy between 1995 Title Deed and 2026 Sale Agreement.',
      timestamp: '1 hour ago',
      isRead: false,
      linkTab: 'timeline',
      severity: 'medium'
    },
    {
      id: 'n-3',
      category: 'deadline',
      title: 'Limitation Period Notice',
      body: 'Suit for Cancellation of Instrument requires verification of client knowledge date under Art 59 Limitation Act.',
      timestamp: '2 hours ago',
      isRead: true,
      linkTab: 'risk'
    },
    {
      id: 'n-4',
      category: 'client_msg',
      title: 'New Client Message Received',
      body: 'S. Ramesh submitted inquiry via Client Portal regarding court order copy.',
      timestamp: '3 hours ago',
      isRead: true,
      linkTab: 'client'
    }
  ]);

  if (!isOpen) return null;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'hearing': return <CalendarCheck className="w-4 h-4 text-red-600" />;
      case 'ai_alert': return <Bot className="w-4 h-4 text-amber-600" />;
      case 'deadline': return <Clock className="w-4 h-4 text-purple-600" />;
      case 'client_msg': return <MessageSquareText className="w-4 h-4 text-blue-600" />;
      case 'fee': return <DollarSign className="w-4 h-4 text-emerald-600" />;
      default: return <ShieldAlert className="w-4 h-4 text-[#B45309]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-end p-4 pt-16">
      <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="p-4 bg-[#F5F2EF] border-b-2 border-[#1A1A1A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#B45309]" />
            <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A]">Chamber Alerts</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={markAllAsRead}
              className="text-[10px] font-bold uppercase tracking-wider text-[#B45309] hover:underline"
            >
              Mark All Read
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#1A1A1A]/10 text-[#1A1A1A] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="p-4 max-h-[70vh] overflow-y-auto space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                if (n.linkTab) onNavigateTab(n.linkTab);
                onClose();
              }}
              className={`p-3 border-2 cursor-pointer transition-colors space-y-1.5 ${
                !n.isRead
                  ? 'bg-[#F5F2EF] border-[#1A1A1A]'
                  : 'bg-[#FDFCFB] border-[#1A1A1A]/30 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(n.category)}
                  <span className="font-serif font-bold text-xs text-[#1A1A1A]">{n.title}</span>
                </div>
                <span className="text-[9px] font-mono text-[#555555]">{n.timestamp}</span>
              </div>

              <p className="text-xs text-[#555555] leading-relaxed font-serif italic pl-6">{n.body}</p>

              {n.linkTab && (
                <div className="pl-6 pt-1 flex items-center justify-end">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] hover:text-[#B45309] flex items-center gap-1">
                    <span>Action Item</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-3 bg-[#1A1A1A] text-white text-center text-[10px] font-serif italic">
          Chamber Notification Stream • Advocate360 LegalOS
        </div>

      </div>
    </div>
  );
};
