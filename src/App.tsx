import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  supabase,
  signInWithGoogle,
  signOut as supabaseSignOut,
  isSupabaseConfigured,
} from './lib/supabase';
import {
  createWorkspaceWithOwner,
  fetchUserWorkspaceMembership,
  listMattersForWorkspace,
  createMatterInDb,
  updateMatterInDb,
  listTasksForWorkspace,
  createTaskInDb,
  updateTaskInDb,
} from './lib/useMatterData';

// Core UI Components
import { Header, HeaderUser } from './components/Header';
import { SidebarNav } from './components/SidebarNav';
import { LandingPage } from './components/LandingPage';
import { PracticeSetupModal } from './components/PracticeSetupModal';
import { PracticeDashboard } from './components/PracticeDashboard';
import { ClientPortal } from './components/ClientPortal';
import { DocumentRepository } from './components/DocumentRepository';
import { BillingModule } from './components/BillingModule';
import { ExecutiveAnalytics } from './components/ExecutiveAnalytics';
import { LegalIntelligenceWorkspace } from './components/LegalIntelligenceWorkspace';
import { SettingsView } from './components/SettingsView';
import { MatterWorkspaceRoute } from './components/MatterWorkspaceRoute';
import { AskAdvocateAssistant } from './components/AskAdvocateAssistant';

// Modals & Utility Drawers
import { NewCaseModal } from './components/NewCaseModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { NotificationCenter } from './components/NotificationCenter';
import { RoleManagerModal } from './components/RoleManagerModal';
import { DigitalSignatureDrawer } from './components/DigitalSignatureDrawer';
import { MultilingualModal } from './components/MultilingualModal';
import { QuickNotesDrawer } from './components/QuickNotesDrawer';

// Types & Data
import {
  CaseFile,
  IntakeData,
  ChamberProfile,
  UserProfile,
  CalendarEvent,
  PracticeTask,
  FeeRecord,
  ChamberRole,
  NotificationItem,
} from './types';
import {
  INITIAL_CASES,
  SAMPLE_CALENDAR,
  SAMPLE_TASKS,
  SAMPLE_FEES,
  SAMPLE_NOTIFICATIONS,
} from './data/landingDemoData';
import { logAuditEvent } from './lib/auditLogger';
import { hasPermission } from './lib/permissions';
import { Scale, AlertTriangle } from 'lucide-react';

function mapSupabaseUser(sbUser: any): HeaderUser {
  const fullName =
    sbUser.user_metadata?.full_name ||
    sbUser.user_metadata?.name ||
    sbUser.email?.split('@')[0] ||
    'Advocate';
  const avatarUrl =
    sbUser.user_metadata?.avatar_url || sbUser.user_metadata?.picture || undefined;

  return {
    id: sbUser.id,
    uid: sbUser.id,
    email: sbUser.email || '',
    displayName: fullName,
    photoURL: avatarUrl,
    user_metadata: sbUser.user_metadata,
  };
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<HeaderUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [chamber, setChamber] = useState<ChamberProfile | null>(null);
  const [officialRole, setOfficialRole] = useState<ChamberRole>('CHAMBER_OWNER');
  const [simulatedRole, setSimulatedRole] = useState<ChamberRole | null>(null);
  const currentRole = simulatedRole || officialRole;
  const [isSettingUpPractice, setIsSettingUpPractice] = useState<boolean>(false);
  const [isSubmittingSetup, setIsSubmittingSetup] = useState<boolean>(false);
  const [matterPersistenceError, setMatterPersistenceError] = useState<string | null>(null);

  // Isolated Demo Sandbox Mode State
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // Active Live Chamber Workspace State (Starts empty for real authenticated chambers)
  const [cases, setCases] = useState<CaseFile[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<PracticeTask[]>([]);
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('adv360_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Modals & Drawers
  const [isAskAssistantOpen, setIsAskAssistantOpen] = useState<boolean>(false);
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isRoleManagerOpen, setIsRoleManagerOpen] = useState<boolean>(false);
  const [isDigitalSigOpen, setIsDigitalSigOpen] = useState<boolean>(false);
  const [isMultilingualOpen, setIsMultilingualOpen] = useState<boolean>(false);

  const clearWorkspaceState = useCallback(() => {
    setUser(null);
    setUserProfile(null);
    setChamber(null);
    setCases([]);
    setCalendarEvents([]);
    setTasks([]);
    setFeeRecords([]);
    setNotifications([]);
    setSelectedCaseId('');
    setIsSettingUpPractice(false);
  }, []);

  const hydrateUserWorkspace = useCallback(async (sbUser: any) => {
    const mappedUser = mapSupabaseUser(sbUser);
    setUser(mappedUser);
    try {
      const { chamber: activeChamber, role, profile } = await fetchUserWorkspaceMembership(
        sbUser.id,
        sbUser.email || ''
      );

      if (activeChamber) {
        setChamber(activeChamber);
        setOfficialRole(role);
        setUserProfile(profile);
        setIsSettingUpPractice(false);

        const [loadedMatters, loadedTasks] = await Promise.all([
          listMattersForWorkspace(activeChamber.id),
          listTasksForWorkspace(activeChamber.id).catch(() => [] as PracticeTask[]),
        ]);
        setCases(loadedMatters);
        setTasks(loadedTasks);
        if (loadedMatters.length === 0) {
          setSelectedCaseId('');
        } else {
          setSelectedCaseId((prev) =>
            prev && loadedMatters.some((c) => c.id === prev) ? prev : loadedMatters[0].id
          );
        }
      } else {
        setChamber(null);
        setCases([]);
        setSelectedCaseId('');
        setIsSettingUpPractice(true);
      }
    } catch (err: any) {
      console.error('Error hydrating Supabase workspace profile:', err);
      setAuthError(err?.message || 'Failed to load workspace membership.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // 1. Supabase Session Initialization, OAuth Callback Handling & Auth-State Subscription
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // Handle OAuth PKCE code callback on /auth/callback
        if (window.location.pathname === '/auth/callback') {
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');
          const errorDesc = params.get('error_description') || params.get('error');
          if (errorDesc) {
            if (isMounted) {
              setAuthError(`Google OAuth callback error: ${errorDesc}`);
              setAuthLoading(false);
            }
            return;
          }
          if (code) {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              if (isMounted) {
                setAuthError(`Failed to exchange OAuth code: ${error.message}`);
                setAuthLoading(false);
              }
              return;
            }
            if (data.session?.user && isMounted) {
              await hydrateUserWorkspace(data.session.user);
              navigate('/app/today', { replace: true });
              return;
            }
          }
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.warn('Supabase session initialization warning:', error.message);
        }

        if (!isMounted) return;

        if (session?.user) {
          await hydrateUserWorkspace(session.user);
          if (window.location.pathname === '/auth/callback') {
            navigate('/app/today', { replace: true });
          }
        } else {
          clearWorkspaceState();
          setAuthLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Auth initialization error:', err);
          clearWorkspaceState();
          setAuthLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || !session?.user) {
        clearWorkspaceState();
        setAuthLoading(false);
      } else if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'INITIAL_SESSION'
      ) {
        await hydrateUserWorkspace(session.user);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [clearWorkspaceState, hydrateUserWorkspace, navigate]);

  // 2. Refresh matters and tasks from PostgreSQL when chamber changes and not in demo mode
  useEffect(() => {
    if (!user || !chamber || isDemoMode) return;
    let active = true;

    Promise.all([
      listMattersForWorkspace(chamber.id),
      listTasksForWorkspace(chamber.id).catch(() => [] as PracticeTask[]),
    ])
      .then(([loadedMatters, loadedTasks]) => {
        if (!active) return;
        setCases(loadedMatters);
        setTasks(loadedTasks);
        if (loadedMatters.length === 0) {
          setSelectedCaseId('');
        } else if (!selectedCaseId || !loadedMatters.some((c) => c.id === selectedCaseId)) {
          setSelectedCaseId(loadedMatters[0].id);
        }
      })
      .catch((err) => {
        console.error('PostgreSQL matters/tasks sync error:', err);
      });

    return () => {
      active = false;
    };
  }, [user?.id, chamber?.id, isDemoMode]);

  const handleCreateTask = useCallback(
    async (newTaskInput: Omit<PracticeTask, 'id'> & { id?: string }) => {
      if (isDemoMode || !chamber?.id) {
        const localTask: PracticeTask = {
          ...newTaskInput,
          id: newTaskInput.id || `task-${Date.now()}`,
        };
        setTasks((prev) => [localTask, ...prev]);
        return localTask;
      }

      setMatterPersistenceError(null);
      try {
        const savedTask = await createTaskInDb(chamber.id, {
          ...newTaskInput,
          caseId: newTaskInput.caseId || selectedCaseId || cases[0]?.id || '',
        });
        setTasks((prev) => [savedTask, ...prev]);
        logAuditEvent('CASE_UPDATE', `Created task in PostgreSQL: ${savedTask.title}`);
        return savedTask;
      } catch (err: any) {
        console.error('PostgreSQL create task error:', err);
        setMatterPersistenceError(
          err?.message || 'Failed to create task in PostgreSQL. Unsaved task input preserved.'
        );
        throw err;
      }
    },
    [cases, chamber?.id, isDemoMode, selectedCaseId]
  );

  const handleToggleTask = useCallback(
    async (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;

      const previousTasks = [...tasks];
      const nextStatus: PracticeTask['status'] =
        target.status === 'Completed' ? 'Pending' : 'Completed';

      setMatterPersistenceError(null);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
      );

      if (isDemoMode || !chamber?.id) return;

      try {
        const saved = await updateTaskInDb(chamber.id, taskId, { status: nextStatus });
        setTasks((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      } catch (err: any) {
        console.error('PostgreSQL toggle task error:', err);
        setTasks(previousTasks);
        setMatterPersistenceError(
          err?.message ||
            'Failed to update task status in PostgreSQL. Optimistic task state was rolled back.'
        );
        throw err;
      }
    },
    [chamber?.id, isDemoMode, tasks]
  );

  const handleUpdateTasks = useCallback(
    async (updatedTasks: PracticeTask[]) => {
      const previousTasks = [...tasks];
      setMatterPersistenceError(null);
      setTasks(updatedTasks);

      if (isDemoMode || !chamber?.id) return;

      for (const updated of updatedTasks) {
        const existing = previousTasks.find((t) => t.id === updated.id);
        if (!existing) {
          try {
            const saved = await createTaskInDb(chamber.id, updated);
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? saved : t)));
          } catch (err: any) {
            setTasks(previousTasks);
            setMatterPersistenceError(
              err?.message || 'Failed to save new task to PostgreSQL. Optimistic state rolled back.'
            );
            throw err;
          }
        } else if (JSON.stringify(existing) !== JSON.stringify(updated)) {
          try {
            const saved = await updateTaskInDb(chamber.id, updated.id, updated);
            setTasks((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
          } catch (err: any) {
            setTasks(previousTasks);
            setMatterPersistenceError(
              err?.message || 'Failed to update task in PostgreSQL. Optimistic state rolled back.'
            );
            throw err;
          }
        }
      }
    },
    [chamber?.id, isDemoMode, tasks]
  );

  const handleMarkNotificationAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  // Toggle Isolated Demo Sandbox Mode
  const handleToggleDemoMode = (enabled: boolean) => {
    setIsDemoMode(enabled);
    if (enabled) {
      setCases(INITIAL_CASES);
      setSelectedCaseId('case-101');
      setCalendarEvents(SAMPLE_CALENDAR);
      setTasks(SAMPLE_TASKS);
      setFeeRecords(SAMPLE_FEES);
      setNotifications(SAMPLE_NOTIFICATIONS);
    } else {
      setCases([]);
      setSelectedCaseId('');
      setCalendarEvents([]);
      setTasks([]);
      setFeeRecords([]);
      setNotifications([]);
      if (chamber?.id) {
        Promise.all([
          listMattersForWorkspace(chamber.id),
          listTasksForWorkspace(chamber.id).catch(() => [] as PracticeTask[]),
        ])
          .then(([loadedMatters, loadedTasks]) => {
            setCases(loadedMatters);
            setTasks(loadedTasks);
            setSelectedCaseId(loadedMatters[0]?.id || '');
          })
          .catch(() => {});
      }
    }
  };

  // Auth Action Handlers (Supabase Google OAuth)
  const handleGoogleSignIn = async () => {
    setAuthError(null);
    if (!isSupabaseConfigured) {
      setAuthError(
        'Supabase Auth is not configured in this environment. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable live Google Sign-In.'
      );
      return;
    }

    setAuthLoading(true);
    try {
      await signInWithGoogle();
      logAuditEvent('ROLE_CHANGE', 'User initiated Google OAuth via Supabase Auth');
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setAuthError(err?.message || 'Google Sign-In failed.');
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      logAuditEvent('ROLE_CHANGE', 'User logged out from Chamber Workspace');
      await supabaseSignOut();
      clearWorkspaceState();
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Practice Setup Handler -> Atomic Supabase RPC `create_workspace_with_owner`
  const handlePracticeSetup = async (setupData: {
    advocateName: string;
    chamberName: string;
    enrollmentNo: string;
    stateBarCouncil: string;
    officeLocation: string;
    phone: string;
    practiceAreas: string[];
  }) => {
    if (!user?.id) return;
    setIsSubmittingSetup(true);
    setAuthError(null);

    try {
      const { chamber: createdChamber, role } = await createWorkspaceWithOwner(
        {
          ...setupData,
          email: user.email || '',
        },
        user.id
      );

      const newProfile: UserProfile = {
        uid: user.id,
        displayName: setupData.advocateName,
        email: user.email || '',
        photoURL: user.photoURL || undefined,
        chamberId: createdChamber.id,
        role,
        createdAt: createdChamber.createdAt,
      };

      setChamber(createdChamber);
      setOfficialRole(role);
      setUserProfile(newProfile);
      setCases([]);
      setSelectedCaseId('');
      setIsSettingUpPractice(false);
      logAuditEvent('CASE_CREATE', `Created Chamber Workspace: ${setupData.chamberName}`);
      navigate('/app/today');
    } catch (err: any) {
      console.error('Practice setup failed:', err);
      setAuthError(err?.message || 'Failed to create workspace.');
      throw err;
    } finally {
      setIsSubmittingSetup(false);
    }
  };

  // Add Matter Action -> PostgreSQL `public.matters` with visible error handling & optimistic rollback
  const handleAddNewCase = async (newCase: CaseFile) => {
    if (isDemoMode) {
      return;
    }

    if (!chamber) {
      const err = new Error('Cannot save matter: No active chamber workspace.');
      setMatterPersistenceError(err.message);
      throw err;
    }

    if (!hasPermission(currentRole, 'CREATE_CASE')) {
      const err = new Error('Permission denied: Your role cannot create new matters.');
      setMatterPersistenceError(err.message);
      throw err;
    }

    const previousCases = [...cases];
    const previousSelectedId = selectedCaseId;
    setMatterPersistenceError(null);

    try {
      const savedMatter = await createMatterInDb(chamber.id, {
        ...newCase,
        chamberId: chamber.id,
      });

      setCases((prev) => [savedMatter, ...prev]);
      setSelectedCaseId(savedMatter.id);
      logAuditEvent('CASE_CREATE', `Opened new case file: ${savedMatter.title}`);
      navigate(`/app/matters/${savedMatter.id}/overview`);
    } catch (err: any) {
      console.error('PostgreSQL save matter error:', err);
      // Roll back any optimistic state and surface visible error while preserving modal input
      setCases(previousCases);
      setSelectedCaseId(previousSelectedId);
      setMatterPersistenceError(
        err?.message || 'Failed to save matter to PostgreSQL. Unsaved input has been preserved.'
      );
      throw err;
    }
  };

  // Persist Single Matter Update -> PostgreSQL `public.matters` with optimistic rollback on failure
  const handleUpdateSingleMatter = useCallback(
    async (updatedMatter: CaseFile) => {
      const previousCases = [...cases];
      setMatterPersistenceError(null);
      setCases((prev) => prev.map((c) => (c.id === updatedMatter.id ? updatedMatter : c)));

      if (isDemoMode || !chamber?.id) return;

      try {
        const savedMatter = await updateMatterInDb(chamber.id, updatedMatter.id, updatedMatter);
        setCases((prev) => prev.map((c) => (c.id === savedMatter.id ? savedMatter : c)));
      } catch (err: any) {
        console.error('PostgreSQL update matter error:', err);
        setCases(previousCases);
        setMatterPersistenceError(
          err?.message ||
            'Failed to update matter in PostgreSQL. Optimistic changes were rolled back and unsaved input preserved.'
        );
        throw err;
      }
    },
    [cases, chamber?.id, isDemoMode]
  );

  // Persist Matter Updates -> PostgreSQL `public.matters` with optimistic rollback on failure
  const handleUpdateCases = useCallback(
    async (updatedCases: CaseFile[]) => {
      const previousCases = [...cases];
      setMatterPersistenceError(null);
      setCases(updatedCases);
      if (isDemoMode || !chamber?.id) return;

      for (const updated of updatedCases) {
        const existing = previousCases.find((c) => c.id === updated.id);
        if (existing && JSON.stringify(existing) !== JSON.stringify(updated)) {
          try {
            const saved = await updateMatterInDb(chamber.id, updated.id, updated);
            setCases((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
          } catch (err: any) {
            console.error('PostgreSQL update matter error:', err);
            setCases(previousCases);
            setMatterPersistenceError(
              err?.message ||
                'Failed to save matter updates to PostgreSQL. Optimistic state was rolled back.'
            );
            throw err;
          }
        }
      }
    },
    [cases, chamber?.id, isDemoMode]
  );

  const handleAddCaseFromIntake = (intake: IntakeData) => {
    const hearingDateObj = intake.importantDates?.find(
      (d) =>
        d.label.toLowerCase().includes('hearing') || d.label.toLowerCase().includes('court')
    );

    const newCase: CaseFile = {
      id: `case-${Date.now()}`,
      title: `${intake.parties.client} vs ${intake.parties.oppositeParty || 'Opposite Party'}`,
      caseType: (intake.caseType as any) || 'Property Dispute',
      status: 'Intake',
      clientName: intake.parties.client,
      oppositeParty: intake.parties.oppositeParty,
      courtName: 'Court Not Specified',
      summary: intake.suggestedAction || 'Extracted via AI Client Intake.',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    if (hearingDateObj?.date) {
      newCase.nextHearingDate = hearingDateObj.date;
    }

    handleAddNewCase(newCase);
  };

  const selectedCase = cases.find((c) => c.id === selectedCaseId) || null;

  // 1. Splash Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center justify-center p-4 font-sans text-[#1A1A1A]">
        <div className="p-8 bg-[#F5F2EF] border-2 border-[#1A1A1A] max-w-md w-full text-center space-y-4 shadow-md">
          <div className="w-12 h-12 bg-[#1A1A1A] text-amber-400 mx-auto flex items-center justify-center font-serif text-xl font-bold border border-[#1A1A1A]">
            <Scale className="w-6 h-6 text-amber-400 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="font-serif italic font-bold text-xl text-[#1A1A1A]">Advocate360 AI</h2>
            <p className="text-xs text-[#555555]">
              Initializing Supabase Session & Workspace Security...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated User -> Public Landing Page & OAuth Callback Route (Protected Routes Redirect to /)
  if (!user) {
    return (
      <div>
        {authError && (
          <div className="bg-amber-900 text-amber-100 text-xs px-4 py-2.5 border-b-2 border-amber-500 flex items-center justify-between">
            <span>{authError}</span>
            <button
              onClick={() => setAuthError(null)}
              className="px-2 py-0.5 bg-black text-amber-400 font-mono text-[10px] uppercase"
            >
              Dismiss
            </button>
          </div>
        )}
        <Routes>
          <Route
            path="/"
            element={
              <LandingPage onGoogleSignIn={handleGoogleSignIn} isLoadingAuth={authLoading} />
            }
          />
          <Route
            path="/auth/callback"
            element={
              <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center justify-center p-4">
                <div className="p-8 bg-[#F5F2EF] border-2 border-[#1A1A1A] max-w-md w-full text-center space-y-4">
                  <AlertTriangle className="w-8 h-8 text-[#B45309] mx-auto" />
                  <h2 className="font-serif italic font-bold text-lg">
                    {authError ? 'Authentication Callback Failed' : 'Completing Google Sign-In...'}
                  </h2>
                  <p className="text-xs text-[#555555]">
                    {authError || 'Verifying OAuth session with Supabase Auth...'}
                  </p>
                  <button
                    onClick={() => navigate('/', { replace: true })}
                    className="px-4 py-2 bg-[#1A1A1A] text-amber-400 text-xs font-bold uppercase"
                  >
                    Return to Sign In
                  </button>
                </div>
              </div>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    );
  }

  // 3. Authenticated User Without Chamber -> Practice Setup (calls create_workspace_with_owner)
  if (isSettingUpPractice) {
    return (
      <div className="min-h-screen bg-[#FDFCFB]">
        <PracticeSetupModal
          userEmail={user.email || ''}
          userDisplayName={user.displayName || ''}
          onSubmitSetup={handlePracticeSetup}
          isSubmitting={isSubmittingSetup}
        />
      </div>
    );
  }

  // 4. Authenticated Advocate Workspace with Protected URL Router
  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] flex flex-col font-sans selection:bg-[#B45309] selection:text-white">
      {/* Top Bar Navigation */}
      <Header
        user={user}
        chamber={chamber}
        currentRole={currentRole}
        cases={cases}
        selectedCaseId={selectedCaseId}
        onOpenNewCaseModal={() => setIsNewCaseModalOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onLogout={handleLogout}
        onToggleAskAssistant={() => setIsAskAssistantOpen(!isAskAssistantOpen)}
        unreadNotificationsCount={notifications.filter((n) => !n.isRead).length}
        isDemoMode={isDemoMode}
        onToggleDemoMode={handleToggleDemoMode}
      />

      {/* Isolated Demo Sandbox Banner */}
      {isDemoMode && (
        <div className="bg-amber-900 text-amber-100 text-xs px-4 py-2 border-b-2 border-amber-500 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 font-mono">
            <span className="bg-amber-400 text-black font-bold px-2 py-0.5 text-[9px] uppercase tracking-wider">
              ISOLATED DEMO SANDBOX
            </span>
            <span>
              Sample data preview active. Live chamber writes and protected production APIs are
              disabled.
            </span>
          </div>
          <button
            onClick={() => handleToggleDemoMode(false)}
            className="bg-white text-black font-bold px-3 py-1 text-[10px] uppercase hover:bg-amber-100 transition-colors cursor-pointer"
          >
            Exit Demo Mode
          </button>
        </div>
      )}

      {/* Visible Matter Persistence Error Banner */}
      {matterPersistenceError && (
        <div
          role="alert"
          className="bg-rose-900 text-rose-100 text-xs px-4 py-2.5 border-b-2 border-rose-500 flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{matterPersistenceError}</span>
          </div>
          <button
            onClick={() => setMatterPersistenceError(null)}
            className="bg-black text-amber-400 font-mono font-bold px-2.5 py-0.5 text-[10px] uppercase cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        {/* Left Sidebar Main Navigation */}
        <SidebarNav
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={(val) => {
            setIsSidebarCollapsed(val);
            localStorage.setItem('adv360_sidebar_collapsed', String(val));
          }}
          currentRole={currentRole}
          isDemoMode={isDemoMode}
        />

        {/* Right Workspace View Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#FDFCFB]">
          <div className="flex-1 max-w-[1700px] w-full mx-auto p-4 sm:p-6">
            <Routes>
              {/* Main Navigation Sub-Routes */}
              <Route
                path="/app/today"
                element={
                  <PracticeDashboard
                    cases={cases}
                    chamberId={chamber?.id}
                    selectedCaseId={selectedCaseId}
                    setSelectedCaseId={setSelectedCaseId}
                    calendarEvents={calendarEvents}
                    tasks={tasks}
                    feeRecords={feeRecords}
                    notifications={notifications}
                    onNavigateTab={(tab) => navigate(`/app/${tab}`)}
                    onOpenNewCaseModal={() => setIsNewCaseModalOpen(true)}
                    onToggleTask={handleToggleTask}
                    onCreateTask={handleCreateTask}
                    onMarkNotificationAsRead={handleMarkNotificationAsRead}
                    onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
                    onUpdateCases={handleUpdateCases}
                    onUpdateTasks={handleUpdateTasks}
                    initialTaskViewMode="list"
                  />
                }
              />

              <Route
                path="/app/matters"
                element={
                  <PracticeDashboard
                    cases={cases}
                    chamberId={chamber?.id}
                    selectedCaseId={selectedCaseId}
                    setSelectedCaseId={setSelectedCaseId}
                    calendarEvents={calendarEvents}
                    tasks={tasks}
                    feeRecords={feeRecords}
                    notifications={notifications}
                    onNavigateTab={(tab) => navigate(`/app/${tab}`)}
                    onOpenNewCaseModal={() => setIsNewCaseModalOpen(true)}
                    onToggleTask={handleToggleTask}
                    onCreateTask={handleCreateTask}
                    onMarkNotificationAsRead={handleMarkNotificationAsRead}
                    onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
                    onUpdateCases={handleUpdateCases}
                    onUpdateTasks={handleUpdateTasks}
                    initialTaskViewMode="list"
                    onAddCaseFromIntake={handleAddCaseFromIntake}
                  />
                }
              />

              <Route
                path="/app/clients"
                element={
                  <ClientPortal
                    cases={cases}
                    selectedCaseId={selectedCaseId}
                    setSelectedCaseId={setSelectedCaseId}
                    chamber={chamber}
                  />
                }
              />

              <Route
                path="/app/work"
                element={
                  <PracticeDashboard
                    cases={cases}
                    chamberId={chamber?.id}
                    selectedCaseId={selectedCaseId}
                    setSelectedCaseId={setSelectedCaseId}
                    calendarEvents={calendarEvents}
                    tasks={tasks}
                    feeRecords={feeRecords}
                    notifications={notifications}
                    onNavigateTab={(tab) => navigate(`/app/${tab}`)}
                    onOpenNewCaseModal={() => setIsNewCaseModalOpen(true)}
                    onToggleTask={handleToggleTask}
                    onCreateTask={handleCreateTask}
                    onMarkNotificationAsRead={handleMarkNotificationAsRead}
                    onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
                    onUpdateCases={handleUpdateCases}
                    onUpdateTasks={handleUpdateTasks}
                    initialTaskViewMode="dag"
                  />
                }
              />

              <Route
                path="/app/documents"
                element={
                  <DocumentRepository
                    selectedCase={selectedCase as any}
                    chamberId={chamber?.id}
                    onOpenDigitalSignature={() => setIsDigitalSigOpen(true)}
                  />
                }
              />

              <Route
                path="/app/billing"
                element={
                  <BillingModule
                    cases={cases}
                    chamber={chamber}
                    selectedCaseId={selectedCaseId}
                    setSelectedCaseId={setSelectedCaseId}
                    onNavigateTab={(tab) => navigate(`/app/${tab}`)}
                    currentRole={currentRole}
                  />
                }
              />

              <Route
                path="/app/reports"
                element={
                  <div className="space-y-6">
                    <ExecutiveAnalytics cases={cases} feeRecords={feeRecords} />
                    <LegalIntelligenceWorkspace />
                  </div>
                }
              />

              {/* Settings Sub-Routes */}
              <Route
                path="/app/settings/*"
                element={
                  <SettingsView
                    chamber={chamber}
                    currentRole={currentRole}
                    userEmail={user.email || ''}
                    onOpenRoleManager={() => setIsRoleManagerOpen(true)}
                  />
                }
              />

              {/* Matter Workspace Sub-Routes */}
              <Route
                path="/app/matters/:matterId/*"
                element={
                  <MatterWorkspaceRoute
                    cases={cases}
                    chamber={chamber}
                    calendarEvents={calendarEvents}
                    tasks={tasks}
                    feeRecords={feeRecords}
                    notifications={notifications}
                    userEmail={user.email || ''}
                    onOpenDigitalSignature={() => setIsDigitalSigOpen(true)}
                    onToggleTask={handleToggleTask}
                    onCreateTask={handleCreateTask}
                    onUpdateTasks={handleUpdateTasks}
                    onUpdateCases={handleUpdateCases}
                    onUpdateMatter={handleUpdateSingleMatter}
                  />
                }
              />

              {/* Root & OAuth Callback Redirects */}
              <Route path="/" element={<Navigate to="/app/today" replace />} />
              <Route path="/auth/callback" element={<Navigate to="/app/today" replace />} />
              <Route path="/app" element={<Navigate to="/app/today" replace />} />
              <Route path="/dashboard" element={<Navigate to="/app/today" replace />} />
              <Route path="/workflow_dag" element={<Navigate to="/app/work" replace />} />
              <Route path="/intelligence" element={<Navigate to="/app/reports" replace />} />
              <Route path="/intake" element={<Navigate to="/app/matters" replace />} />
              <Route path="/analyzer" element={<Navigate to="/app/documents" replace />} />
              <Route path="/repository" element={<Navigate to="/app/documents" replace />} />
              <Route
                path="/evidence"
                element={
                  <Navigate
                    to={selectedCaseId ? `/app/matters/${selectedCaseId}/analysis` : '/app/matters'}
                    replace
                  />
                }
              />
              <Route
                path="/drafting"
                element={
                  <Navigate
                    to={
                      selectedCaseId
                        ? `/app/matters/${selectedCaseId}/research-drafts`
                        : '/app/matters'
                    }
                    replace
                  />
                }
              />
              <Route
                path="/hearing"
                element={
                  <Navigate
                    to={selectedCaseId ? `/app/matters/${selectedCaseId}/work` : '/app/work'}
                    replace
                  />
                }
              />
              <Route path="/audit" element={<Navigate to="/app/settings/audit" replace />} />
              <Route path="/ops" element={<Navigate to="/app/settings/diagnostics" replace />} />

              {/* 404 Route */}
              <Route
                path="*"
                element={
                  <div className="p-8 bg-[#FDFCFB] border-2 border-[#1A1A1A] max-w-md mx-auto my-12 text-center space-y-4">
                    <AlertTriangle className="w-10 h-10 text-[#B45309] mx-auto" />
                    <h2 className="font-serif italic font-bold text-xl">Page Not Found</h2>
                    <p className="text-xs text-slate-600">The requested route does not exist.</p>
                    <button
                      onClick={() => navigate('/app/today')}
                      className="px-4 py-2 bg-[#1A1A1A] text-amber-400 font-bold uppercase text-xs border border-[#1A1A1A]"
                    >
                      Return to Today Overview
                    </button>
                  </div>
                }
              />
            </Routes>
          </div>

          {/* Footer */}
          <footer className="bg-[#1A1A1A] border-t border-slate-800 py-4 text-center text-xs text-slate-400 mt-auto">
            <div className="max-w-[1700px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="font-serif italic text-white font-bold">Advocate360 AI LegalOS</span>
              <span className="text-[10px] uppercase font-mono">
                Confidential & Isolated Chamber Workspace
              </span>
              <span className="text-[10px]">© {new Date().getFullYear()} Advocate360</span>
            </div>
          </footer>
        </div>
      </div>

      {/* Floating Utilities */}
      <QuickNotesDrawer
        cases={cases}
        selectedCaseId={selectedCaseId}
        onAssignToCase={(caseId, content, noteTitle) => {
          const nextCases = cases.map((c) => {
            if (c.id === caseId) {
              const prevNotes = c.summary
                ? `${c.summary}\n\n[Quick Note: ${noteTitle}]\n${content}`
                : content;
              return { ...c, summary: prevNotes };
            }
            return c;
          });
          handleUpdateCases(nextCases);
        }}
        onConvertToTask={(newTask) => {
          handleCreateTask(newTask).catch(() => {});
        }}
      />

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        cases={cases}
        onSelectCase={(id) => {
          setSelectedCaseId(id);
          setIsSearchOpen(false);
          navigate(`/app/matters/${id}/overview`);
        }}
        onNavigateTab={(tab) => {
          setIsSearchOpen(false);
          navigate(`/app/${tab}`);
        }}
      />

      <NotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onNavigateTab={(tab) => {
          setIsNotificationsOpen(false);
          navigate(`/app/${tab}`);
        }}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotificationsAsRead}
        onMarkRead={handleMarkNotificationAsRead}
      />

      <RoleManagerModal
        isOpen={isRoleManagerOpen}
        onClose={() => setIsRoleManagerOpen(false)}
        officialRole={officialRole}
        simulatedRole={simulatedRole}
        onSelectSimulatedRole={(role) => setSimulatedRole(role)}
        chamberId={chamber?.id}
        userEmail={user?.email || ''}
      />

      <NewCaseModal
        isOpen={isNewCaseModalOpen}
        onClose={() => setIsNewCaseModalOpen(false)}
        onAddCase={handleAddNewCase}
      />

      <DigitalSignatureDrawer
        isOpen={isDigitalSigOpen}
        onClose={() => setIsDigitalSigOpen(false)}
        isDemoMode={isDemoMode}
      />

      <MultilingualModal
        isOpen={isMultilingualOpen}
        onClose={() => setIsMultilingualOpen(false)}
      />

      {/* Contextual Ask Advocate360 AI Assistant Drawer */}
      <AskAdvocateAssistant
        isOpen={isAskAssistantOpen}
        onClose={() => setIsAskAssistantOpen(false)}
        selectedCase={selectedCase}
        chamberId={chamber?.id}
      />
    </div>
  );
}
