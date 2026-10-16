import React, { useState } from 'react';
import { apiPost } from '../lib/api';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  Scale, 
  User, 
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import { AgentRole, CaseFile } from '../types';
import { ADVOCATE_AGENTS } from '../data/agents';
import { useTranslation, SUPPORTED_LANGUAGES } from '../lib/multilingualEngine';

interface AgentChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeAgent: AgentRole;
  setActiveAgent: (agent: AgentRole) => void;
  selectedCase: CaseFile;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
}

export const AgentChatDrawer: React.FC<AgentChatDrawerProps> = ({
  isOpen,
  onClose,
  activeAgent,
  setActiveAgent,
  selectedCase
}) => {
  if (!isOpen) return null;

  const { prefs } = useTranslation();
  const currentLangMeta = SUPPORTED_LANGUAGES.find(l => l.code === prefs.aiConversationLanguage) || SUPPORTED_LANGUAGES[0];
  const currentAgent = ADVOCATE_AGENTS.find(a => a.id === activeAgent) || ADVOCATE_AGENTS[0];

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'agent',
      text: `Greetings Advocate! I am your **${currentAgent.name}** for Case: *${selectedCase.title}*. How can I assist with legal research, drafting, evidence analysis, or court preparation today?`
    }
  ]);
  const [inputMsg, setInputMsg] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const handleSend = async () => {
    if (!inputMsg.trim()) return;

    const userText = inputMsg;
    setInputMsg('');
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, sender: 'user', text: userText };
    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      const data = await apiPost<{ reply: string }>('/api/ai/agent-chat', {
        agentRole: currentAgent.name,
        message: userText,
        caseContext: `${selectedCase.title} (${selectedCase.caseType})`,
        language: prefs.aiConversationLanguage
      });
      const agentMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: 'agent',
        text: data.reply || 'Analysis completed.'
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      console.error('Agent chat error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1A1A1A]/70 backdrop-blur-xs z-50 flex justify-end">
      <div className="w-full max-w-lg bg-[#FDFCFB] h-full border-l-2 border-[#1A1A1A] shadow-2xl flex flex-col justify-between text-[#1A1A1A]">
        
        {/* Header */}
        <div className="p-4 bg-[#1A1A1A] text-white border-b border-[#1A1A1A] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#B45309] text-white flex items-center justify-center font-bold">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif italic font-bold text-sm">{currentAgent.name}</span>
                <span className="text-[9px] font-mono bg-white/20 text-white px-1.5 py-0.5 uppercase tracking-widest">
                  AI Counsel
                </span>
                <span className="text-[9px] font-mono bg-amber-500 text-black px-1.5 py-0.5 font-bold uppercase flex items-center gap-1" title={`Responding in ${currentLangMeta.name}`}>
                  <span>{currentLangMeta.flag}</span>
                  <span>{currentLangMeta.code}</span>
                </span>
              </div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                Case: {selectedCase.title}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Agent Switcher Bar */}
        <div className="p-2 bg-[#F5F2EF] border-b border-[#1A1A1A] flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
          {ADVOCATE_AGENTS.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setActiveAgent(agent.id)}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${
                activeAgent === agent.id
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                  : 'bg-[#FDFCFB] text-[#1A1A1A] border-[#1A1A1A]/20 hover:border-[#1A1A1A]'
              }`}
            >
              {agent.title.split(' ')[0]} {agent.name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Chat Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 max-w-md ${m.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              <div className={`w-7 h-7 flex items-center justify-center shrink-0 border ${
                m.sender === 'user' ? 'bg-[#1A1A1A] text-amber-400 border-[#1A1A1A]' : 'bg-[#F5F2EF] text-[#B45309] border-[#1A1A1A]'
              }`}>
                {m.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div className={`p-3.5 text-xs space-y-1 border ${
                m.sender === 'user'
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] font-medium'
                  : 'bg-[#F9F7F5] text-[#1A1A1A] border-[#1A1A1A] whitespace-pre-wrap leading-relaxed'
              }`}>
                {m.text}
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className="flex gap-2 items-center text-xs text-[#B45309] font-serif italic p-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{currentAgent.name} is drafting opinion...</span>
            </div>
          )}
        </div>

        {/* Input Footer */}
        <div className="p-3 bg-[#F5F2EF] border-t border-[#1A1A1A] flex items-center gap-2">
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Ask ${currentAgent.name}...`}
            className="flex-1 p-2.5 bg-[#FDFCFB] border border-[#1A1A1A] text-[#1A1A1A] text-xs focus:outline-none focus:ring-1 focus:ring-[#B45309]"
          />
          <button
            onClick={handleSend}
            disabled={!inputMsg.trim() || isGenerating}
            className="p-2.5 bg-[#1A1A1A] hover:bg-black text-amber-400 font-bold transition-all disabled:opacity-50 border border-[#1A1A1A]"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
