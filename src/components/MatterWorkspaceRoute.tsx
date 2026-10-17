import React from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { Briefcase, Folder, FileText, CheckSquare, BookOpen, CalendarCheck, Clock, ArrowLeft } from 'lucide-react';
import { CaseFile, ChamberProfile, CalendarEvent, PracticeTask, FeeRecord, NotificationItem } from '../types';
import { MatterWorkspaceHeader } from './MatterWorkspaceHeader';
import { MatterOverview } from './MatterOverview';
import { DocumentRepository } from './DocumentRepository';
import { DocumentAnalyzer } from './DocumentAnalyzer';
import { EvidenceIntelligence } from './EvidenceIntelligence';
import { LegalResearch } from './LegalResearch';
import { DraftingAssistant } from './DraftingAssistant';
import { TimelineAndContradictions } from './TimelineAndContradictions';
import { PracticeDashboard } from './PracticeDashboard';
import { AuditLogViewer } from './AuditLogViewer';

interface MatterWorkspaceRouteProps {
  cases: CaseFile[];
  chamber?: ChamberProfile | null;
  calendarEvents: CalendarEvent[];
  tasks: PracticeTask[];
  feeRecords: FeeRecord[];
  notifications: NotificationItem[];
  userEmail?: string;
  onOpenDigitalSignature?: () => void;
  onToggleTask?: (taskId: string) => Promise<void> | void;
  onCreateTask?: (task: Omit<PracticeTask, 'id'> & { id?: string }) => Promise<PracticeTask | void> | void;
  onUpdateTasks?: (tasks: PracticeTask[]) => Promise<void> | void;
  onUpdateCases?: (cases: CaseFile[]) => Promise<void> | void;
  onUpdateMatter?: (updatedMatter: CaseFile) => Promise<void>;
}

export const MatterWorkspaceRoute: React.FC<MatterWorkspaceRouteProps> = ({
  cases,
  chamber,
  calendarEvents,
  tasks,
  feeRecords,
  notifications,
  userEmail = '',
  onOpenDigitalSignature,
  onToggleTask,
  onCreateTask,
  onUpdateTasks,
  onUpdateCases,
  onUpdateMatter
}) => {
  const { matterId } = useParams<{ matterId: string }>();
  const navigate = useNavigate();

  const matter = cases.find(c => c.id === matterId);

  if (!matter) {
    return (
      <div className="p-8 bg-[#FDFCFB] border-2 border-[#1A1A1A] max-w-2xl mx-auto my-8 space-y-4 text-center text-[#1A1A1A] shadow-md">
        <Briefcase className="w-10 h-10 text-[#B45309] mx-auto" />
        <h2 className="font-serif italic font-extrabold text-2xl">Matter Not Found or Access Restricted</h2>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          The requested matter (ID: {matterId}) does not exist in this chamber or has been archived.
        </p>
        <button
          onClick={() => navigate('/app/matters')}
          className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold uppercase text-xs tracking-wider inline-flex items-center gap-2 border border-[#1A1A1A]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Matters List</span>
        </button>
      </div>
    );
  }

  const matterCalendar = calendarEvents.filter(e => e.caseId === matter.id);
  const matterTasks = tasks.filter(t => t.caseId === matter.id);

  return (
    <div className="space-y-6">
      {/* Matter Top Header */}
      <MatterWorkspaceHeader
        matter={matter}
        chamber={chamber}
        onOpenDigitalSignature={onOpenDigitalSignature}
      />

      {/* Matter Section Router */}
      <main className="max-w-[1700px] mx-auto px-4 sm:px-6 py-2">
        <Routes>
          <Route path="overview" element={<MatterOverview matter={matter} onUpdateMatter={onUpdateMatter} />} />
          <Route path="documents" element={
            <DocumentRepository
              selectedCase={matter}
              chamberId={chamber?.id}
              onOpenDigitalSignature={onOpenDigitalSignature}
            />
          } />
          <Route path="analysis" element={
            <div className="space-y-6">
              <DocumentAnalyzer selectedCase={matter} chamberId={chamber?.id} />
              <EvidenceIntelligence selectedCase={matter} chamberId={chamber?.id} />
              <TimelineAndContradictions selectedCase={matter} chamberId={chamber?.id} />
            </div>
          } />
          <Route path="research-drafts" element={
            <div className="space-y-6">
              <LegalResearch selectedCase={matter} chamberId={chamber?.id} />
              <DraftingAssistant selectedCase={matter} chamberId={chamber?.id} />
            </div>
          } />
          <Route path="work" element={
            <PracticeDashboard
              cases={[matter]}
              chamberId={chamber?.id}
              selectedCaseId={matter.id}
              setSelectedCaseId={() => {}}
              calendarEvents={matterCalendar}
              tasks={matterTasks}
              feeRecords={feeRecords}
              notifications={notifications}
              onNavigateTab={(tab) => navigate(`/app/matters/${matter.id}/${tab}`)}
              onOpenNewCaseModal={() => {}}
              onToggleTask={onToggleTask || (() => {})}
              onCreateTask={onCreateTask}
              onMarkNotificationAsRead={() => {}}
              onMarkAllNotificationsAsRead={() => {}}
              onUpdateCases={onUpdateCases || (() => {})}
              onUpdateTasks={onUpdateTasks || (() => {})}
              initialTaskViewMode="list"
            />
          } />
          <Route path="activity" element={
            <AuditLogViewer chamberId={chamber?.id} userEmail={userEmail} />
          } />
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Routes>
      </main>
    </div>
  );
};
