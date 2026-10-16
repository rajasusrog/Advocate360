import React, { useState } from 'react';
import { Building2, Scale, User, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { ChamberProfile, UserProfile } from '../types';

interface PracticeSetupModalProps {
  userEmail: string;
  userDisplayName: string;
  onSubmitSetup: (data: {
    advocateName: string;
    chamberName: string;
    enrollmentNo: string;
    stateBarCouncil: string;
    officeLocation: string;
    phone: string;
    practiceAreas: string[];
  }) => Promise<void>;
  isSubmitting: boolean;
}

const STATE_BAR_COUNCILS = [
  'Bar Council of Delhi',
  'Bar Council of Maharashtra & Goa',
  'Bar Council of Tamil Nadu & Puducherry',
  'Bar Council of Karnataka',
  'Bar Council of Uttar Pradesh',
  'Bar Council of West Bengal',
  'Bar Council of Gujarat',
  'Bar Council of Punjab & Haryana',
  'Bar Council of Kerala',
  'Bar Council of Rajasthan',
  'Bar Council of Telangana / AP',
  'Other State Bar Council'
];

const PRACTICE_AREAS = [
  'Civil & Property Disputes',
  'Criminal Law & FIR Matters',
  'Corporate & Commercial Recovery',
  'Family & Matrimonial Law',
  'Constitutional & Writ Jurisdiction',
  'Taxation & Revenue',
  'Arbitration & ADR',
  'Consumer & Labour Disputes'
];

export const PracticeSetupModal: React.FC<PracticeSetupModalProps> = ({
  userEmail,
  userDisplayName,
  onSubmitSetup,
  isSubmitting
}) => {
  const [advocateName, setAdvocateName] = useState(userDisplayName || 'Advocate');
  const [chamberName, setChamberName] = useState(`${userDisplayName || 'Advocate'}'s Law Chambers`);
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [stateBarCouncil, setStateBarCouncil] = useState('Bar Council of Delhi');
  const [officeLocation, setOfficeLocation] = useState('High Court & City Civil Courts');
  const [phone, setPhone] = useState('');
  const [selectedAreas, setSelectedAreas] = useState<string[]>(['Civil & Property Disputes']);
  const [error, setError] = useState('');

  const toggleArea = (area: string) => {
    setSelectedAreas(prev => 
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advocateName.trim() || !chamberName.trim()) {
      setError('Advocate Name and Chamber Name are required.');
      return;
    }
    setError('');
    try {
      await onSubmitSetup({
        advocateName,
        chamberName,
        enrollmentNo,
        stateBarCouncil,
        officeLocation,
        phone,
        practiceAreas: selectedAreas
      });
    } catch (err: any) {
      setError(err.message || 'Failed to setup practice profile.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] max-w-2xl w-full shadow-2xl p-6 sm:p-8 space-y-6 text-[#1A1A1A] my-8">
        
        {/* Header */}
        <div className="bg-[#F5F2EF] border border-[#1A1A1A] p-5">
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-amber-400 px-2.5 py-0.5 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>First Login Setup • Private Chamber Registration</span>
          </div>
          <h2 className="font-serif italic font-bold text-2xl text-[#1A1A1A]">
            Set Up Your Advocate Chamber
          </h2>
          <p className="text-xs text-[#555555] mt-1 font-sans">
            Welcome to Advocate360 AI. Create your private chamber profile to isolate and manage your litigation matters securely.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-[#FFF4F2] border border-[#FF4444] text-[#FF4444] text-xs font-bold font-sans">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] mb-1">
                Advocate Full Name *
              </label>
              <input
                type="text"
                value={advocateName}
                onChange={e => setAdvocateName(e.target.value)}
                required
                placeholder="e.g. Adv. Ramesh Kumar"
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] mb-1">
                Chamber / Practice Name *
              </label>
              <input
                type="text"
                value={chamberName}
                onChange={e => setChamberName(e.target.value)}
                required
                placeholder="e.g. Ramesh Kumar & Associates Law Chambers"
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] mb-1">
                Bar Council Enrollment No (Optional)
              </label>
              <input
                type="text"
                value={enrollmentNo}
                onChange={e => setEnrollmentNo(e.target.value)}
                placeholder="e.g. MAH/2041/2018"
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] mb-1">
                State Bar Council
              </label>
              <select
                value={stateBarCouncil}
                onChange={e => setStateBarCouncil(e.target.value)}
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] focus:outline-none"
              >
                {STATE_BAR_COUNCILS.map((bc, idx) => (
                  <option key={idx} value={bc}>{bc}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] mb-1">
                Chamber Office / Court Location
              </label>
              <input
                type="text"
                value={officeLocation}
                onChange={e => setOfficeLocation(e.target.value)}
                placeholder="e.g. High Court Chamber Block B, New Delhi"
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] mb-1">
                Contact Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full p-2.5 bg-[#F9F7F5] border border-[#1A1A1A] text-[#1A1A1A] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A] mb-1">
              Primary Practice Areas
            </label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {PRACTICE_AREAS.map((area, idx) => (
                <label key={idx} className="flex items-center gap-2 text-[11px] p-2 bg-[#F5F2EF] border border-[#1A1A1A]/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAreas.includes(area)}
                    onChange={() => toggleArea(area)}
                    className="accent-[#B45309]"
                  />
                  <span>{area}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="p-3 bg-[#F5F2EF] border border-[#1A1A1A]/30 text-[11px] text-[#555555] font-serif italic flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#B45309] shrink-0" />
            <span>Your chamber profile creates an isolated multi-tenant data space (<code className="text-[#1A1A1A] font-mono">/chambers/&#123;id&#125;</code>) accessible only by you and your authorized staff.</span>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold uppercase tracking-wider text-xs px-8 py-3.5 border border-[#1A1A1A] flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Registering Chamber...' : 'Create Practice & Enter Workspace'}</span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
