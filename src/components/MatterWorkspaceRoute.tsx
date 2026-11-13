import React from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { Briefcase, ArrowLeft } from 'lucide-react';
import {
  CaseFile,
  ChamberProfile,
  ChamberRole,
  CalendarEvent,
  PracticeTask,
  FeeRecord,
  NotificationItem,
} from '../types';
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
import { BillingModule } from './BillingModule';

interface MatterWorkspaceRouteProps {
  cases: CaseFile[];
  chamber?: ChamberProfile | null;
  currentRole?: ChamberRole;
  calendarEvents: CalendarEvent[];
  tasks: PracticeTask[];
  feeRecords: FeeRecord[];
  notifications: NotificationItem[];
  userEmail?: string;
  isDemoMode?: boolean;
  onOpenDigitalSignature?: () => void;
  onOpenScheduleHearing?: (matterId: string) => void;
  onToggleTask?: (taskId: string) => Promise<void> | void;
  onCreateTask?: (task: Omit<PracticeTask, 'id'> & { id?: string }) => Promise<PracticeTask | void> | void;
  onUpdateTasks?: (tasks: PracticeTask[]) => Promise<void> | void;
  onUpdateCases?: (cases: CaseFile[]) => Promise<void> | void;
  onUpdateMatter?: (updatedMatter: CaseFile) => Promise<void>;
}

export const MatterWorkspaceRoute: React.FC<MatterWorkspaceRouteProps> = ({
  cases,
  chamber,
  currentRole = 'CHAMBER_OWNER',
  calendarEvents,
  tasks,
  feeRecords,
  notifications,
  userEmail = '',
  isDemoMode = false,
  onOpenDigitalSignature,
  onOpenScheduleHearing,
  onToggleTask,
  onCreateTask,
  onUpdateTasks,
  onUpdateCases,
  onUpdateMatter,
}) => {
  const { matterId } = useParams<{ matterId: string }>();
  const navigate = useNavigate();

  const matter = cases.find((c) => c.id === matterId);

  if (!matter) {
    return (
      <div className="p-8 bg-white border border-[#E2DFD7] rounded-2xl max-w-xl mx-auto my-8 space-y-4 text-center text-[#0B1426] shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-[#0B1426]/5 text-[#C49A36] mx-auto flex items-center justify-center">
          <Briefcase className="w-6 h-6" />
        </div>
        <h2 className="font-bold text-xl text-[#0B1426]">Matter not found or access restricted</h2>
        <p className="text-xs text-[#64748B] max-w-md mx-auto">
          The requested matter ({matterId}) does not exist in this workspace or you do not have permission to view it.
        </p>
        <button
          type="button"
          onClick={() => navigate('/app/matters')}
          className="px-4 py-2 bg-[#0B1426] hover:bg-[#16233D] text-white font-semibold text-xs rounded-lg inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#C49A36]" />
          <span>Return to matters</span>
        </button>
      </div>
    );
  }

  const matterCalendar = calendarEvents.filter((e) => e.caseId === matter.id);
  const matterTasks = tasks.filter((t) => t.caseId === matter.id);

  return (
    <div className="space-y-6">
      {/* Matter Top Header & Sub-Tabs */}
      <MatterWorkspaceHeader
        matter={matter}
        chamber={chamber}
        currentRole={currentRole}
        onOpenDigitalSignature={onOpenDigitalSignature}
        onOpenScheduleHearing={onOpenScheduleHearing}
      />

      {/* Matter Section Router */}
      <div className="space-y-6">
        <Routes>
          <Route
            path="overview"
            element={
              <MatterOverview
                matter={matter}
                hearings={matterCalendar}
                tasks={matterTasks}
                onOpenScheduleHearing={
                  onOpenScheduleHearing ? () => onOpenScheduleHearing(matter.id) : undefined
                }
                onUpdateMatter={onUpdateMatter}
              />
            }
          />
          <Route
            path="documents"
            element={
              <DocumentRepository
                selectedCase={matter}
                chamberId={chamber?.id}
                onOpenDigitalSignature={onOpenDigitalSignature}
              />
            }
          />
          <Route
            path="billing"
            element={
              <BillingModule
                cases={[matter]}
                chamber={chamber || null}
                selectedCaseId={matter.id}
                setSelectedCaseId={() => {}}
                onNavigateTab={(tab) => navigate(`/app/${tab}`)}
                currentRole={currentRole}
                scopedMatterId={matter.id}
              />
            }
          />
          <Route
            path="analysis"
            element={
              <div className="space-y-6">
                <DocumentAnalyzer selectedCase={matter} chamberId={chamber?.id} />
                <EvidenceIntelligence selectedCase={matter} chamberId={chamber?.id} />
                <TimelineAndContradictions selectedCase={matter} chamberId={chamber?.id} />
              </div>
            }
          />
          <Route
            path="research-drafts"
            element={
              <div className="space-y-6">
                <LegalResearch selectedCase={matter} chamberId={chamber?.id} />
                <DraftingAssistant selectedCase={matter} chamberId={chamber?.id} />
              </div>
            }
          />
          <Route
            path="work"
            element={
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
                onOpenScheduleHearing={
                  onOpenScheduleHearing ? () => onOpenScheduleHearing(matter.id) : undefined
                }
                onToggleTask={onToggleTask || (() => {})}
                onCreateTask={onCreateTask}
                onMarkNotificationAsRead={() => {}}
                onMarkAllNotificationsAsRead={() => {}}
                onUpdateCases={onUpdateCases || (() => {})}
                onUpdateTasks={onUpdateTasks || (() => {})}
                initialTaskViewMode="list"
                viewMode="work"
                isDemoMode={isDemoMode}
              />
            }
          />
          <Route
            path="activity"
            element={<AuditLogViewer chamberId={chamber?.id} userEmail={userEmail} />}
          />
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Routes>
      </div>
    </div>
  );
};
