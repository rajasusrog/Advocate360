import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User, db, auth, signInWithPopup, googleProvider, signOut, cleanFirestoreData } from './firebase';
import { collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { SidebarNav } from './components/SidebarNav';
import { PracticeDashboard } from './components/PracticeDashboard';
import { ClientIntake } from './components/ClientIntake';
import { DocumentAnalyzer } from './components/DocumentAnalyzer';
import { EvidenceIntelligence } from './components/EvidenceIntelligence';
import { TimelineAndContradictions } from './components/TimelineAndContradictions';
import { LegalResearch } from './components/LegalResearch';
import { DraftingAssistant } from './components/DraftingAssistant';
import { RiskAndLimitation } from './components/RiskAndLimitation';
import { HearingBrief } from './components/HearingBrief';
import { ClientPortal } from './components/ClientPortal';
import { DocumentComparison } from './components/DocumentComparison';
import { AgentChatDrawer } from './components/AgentChatDrawer';
import { NewCaseModal } from './components/NewCaseModal';
import { LandingPage } from './components/LandingPage';
import { PracticeSetupModal } from './components/PracticeSetupModal';

// Enterprise LegalOS Components
import { KnowledgeGraph } from './components/KnowledgeGraph';
import { AgentOrchestrator } from './components/AgentOrchestrator';
import { ConflictChecker } from './components/ConflictChecker';
import { AuditLogViewer } from './components/AuditLogViewer';
import { ExecutiveAnalytics } from './components/ExecutiveAnalytics';
import { PluginManager } from './components/PluginManager';
import { OpsHealthDashboard } from './components/OpsHealthDashboard';
import { DocumentRepository } from './components/DocumentRepository';
import { AiMemoryInspector } from './components/AiMemoryInspector';
import { WorkflowAutomation } from './components/WorkflowAutomation';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { NotificationCenter } from './components/NotificationCenter';
import { RoleManagerModal } from './components/RoleManagerModal';
import { DigitalSignatureDrawer } from './components/DigitalSignatureDrawer';
import { MultilingualModal } from './components/MultilingualModal';
import { MatterWorkspaceBar } from './components/MatterWorkspaceBar';
import { LegalIntelligenceWorkspace } from './components/LegalIntelligenceWorkspace';
import { BillingModule } from './components/BillingModule';
import { QuickNotesDrawer } from './components/QuickNotesDrawer';

import { CaseFile, AgentRole, IntakeData, ChamberProfile, UserProfile, CalendarEvent, PracticeTask, FeeRecord, ChamberRole } from './types';
import { INITIAL_CASES, SAMPLE_CALENDAR, SAMPLE_TASKS, SAMPLE_FEES } from './data/landingDemoData';
import { logAuditEvent } from './lib/auditLogger';
import { hasPermission } from './lib/permissions';
import { Scale, Sparkles } from 'lucide-react';

export default function App() {
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [chamber, setChamber] = useState<ChamberProfile | null>(null);
  const [officialRole, setOfficialRole] = useState<ChamberRole>('CHAMBER_OWNER');
  const [simulatedRole, setSimulatedRole] = useState<ChamberRole | null>(null);
  const currentRole = simulatedRole || officialRole;
  const [isSettingUpPractice, setIsSettingUpPractice] = useState<boolean>(false);
  const [isSubmittingSetup, setIsSubmittingSetup] = useState<boolean>(false);

  // Workspace state seeded with initial legal matters & fixtures
  const [cases, setCases] = useState<CaseFile[]>(INITIAL_CASES);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('case-101');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeAgent, setActiveAgent] = useState<AgentRole>('document_intelligence');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('adv360_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(SAMPLE_CALENDAR);
  const [tasks, setTasks] = useState<PracticeTask[]>(SAMPLE_TASKS);
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>(SAMPLE_FEES);

  // Modals
  const [isAgentDrawerOpen, setIsAgentDrawerOpen] = useState<boolean>(false);
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isRoleManagerOpen, setIsRoleManagerOpen] = useState<boolean>(false);
  const [isDigitalSigOpen, setIsDigitalSigOpen] = useState<boolean>(false);
  const [isMultilingualOpen, setIsMultilingualOpen] = useState<boolean>(false);

  // 1. Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        // Clear all private chamber data immediately on logout
        setUserProfile(null);
        setChamber(null);
        setCases([]);
        setCalendarEvents([]);
        setTasks([]);
        setFeeRecords([]);
        setSelectedCaseId('');
        setIsSettingUpPractice(false);
        setAuthLoading(false);
      } else {
        // Fetch user profile and chamber
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const uData = userSnap.data() as UserProfile;
            setUserProfile(uData);
            if (uData.role) {
              setOfficialRole(uData.role);
            } else {
              setOfficialRole('CHAMBER_OWNER');
            }

            if (uData.chamberId) {
              const chamberDocRef = doc(db, 'chambers', uData.chamberId);
              const chamberSnap = await getDoc(chamberDocRef);
              if (chamberSnap.exists()) {
                setChamber(chamberSnap.data() as ChamberProfile);
              }
            } else {
              setIsSettingUpPractice(true);
            }
          } else {
            // First time login - prompt chamber setup
            setIsSettingUpPractice(true);
          }
        } catch (err) {
          console.error('Error fetching user chamber profile:', err);
        } finally {
          setAuthLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Multi-Tenant Chamber Sync
  useEffect(() => {
    if (!user || !chamber) return;

    try {
      const casesCol = collection(db, 'chambers', chamber.id, 'cases');
      const unsubscribeCases = onSnapshot(casesCol, (snapshot) => {
        const loadedCases: CaseFile[] = [];
        snapshot.forEach((d) => {
          loadedCases.push({ id: d.id, ...d.data() } as CaseFile);
        });
        if (loadedCases.length > 0) {
          setCases(loadedCases);
          if (!selectedCaseId) {
            setSelectedCaseId(loadedCases[0].id);
          }
        }
      }, (err) => {
        console.error('Firestore cases permission/sync error:', err);
      });

      return () => unsubscribeCases();
    } catch (err) {
      console.warn('Chamber sync error:', err);
    }
  }, [user, chamber]);

  // Auth Action Handlers
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      logAuditEvent('ROLE_CHANGE', 'User authenticated via Google Auth');
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      logAuditEvent('ROLE_CHANGE', 'User logged out from Chamber Workspace');
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      setChamber(null);
      setCases([]);
      setCalendarEvents([]);
      setTasks([]);
      setFeeRecords([]);
      setSelectedCaseId('');
      setActiveTab('dashboard');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // First Time Practice Setup Handler
  const handlePracticeSetup = async (setupData: {
    advocateName: string;
    chamberName: string;
    enrollmentNo: string;
    stateBarCouncil: string;
    officeLocation: string;
    phone: string;
    practiceAreas: string[];
  }) => {
    if (!user) return;
    setIsSubmittingSetup(true);

    try {
      const chamberId = `chamber-${Date.now()}`;
      const nowIso = new Date().toISOString();

      const newChamber: ChamberProfile = {
        id: chamberId,
        name: setupData.chamberName,
        ownerUid: user.uid,
        advocateName: setupData.advocateName,
        enrollmentNo: setupData.enrollmentNo,
        stateBarCouncil: setupData.stateBarCouncil,
        officeLocation: setupData.officeLocation,
        phone: setupData.phone,
        email: user.email || '',
        practiceAreas: setupData.practiceAreas,
        createdAt: nowIso
      };

      const newProfile: UserProfile = {
        uid: user.uid,
        displayName: setupData.advocateName,
        email: user.email || '',
        photoURL: user.photoURL || undefined,
        chamberId: chamberId,
        role: 'CHAMBER_OWNER',
        createdAt: nowIso
      };

      // 1. Create chamber document
      await setDoc(doc(db, 'chambers', chamberId), cleanFirestoreData(newChamber));

      // 2. Add member record in chamber
      await setDoc(doc(db, 'chambers', chamberId, 'members', user.uid), {
        uid: user.uid,
        role: 'CHAMBER_OWNER',
        joinedAt: nowIso
      });

      // 3. Create user profile document
      await setDoc(doc(db, 'users', user.uid), cleanFirestoreData(newProfile));

      setChamber(newChamber);
      setUserProfile(newProfile);
      setIsSettingUpPractice(false);
      logAuditEvent('CASE_CREATE', `Created Chamber Workspace: ${setupData.chamberName}`);
    } catch (err: any) {
      console.error('Practice setup failed:', err);
      throw err;
    } finally {
      setIsSubmittingSetup(false);
    }
  };

  // Case Actions inside Chamber
  const handleAddNewCase = async (newCase: CaseFile) => {
    if (!chamber) return;

    if (!hasPermission(currentRole, 'CREATE_CASE')) {
      alert(`Role "${currentRole}" is not authorized to create cases.`);
      return;
    }

    setCases((prev) => [newCase, ...prev]);
    setSelectedCaseId(newCase.id);
    logAuditEvent('CASE_CREATE', `Opened new case file: ${newCase.title}`);

    try {
      const sanitizedCase = cleanFirestoreData(newCase);
      await setDoc(doc(db, 'chambers', chamber.id, 'cases', newCase.id), sanitizedCase);
    } catch (err) {
      console.error('Firestore save case error:', err);
    }
  };

  const handleAddCaseFromIntake = (intake: IntakeData) => {
    const hearingDateObj = intake.importantDates?.find((d) => 
      d.label.toLowerCase().includes('hearing') || d.label.toLowerCase().includes('court')
    );

    const newCase: CaseFile = {
      id: `case-${Date.now()}`,
      title: `${intake.parties.client} vs ${intake.parties.oppositeParty || 'Opposite Party'}`,
      caseType: (intake.caseType as any) || 'Property Dispute',
      status: 'Intake',
      clientName: intake.parties.client,
      courtName: 'Court Not Specified',
      summary: intake.suggestedAction || 'Extracted via AI Client Intake.',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0]
    };

    if (intake.parties.oppositeParty) {
      newCase.oppositeParty = intake.parties.oppositeParty;
    }
    if (hearingDateObj?.date) {
      newCase.nextHearingDate = hearingDateObj.date;
    }

    handleAddNewCase(newCase);
    setActiveTab('dashboard');
  };

  const handleSimulatedRoleSwitch = (newRole: ChamberRole | null) => {
    setSimulatedRole(newRole);
    if (newRole) {
      logAuditEvent('ROLE_CHANGE', `Activated UI Permission Simulator for role: ${newRole}`);
    } else {
      logAuditEvent('ROLE_CHANGE', `Deactivated UI Permission Simulator, reverted to official role: ${officialRole}`);
    }
  };

  const selectedCase = cases.find((c) => c.id === selectedCaseId) || cases[0] || {
    id: 'placeholder',
    title: 'Mylapore Ancestral Property Dispute',
    caseType: 'Property Dispute',
    status: 'Active Litigation',
    clientName: 'S. Ramesh',
    createdAt: new Date().toISOString()
  };

  // ROOT VIEW ROUTING

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
            <p className="text-xs text-[#555555]">Initializing Chamber Security & Authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. UNAUTHENTICATED USER -> PUBLIC LANDING PAGE ONLY
  if (!user) {
    return (
      <LandingPage
        onGoogleSignIn={handleGoogleSignIn}
        isLoadingAuth={authLoading}
      />
    );
  }

  // 3. AUTHENTICATED USER WITHOUT CHAMBER -> PRACTICE SETUP MODAL
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

  // 4. AUTHENTICATED ADVOCATE WORKSPACE
  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] flex flex-col font-sans selection:bg-[#B45309] selection:text-white">
      
      {/* Brand & Chamber Header */}
      <Header
        user={user}
        chamber={chamber}
        currentRole={currentRole}
        simulatedRole={simulatedRole}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAgent={activeAgent}
        setActiveAgent={setActiveAgent}
        cases={cases}
        selectedCaseId={selectedCaseId}
        setSelectedCaseId={setSelectedCaseId}
        onOpenNewCaseModal={() => setIsNewCaseModalOpen(true)}
        toggleAgentChatDrawer={() => setIsAgentDrawerOpen(!isAgentDrawerOpen)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenRoleManager={() => setIsRoleManagerOpen(true)}
        onOpenMultilingual={() => setIsMultilingualOpen(true)}
        onLogout={handleLogout}
      />

      {/* Simulator Banner (Active when testing UI permissions) */}
      {simulatedRole && (
        <div className="bg-purple-950 text-purple-100 text-xs px-4 py-2 border-b-2 border-purple-500 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2 font-mono">
            <span className="bg-purple-500 text-white font-bold px-2 py-0.5 text-[9px] uppercase tracking-wider animate-pulse">
              SIMULATOR ACTIVE
            </span>
            <span>
              Previewing UI permissions as: <strong className="text-purple-300 uppercase">{simulatedRole}</strong> (Official Bound Role: <strong>{officialRole}</strong>)
            </span>
          </div>
          <button
            onClick={() => handleSimulatedRoleSwitch(null)}
            className="bg-white text-purple-950 font-bold px-3 py-1 text-[10px] uppercase hover:bg-purple-100 transition-colors shadow-xs"
          >
            Exit Simulation Mode
          </button>
        </div>
      )}

      {/* Enterprise Left Sidebar + Main Workspace Workspace Container */}
      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        
        {/* Enterprise Left Sidebar */}
        <SidebarNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={(val) => {
            setIsSidebarCollapsed(val);
            localStorage.setItem('adv360_sidebar_collapsed', String(val));
          }}
          cases={cases}
          selectedCaseId={selectedCaseId}
          setSelectedCaseId={setSelectedCaseId}
          onOpenNewCaseModal={() => setIsNewCaseModalOpen(true)}
          currentRole={currentRole}
        />

        {/* Right Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#FDFCFB]">
          
          {/* Matter-Centric Context Navigation Bar */}
          {selectedCase && (
            <MatterWorkspaceBar
              selectedCase={selectedCase as CaseFile}
              activeTab={activeTab}
              onNavigateTab={setActiveTab}
            />
          )}

          {/* Primary Workspace Body */}
          <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {activeTab === 'dashboard' && (
              <PracticeDashboard
                cases={cases}
                selectedCaseId={selectedCaseId}
                setSelectedCaseId={setSelectedCaseId}
                calendarEvents={calendarEvents}
                tasks={tasks}
                feeRecords={feeRecords}
                onNavigateTab={setActiveTab}
                onOpenNewCaseModal={() => setIsNewCaseModalOpen(true)}
              />
            )}

            {activeTab === 'billing' && (
              <BillingModule
                cases={cases}
                chamber={chamber}
                selectedCaseId={selectedCaseId}
                setSelectedCaseId={setSelectedCaseId}
                onNavigateTab={setActiveTab}
                currentRole={currentRole}
              />
            )}

            {activeTab === 'intelligence' && (
              <LegalIntelligenceWorkspace />
            )}

            {activeTab === 'graph' && (
              <KnowledgeGraph selectedCase={selectedCase as CaseFile} onNavigateTab={setActiveTab} />
            )}

            {activeTab === 'orchestrator' && (
              <AgentOrchestrator selectedCase={selectedCase as CaseFile} onNavigateTab={setActiveTab} />
            )}

            {activeTab === 'intake' && (
              <ClientIntake onAddCaseFromIntake={handleAddCaseFromIntake} />
            )}

            {activeTab === 'analyzer' && <DocumentAnalyzer />}

            {activeTab === 'evidence' && <EvidenceIntelligence />}

            {activeTab === 'timeline' && <TimelineAndContradictions />}

            {activeTab === 'research' && <LegalResearch />}

            {activeTab === 'drafting' && <DraftingAssistant />}

            {activeTab === 'risk' && <RiskAndLimitation />}

            {activeTab === 'hearing' && <HearingBrief />}

            {activeTab === 'conflict' && <ConflictChecker cases={cases} />}

            {activeTab === 'audit' && (
              <AuditLogViewer chamberId={chamber?.id} userEmail={user?.email || ''} />
            )}

            {activeTab === 'analytics' && (
              <ExecutiveAnalytics cases={cases} feeRecords={feeRecords} />
            )}

            {activeTab === 'plugins' && <PluginManager />}

            {activeTab === 'ops' && <OpsHealthDashboard />}

            {activeTab === 'repository' && (
              <DocumentRepository 
                selectedCase={selectedCase as CaseFile} 
                onOpenDigitalSignature={() => setIsDigitalSigOpen(true)}
              />
            )}

            {activeTab === 'client' && (
              <ClientPortal 
                cases={cases}
                selectedCaseId={selectedCaseId}
                setSelectedCaseId={setSelectedCaseId}
                chamber={chamber}
              />
            )}

            {activeTab === 'comparison' && <DocumentComparison />}

            {activeTab === 'memory' && (
              <AiMemoryInspector selectedCase={selectedCase as CaseFile} />
            )}

            {activeTab === 'workflow' && (
              <WorkflowAutomation selectedCase={selectedCase as CaseFile} onNavigateTab={setActiveTab} />
            )}
          </main>

          {/* Editorial Gazette Footer */}
          <footer className="bg-[#1A1A1A] border-t-2 border-[#1A1A1A] py-6 text-center text-xs text-slate-300 mt-auto">
            <div className="max-w-[1600px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-serif italic font-bold text-white text-base">Advocate360 AI</span>
                <span className="text-[9px] uppercase tracking-widest font-bold bg-[#B45309] text-white px-2 py-0.5">
                  UNIKORN360
                </span>
              </div>
              <p className="text-xs text-slate-400 font-serif italic">
                "Your AI Junior Advocate, available 24×7 — Confidential & Isolated Chamber Workspace."
              </p>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                © {new Date().getFullYear()} Advocate360 AI LegalOS
              </span>
            </div>
          </footer>

        </div>
      </div>

      {/* Quick Notes Floating Action Button & Voice Drawer */}
      <QuickNotesDrawer
        cases={cases}
        selectedCaseId={selectedCaseId}
        onAssignToCase={(caseId, content, noteTitle) => {
          setCases(prev => prev.map(c => {
            if (c.id === caseId) {
              const prevNotes = c.summary ? `${c.summary}\n\n[Quick Note: ${noteTitle}]\n${content}` : content;
              return { ...c, summary: prevNotes };
            }
            return c;
          }));
        }}
        onConvertToTask={(newTask) => {
          setTasks(prev => [newTask, ...prev]);
        }}
      />

      {/* Global Search Modal (Cmd+K) */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        cases={cases}
        onSelectCase={(id) => {
          setSelectedCaseId(id);
          setIsSearchOpen(false);
        }}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setIsSearchOpen(false);
        }}
      />

      {/* Notification Center */}
      <NotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setIsNotificationsOpen(false);
        }}
      />

      {/* Role & Permission Simulator Modal */}
      <RoleManagerModal
        isOpen={isRoleManagerOpen}
        onClose={() => setIsRoleManagerOpen(false)}
        officialRole={officialRole}
        simulatedRole={simulatedRole}
        onSelectSimulatedRole={handleSimulatedRoleSwitch}
        chamberId={chamber?.id}
        userEmail={user?.email || ''}
      />

      {/* New Case Creation Modal */}
      <NewCaseModal
        isOpen={isNewCaseModalOpen}
        onClose={() => setIsNewCaseModalOpen(false)}
        onAddCase={(newCase) => {
          handleAddNewCase(newCase);
          setIsNewCaseModalOpen(false);
        }}
      />

      {/* Agent Chat Drawer */}
      <AgentChatDrawer
        isOpen={isAgentDrawerOpen}
        onClose={() => setIsAgentDrawerOpen(false)}
        activeAgent={activeAgent}
        setActiveAgent={setActiveAgent}
        selectedCase={selectedCase as CaseFile}
      />

      {/* Digital Signature Drawer */}
      <DigitalSignatureDrawer
        isOpen={isDigitalSigOpen}
        onClose={() => setIsDigitalSigOpen(false)}
      />

      {/* Multilingual OS Engine Modal */}
      <MultilingualModal
        isOpen={isMultilingualOpen}
        onClose={() => setIsMultilingualOpen(false)}
      />

    </div>
  );
}
