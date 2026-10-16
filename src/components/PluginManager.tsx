import React, { useState } from 'react';
import { 
  Boxes, 
  Check, 
  Plus, 
  Settings, 
  ShieldCheck, 
  ExternalLink, 
  Zap, 
  Building2, 
  Scale, 
  FileText, 
  AlertCircle, 
  Sliders,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Layers
} from 'lucide-react';
import { logAuditEvent } from '../lib/auditLogger';

export interface LegalOSPlugin {
  id: string;
  name: string;
  category: 'Tax & Revenue' | 'Land & Property' | 'Criminal Defense' | 'Corporate' | 'Compliance';
  description: string;
  version: string;
  installed: boolean;
  active: boolean;
  author: string;
  permissionsRequired: string[];
}

export const PluginManager: React.FC = () => {
  const [plugins, setPlugins] = useState<LegalOSPlugin[]>([
    {
      id: 'plugin-property',
      name: 'Property & Land Title Verification Engine',
      category: 'Land & Property',
      description: 'Automates encumbrance certificate analysis, survey boundary verification, and Section 44 Transfer of Property Act coparcenary share calculation.',
      version: 'v3.1.0',
      installed: true,
      active: true,
      author: 'LegalOS Core Team',
      permissionsRequired: ['case.read', 'document.export', 'ai.execute']
    },
    {
      id: 'plugin-gst',
      name: 'GST & Indirect Tax Litigation Suite',
      category: 'Tax & Revenue',
      description: 'Automates Notice under Sec 73/74 analysis, ITC reversal calculations, Appellate Tribunal petition drafting, and High Court tax writ petitions.',
      version: 'v2.4.2',
      installed: true,
      active: true,
      author: 'Chamber Tax Practice Group',
      permissionsRequired: ['billing.view', 'workflow.create', 'ai.execute']
    },
    {
      id: 'plugin-criminal',
      name: 'Criminal Defense & Quashing Assistant (BNSS/IPC)',
      category: 'Criminal Defense',
      description: 'Automates FIR section breakdown, Section 482 BNSS/CrPC quashing ground generation, and bail application risk scoring.',
      version: 'v1.8.0',
      installed: false,
      active: false,
      author: 'Criminal Law Bar Labs',
      permissionsRequired: ['case.read', 'ai.execute']
    },
    {
      id: 'plugin-corporate',
      name: 'NCLT & Insolvency (IBC 2016) Matrix',
      category: 'Corporate',
      description: 'Automates Section 7 & 9 IBC demand notice extraction, Committee of Creditors voting thresholds, and CIRP timeline tracking.',
      version: 'v2.0.1',
      installed: false,
      active: false,
      author: 'Insolvency Professionals Guild',
      permissionsRequired: ['workflow.manage', 'ai.execute']
    },
    {
      id: 'plugin-hr',
      name: 'HR & Labor Dispute Compliance Engine',
      category: 'Compliance',
      description: 'Automates Industrial Disputes Act claims, gratuity calculation auditing, and POSH inquiry report compliance verification.',
      version: 'v1.2.0',
      installed: false,
      active: false,
      author: 'Labor Law Specialist Network',
      permissionsRequired: ['audit.read', 'case.read']
    }
  ]);

  const togglePluginState = (pluginId: string) => {
    setPlugins(prev => prev.map(p => {
      if (p.id === pluginId) {
        const nextActive = !p.active;
        logAuditEvent('ROLE_CHANGE', `Plugin "${p.name}" status toggled to ${nextActive ? 'Active' : 'Disabled'}`);
        return { ...p, active: nextActive, installed: true };
      }
      return p;
    }));
  };

  const installPlugin = (pluginId: string) => {
    setPlugins(prev => prev.map(p => {
      if (p.id === pluginId) {
        logAuditEvent('ROLE_CHANGE', `Installed LegalOS Plugin: ${p.name}`);
        return { ...p, installed: true, active: true };
      }
      return p;
    }));
  };

  return (
    <div className="space-y-6 text-[#1A1A1A]">
      
      {/* Header Banner */}
      <div className="bg-[#F5F2EF] p-6 border-2 border-[#1A1A1A] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-white px-2.5 py-0.5 mb-2">
              <Boxes className="w-3.5 h-3.5 text-amber-400" />
              <span>Modular Plugin Architecture & Practice Extensions</span>
            </div>
            <h1 className="font-serif text-3xl font-light italic text-[#1A1A1A]">LegalOS Core Plugin Marketplace</h1>
            <p className="text-xs text-[#555555] mt-1 max-w-2xl">
              Extend LegalOS Core with domain-specific practice modules without touching core codebase. Enable Property, GST, Criminal, or Corporate Insolvency plugins dynamically.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-white border border-[#1A1A1A] px-3 py-1.5 font-bold">
              Core Runtime: v8.0.0 Microkernel
            </span>
          </div>
        </div>
      </div>

      {/* Plugin Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plugins.map(p => (
          <div 
            key={p.id}
            className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-amber-700 transition-colors"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider bg-[#1A1A1A] text-amber-400 px-2 py-0.5">
                  {p.category}
                </span>
                <span className="text-[10px] font-mono text-[#555555]">{p.version} • {p.author}</span>
              </div>

              <h3 className="font-serif font-bold text-base text-[#1A1A1A]">{p.name}</h3>
              <p className="text-xs text-[#555555] leading-relaxed">{p.description}</p>

              <div className="pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#555555] mb-1">Permissions Required:</p>
                <div className="flex flex-wrap gap-1">
                  {p.permissionsRequired.map((perm, idx) => (
                    <span key={idx} className="text-[9px] font-mono bg-[#F5F2EF] border border-[#1A1A1A]/30 px-1.5 py-0.5 text-[#1A1A1A]">
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1A1A1A]/20 flex items-center justify-between text-xs">
              {p.installed ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePluginState(p.id)}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#1A1A1A]"
                  >
                    {p.active ? (
                      <>
                        <ToggleRight className="w-5 h-5 text-emerald-700 fill-emerald-700" />
                        <span className="text-emerald-800 font-bold">Active</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-5 h-5 text-[#888888]" />
                        <span className="text-[#555555]">Disabled</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => installPlugin(p.id)}
                  className="px-4 py-1.5 bg-[#1A1A1A] text-amber-400 font-bold uppercase text-[10px] tracking-wider border border-[#1A1A1A] flex items-center gap-1 hover:bg-black"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Install Plugin</span>
                </button>
              )}

              <span className="text-[10px] font-mono text-[#777777]">Hot-Swappable</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
