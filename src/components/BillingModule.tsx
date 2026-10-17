import React, { useState, useEffect, useRef } from 'react';
import { 
  IndianRupee, 
  Clock, 
  FileText, 
  Plus, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Filter, 
  Search, 
  Download, 
  Printer, 
  Send, 
  DollarSign, 
  Calendar, 
  Tag, 
  User, 
  Briefcase, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  Eye, 
  CreditCard, 
  Building, 
  TrendingUp, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Check, 
  X, 
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  QrCode,
  Share2,
  Copy
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie, 
  Legend 
} from 'recharts';
import { CaseFile, ChamberProfile, ChamberRole, TimeLog, Invoice, InvoiceItem, InvoicePayment } from '../types';
import {
  listTimeEntriesForWorkspace,
  createTimeEntryInDb,
  deleteTimeEntryInDb,
  listInvoicesForWorkspace,
  createInvoiceInDb,
  deleteInvoiceInDb,
  recordPaymentInDb,
} from '../lib/useMatterData';
import { logAuditEvent } from '../lib/auditLogger';

interface BillingModuleProps {
  cases: CaseFile[];
  chamber: ChamberProfile | null;
  selectedCaseId: string;
  setSelectedCaseId: (id: string) => void;
  onNavigateTab?: (tab: string) => void;
  currentRole?: ChamberRole;
}

// Initial Sample Time Logs for realistic legal chamber demo
const INITIAL_TIME_LOGS: TimeLog[] = [
  {
    id: 'tl-101',
    caseId: 'case-1',
    caseTitle: 'Mylapore Ancestral Property Dispute',
    advocateName: 'Adv. R. Venkatraman',
    advocateRole: 'Senior Advocate',
    taskCategory: 'Document Review',
    description: 'Examined 1995 Parent Title Deed and verified boundary covenants against 2026 Sale Deed.',
    hours: 2.5,
    hourlyRate: 3500,
    totalAmount: 8750,
    date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
    billable: true,
    status: 'Invoiced',
    invoiceId: 'inv-2026-001',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'tl-102',
    caseId: 'case-1',
    caseTitle: 'Mylapore Ancestral Property Dispute',
    advocateName: 'Adv. S. Priya',
    advocateRole: 'Junior Advocate',
    taskCategory: 'Legal Research',
    description: 'Researched Supreme Court precedents on Limitation Act Article 59 regarding cancellation of voidable deeds.',
    hours: 4.0,
    hourlyRate: 1800,
    totalAmount: 7200,
    date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    billable: true,
    status: 'Invoiced',
    invoiceId: 'inv-2026-001',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'tl-103',
    caseId: 'case-1',
    caseTitle: 'Mylapore Ancestral Property Dispute',
    advocateName: 'Adv. R. Venkatraman',
    advocateRole: 'Senior Advocate',
    taskCategory: 'Court Hearing',
    description: 'Appeared before High Court Bench for arguments on Interim Injunction application.',
    hours: 3.0,
    hourlyRate: 4000,
    totalAmount: 12000,
    date: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0],
    billable: true,
    status: 'Unbilled',
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
  },
  {
    id: 'tl-104',
    caseId: 'case-2',
    caseTitle: 'Alpha Tech Vendor Contract Arbitration',
    advocateName: 'Adv. S. Priya',
    advocateRole: 'Junior Advocate',
    taskCategory: 'Drafting Petition',
    description: 'Drafted Section 11 Arbitration Application and verified dispute notice delivery receipts.',
    hours: 3.5,
    hourlyRate: 1800,
    totalAmount: 6300,
    date: new Date().toISOString().split('T')[0],
    billable: true,
    status: 'Unbilled',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tl-105',
    caseId: 'case-1',
    caseTitle: 'Mylapore Ancestral Property Dispute',
    advocateName: 'Adv. R. Venkatraman',
    advocateRole: 'Senior Advocate',
    taskCategory: 'Client Consultation',
    description: 'Conference with client S. Ramesh regarding cross-examination strategy for DW-1.',
    hours: 1.5,
    hourlyRate: 3500,
    totalAmount: 5250,
    date: new Date().toISOString().split('T')[0],
    billable: true,
    status: 'Unbilled',
    createdAt: new Date().toISOString()
  }
];

// Initial Sample Invoices
const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-2026-001',
    invoiceNumber: 'INV-2026-001',
    caseId: 'case-1',
    caseTitle: 'Mylapore Ancestral Property Dispute',
    clientName: 'S. Ramesh',
    clientEmail: 's.ramesh@example.com',
    clientPhone: '+91 98400 12345',
    clientAddress: 'No. 42, Luz Church Road, Mylapore, Chennai - 600004',
    issueDate: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0],
    hourlyRate: 3500,
    items: [
      { id: 'item-1', description: 'Examined 1995 Parent Title Deed and boundary covenants', hours: 2.5, rate: 3500, amount: 8750, timeLogId: 'tl-101' },
      { id: 'item-2', description: 'Precedent research on Limitation Act Article 59', hours: 4.0, rate: 1800, amount: 7200, timeLogId: 'tl-102' },
      { id: 'item-3', description: 'High Court Filing & Service Charges (Flat Fee)', amount: 2500 }
    ],
    subtotal: 18450,
    taxRatePercentage: 18,
    taxAmount: 3321,
    discountAmount: 1000,
    totalAmount: 20771,
    paidAmount: 10000,
    balanceAmount: 10771,
    status: 'Partially Paid',
    paymentTerms: 'Payment due within 15 days of invoice date via UPI or NEFT/RTGS.',
    bankDetails: {
      accountName: 'Advocate360 Chamber Legal Account',
      accountNumber: '92102003884912',
      ifscCode: 'UTIB0000123',
      bankName: 'Axis Bank, High Court Branch',
      upiId: 'adv360chamber@axisbank'
    },
    notes: 'Retainer fee paid during initial intake credited in final balance.',
    payments: [
      {
        id: 'pay-1',
        invoiceId: 'inv-2026-001',
        amount: 10000,
        paymentDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
        paymentMethod: 'UPI',
        referenceNo: 'UPI/6192847192/ADV',
        notes: 'Advance partial payment via Google Pay'
      }
    ],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
  }
];

export const BillingModule: React.FC<BillingModuleProps> = ({
  cases,
  chamber,
  selectedCaseId,
  setSelectedCaseId,
  onNavigateTab,
  currentRole = 'CHAMBER_OWNER'
}) => {
  // State
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'timelogs' | 'invoices' | 'payments'>('timelogs');
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>(chamber ? [] : INITIAL_TIME_LOGS);
  const [invoices, setInvoices] = useState<Invoice[]>(chamber ? [] : INITIAL_INVOICES);
  const [billingLoading, setBillingLoading] = useState<boolean>(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingSuccess, setBillingSuccess] = useState<string | null>(null);
  const [isSavingBilling, setIsSavingBilling] = useState<boolean>(false);
  const [chamberRates, setChamberRates] = useState<{ [role: string]: number }>({
    'Senior Advocate': 4000,
    'Advocate': 2500,
    'Junior Advocate': 1800,
    'Paralegal': 1000
  });

  // Filter states
  const [filterCaseId, setFilterCaseId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Timer Widget State
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [timerCaseId, setTimerCaseId] = useState<string>(selectedCaseId || (cases[0]?.id || ''));
  const [timerCategory, setTimerCategory] = useState<TimeLog['taskCategory']>('Legal Research');
  const [timerAdvocate, setTimerAdvocate] = useState<string>(chamber?.advocateName || 'Adv. Advocate360');
  const [timerRole, setTimerRole] = useState<string>('Senior Advocate');
  const [timerDescription, setTimerDescription] = useState<string>('');
  const [timerBillable, setTimerBillable] = useState<boolean>(true);
  const timerIntervalRef = useRef<any>(null);

  // Selected logs for invoice generation
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);

  // Modals
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [isRatesModalOpen, setIsRatesModalOpen] = useState<boolean>(false);

  // Modal active objects
  const [activeInvoiceForView, setActiveInvoiceForView] = useState<Invoice | null>(null);
  const [activeInvoiceForPayment, setActiveInvoiceForPayment] = useState<Invoice | null>(null);

  // New Log Form State
  const [newLogData, setNewLogData] = useState<{
    caseId: string;
    taskCategory: TimeLog['taskCategory'];
    advocateName: string;
    advocateRole: string;
    description: string;
    hours: number;
    hourlyRate: number;
    date: string;
    billable: boolean;
  }>({
    caseId: selectedCaseId || (cases[0]?.id || ''),
    taskCategory: 'Document Review',
    advocateName: chamber?.advocateName || 'Adv. Advocate360',
    advocateRole: 'Senior Advocate',
    description: '',
    hours: 1,
    hourlyRate: 3500,
    date: new Date().toISOString().split('T')[0],
    billable: true
  });

  // New Invoice Form State
  const [newInvoiceData, setNewInvoiceData] = useState<{
    caseId: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    clientAddress: string;
    issueDate: string;
    dueDate: string;
    taxRatePercentage: number;
    discountAmount: number;
    paymentTerms: string;
    notes: string;
    items: InvoiceItem[];
  }>({
    caseId: selectedCaseId || (cases[0]?.id || ''),
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
    taxRatePercentage: 18,
    discountAmount: 0,
    paymentTerms: 'Payment due within 14 days of invoice date. Please mention Invoice Number in bank transfer notes.',
    notes: 'Thank you for choosing our chamber for your legal counsel.',
    items: []
  });

  // Payment Entry State
  const [paymentData, setPaymentData] = useState<{
    amount: number;
    paymentDate: string;
    paymentMethod: 'UPI' | 'Bank Transfer' | 'Cheque' | 'Cash' | 'Card';
    referenceNo: string;
    notes: string;
  }>({
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'UPI',
    referenceNo: '',
    notes: 'Payment received towards legal invoice balance'
  });

  // Keep Timer Case ID synced if selectedCaseId changes externally
  useEffect(() => {
    if (selectedCaseId) {
      setTimerCaseId(selectedCaseId);
      setNewLogData(prev => ({ ...prev, caseId: selectedCaseId }));
    }
  }, [selectedCaseId]);

  // Supabase PostgreSQL Sync for TimeLogs, Invoices, and Payments
  useEffect(() => {
    if (!chamber?.id) {
      setTimeLogs(INITIAL_TIME_LOGS);
      setInvoices(INITIAL_INVOICES);
      return;
    }

    let cancelled = false;
    setBillingLoading(true);
    setBillingError(null);

    Promise.all([
      listTimeEntriesForWorkspace(chamber.id, cases),
      listInvoicesForWorkspace(chamber.id, cases),
    ])
      .then(([loadedLogs, loadedInvoices]) => {
        if (cancelled) return;
        setTimeLogs(loadedLogs);
        setInvoices(loadedInvoices);
      })
      .catch((err: any) => {
        if (cancelled) return;
        console.error('Billing Supabase load error:', err);
        setBillingError(err?.message || 'Failed to load billing records from PostgreSQL.');
      })
      .finally(() => {
        if (!cancelled) setBillingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chamber?.id, cases]);

  // Timer Tick
  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerRunning]);

  // Format Timer Display HH:MM:SS
  const formatTimer = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Save Timer to Time Log
  const handleSaveTimer = async () => {
    setBillingError(null);
    setBillingSuccess(null);
    if (timerSeconds < 10) {
      setBillingError('Timer duration is too short to log (minimum 10 seconds).');
      return;
    }

    const calculatedHours = Number((timerSeconds / 3600).toFixed(2));
    const finalRate = chamberRates[timerRole] || 2500;
    const currentCase = cases.find(c => c.id === timerCaseId) || cases[0];

    const logPayload: Omit<TimeLog, 'id' | 'createdAt'> = {
      caseId: timerCaseId,
      caseTitle: currentCase ? currentCase.title : 'General Legal Counsel',
      advocateName: timerAdvocate,
      advocateRole: timerRole,
      taskCategory: timerCategory,
      description: timerDescription || `Recorded via Live Chamber Timer (${formatTimer(timerSeconds)})`,
      hours: Math.max(calculatedHours, 0.25),
      hourlyRate: finalRate,
      totalAmount: Math.round(Math.max(calculatedHours, 0.25) * finalRate),
      date: new Date().toISOString().split('T')[0],
      billable: timerBillable,
      status: 'Unbilled'
    };

    if (!chamber?.id) {
      setBillingError('Cannot save time entry: active workspace is required.');
      return;
    }

    setIsSavingBilling(true);
    try {
      const saved = await createTimeEntryInDb(chamber.id, logPayload, cases);
      setTimeLogs(prev => [saved, ...prev]);
      setTimerRunning(false);
      setTimerSeconds(0);
      setTimerDescription('');
      logAuditEvent('CASE_UPDATE', `Logged ${saved.hours} hrs for matter: ${saved.caseTitle}`, {
        chamberId: chamber.id,
        caseId: saved.caseId,
      });
      setBillingSuccess(`Saved timer entry (${saved.hours} hrs) to PostgreSQL.`);
      setTimeout(() => setBillingSuccess(null), 4000);
    } catch (err: any) {
      console.error('Save time log error:', err);
      setBillingError(err?.message || 'Failed to save timer entry to PostgreSQL.');
    } finally {
      setIsSavingBilling(false);
    }
  };

  // Add Manual Time Log
  const handleCreateManualLog = async () => {
    setBillingError(null);
    setBillingSuccess(null);
    if (!newLogData.description.trim()) {
      setBillingError('Please enter a task description.');
      return;
    }

    if (!chamber?.id) {
      setBillingError('Cannot save time entry: active workspace is required.');
      return;
    }

    const currentCase = cases.find(c => c.id === newLogData.caseId) || cases[0];
    const logPayload: Omit<TimeLog, 'id' | 'createdAt'> = {
      caseId: newLogData.caseId,
      caseTitle: currentCase ? currentCase.title : 'General Legal Counsel',
      advocateName: newLogData.advocateName,
      advocateRole: newLogData.advocateRole,
      taskCategory: newLogData.taskCategory,
      description: newLogData.description.trim(),
      hours: Number(newLogData.hours),
      hourlyRate: Number(newLogData.hourlyRate),
      totalAmount: Math.round(Number(newLogData.hours) * Number(newLogData.hourlyRate)),
      date: newLogData.date,
      billable: newLogData.billable,
      status: 'Unbilled'
    };

    setIsSavingBilling(true);
    try {
      const saved = await createTimeEntryInDb(chamber.id, logPayload, cases);
      setTimeLogs(prev => [saved, ...prev]);
      setIsLogModalOpen(false);
      setNewLogData({
        caseId: selectedCaseId || (cases[0]?.id || ''),
        taskCategory: 'Document Review',
        advocateName: chamber?.advocateName || 'Adv. Advocate360',
        advocateRole: 'Senior Advocate',
        description: '',
        hours: 1,
        hourlyRate: 3500,
        date: new Date().toISOString().split('T')[0],
        billable: true
      });
      logAuditEvent('CASE_UPDATE', `Logged ${saved.hours} manual hrs: ${saved.taskCategory}`, {
        chamberId: chamber.id,
        caseId: saved.caseId,
      });
      setBillingSuccess(`Saved ${saved.hours}h time entry to PostgreSQL.`);
      setTimeout(() => setBillingSuccess(null), 4000);
    } catch (err: any) {
      console.error('Supabase log creation error:', err);
      setBillingError(
        err?.message || 'Failed to save time entry to PostgreSQL. Your input has been preserved.'
      );
    } finally {
      setIsSavingBilling(false);
    }
  };

  // Delete Time Log
  const handleDeleteTimeLog = async (logId: string) => {
    if (!chamber?.id) return;
    setBillingError(null);
    setBillingSuccess(null);
    const previousLogs = [...timeLogs];
    setTimeLogs(prev => prev.filter(l => l.id !== logId));
    try {
      await deleteTimeEntryInDb(chamber.id, logId);
      setBillingSuccess('Deleted time entry from PostgreSQL.');
      setTimeout(() => setBillingSuccess(null), 3000);
    } catch (err: any) {
      console.error('Delete time log error:', err);
      setTimeLogs(previousLogs);
      setBillingError(err?.message || 'Failed to delete time entry from PostgreSQL.');
    }
  };

  // Open Invoice Builder pre-populated with selected time logs or current case
  const handleOpenInvoiceModalForSelectedLogs = () => {
    setBillingError(null);
    const logsToConvert = timeLogs.filter(l => selectedLogIds.includes(l.id));
    if (logsToConvert.length === 0) {
      setBillingError('Please select at least one unbilled time entry to generate an invoice.');
      return;
    }

    const firstCase = cases.find(c => c.id === logsToConvert[0].caseId);
    const convertedItems: InvoiceItem[] = logsToConvert.map(l => ({
      id: `item-${l.id}`,
      description: `${l.taskCategory}: ${l.description}`,
      hours: l.hours,
      rate: l.hourlyRate,
      amount: l.totalAmount,
      timeLogId: l.id
    }));

    setNewInvoiceData({
      caseId: logsToConvert[0].caseId,
      clientName: firstCase?.clientName || 'S. Ramesh',
      clientEmail: firstCase?.clientEmail || 'client@example.com',
      clientPhone: firstCase?.clientPhone || '+91 98400 12345',
      clientAddress: 'High Court Chambers Annex, Chennai',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
      taxRatePercentage: 18,
      discountAmount: 0,
      paymentTerms: 'Payment due within 14 days via UPI or NEFT/RTGS.',
      notes: 'Fee calculation based on logged professional hours.',
      items: convertedItems
    });

    setIsInvoiceModalOpen(true);
  };

  // Open blank invoice modal for case
  const handleOpenBlankInvoiceModal = () => {
    setBillingError(null);
    const targetCase = cases.find(c => c.id === (filterCaseId !== 'all' ? filterCaseId : selectedCaseId)) || cases[0];
    
    // Auto pull unbilled logs for this case
    const caseUnbilledLogs = timeLogs.filter(l => l.caseId === targetCase?.id && l.status === 'Unbilled' && l.billable);
    
    const convertedItems: InvoiceItem[] = caseUnbilledLogs.map(l => ({
      id: `item-${l.id}`,
      description: `${l.taskCategory}: ${l.description}`,
      hours: l.hours,
      rate: l.hourlyRate,
      amount: l.totalAmount,
      timeLogId: l.id
    }));

    if (convertedItems.length === 0) {
      convertedItems.push({
        id: `item-${Date.now()}`,
        description: 'Professional Legal Counsel & Case Consultation Fee',
        hours: 2,
        rate: 3500,
        amount: 7000
      });
    }

    setNewInvoiceData({
      caseId: targetCase?.id || '',
      clientName: targetCase?.clientName || 'Client Name',
      clientEmail: targetCase?.clientEmail || 'client@example.com',
      clientPhone: targetCase?.clientPhone || '+91 98000 00000',
      clientAddress: 'Chambers Client Location',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
      taxRatePercentage: 18,
      discountAmount: 0,
      paymentTerms: 'Payment due within 14 days of invoice issue date.',
      notes: 'Thank you for engaging our legal practice.',
      items: convertedItems
    });

    setIsInvoiceModalOpen(true);
  };

  // Add Item to Invoice Builder
  const handleAddInvoiceItem = () => {
    setNewInvoiceData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `item-${Date.now()}`,
          description: 'Legal Representation & Court Filing Fee',
          hours: 1,
          rate: 2500,
          amount: 2500
        }
      ]
    }));
  };

  // Remove Item from Invoice Builder
  const handleRemoveInvoiceItem = (itemId: string) => {
    setNewInvoiceData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== itemId)
    }));
  };

  // Save Generated Invoice
  const handleSaveInvoice = async () => {
    setBillingError(null);
    setBillingSuccess(null);
    if (newInvoiceData.items.length === 0) {
      setBillingError('Please add at least one line item to the invoice.');
      return;
    }
    if (!chamber?.id) {
      setBillingError('Cannot save invoice: active workspace is required.');
      return;
    }

    const subtotal = newInvoiceData.items.reduce((acc, i) => acc + i.amount, 0);
    const taxAmount = Math.round((subtotal * newInvoiceData.taxRatePercentage) / 100);
    const totalAmount = Math.max(0, subtotal + taxAmount - Number(newInvoiceData.discountAmount));
    const invNumber = `INV-${new Date().getFullYear()}-${(invoices.length + 1).toString().padStart(3, '0')}`;
    const targetCase = cases.find(c => c.id === newInvoiceData.caseId) || cases[0];

    const invoicePayload: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = {
      invoiceNumber: invNumber,
      caseId: newInvoiceData.caseId,
      caseTitle: targetCase ? targetCase.title : 'Legal Matter',
      clientName: newInvoiceData.clientName,
      clientEmail: newInvoiceData.clientEmail,
      clientPhone: newInvoiceData.clientPhone,
      clientAddress: newInvoiceData.clientAddress,
      issueDate: newInvoiceData.issueDate,
      dueDate: newInvoiceData.dueDate,
      hourlyRate: 3500,
      items: newInvoiceData.items,
      subtotal,
      taxRatePercentage: Number(newInvoiceData.taxRatePercentage),
      taxAmount,
      discountAmount: Number(newInvoiceData.discountAmount),
      totalAmount,
      paidAmount: 0,
      balanceAmount: totalAmount,
      status: 'Issued',
      paymentTerms: newInvoiceData.paymentTerms,
      notes: newInvoiceData.notes,
      bankDetails: {
        accountName: chamber ? `${chamber.name} Legal Account` : 'Advocate360 Legal Account',
        accountNumber: '92102003884912',
        ifscCode: 'UTIB0000123',
        bankName: 'Axis Bank, High Court Branch',
        upiId: 'adv360chamber@axisbank'
      },
      payments: []
    };

    const linkedLogIds = newInvoiceData.items.map(i => i.timeLogId).filter(Boolean) as string[];

    setIsSavingBilling(true);
    try {
      const createdInvoice = await createInvoiceInDb(
        chamber.id,
        invoicePayload,
        linkedLogIds,
        cases
      );
      setTimeLogs(prev =>
        prev.map(l =>
          linkedLogIds.includes(l.id)
            ? { ...l, status: 'Invoiced', invoiceId: createdInvoice.id }
            : l
        )
      );
      setInvoices(prev => [createdInvoice, ...prev]);
      setSelectedLogIds([]);
      setIsInvoiceModalOpen(false);
      logAuditEvent(
        'DRAFT_CREATE',
        `Generated Invoice ${createdInvoice.invoiceNumber} (₹${createdInvoice.totalAmount})`,
        { chamberId: chamber.id, caseId: createdInvoice.caseId }
      );
      setBillingSuccess(
        `Issued Invoice ${createdInvoice.invoiceNumber} (₹${createdInvoice.totalAmount.toLocaleString('en-IN')}) in PostgreSQL.`
      );
      setTimeout(() => setBillingSuccess(null), 4000);
    } catch (err: any) {
      console.error('Supabase save invoice error:', err);
      setBillingError(
        err?.message || 'Failed to save invoice to PostgreSQL. Your input has been preserved.'
      );
    } finally {
      setIsSavingBilling(false);
    }
  };

  // Delete Invoice
  const handleDeleteInvoice = async (invId: string) => {
    if (!chamber?.id) return;
    setBillingError(null);
    setBillingSuccess(null);
    const previousInvoices = [...invoices];
    setInvoices(prev => prev.filter(i => i.id !== invId));
    try {
      await deleteInvoiceInDb(chamber.id, invId);
      setBillingSuccess('Deleted invoice from PostgreSQL.');
      setTimeout(() => setBillingSuccess(null), 3000);
    } catch (err: any) {
      console.error('Delete invoice error:', err);
      setInvoices(previousInvoices);
      setBillingError(err?.message || 'Failed to delete invoice from PostgreSQL.');
    }
  };

  // Open Record Payment Modal
  const handleOpenPaymentModal = (inv: Invoice) => {
    setBillingError(null);
    setActiveInvoiceForPayment(inv);
    setPaymentData({
      amount: inv.balanceAmount,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'UPI',
      referenceNo: `PAY-${Date.now().toString().slice(-6)}`,
      notes: `Payment for Invoice ${inv.invoiceNumber}`
    });
    setIsPaymentModalOpen(true);
  };

  // Submit Payment
  const handleSubmitPayment = async () => {
    if (!activeInvoiceForPayment) return;
    setBillingError(null);
    setBillingSuccess(null);
    const payAmt = Number(paymentData.amount);
    if (payAmt <= 0) {
      setBillingError('Please enter a valid payment amount greater than zero.');
      return;
    }
    if (!chamber?.id) {
      setBillingError('Cannot record payment: active workspace is required.');
      return;
    }

    setIsSavingBilling(true);
    try {
      const updatedInvoice = await recordPaymentInDb(
        chamber.id,
        activeInvoiceForPayment,
        {
          amount: payAmt,
          paymentDate: paymentData.paymentDate,
          paymentMethod: paymentData.paymentMethod,
          referenceNo: paymentData.referenceNo,
          notes: paymentData.notes
        },
        cases
      );

      setInvoices(prev => prev.map(i => i.id === updatedInvoice.id ? updatedInvoice : i));
      setIsPaymentModalOpen(false);
      setActiveInvoiceForPayment(null);
      logAuditEvent(
        'CASE_UPDATE',
        `Recorded Payment ₹${payAmt} for Invoice ${updatedInvoice.invoiceNumber}`,
        { chamberId: chamber.id, caseId: updatedInvoice.caseId }
      );
      setBillingSuccess(
        `Recorded payment ₹${payAmt.toLocaleString('en-IN')} for ${updatedInvoice.invoiceNumber} in PostgreSQL.`
      );
      setTimeout(() => setBillingSuccess(null), 4000);
    } catch (err: any) {
      console.error('Record payment error:', err);
      setBillingError(
        err?.message || 'Failed to record payment in PostgreSQL. Your input has been preserved.'
      );
    } finally {
      setIsSavingBilling(false);
    }
  };

  // Open Preview Modal
  const handleViewInvoice = (inv: Invoice) => {
    setActiveInvoiceForView(inv);
    setIsPreviewModalOpen(true);
  };

  // Financial Metric Calculations
  const filteredLogs = timeLogs.filter(l => {
    const matchCase = filterCaseId === 'all' || l.caseId === filterCaseId;
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    const matchSearch = !searchQuery || l.description.toLowerCase().includes(searchQuery.toLowerCase()) || l.taskCategory.toLowerCase().includes(searchQuery.toLowerCase()) || l.caseTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCase && matchStatus && matchSearch;
  });

  const filteredInvoices = invoices.filter(i => {
    const matchCase = filterCaseId === 'all' || i.caseId === filterCaseId;
    const matchStatus = filterStatus === 'all' || i.status === filterStatus;
    const matchSearch = !searchQuery || i.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || i.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || i.caseTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCase && matchStatus && matchSearch;
  });

  const totalHoursLogged = timeLogs.reduce((acc, l) => acc + l.hours, 0);
  const billableHours = timeLogs.filter(l => l.billable).reduce((acc, l) => acc + l.hours, 0);
  const unbilledAmount = timeLogs.filter(l => l.status === 'Unbilled' && l.billable).reduce((acc, l) => acc + l.totalAmount, 0);
  const totalInvoicedAmount = invoices.reduce((acc, i) => acc + i.totalAmount, 0);
  const totalCollectedAmount = invoices.reduce((acc, i) => acc + i.paidAmount, 0);
  const totalOutstandingBalance = invoices.reduce((acc, i) => acc + i.balanceAmount, 0);

  // Chart Data: Hours by Category
  const categoryHoursMap: { [cat: string]: number } = {};
  timeLogs.forEach(l => {
    categoryHoursMap[l.taskCategory] = (categoryHoursMap[l.taskCategory] || 0) + l.hours;
  });
  const chartCategoryData = Object.keys(categoryHoursMap).map(cat => ({
    name: cat,
    hours: Number(categoryHoursMap[cat].toFixed(1))
  }));

  // Chart Data: Invoices Status Pie
  const statusPieData = [
    { name: 'Paid', value: invoices.filter(i => i.status === 'Paid').length, color: '#10B981' },
    { name: 'Partially Paid', value: invoices.filter(i => i.status === 'Partially Paid').length, color: '#F59E0B' },
    { name: 'Issued / Pending', value: invoices.filter(i => i.status === 'Issued').length, color: '#3B82F6' },
    { name: 'Overdue', value: invoices.filter(i => i.status === 'Overdue').length, color: '#EF4444' }
  ].filter(d => d.value > 0);

  // Toggle log selection for batch invoicing
  const toggleSelectLog = (logId: string) => {
    setSelectedLogIds(prev => prev.includes(logId) ? prev.filter(id => id !== logId) : [...prev, logId]);
  };

  const toggleSelectAllUnbilled = () => {
    const unbilledIds = filteredLogs.filter(l => l.status === 'Unbilled' && l.billable).map(l => l.id);
    if (selectedLogIds.length === unbilledIds.length) {
      setSelectedLogIds([]);
    } else {
      setSelectedLogIds(unbilledIds);
    }
  };

  return (
    <div className="space-y-6">
      {billingError && (
        <div role="alert" className="p-3 bg-[#FFF4F2] border-2 border-[#FF4444] text-xs text-[#FF4444] font-bold flex items-center justify-between">
          <span>⚠️ {billingError}</span>
          <button onClick={() => setBillingError(null)} className="underline ml-3">Dismiss</button>
        </div>
      )}
      {billingSuccess && (
        <div role="status" className="p-3 bg-emerald-50 border-2 border-emerald-700 text-xs text-emerald-900 font-bold flex items-center justify-between">
          <span>✓ {billingSuccess}</span>
          <button onClick={() => setBillingSuccess(null)} className="underline ml-3">Dismiss</button>
        </div>
      )}
      
      {/* Editorial Header & Chamber Billing Toolbar */}
      <div className="bg-[#F5F2EF] border-2 border-[#1A1A1A] p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-[#1A1A1A] text-amber-400 font-bold text-[9px] uppercase tracking-widest px-2.5 py-0.5 font-mono">
              Chamber Financial Governance
            </span>
            <span className="text-xs text-[#555555] font-serif italic">
              {billingLoading ? 'Syncing PostgreSQL Ledger...' : 'Matter-Wise Time Tracking & Invoicing Engine'}
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold italic text-[#1A1A1A] flex items-center gap-2">
            <IndianRupee className="w-7 h-7 text-[#B45309]" />
            <span>Chamber Billing & Hourly Rates</span>
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsRatesModalOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-[#1A1A1A] border border-[#1A1A1A] text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Tag className="w-3.5 h-3.5 text-[#B45309]" />
            <span>Rate Card</span>
          </button>

          <button
            onClick={() => {
              setBillingError(null);
              setIsLogModalOpen(true);
            }}
            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-[#1A1A1A] border border-[#1A1A1A] text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>+ Log Hours</span>
          </button>

          <button
            onClick={handleOpenBlankInvoiceModal}
            className="px-4 py-2 bg-[#1A1A1A] hover:bg-slate-800 text-amber-400 border border-[#1A1A1A] text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-md"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>+ New Invoice</span>
          </button>
        </div>
      </div>

      {/* Real-Time Live Chamber Timer Widget */}
      <div className="bg-[#1A1A1A] text-white border-2 border-[#1A1A1A] p-4 sm:p-5 shadow-md rounded-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Live Timer Counter */}
          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-3 shrink-0">
            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
            <div>
              <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-400">
                Live Stopwatch
              </div>
              <div className="font-mono text-2xl font-black text-amber-400 tracking-wider">
                {formatTimer(timerSeconds)}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {!timerRunning ? (
                <button
                  onClick={() => setTimerRunning(true)}
                  className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase flex items-center gap-1 transition-colors"
                  title="Start Timer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span className="hidden sm:inline">Start</span>
                </button>
              ) : (
                <button
                  onClick={() => setTimerRunning(false)}
                  className="p-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase flex items-center gap-1 transition-colors"
                  title="Pause Timer"
                >
                  <Pause className="w-4 h-4 fill-white" />
                  <span className="hidden sm:inline">Pause</span>
                </button>
              )}
              <button
                onClick={() => { setTimerRunning(false); setTimerSeconds(0); }}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase transition-colors"
                title="Reset Timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Context Inputs for Timer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 flex-1 text-xs font-mono">
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Target Matter</label>
              <select
                value={timerCaseId}
                onChange={(e) => setTimerCaseId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 py-1.5 px-2 focus:border-amber-500 focus:outline-none"
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Task Category</label>
              <select
                value={timerCategory}
                onChange={(e) => setTimerCategory(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 py-1.5 px-2 focus:border-amber-500 focus:outline-none"
              >
                <option value="Document Review">Document Review</option>
                <option value="Legal Research">Legal Research</option>
                <option value="Court Hearing">Court Hearing</option>
                <option value="Drafting Petition">Drafting Petition</option>
                <option value="Client Consultation">Client Consultation</option>
                <option value="Evidence Analysis">Evidence Analysis</option>
                <option value="Filing & Administrative">Filing & Administrative</option>
              </select>
            </div>

            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Advocate Role</label>
              <select
                value={timerRole}
                onChange={(e) => setTimerRole(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 py-1.5 px-2 focus:border-amber-500 focus:outline-none"
              >
                <option value="Senior Advocate">Senior Advocate (₹4,000/hr)</option>
                <option value="Advocate">Advocate (₹2,500/hr)</option>
                <option value="Junior Advocate">Junior Advocate (₹1,800/hr)</option>
                <option value="Paralegal">Paralegal (₹1,000/hr)</option>
              </select>
            </div>

            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Work Description</label>
              <input
                type="text"
                placeholder="Brief summary of work..."
                value={timerDescription}
                onChange={(e) => setTimerDescription(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 py-1.5 px-2 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Direct Log Button */}
          <button
            onClick={handleSaveTimer}
            disabled={timerSeconds === 0}
            className={`px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider border shrink-0 transition-all ${
              timerSeconds > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-black border-amber-500 shadow-md'
                : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
            }`}
          >
            Log Session Hours
          </button>

        </div>
      </div>

      {/* KPI Financial Overview Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border-2 border-[#1A1A1A] p-4 shadow-xs space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#555555] flex items-center justify-between">
            <span>Total Hours</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-serif font-bold text-[#1A1A1A]">
            {totalHoursLogged.toFixed(1)} <span className="text-xs font-sans text-slate-500 font-normal">hrs</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {billableHours.toFixed(1)} hrs billable
          </div>
        </div>

        <div className="bg-white border-2 border-[#1A1A1A] p-4 shadow-xs space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#555555] flex items-center justify-between">
            <span>Unbilled Work</span>
            <IndianRupee className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-serif font-bold text-amber-700">
            ₹{unbilledAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-amber-600 font-mono">
            {timeLogs.filter(l => l.status === 'Unbilled').length} unbilled entries
          </div>
        </div>

        <div className="bg-white border-2 border-[#1A1A1A] p-4 shadow-xs space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#555555] flex items-center justify-between">
            <span>Total Invoiced</span>
            <FileText className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-serif font-bold text-[#1A1A1A]">
            ₹{totalInvoicedAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {invoices.length} invoices issued
          </div>
        </div>

        <div className="bg-white border-2 border-[#1A1A1A] p-4 shadow-xs space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#555555] flex items-center justify-between">
            <span>Fees Collected</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-serif font-bold text-emerald-700">
            ₹{totalCollectedAmount.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-emerald-600 font-mono font-bold">
            {totalInvoicedAmount > 0 ? Math.round((totalCollectedAmount / totalInvoicedAmount) * 100) : 0}% realized
          </div>
        </div>

        <div className="bg-white border-2 border-[#1A1A1A] p-4 shadow-xs space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#555555] flex items-center justify-between">
            <span>Outstanding Due</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-xl sm:text-2xl font-serif font-bold text-rose-700">
            ₹{totalOutstandingBalance.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-rose-600 font-mono">
            {invoices.filter(i => i.balanceAmount > 0).length} pending payments
          </div>
        </div>

        <div className="bg-[#1A1A1A] text-white border-2 border-[#1A1A1A] p-4 shadow-xs space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
            <span>Avg Hourly Rate</span>
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-serif font-bold text-white">
            ₹3,200 <span className="text-xs text-slate-400 font-sans font-normal">/hr</span>
          </div>
          <div className="text-[10px] text-slate-300 font-mono">
            Blended Chamber Rate
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs & Search Filters */}
      <div className="bg-[#F5F2EF] border-2 border-[#1A1A1A] p-3 shadow-xs space-y-3">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-300 pb-3">
          {/* Sub-Tab Switcher */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveSubTab('timelogs')}
              className={`px-3.5 py-1.5 text-xs font-bold font-mono uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                activeSubTab === 'timelogs'
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-xs'
                  : 'bg-white text-[#1A1A1A] border-slate-300 hover:border-[#1A1A1A]'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Timesheet & Logged Hours ({timeLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('invoices')}
              className={`px-3.5 py-1.5 text-xs font-bold font-mono uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                activeSubTab === 'invoices'
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-xs'
                  : 'bg-white text-[#1A1A1A] border-slate-300 hover:border-[#1A1A1A]'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>Invoices Ledger ({invoices.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('payments')}
              className={`px-3.5 py-1.5 text-xs font-bold font-mono uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                activeSubTab === 'payments'
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-xs'
                  : 'bg-white text-[#1A1A1A] border-slate-300 hover:border-[#1A1A1A]'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
              <span>Payment Receipts Log</span>
            </button>

            <button
              onClick={() => setActiveSubTab('overview')}
              className={`px-3.5 py-1.5 text-xs font-bold font-mono uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                activeSubTab === 'overview'
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-xs'
                  : 'bg-white text-[#1A1A1A] border-slate-300 hover:border-[#1A1A1A]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
              <span>Analytics & Metrics</span>
            </button>
          </div>

          {/* Quick Batch Invoice Action when logs are checked */}
          {activeSubTab === 'timelogs' && selectedLogIds.length > 0 && (
            <button
              onClick={handleOpenInvoiceModalForSelectedLogs}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black border border-black font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all animate-pulse"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Invoice {selectedLogIds.length} Selected Entry(s)</span>
            </button>
          )}
        </div>

        {/* Global Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1 bg-white border border-slate-300 px-2 py-1">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] uppercase font-bold text-slate-500">Matter:</span>
              <select
                value={filterCaseId}
                onChange={(e) => setFilterCaseId(e.target.value)}
                className="bg-transparent text-[#1A1A1A] font-bold focus:outline-none"
              >
                <option value="all">All Chamber Matters ({cases.length})</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-white border border-slate-300 px-2 py-1">
              <span className="text-[10px] uppercase font-bold text-slate-500">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-[#1A1A1A] font-bold focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="Unbilled">Unbilled</option>
                <option value="Invoiced">Invoiced</option>
                <option value="Issued">Issued</option>
                <option value="Paid">Paid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description, client..."
              className="w-full bg-white border border-slate-300 focus:border-[#1A1A1A] text-[#1A1A1A] text-xs font-mono pl-8 pr-2 py-1.5 focus:outline-none"
            />
          </div>
        </div>

      </div>

      {/* SUB-TAB 1: TIMESHEET & LOGGED HOURS */}
      {activeSubTab === 'timelogs' && (
        <div className="bg-white border-2 border-[#1A1A1A] shadow-xs overflow-hidden">
          <div className="p-3 border-b-2 border-[#1A1A1A] bg-[#F5F2EF] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedLogIds.length > 0 && selectedLogIds.length === filteredLogs.filter(l => l.status === 'Unbilled' && l.billable).length}
                onChange={toggleSelectAllUnbilled}
                className="rounded-none accent-amber-600"
              />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A]">
                Chamber Hours Log ({filteredLogs.length} entries)
              </span>
            </div>
            <span className="text-xs font-mono text-slate-600">
              Select entries to generate a consolidated legal invoice.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="bg-[#1A1A1A] text-white font-mono text-[10px] uppercase tracking-wider border-b border-[#1A1A1A]">
                  <th className="py-2.5 px-3 w-10 text-center">Select</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Matter / Case</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Work Description</th>
                  <th className="py-2.5 px-3">Advocate</th>
                  <th className="py-2.5 px-3 text-right">Hours</th>
                  <th className="py-2.5 px-3 text-right">Rate</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500 font-mono italic">
                      No time logs found matching the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isSelected = selectedLogIds.includes(log.id);
                    const isUnbilled = log.status === 'Unbilled';

                    return (
                      <tr 
                        key={log.id} 
                        className={`hover:bg-amber-50/60 transition-colors ${isSelected ? 'bg-amber-100/80 font-medium' : ''}`}
                      >
                        <td className="py-3 px-3 text-center">
                          {isUnbilled ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectLog(log.id)}
                              className="accent-amber-600 cursor-pointer"
                            />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-slate-400 mx-auto" />
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700 shrink-0">
                          {log.date}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-serif italic font-bold text-[#1A1A1A] line-clamp-1">
                            {log.caseTitle}
                          </p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="bg-slate-100 border border-slate-300 text-slate-800 text-[10px] font-mono px-2 py-0.5 rounded-none font-bold">
                            {log.taskCategory}
                          </span>
                        </td>
                        <td className="py-3 px-3 max-w-xs text-slate-700">
                          <p className="line-clamp-2 leading-relaxed">
                            {log.description}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-mono text-[11px]">
                          <div>{log.advocateName}</div>
                          {log.advocateRole && (
                            <div className="text-[9px] text-slate-500">{log.advocateRole}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[#1A1A1A]">
                          {log.hours} h
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-600">
                          ₹{log.hourlyRate.toLocaleString('en-IN')}/h
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-800">
                          ₹{log.totalAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 border ${
                            log.status === 'Unbilled' 
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : log.status === 'Invoiced'
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : 'bg-slate-100 text-slate-600 border-slate-300'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleDeleteTimeLog(log.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete time log"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: INVOICES MANAGEMENT */}
      {activeSubTab === 'invoices' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInvoices.length === 0 ? (
              <div className="col-span-full bg-white border-2 border-[#1A1A1A] p-8 text-center text-slate-500 font-mono italic">
                No invoices found matching current criteria. Click "+ New Invoice" above to issue an invoice.
              </div>
            ) : (
              filteredInvoices.map((inv) => {
                const isPaid = inv.status === 'Paid';
                const isPartial = inv.status === 'Partially Paid';
                const isOverdue = inv.status === 'Overdue';

                return (
                  <div key={inv.id} className="bg-white border-2 border-[#1A1A1A] p-5 shadow-xs flex flex-col justify-between space-y-4">
                    
                    {/* Invoice Header */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="font-mono font-bold text-xs text-amber-800">
                          {inv.invoiceNumber}
                        </span>
                        <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 border ${
                          isPaid ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          isPartial ? 'bg-amber-100 text-amber-800 border-amber-300' :
                          isOverdue ? 'bg-rose-100 text-rose-800 border-rose-300' :
                          'bg-blue-100 text-blue-800 border-blue-300'
                        }`}>
                          {inv.status}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-serif italic font-bold text-base text-[#1A1A1A] line-clamp-1">
                          {inv.caseTitle}
                        </h3>
                        <p className="text-xs text-slate-600 font-sans">
                          Client: <strong>{inv.clientName}</strong>
                        </p>
                      </div>

                      <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between">
                        <span>Issued: {inv.issueDate}</span>
                        <span>Due: <strong className="text-slate-700">{inv.dueDate}</strong></span>
                      </div>
                    </div>

                    {/* Financial Progress Bar */}
                    <div className="space-y-1.5 bg-[#F5F2EF] p-2.5 border border-slate-200 text-xs font-mono">
                      <div className="flex justify-between font-bold">
                        <span>Total: ₹{inv.totalAmount.toLocaleString('en-IN')}</span>
                        <span className="text-emerald-700">Paid: ₹{inv.paidAmount.toLocaleString('en-IN')}</span>
                      </div>

                      {/* Progress Track */}
                      <div className="w-full h-2 bg-slate-300 rounded-none overflow-hidden">
                        <div 
                          className="h-full bg-emerald-600 transition-all"
                          style={{ width: `${inv.totalAmount > 0 ? Math.min(100, (inv.paidAmount / inv.totalAmount) * 100) : 0}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Balance Due:</span>
                        <span className="font-bold text-rose-700">
                          ₹{inv.balanceAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                      <button
                        onClick={() => handleViewInvoice(inv)}
                        className="flex-1 py-1.5 bg-[#1A1A1A] hover:bg-slate-800 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>View / Print</span>
                      </button>

                      {inv.balanceAmount > 0 && (
                        <button
                          onClick={() => handleOpenPaymentModal(inv)}
                          className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                          title="Record Payment"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Pay</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteInvoice(inv.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 border border-slate-300 hover:border-rose-400 transition-colors"
                        title="Delete Invoice"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: PAYMENT RECEIPTS LEDGER */}
      {activeSubTab === 'payments' && (
        <div className="bg-white border-2 border-[#1A1A1A] shadow-xs overflow-hidden">
          <div className="p-3 border-b-2 border-[#1A1A1A] bg-[#F5F2EF]">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#1A1A1A]">
              Chamber Payment Audit Ledger
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="bg-[#1A1A1A] text-white font-mono text-[10px] uppercase tracking-wider border-b border-[#1A1A1A]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Payment Method</th>
                  <th className="py-2.5 px-3">Reference No</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-right">Amount Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.flatMap(i => (i.payments || []).map(p => ({ ...p, clientName: i.clientName, invNo: i.invoiceNumber }))).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-mono italic">
                      No payments recorded yet. Click "Pay" on any issued invoice to log a payment receipt.
                    </td>
                  </tr>
                ) : (
                  invoices.flatMap(i => (i.payments || []).map(p => ({ ...p, clientName: i.clientName, invNo: i.invoiceNumber }))).map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-700">{p.paymentDate}</td>
                      <td className="py-3 px-3 font-mono font-bold text-amber-800">{p.invNo}</td>
                      <td className="py-3 px-3 font-serif font-bold text-[#1A1A1A]">{p.clientName}</td>
                      <td className="py-3 px-3">
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-mono px-2 py-0.5 font-bold uppercase">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">{p.referenceNo || '—'}</td>
                      <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{p.notes || '—'}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 text-sm">
                        +₹{p.amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: ANALYTICS & METRICS */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Hours by Category Bar Chart */}
          <div className="bg-white border-2 border-[#1A1A1A] p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-200 pb-2">
              <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A]">
                Hours Logged by Task Category
              </h3>
              <p className="text-xs text-slate-500 font-sans">
                Distribution of legal workload hours across practice areas
              </p>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartCategoryData} layout="vertical">
                  <XAxis type="number" stroke="#555" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="#555" fontSize={10} width={130} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1A1A1A', color: '#fff', fontSize: '12px', borderRadius: '0px' }}
                    formatter={(value: any) => [`${value} Hours`, 'Time Logged']}
                  />
                  <Bar dataKey="hours" fill="#B45309" radius={0} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Invoices Payment Status Pie */}
          <div className="bg-white border-2 border-[#1A1A1A] p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-200 pb-2">
              <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A]">
                Invoice Collection Portfolio
              </h3>
              <p className="text-xs text-slate-500 font-sans">
                Realized fees vs outstanding balances breakdown
              </p>
            </div>

            <div className="h-64 w-full flex items-center justify-center">
              {statusPieData.length === 0 ? (
                <div className="text-slate-400 font-mono text-xs italic">No invoice status data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', color: '#fff', fontSize: '12px' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>
      )}

      {/* MODAL 1: ADD MANUAL HOUR LOG */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#1A1A1A] max-w-lg w-full p-6 space-y-5 shadow-2xl font-sans">
            
            <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#B45309]" />
                <h2 className="font-serif italic font-bold text-xl text-[#1A1A1A]">
                  Log Professional Hours
                </h2>
              </div>
              <button onClick={() => setIsLogModalOpen(false)} className="text-slate-500 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            {billingError && (
              <div role="alert" className="p-2.5 bg-[#FFF4F2] border border-[#FF4444] text-xs font-mono font-bold text-[#FF4444]">
                ⚠️ {billingError}
              </div>
            )}

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Matter / Case File</label>
                <select
                  value={newLogData.caseId}
                  onChange={(e) => setNewLogData({ ...newLogData, caseId: e.target.value })}
                  className="w-full bg-[#F5F2EF] border border-[#1A1A1A] p-2 focus:outline-none"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Task Category</label>
                  <select
                    value={newLogData.taskCategory}
                    onChange={(e) => setNewLogData({ ...newLogData, taskCategory: e.target.value as any })}
                    className="w-full bg-[#F5F2EF] border border-[#1A1A1A] p-2 focus:outline-none"
                  >
                    <option value="Document Review">Document Review</option>
                    <option value="Legal Research">Legal Research</option>
                    <option value="Court Hearing">Court Hearing</option>
                    <option value="Drafting Petition">Drafting Petition</option>
                    <option value="Client Consultation">Client Consultation</option>
                    <option value="Evidence Analysis">Evidence Analysis</option>
                    <option value="Filing & Administrative">Filing & Administrative</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={newLogData.date}
                    onChange={(e) => setNewLogData({ ...newLogData, date: e.target.value })}
                    className="w-full bg-[#F5F2EF] border border-[#1A1A1A] p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Work Description</label>
                <textarea
                  rows={3}
                  placeholder="Detailed summary of research, filing, or court appearance..."
                  value={newLogData.description}
                  onChange={(e) => setNewLogData({ ...newLogData, description: e.target.value })}
                  className="w-full bg-[#F5F2EF] border border-[#1A1A1A] p-2 focus:outline-none font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hours Spent</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={newLogData.hours}
                    onChange={(e) => setNewLogData({ ...newLogData, hours: Number(e.target.value) })}
                    className="w-full bg-[#F5F2EF] border border-[#1A1A1A] p-2 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hourly Rate (₹)</label>
                  <input
                    type="number"
                    step="100"
                    value={newLogData.hourlyRate}
                    onChange={(e) => setNewLogData({ ...newLogData, hourlyRate: Number(e.target.value) })}
                    className="w-full bg-[#F5F2EF] border border-[#1A1A1A] p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 flex items-center justify-between font-mono font-bold">
                <span>Calculated Amount:</span>
                <span className="text-amber-900 text-base">
                  ₹{(Number(newLogData.hours) * Number(newLogData.hourlyRate)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="px-4 py-2 border border-slate-400 text-xs font-mono font-bold uppercase hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateManualLog}
                className="px-4 py-2 bg-[#1A1A1A] text-amber-400 font-mono text-xs font-bold uppercase hover:bg-slate-800"
              >
                Save Entry
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: CREATE NEW INVOICE */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-2 border-[#1A1A1A] max-w-3xl w-full p-6 space-y-6 shadow-2xl my-8 font-sans">
            
            <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-3">
              <div>
                <h2 className="font-serif italic font-bold text-2xl text-[#1A1A1A]">
                  Issue Legal Fee Invoice
                </h2>
                <p className="text-xs text-slate-600 font-mono">
                  Consolidate billable time logs and custom fee items
                </p>
              </div>
              <button onClick={() => setIsInvoiceModalOpen(false)} className="text-slate-500 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            {billingError && (
              <div role="alert" className="p-2.5 bg-[#FFF4F2] border border-[#FF4444] text-xs font-mono font-bold text-[#FF4444]">
                ⚠️ {billingError}
              </div>
            )}

            <div className="space-y-4 text-xs font-mono">
              
              {/* Client & Case Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F5F2EF] p-3 border border-slate-300">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Matter File</label>
                  <select
                    value={newInvoiceData.caseId}
                    onChange={(e) => {
                      const c = cases.find(cs => cs.id === e.target.value);
                      setNewInvoiceData({
                        ...newInvoiceData,
                        caseId: e.target.value,
                        clientName: c?.clientName || newInvoiceData.clientName
                      });
                    }}
                    className="w-full bg-white border border-[#1A1A1A] p-2 focus:outline-none"
                  >
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Client Name</label>
                  <input
                    type="text"
                    value={newInvoiceData.clientName}
                    onChange={(e) => setNewInvoiceData({ ...newInvoiceData, clientName: e.target.value })}
                    className="w-full bg-white border border-[#1A1A1A] p-2 focus:outline-none font-sans font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Client Email</label>
                  <input
                    type="email"
                    value={newInvoiceData.clientEmail}
                    onChange={(e) => setNewInvoiceData({ ...newInvoiceData, clientEmail: e.target.value })}
                    className="w-full bg-white border border-[#1A1A1A] p-2 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Client Phone</label>
                  <input
                    type="text"
                    value={newInvoiceData.clientPhone}
                    onChange={(e) => setNewInvoiceData({ ...newInvoiceData, clientPhone: e.target.value })}
                    className="w-full bg-white border border-[#1A1A1A] p-2 focus:outline-none"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={newInvoiceData.issueDate}
                    onChange={(e) => setNewInvoiceData({ ...newInvoiceData, issueDate: e.target.value })}
                    className="w-full bg-[#F5F2EF] border border-[#1A1A1A] p-2 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newInvoiceData.dueDate}
                    onChange={(e) => setNewInvoiceData({ ...newInvoiceData, dueDate: e.target.value })}
                    className="w-full bg-[#F5F2EF] border border-[#1A1A1A] p-2 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">GST / Tax (%)</label>
                  <input
                    type="number"
                    value={newInvoiceData.taxRatePercentage}
                    onChange={(e) => setNewInvoiceData({ ...newInvoiceData, taxRatePercentage: Number(e.target.value) })}
                    className="w-full bg-[#F5F2EF] border border-[#1A1A1A] p-2 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    value={newInvoiceData.discountAmount}
                    onChange={(e) => setNewInvoiceData({ ...newInvoiceData, discountAmount: Number(e.target.value) })}
                    className="w-full bg-[#F5F2EF] border border-[#1A1A1A] p-2 focus:outline-none"
                  />
                </div>
              </div>

              {/* Line Items Editor */}
              <div className="space-y-2 border-t border-b border-slate-300 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-slate-800">
                    Invoice Line Items ({newInvoiceData.items.length})
                  </span>
                  <button
                    onClick={handleAddInvoiceItem}
                    className="px-2.5 py-1 bg-[#1A1A1A] text-amber-400 text-[10px] font-bold uppercase flex items-center gap-1 hover:bg-slate-800"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Fee Line</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {newInvoiceData.items.map((item, idx) => (
                    <div key={item.id} className="p-2.5 bg-[#F5F2EF] border border-slate-300 flex flex-col sm:flex-row items-center gap-2">
                      <input
                        type="text"
                        placeholder="Description..."
                        value={item.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewInvoiceData(prev => ({
                            ...prev,
                            items: prev.items.map(i => i.id === item.id ? { ...i, description: val } : i)
                          }));
                        }}
                        className="flex-1 bg-white border border-slate-300 p-1.5 focus:outline-none text-xs font-sans font-medium"
                      />

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="number"
                          placeholder="Hours"
                          step="0.5"
                          value={item.hours || 1}
                          onChange={(e) => {
                            const hrs = Number(e.target.value);
                            setNewInvoiceData(prev => ({
                              ...prev,
                              items: prev.items.map(i => i.id === item.id ? { ...i, hours: hrs, amount: hrs * (i.rate || 0) } : i)
                            }));
                          }}
                          className="w-16 bg-white border border-slate-300 p-1.5 focus:outline-none text-center"
                        />
                        <span className="text-slate-500">×</span>
                        <input
                          type="number"
                          placeholder="Rate"
                          value={item.rate || item.amount}
                          onChange={(e) => {
                            const r = Number(e.target.value);
                            setNewInvoiceData(prev => ({
                              ...prev,
                              items: prev.items.map(i => i.id === item.id ? { ...i, rate: r, amount: (i.hours || 1) * r } : i)
                            }));
                          }}
                          className="w-24 bg-white border border-slate-300 p-1.5 focus:outline-none text-right"
                        />
                        <span className="font-bold text-[#1A1A1A] w-24 text-right">
                          ₹{item.amount.toLocaleString('en-IN')}
                        </span>
                        <button
                          onClick={() => handleRemoveInvoiceItem(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invoice Totals Calculation */}
              {(() => {
                const sub = newInvoiceData.items.reduce((acc, i) => acc + i.amount, 0);
                const tax = Math.round((sub * newInvoiceData.taxRatePercentage) / 100);
                const total = Math.max(0, sub + tax - Number(newInvoiceData.discountAmount));
                return (
                  <div className="bg-[#1A1A1A] text-white p-4 space-y-1 font-mono text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Subtotal:</span>
                      <span>₹{sub.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>GST / Tax ({newInvoiceData.taxRatePercentage}%):</span>
                      <span>+₹{tax.toLocaleString('en-IN')}</span>
                    </div>
                    {newInvoiceData.discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Discount Applied:</span>
                        <span>-₹{Number(newInvoiceData.discountAmount).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-amber-400 text-sm border-t border-slate-700 pt-2 mt-1">
                      <span>Grand Total Receivable:</span>
                      <span>₹{total.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                );
              })()}

            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setIsInvoiceModalOpen(false)}
                className="px-4 py-2 border border-slate-400 font-mono text-xs font-bold uppercase hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInvoice}
                className="px-5 py-2 bg-[#1A1A1A] text-amber-400 font-mono text-xs font-bold uppercase hover:bg-slate-800 shadow-md"
              >
                Issue & Save Invoice
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: INVOICE PREVIEW & EDITORIAL PRINT */}
      {isPreviewModalOpen && activeInvoiceForView && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-2 border-[#1A1A1A] max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8 font-sans relative">
            
            {/* Top Modal Controls */}
            <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-3 print:hidden">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#B45309]">
                Editorial Legal Invoice Document
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-[#1A1A1A] text-amber-400 font-mono text-xs font-bold uppercase flex items-center gap-1 hover:bg-slate-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print PDF</span>
                </button>
                <button onClick={() => setIsPreviewModalOpen(false)} className="text-slate-500 hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINTABLE LEGAL INVOICE LAYOUT */}
            <div className="p-4 border border-slate-200 space-y-6 bg-[#FDFCFB]">
              
              {/* Chamber Letterhead Header */}
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b-2 border-[#1A1A1A] pb-4">
                <div className="space-y-1">
                  <h1 className="font-serif italic font-bold text-2xl text-[#1A1A1A]">
                    {chamber?.name || 'Advocate360 AI Chamber'}
                  </h1>
                  <p className="text-xs text-slate-600 font-serif">
                    Adv. {chamber?.advocateName || 'R. Venkatraman'} • Enrollment No: {chamber?.enrollmentNo || 'MAH/1042/2005'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-sans">
                    {chamber?.officeLocation || 'High Court Chambers Annex, Bar Council Block'} • Ph: {chamber?.phone || '+91 98400 12345'}
                  </p>
                </div>

                <div className="text-right font-mono text-xs space-y-1">
                  <div className="bg-[#1A1A1A] text-amber-400 font-bold px-3 py-1 uppercase tracking-wider text-sm">
                    INVOICE
                  </div>
                  <div className="font-bold text-[#1A1A1A]">{activeInvoiceForView.invoiceNumber}</div>
                  <div className="text-slate-500 text-[10px]">Date: {activeInvoiceForView.issueDate}</div>
                  <div className="text-slate-500 text-[10px]">Due: {activeInvoiceForView.dueDate}</div>
                </div>
              </div>

              {/* Bill To & Matter Info */}
              <div className="grid grid-cols-2 gap-4 bg-[#F5F2EF] p-4 border border-slate-300 text-xs">
                <div>
                  <span className="font-mono text-[10px] uppercase font-bold text-slate-500 block mb-1">Billed To (Client):</span>
                  <div className="font-serif italic font-bold text-base text-[#1A1A1A]">{activeInvoiceForView.clientName}</div>
                  {activeInvoiceForView.clientAddress && <div className="text-slate-600">{activeInvoiceForView.clientAddress}</div>}
                  {activeInvoiceForView.clientPhone && <div className="text-slate-600">{activeInvoiceForView.clientPhone}</div>}
                  {activeInvoiceForView.clientEmail && <div className="text-slate-600">{activeInvoiceForView.clientEmail}</div>}
                </div>

                <div>
                  <span className="font-mono text-[10px] uppercase font-bold text-slate-500 block mb-1">Matter Reference:</span>
                  <div className="font-serif italic font-bold text-sm text-[#1A1A1A]">{activeInvoiceForView.caseTitle}</div>
                  <div className="font-mono text-[11px] text-slate-600 mt-1">Status: {activeInvoiceForView.status}</div>
                </div>
              </div>

              {/* Itemized Charges Table */}
              <table className="w-full text-left border-collapse text-xs font-sans">
                <thead>
                  <tr className="bg-[#1A1A1A] text-white font-mono text-[10px] uppercase border-b border-[#1A1A1A]">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Description of Legal Work / Fee Item</th>
                    <th className="py-2 px-3 text-right">Hours</th>
                    <th className="py-2 px-3 text-right">Rate</th>
                    <th className="py-2 px-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeInvoiceForView.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{index + 1}</td>
                      <td className="py-2.5 px-3 text-slate-800 font-medium">{item.description}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">{item.hours ? `${item.hours}h` : '—'}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">{item.rate ? `₹${item.rate.toLocaleString('en-IN')}` : '—'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#1A1A1A]">₹{item.amount.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total Summary Block */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t-2 border-[#1A1A1A]">
                
                {/* Bank Details & Payment Instructions */}
                <div className="bg-[#F5F2EF] p-3 border border-slate-300 text-xs font-mono space-y-1 max-w-sm">
                  <div className="font-bold text-[#1A1A1A] uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-amber-700" />
                    <span>Payment & Banking Details</span>
                  </div>
                  <div className="text-slate-700">Account: {activeInvoiceForView.bankDetails?.accountName}</div>
                  <div className="text-slate-700">A/C No: {activeInvoiceForView.bankDetails?.accountNumber}</div>
                  <div className="text-slate-700">IFSC: {activeInvoiceForView.bankDetails?.ifscCode}</div>
                  <div className="text-slate-700 font-bold text-amber-800">UPI ID: {activeInvoiceForView.bankDetails?.upiId}</div>
                </div>

                {/* Amount Totals */}
                <div className="w-full sm:w-64 font-mono text-xs space-y-1 text-right">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>₹{activeInvoiceForView.subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>GST ({activeInvoiceForView.taxRatePercentage}%):</span>
                    <span>+₹{activeInvoiceForView.taxAmount.toLocaleString('en-IN')}</span>
                  </div>
                  {activeInvoiceForView.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount:</span>
                      <span>-₹{activeInvoiceForView.discountAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-[#1A1A1A] text-sm border-t border-slate-300 pt-1.5">
                    <span>Grand Total:</span>
                    <span>₹{activeInvoiceForView.totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Amount Paid:</span>
                    <span>₹{activeInvoiceForView.paidAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-rose-700 text-sm border-t border-slate-900 pt-1">
                    <span>Balance Due:</span>
                    <span>₹{activeInvoiceForView.balanceAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>

              </div>

              {/* Digital Seal & Advocate Signature */}
              <div className="pt-6 border-t border-slate-200 flex justify-between items-end">
                <div className="flex items-center gap-2 text-slate-400 font-mono text-[9px]">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Digitally Verified Advocate360 Chamber Ledger Record</span>
                </div>
                <div className="text-center font-serif text-xs">
                  <div className="border-b border-[#1A1A1A] w-40 mb-1" />
                  <p className="font-bold italic">Authorized Signatory</p>
                  <p className="text-[10px] text-slate-500">Bar Council Chamber Seal</p>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* MODAL 4: RECORD PAYMENT */}
      {isPaymentModalOpen && activeInvoiceForPayment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#1A1A1A] max-w-md w-full p-6 space-y-5 shadow-2xl font-sans">
            
            <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-3">
              <div>
                <h2 className="font-serif italic font-bold text-xl text-[#1A1A1A]">
                  Record Payment Receipt
                </h2>
                <p className="text-xs text-slate-600 font-mono">
                  Invoice #{activeInvoiceForPayment.invoiceNumber}
                </p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-500 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            {billingError && (
              <div role="alert" className="p-2.5 bg-[#FFF4F2] border border-[#FF4444] text-xs font-mono font-bold text-[#FF4444]">
                ⚠️ {billingError}
              </div>
            )}

            <div className="space-y-4 text-xs font-mono">
              <div className="bg-[#F5F2EF] p-3 border border-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span>Client:</span>
                  <span className="font-serif italic font-bold">{activeInvoiceForPayment.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Invoice Amount:</span>
                  <span>₹{activeInvoiceForPayment.totalAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-rose-700">
                  <span>Current Balance Due:</span>
                  <span>₹{activeInvoiceForPayment.balanceAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Amount (₹)</label>
                <input
                  type="number"
                  max={activeInvoiceForPayment.balanceAmount}
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: Number(e.target.value) })}
                  className="w-full bg-[#F5F2EF] border border-[#1A1A1A] p-2 focus:outline-none font-bold text-sm text-emerald-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paymentData.paymentDate}
                    onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                    className="w-full bg-[#F5F2EF] border border-[#1A1A1A] p-2 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentData.paymentMethod}
                    onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value as any })}
                    className="w-full bg-[#F5F2EF] border border-[#1A1A1A] p-2 focus:outline-none"
                  >
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="Cheque">Demand Draft / Cheque</option>
                    <option value="Cash">Cash Receipt</option>
                    <option value="Card">Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reference / UTR / Cheque No.</label>
                <input
                  type="text"
                  placeholder="e.g. UPI/391029402910"
                  value={paymentData.referenceNo}
                  onChange={(e) => setPaymentData({ ...paymentData, referenceNo: e.target.value })}
                  className="w-full bg-[#F5F2EF] border border-[#1A1A1A] p-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  className="w-full bg-[#F5F2EF] border border-[#1A1A1A] p-2 focus:outline-none font-sans"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 border border-slate-400 font-mono text-xs font-bold uppercase hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPayment}
                className="px-5 py-2 bg-emerald-600 text-white font-mono text-xs font-bold uppercase hover:bg-emerald-500 shadow-md"
              >
                Confirm Payment Receipt
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 5: RATE CARD CONFIGURATOR */}
      {isRatesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#1A1A1A] max-w-md w-full p-6 space-y-5 shadow-2xl font-sans">
            
            <div className="flex items-center justify-between border-b-2 border-[#1A1A1A] pb-3">
              <div>
                <h2 className="font-serif italic font-bold text-xl text-[#1A1A1A]">
                  Chamber Rate Card Card
                </h2>
                <p className="text-xs text-slate-600 font-mono">
                  Default hourly rates by advocate tier
                </p>
              </div>
              <button onClick={() => setIsRatesModalOpen(false)} className="text-slate-500 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {Object.keys(chamberRates).map((role) => (
                <div key={role} className="flex items-center justify-between p-2.5 bg-[#F5F2EF] border border-slate-300">
                  <span className="font-bold text-[#1A1A1A]">{role}</span>
                  <div className="flex items-center gap-1">
                    <span>₹</span>
                    <input
                      type="number"
                      step="100"
                      value={chamberRates[role]}
                      onChange={(e) => setChamberRates({ ...chamberRates, [role]: Number(e.target.value) })}
                      className="w-24 bg-white border border-slate-300 p-1 text-right font-bold focus:outline-none"
                    />
                    <span>/hr</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                onClick={() => setIsRatesModalOpen(false)}
                className="px-5 py-2 bg-[#1A1A1A] text-amber-400 font-mono text-xs font-bold uppercase hover:bg-slate-800"
              >
                Save Rate Card
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
