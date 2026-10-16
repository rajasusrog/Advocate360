import React, { useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  CheckCircle2, 
  Briefcase, 
  Clock, 
  Bot, 
  PieChart as PieIcon,
  BarChart2,
  Users,
  ShieldCheck,
  Database,
  Cloud,
  Globe,
  RefreshCw,
  HardDrive,
  Building2,
  Key,
  Code
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { CaseFile, FeeRecord } from '../types';
import { logAuditEvent } from '../lib/auditLogger';

interface ExecutiveAnalyticsProps {
  cases: CaseFile[];
  feeRecords: FeeRecord[];
}

export const ExecutiveAnalytics: React.FC<ExecutiveAnalyticsProps> = ({ cases, feeRecords }) => {
  const [backupSchedule, setBackupSchedule] = useState<'daily' | 'weekly' | 'realtime'>('daily');
  const [isBackupRunning, setIsBackupRunning] = useState<boolean>(false);
  const [lastBackupTime, setLastBackupTime] = useState<string>('2026-07-29 18:00:00 IST');
  const [selectedBranch, setSelectedBranch] = useState<string>('MUMBAI_HQ');
  const [apiKey, setApiKey] = useState<string>('adv360_live_8f910a23b49e11fc');

  // Branch offices
  const branches = [
    { id: 'MUMBAI_HQ', name: 'Mumbai Head Chamber', casesCount: 22, advocates: 8 },
    { id: 'DELHI_BRANCH', name: 'Delhi NCR Supreme Court Chambers', casesCount: 14, advocates: 5 },
    { id: 'CHENNAI_BRANCH', name: 'Chennai High Court Branch', casesCount: 9, advocates: 3 },
    { id: 'BENGALURU_BRANCH', name: 'Bengaluru Commercial Law Desk', casesCount: 6, advocates: 2 }
  ];

  // Monthly Revenue & Recovery Trend
  const revenueTrendData = [
    { month: 'Mar', invoiced: 450000, collected: 400000 },
    { month: 'Apr', invoiced: 520000, collected: 480000 },
    { month: 'May', invoiced: 610000, collected: 550000 },
    { month: 'Jun', invoiced: 700000, collected: 620000 },
    { month: 'Jul', invoiced: 850000, collected: 780000 }
  ];

  // AI Usage Metrics
  const aiUsageData = [
    { module: 'Legal Research', queries: 142 },
    { module: 'Drafting & Petitions', queries: 98 },
    { module: 'Doc OCR & Analysis', queries: 210 },
    { module: 'Evidence Scorecard', queries: 65 },
    { module: 'Client Portal Assistant', queries: 115 }
  ];

  const COLORS = ['#1A1A1A', '#B45309', '#059669', '#7C3AED', '#DC2626'];

  const triggerManualBackup = () => {
    setIsBackupRunning(true);
    setTimeout(() => {
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' IST';
      setLastBackupTime(nowStr);
      setIsBackupRunning(false);
      logAuditEvent('BACKUP_CREATE', `Triggered manual cloud disaster recovery snapshot for Chamber Vault`);
    }, 1200);
  };

  const handleRotateKey = () => {
    const newK = `adv360_live_${Math.random().toString(36).substring(2, 18)}`;
    setApiKey(newK);
    logAuditEvent('ROLE_CHANGE', 'Rotated Enterprise REST API Integration Key');
  };

  return (
    <div className="space-y-6 text-[#1A1A1A]">
      
      {/* Header Banner */}
      <div className="bg-[#F5F2EF] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span>Multi-Office Command & Enterprise Integration</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">Multi-Branch Executive & API Portal</h1>
            <p className="text-xs text-[#555555] mt-1 max-w-2xl">
              Cross-office practice analytics across Mumbai HQ, Delhi NCR, Chennai, and Bengaluru branches, alongside public REST API developer key management and disaster recovery.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#B45309]" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="p-2 bg-[#FDFCFB] border-2 border-[#1A1A1A] font-bold text-xs focus:outline-none"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-[#FDFCFB] border-2 border-[#1A1A1A] space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#555555]">Active Branch Matters</p>
          <p className="text-3xl font-serif font-bold text-[#1A1A1A]">{cases.length || 35}</p>
          <p className="text-[10px] text-emerald-800 font-bold">↑ 12% growth across 4 offices</p>
        </div>

        <div className="p-4 bg-[#FDFCFB] border-2 border-[#1A1A1A] space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#555555]">Monthly Invoiced Fees</p>
          <p className="text-3xl font-serif font-bold text-[#1A1A1A]">₹8,50,000</p>
          <p className="text-[10px] text-emerald-800 font-bold">₹7,80,000 collected (91.7%)</p>
        </div>

        <div className="p-4 bg-[#FDFCFB] border-2 border-[#1A1A1A] space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#555555]">Interim Injunction Rate</p>
          <p className="text-3xl font-serif font-bold text-[#1A1A1A]">84.2%</p>
          <p className="text-[10px] text-[#B45309] font-bold">16 Order 39 applications won</p>
        </div>

        <div className="p-4 bg-[#FDFCFB] border-2 border-[#1A1A1A] space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#555555]">Total AI Agent Calls</p>
          <p className="text-3xl font-serif font-bold text-[#1A1A1A]">630</p>
          <p className="text-[10px] text-amber-800 font-bold">~140 hours drafting time saved</p>
        </div>
      </div>

      {/* REST API Layer & Multi-Branch Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Developer REST API Layer */}
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
              <Code className="w-4 h-4 text-[#B45309]" />
              <span>Enterprise Developer REST API Access</span>
            </h3>
            <span className="text-[9px] bg-[#1A1A1A] text-amber-400 font-mono px-2 py-0.5">v2.4 ACTIVE</span>
          </div>

          <div className="space-y-2 p-3 bg-[#F9F7F5] border border-[#1A1A1A]">
            <p className="font-mono text-[10px] text-[#555555]">Public API Token (eCourt & Accounting Sync):</p>
            <div className="flex items-center justify-between gap-2">
              <code className="p-2 bg-white border border-[#1A1A1A] font-mono text-[11px] text-[#1A1A1A] flex-1 overflow-x-auto">
                {apiKey}
              </code>
              <button
                onClick={handleRotateKey}
                className="px-3 py-2 bg-[#1A1A1A] text-amber-400 font-bold text-[10px] uppercase border border-[#1A1A1A] hover:bg-black"
              >
                Rotate Token
              </button>
            </div>
            <p className="text-[10px] text-[#555555] font-serif italic pt-1">
              Supports webhooks for eCourt daily cause lists, Tally accounting sync, and WhatsApp client alerts.
            </p>
          </div>
        </div>

        {/* Disaster Recovery Snapshot */}
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
              <Database className="w-4 h-4 text-[#B45309]" />
              <span>Disaster Recovery & Point-in-Time Restore</span>
            </h3>
            <span className="text-[9px] bg-emerald-900 text-emerald-100 font-mono px-2 py-0.5">HEALTHY</span>
          </div>

          <div className="p-3 bg-[#F9F7F5] border border-[#1A1A1A] space-y-2">
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-bold text-[#555555]">Schedule:</span>
              <div className="flex gap-1">
                {(['daily', 'weekly', 'realtime'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setBackupSchedule(mode)}
                    className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                      backupSchedule === mode
                        ? 'bg-[#1A1A1A] text-amber-400 border-[#1A1A1A]'
                        : 'bg-white text-[#1A1A1A] border-[#1A1A1A]/30'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center text-[11px] pt-1 border-t border-[#1A1A1A]/20">
              <span className="text-[#555555]">Last Encrypted Snapshot:</span>
              <span className="font-mono font-bold text-[#1A1A1A]">{lastBackupTime}</span>
            </div>
          </div>

          <button
            onClick={triggerManualBackup}
            disabled={isBackupRunning}
            className="w-full py-2.5 bg-[#1A1A1A] text-amber-400 font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] hover:bg-black transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isBackupRunning ? 'animate-spin' : ''}`} />
            <span>{isBackupRunning ? 'Snapshotting Firestore & Storage...' : 'Initiate Point-in-Time Backup Snapshot'}</span>
          </button>
        </div>

      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Revenue Trend Chart */}
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#B45309]" />
              <span>Revenue & Collection Velocity (₹ INR)</span>
            </h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#1A1A1A" fontSize={11} />
                <YAxis stroke="#1A1A1A" fontSize={11} />
                <Tooltip />
                <Bar dataKey="invoiced" fill="#1A1A1A" name="Invoiced" />
                <Bar dataKey="collected" fill="#B45309" name="Collected" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Usage Breakdown */}
        <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#B45309]" />
              <span>AI Legal Agent Utilization by Module</span>
            </h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aiUsageData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" stroke="#1A1A1A" fontSize={11} />
                <YAxis dataKey="module" type="category" stroke="#1A1A1A" fontSize={10} width={130} />
                <Tooltip />
                <Bar dataKey="queries" fill="#1A1A1A" name="Agent Executions">
                  {aiUsageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};
