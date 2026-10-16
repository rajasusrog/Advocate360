import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Search, 
  ShieldCheck, 
  Download, 
  Filter, 
  FileText, 
  User, 
  Key, 
  Sparkles,
  Lock
} from 'lucide-react';
import { AuditLog } from '../types';
import { subscribeAuditLogs } from '../lib/auditLogger';

interface AuditLogViewerProps {
  chamberId?: string;
  userEmail?: string;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ chamberId, userEmail }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeAuditLogs((updatedLogs) => {
      setLogs(updatedLogs);
    });
    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.actorEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.action.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = selectedAction === 'ALL' || log.action === selectedAction;
    return matchesSearch && matchesAction;
  });

  const handleExportLogs = () => {
    const jsonStr = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chamber-audit-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 text-[#1A1A1A]">
      
      {/* Title Header */}
      <div className="bg-[#F5F2EF] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Immutable Enterprise Audit & Compliance Ledger</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">Chamber Audit Trail</h1>
            <p className="text-xs text-[#555555] mt-1 max-w-2xl">
              Cryptographically verified, tamper-proof activity logs tracking case creation, AI executions, document access, role modifications, digital signatures, and backup restore operations across your workspace.
            </p>
          </div>

          <button
            onClick={handleExportLogs}
            className="px-4 py-2.5 bg-[#1A1A1A] text-amber-400 hover:bg-black font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] flex items-center gap-2 transition-colors self-start md:self-auto"
          >
            <Download className="w-4 h-4" />
            <span>Export Audit Ledger (.JSON)</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 w-full md:w-1/2 bg-[#F9F7F5] border border-[#1A1A1A] px-3 py-2">
          <Search className="w-4 h-4 text-[#B45309]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search audit trail by actor email, action, or details..."
            className="w-full bg-transparent text-[#1A1A1A] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-[#B45309]" />
          <span className="font-bold uppercase text-[10px] text-[#555555]">Action Type:</span>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="p-2 bg-[#F9F7F5] border border-[#1A1A1A] font-bold text-xs focus:outline-none"
          >
            <option value="ALL">All Actions</option>
            <option value="CASE_CREATE">Case Creation</option>
            <option value="AI_GENERATION">AI Agent Generation</option>
            <option value="DOCUMENT_UPLOAD">Document Upload</option>
            <option value="DOCUMENT_VIEW">Document View</option>
            <option value="DRAFT_CREATE">Drafting Execution</option>
            <option value="ROLE_CHANGE">Permission Change</option>
            <option value="PREPARATION_SIGN">Digital Signature</option>
            <option value="RESTORE_VERSION">Version Restore</option>
          </select>
        </div>
      </div>

      {/* Log Entries Table */}
      <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs text-[#1A1A1A]">
          <thead className="bg-[#1A1A1A] text-white text-[10px] uppercase font-bold tracking-widest border-b border-[#1A1A1A]">
            <tr>
              <th className="p-3">Log ID</th>
              <th className="p-3">Action</th>
              <th className="p-3">Actor Email</th>
              <th className="p-3">Activity Description</th>
              <th className="p-3">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A1A1A]/20">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-[#F5F2EF] transition-colors">
                <td className="p-3 font-mono text-[10px] font-bold text-[#555555]">{log.id}</td>
                <td className="p-3 font-bold">
                  <span className="px-2 py-0.5 bg-[#1A1A1A]/10 text-[#1A1A1A] border border-[#1A1A1A] text-[9px] uppercase tracking-wider font-mono">
                    {log.action}
                  </span>
                </td>
                <td className="p-3 font-serif font-bold text-[#1A1A1A]">{log.actorEmail}</td>
                <td className="p-3 font-serif italic text-[#1A1A1A]">{log.details}</td>
                <td className="p-3 font-mono text-[11px] text-[#555555] whitespace-nowrap">{log.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};
