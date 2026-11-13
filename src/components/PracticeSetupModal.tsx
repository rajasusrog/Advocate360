import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react';

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
  'Other State Bar Council',
];

const PRACTICE_AREAS = [
  'Civil & Property Disputes',
  'Criminal Law & FIR Matters',
  'Corporate & Commercial Recovery',
  'Family & Matrimonial Law',
  'Constitutional & Writ Jurisdiction',
  'Taxation & Revenue',
  'Arbitration & ADR',
  'Consumer & Labour Disputes',
];

export const PracticeSetupModal: React.FC<PracticeSetupModalProps> = ({
  userDisplayName,
  onSubmitSetup,
  isSubmitting,
}) => {
  const [advocateName, setAdvocateName] = useState(userDisplayName || 'Advocate');
  const [chamberName, setChamberName] = useState(`${userDisplayName || 'Advocate'} Law Chambers`);
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [stateBarCouncil, setStateBarCouncil] = useState('Bar Council of Tamil Nadu & Puducherry');
  const [officeLocation, setOfficeLocation] = useState('High Court & City Civil Courts');
  const [phone, setPhone] = useState('');
  const [selectedAreas, setSelectedAreas] = useState<string[]>(['Civil & Property Disputes']);
  const [error, setError] = useState('');

  const toggleArea = (area: string) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advocateName.trim() || !chamberName.trim()) {
      setError('Advocate name and chamber name are required.');
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
        practiceAreas: selectedAreas,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to set up practice profile. Your input has been preserved.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B1426]/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#E2DFD7] rounded-2xl max-w-2xl w-full shadow-2xl p-6 sm:p-8 space-y-6 text-[#0B1426] my-8">
        {/* Header */}
        <div className="bg-[#F6F5F1] border border-[#E2DFD7] rounded-xl p-5">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider bg-[#0B1426] text-[#C49A36] px-2.5 py-0.5 rounded mb-2">
            <span>Chamber Setup</span>
          </div>
          <h2 className="text-xl font-bold text-[#0B1426]">Set up your advocate chamber</h2>
          <p className="text-xs text-[#475569] mt-1">
            Create your isolated chamber workspace to manage matters, hearings, tasks, and verified client access.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-lg text-xs font-medium flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-xs text-[#0B1426] mb-1">
                Advocate full name <span className="text-[#B91C1C]">*</span>
              </label>
              <input
                type="text"
                value={advocateName}
                onChange={(e) => setAdvocateName(e.target.value)}
                required
                placeholder="e.g. Adv. Ramesh Kumar"
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
              />
            </div>

            <div>
              <label className="block font-semibold text-xs text-[#0B1426] mb-1">
                Chamber / practice name <span className="text-[#B91C1C]">*</span>
              </label>
              <input
                type="text"
                value={chamberName}
                onChange={(e) => setChamberName(e.target.value)}
                required
                placeholder="e.g. Ramesh Kumar Law Chambers"
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-xs text-[#0B1426] mb-1">
                Bar Council enrollment number
              </label>
              <input
                type="text"
                value={enrollmentNo}
                onChange={(e) => setEnrollmentNo(e.target.value)}
                placeholder="e.g. TN/2041/2018"
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] font-mono focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
              />
            </div>

            <div>
              <label className="block font-semibold text-xs text-[#0B1426] mb-1">
                State Bar Council
              </label>
              <select
                value={stateBarCouncil}
                onChange={(e) => setStateBarCouncil(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
              >
                {STATE_BAR_COUNCILS.map((bc, idx) => (
                  <option key={idx} value={bc}>
                    {bc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-xs text-[#0B1426] mb-1">
                Chamber office / court location
              </label>
              <input
                type="text"
                value={officeLocation}
                onChange={(e) => setOfficeLocation(e.target.value)}
                placeholder="e.g. High Court Chamber Block B"
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
              />
            </div>

            <div>
              <label className="block font-semibold text-xs text-[#0B1426] mb-1">
                Contact phone number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full px-3 py-2 bg-white border border-[#CBD5E1] rounded-lg text-sm text-[#0B1426] focus:outline-none focus:border-[#0B1426] focus:ring-1 focus:ring-[#C49A36]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-xs text-[#0B1426] mb-1.5">
              Primary practice areas
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRACTICE_AREAS.map((area, idx) => (
                <label
                  key={idx}
                  className="flex items-center gap-2 text-xs p-2.5 bg-[#F6F5F1] border border-[#E2DFD7] rounded-lg cursor-pointer hover:border-[#0B1426]/40"
                >
                  <input
                    type="checkbox"
                    checked={selectedAreas.includes(area)}
                    onChange={() => toggleArea(area)}
                    className="accent-[#0B1426]"
                  />
                  <span>{area}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="p-3 bg-[#F6F5F1] border border-[#E2DFD7] rounded-lg text-xs text-[#475569] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#C49A36] shrink-0" />
            <span>
              Your chamber profile creates an isolated multi-tenant workspace accessible only to you and authorized staff.
            </span>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#0B1426] hover:bg-[#16233D] text-white font-semibold text-xs px-6 py-3 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <span>{isSubmitting ? 'Creating workspace...' : 'Create workspace'}</span>
              <ArrowRight className="w-4 h-4 text-[#C49A36]" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
