import React, { useState } from 'react';
import { 
  GitCommit, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Plus, 
  Sparkles, 
  ShieldAlert, 
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { TimelineNode, ContradictionItem } from '../types';
import { SAMPLE_TIMELINE, SAMPLE_CONTRADICTIONS } from '../data/landingDemoData';

import { CaseFile } from '../types';
import {
  listTimelineEventsForMatter,
  createTimelineEventInDb,
  updateMatterInDb,
} from '../lib/useMatterData';

interface TimelineAndContradictionsProps {
  selectedCase?: CaseFile | null;
  chamberId?: string;
}

export const TimelineAndContradictions: React.FC<TimelineAndContradictionsProps> = ({ selectedCase, chamberId }) => {
  const [timelineNodes, setTimelineNodes] = useState<TimelineNode[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState<boolean>(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineSuccess, setTimelineSuccess] = useState<string | null>(null);
  const [isSavingNode, setIsSavingNode] = useState<boolean>(false);

  React.useEffect(() => {
    let cancelled = false;
    const parseMatterTimelineStrings = (): TimelineNode[] => {
      if (selectedCase && Array.isArray(selectedCase.timeline) && selectedCase.timeline.length > 0) {
        return selectedCase.timeline.map((item, idx) => {
          const parts = item.split(': ');
          return {
            id: `t-${idx}`,
            date: parts[0] || 'Date pending',
            event: parts.slice(1).join(': ') || item,
            category: 'Property' as const,
          };
        });
      }
      return [];
    };

    if (!chamberId || !selectedCase?.id) {
      setTimelineNodes(parseMatterTimelineStrings());
      return;
    }

    setLoadingTimeline(true);
    setTimelineError(null);
    listTimelineEventsForMatter(chamberId, selectedCase.id)
      .then((dbNodes) => {
        if (cancelled) return;
        if (dbNodes.length > 0) {
          setTimelineNodes(dbNodes);
        } else {
          setTimelineNodes(parseMatterTimelineStrings());
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        console.error('Failed to load timeline events from Supabase:', err);
        setTimelineError(err?.message || 'Failed to load chronology events from database.');
        setTimelineNodes(parseMatterTimelineStrings());
      })
      .finally(() => {
        if (!cancelled) setLoadingTimeline(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chamberId, selectedCase?.id]);

  const [contradictions, setContradictions] = useState<ContradictionItem[]>([]);

  const handleLoadSampleTimeline = () => {
    setTimelineNodes(SAMPLE_TIMELINE);
    setContradictions(SAMPLE_CONTRADICTIONS);
  };

  // New Node Form
  const [newDate, setNewDate] = useState<string>('');
  const [newEvent, setNewEvent] = useState<string>('');
  const [newCategory, setNewCategory] = useState<TimelineNode['category']>('Property');

  const handleAddTimelineNode = async () => {
    if (!newDate || !newEvent.trim() || isSavingNode) return;
    setTimelineError(null);
    setTimelineSuccess(null);

    if (!chamberId || !selectedCase?.id) {
      setTimelineError('Cannot save timeline event: select an active workspace matter first.');
      return;
    }

    setIsSavingNode(true);
    try {
      const createdNode = await createTimelineEventInDb(chamberId, selectedCase.id, {
        date: newDate,
        event: newEvent.trim(),
        category: newCategory,
      });

      const updatedNodes = [...timelineNodes, createdNode].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      const formattedTimeline = updatedNodes.map((n) => `${n.date}: ${n.event}`);
      await updateMatterInDb(chamberId, selectedCase.id, { timeline: formattedTimeline });

      setTimelineNodes(updatedNodes);
      setNewDate('');
      setNewEvent('');
      setTimelineSuccess(`Saved chronology event "${createdNode.event}" (${createdNode.date}) to PostgreSQL.`);
      setTimeout(() => setTimelineSuccess(null), 4000);
    } catch (err: any) {
      console.error('Failed to persist timeline node to Supabase:', err);
      setTimelineError(
        err?.message || 'Failed to save timeline event to PostgreSQL. Your input has been preserved.'
      );
    } finally {
      setIsSavingNode(false);
    }
  };

  return (
    <div className="space-y-6">
      {timelineError && (
        <div role="alert" className="p-3 bg-[#FFF4F2] border-2 border-[#FF4444] text-xs text-[#FF4444] font-bold flex items-center justify-between">
          <span>⚠️ {timelineError}</span>
          <button onClick={() => setTimelineError(null)} className="underline ml-3">Dismiss</button>
        </div>
      )}
      {timelineSuccess && (
        <div role="status" className="p-3 bg-emerald-50 border-2 border-emerald-700 text-xs text-emerald-900 font-bold flex items-center justify-between">
          <span>✓ {timelineSuccess}</span>
          <button onClick={() => setTimelineSuccess(null)} className="underline ml-3">Dismiss</button>
        </div>
      )}
      {/* Editorial Header Banner */}
      <div className="bg-[#F5F2EF] text-[#1A1A1A] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <GitCommit className="w-3.5 h-3.5 text-amber-400" />
              <span>Features #6 & #7 • One-Click Timeline & Contradiction Detector</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">Case Chronology & Contradiction Detector</h1>
            <p className="text-xs text-[#555555] leading-relaxed mt-1 max-w-2xl">
              Advocate360 reads every document in the case bundle to produce an instant timeline and highlights conflicting dates, payment discrepancies, or contradictory affidavits.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Visual Chronology Timeline */}
        <div className="lg:col-span-6 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#B45309]" />
              <span>Case Chronology Timeline ({timelineNodes.length})</span>
            </h3>
            <span className="text-[10px] font-mono font-bold text-[#B45309]">
              {loadingTimeline ? 'Syncing...' : 'Auto-Sorted'}
            </span>
          </div>

          {/* Add Quick Node Box */}
          <div className="p-3 bg-[#F9F7F5] border border-[#1A1A1A] space-y-2 text-xs">
            <span className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">Add Chronology Event:</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="p-2 bg-white border border-[#1A1A1A] text-[#1A1A1A]"
              />
              <input
                type="text"
                placeholder="Event description..."
                value={newEvent}
                onChange={(e) => setNewEvent(e.target.value)}
                className="p-2 bg-white border border-[#1A1A1A] text-[#1A1A1A] sm:col-span-2"
              />
            </div>
            <button
              onClick={handleAddTimelineNode}
              disabled={isSavingNode || !newDate || !newEvent.trim()}
              className="w-full py-1.5 bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold uppercase tracking-wider text-xs border border-[#1A1A1A] disabled:opacity-50"
            >
              {isSavingNode ? 'Saving Event...' : '+ Add Event'}
            </button>
          </div>

          {/* Visual Timeline Bar */}
          {timelineNodes.length > 0 ? (
            <div className="relative border-l-2 border-[#1A1A1A] ml-3 pl-5 space-y-6">
              {timelineNodes.map((node) => (
                <div key={node.id} className="relative group">
                  {/* Node Bullet */}
                  <div className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 bg-[#1A1A1A] border-2 border-[#FDFCFB] group-hover:bg-[#B45309] transition-colors" />

                  <div className="p-3.5 bg-[#F9F7F5] border border-[#1A1A1A]/30 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#B45309] font-mono">{node.date}</span>
                      <span className="text-[9px] uppercase font-bold bg-[#1A1A1A] text-white px-2 py-0.5">
                        {node.category}
                      </span>
                    </div>
                    <p className="text-[#1A1A1A] font-serif italic font-medium">{node.event}</p>
                    {node.flag && (
                      <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider text-[#FF4444] bg-[#FFF4F2] px-2 py-0.5 border border-[#FF4444]">
                        ⚠️ {node.flag}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 bg-[#F5F2EF] border border-[#1A1A1A] text-center space-y-3">
              <Clock className="w-8 h-8 text-[#B45309] mx-auto" />
              <p className="text-xs text-[#555555]">No timeline events logged for this matter yet.</p>
              <button
                onClick={handleLoadSampleTimeline}
                className="bg-[#1A1A1A] text-amber-400 font-bold px-3 py-1.5 text-xs uppercase tracking-wider border border-[#1A1A1A]"
              >
                Load Sample Timeline
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Contradiction Detector */}
        <div className="lg:col-span-6 bg-[#FDFCFB] border border-[#1A1A1A] p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF4444] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FF4444]" />
              <span>Contradictions & Discrepancies ({contradictions.length})</span>
            </h3>
            <span className="text-[9px] bg-[#FFF4F2] text-[#FF4444] font-bold uppercase tracking-wider px-2 py-0.5 border border-[#FF4444]">
              Verification Required
            </span>
          </div>

          <div className="space-y-4">
            {contradictions.map((c) => (
              <div key={c.id} className="p-4 bg-[#FFF4F2] border border-[#FF4444] space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#FF4444] uppercase tracking-wider text-[10px]">
                    {c.natureOfContradiction}
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border ${
                    c.impactOnCase === 'Severe' ? 'bg-[#FF4444] text-white border-[#FF4444]' : 'bg-amber-400 text-[#1A1A1A] border-[#1A1A1A]'
                  }`}>
                    Impact: {c.impactOnCase}
                  </span>
                </div>

                {/* Side-by-Side Statements */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-white border border-[#FF4444]/40 space-y-1">
                    <span className="text-[9px] font-bold text-[#1A1A1A] font-mono uppercase">Statement A ({c.statementA.source})</span>
                    <p className="text-[#1A1A1A] font-serif italic">"{c.statementA.text}"</p>
                  </div>

                  <div className="p-3 bg-white border border-[#FF4444]/40 space-y-1">
                    <span className="text-[9px] font-bold text-[#1A1A1A] font-mono uppercase">Statement B ({c.statementB.source})</span>
                    <p className="text-[#1A1A1A] font-serif italic">"{c.statementB.text}"</p>
                  </div>
                </div>

                <div className="p-3 bg-[#F5F2EF] border border-[#1A1A1A] text-[#1A1A1A] font-serif italic text-xs">
                  🔍 <strong>Recommended Cross-Exam Line:</strong> {c.recommendedVerification}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-[#F5F2EF] border border-[#1A1A1A] text-xs space-y-2">
            <h4 className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-[#B45309]" />
              <span>Contradiction Detection Rulebook</span>
            </h4>
            <p className="text-[#555555] leading-relaxed">
              The AI automatically flags discrepancies between affidavits, FIR statements, bank statements, and sale deeds. Use these contradictions during cross-examination to shatter witness credibility.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
