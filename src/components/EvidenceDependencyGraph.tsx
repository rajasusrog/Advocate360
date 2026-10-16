import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { 
  Network, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Link2, 
  Layers, 
  Sparkles,
  Info,
  Maximize2
} from 'lucide-react';
import { EvidenceItem } from '../types';

export interface EvidenceNode extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  type: 'Document' | 'Digital' | 'Statutory' | 'Opponent' | 'Witness';
  status: 'Verified' | 'Unverified' | 'Contradicted' | 'Missing';
  strengthScore: number;
  date: string;
  proves: string;
  cannotProve: string;
  sourceDoc?: string;
}

export interface EvidenceLink extends d3.SimulationLinkDatum<EvidenceNode> {
  source: string | EvidenceNode;
  target: string | EvidenceNode;
  relation: 'corroborates' | 'contradicts' | 'depends_on' | 'supersedes';
  label: string;
  severity?: 'High' | 'Medium' | 'Low';
  explanation: string;
}

interface EvidenceDependencyGraphProps {
  evidenceItems?: EvidenceItem[];
  caseTitle?: string;
  caseNumber?: string;
}

const INITIAL_NODES: EvidenceNode[] = [
  {
    id: 'n-title-deed',
    title: '1995 Parent Title Deed (Doc 1204/1995)',
    type: 'Document',
    status: 'Verified',
    strengthScore: 95,
    date: '1995-04-12',
    proves: 'Absolute undivided ownership of father K. Ramachandran in Mylapore plot.',
    cannotProve: 'Does not prove who is in actual physical possession in 2026.'
  },
  {
    id: 'n-tax-receipts',
    title: 'Municipal Property Tax Receipts (2020-2026)',
    type: 'Document',
    status: 'Verified',
    strengthScore: 88,
    date: '2026-05-10',
    proves: 'Client Ramesh continuous revenue payment and possession claim.',
    cannotProve: 'Tax assessment does not confer title ownership alone.'
  },
  {
    id: 'n-whatsapp',
    title: 'WhatsApp Admission Transcript',
    type: 'Digital',
    status: 'Unverified',
    strengthScore: 70,
    date: '2026-05-22',
    proves: 'Suresh acknowledged Ramesh holds 50% undivided interest.',
    cannotProve: 'Currently lacks Section 65B Indian Evidence Act Certificate.'
  },
  {
    id: 'n-sec65b',
    title: 'Section 65B Electronic Evidence Affidavit',
    type: 'Statutory',
    status: 'Missing',
    strengthScore: 20,
    date: 'Pending',
    proves: 'Statutory legal admissibility of WhatsApp chat under Sec 65B / BSA.',
    cannotProve: 'Affidavit alone without device hash audit can be challenged.'
  },
  {
    id: 'n-impugned-sale',
    title: 'Impugned Sale Deed 4012/2026 (Suresh to Builder)',
    type: 'Opponent',
    status: 'Contradicted',
    strengthScore: 35,
    date: '2026-06-14',
    proves: 'Suresh attempted unlawful alienation for ₹1.2 Crores.',
    cannotProve: 'Cannot prove valid title transfer since co-heir Ramesh did not join.'
  },
  {
    id: 'n-partition-deed',
    title: 'Unregistered Partition Deed (March 2021)',
    type: 'Document',
    status: 'Contradicted',
    strengthScore: 40,
    date: '2021-03-05',
    proves: 'Partition was attempted on ₹100 stamp paper but never registered.',
    cannotProve: 'Inadmissible to prove division of immovable property > ₹100 (Sec 49 Reg Act).'
  },
  {
    id: 'n-possession-photos',
    title: 'Site Photos & Tenant EB Electricity Meter',
    type: 'Document',
    status: 'Verified',
    strengthScore: 85,
    date: '2026-07-01',
    proves: 'Ramesh tenant in continuous occupation of ground floor dwelling.',
    cannotProve: 'Does not define legal metes and bounds boundary demarcation.'
  },
  {
    id: 'n-builder-affidavit',
    title: 'Builder Vacant Possession Affidavit',
    type: 'Opponent',
    status: 'Contradicted',
    strengthScore: 30,
    date: '2026-06-20',
    proves: 'Builder claim of receiving vacant handover on 15 June 2026.',
    cannotProve: 'False assertion contradicted by physical tenant electricity bills.'
  },
  {
    id: 'n-fmb-sketch',
    title: 'Tahsildar Certified FMB Survey Sketch',
    type: 'Statutory',
    status: 'Missing',
    strengthScore: 15,
    date: 'Pending',
    proves: 'Exact boundary coordinates and survey sub-division 402/1A.',
    cannotProve: 'Historical possession rights.'
  }
];

const INITIAL_LINKS: EvidenceLink[] = [
  {
    source: 'n-title-deed',
    target: 'n-tax-receipts',
    relation: 'corroborates',
    label: 'Chain of Title',
    explanation: 'Parent deed anchors subsequent municipal tax registry mutations.'
  },
  {
    source: 'n-tax-receipts',
    target: 'n-possession-photos',
    relation: 'corroborates',
    label: 'Possession Nexus',
    explanation: 'Municipal receipts corroborate electricity meter and tenant physical residency.'
  },
  {
    source: 'n-whatsapp',
    target: 'n-sec65b',
    relation: 'depends_on',
    label: 'Mandatory Prerequisite',
    severity: 'High',
    explanation: 'WhatsApp admission requires Sec 65B affidavit to be marked as an exhibit.'
  },
  {
    source: 'n-impugned-sale',
    target: 'n-partition-deed',
    relation: 'contradicts',
    label: 'Oral vs Written Conflict',
    severity: 'High',
    explanation: 'Sale Deed claims oral partition in Aug 2020, but 2021 deed proves written attempt in 2021.'
  },
  {
    source: 'n-possession-photos',
    target: 'n-builder-affidavit',
    relation: 'contradicts',
    label: 'Physical Possession Discrepancy',
    severity: 'High',
    explanation: 'Tenant EB bills directly refute builder sworn affidavit of vacant possession.'
  },
  {
    source: 'n-whatsapp',
    target: 'n-impugned-sale',
    relation: 'contradicts',
    label: 'Pre-Sale Admission Conflict',
    severity: 'Medium',
    explanation: 'Suresh admitted Ramesh 50% right just 3 weeks before selling 100% to builder.'
  },
  {
    source: 'n-title-deed',
    target: 'n-impugned-sale',
    relation: 'supersedes',
    label: 'Nemo Dat Quod Non Habet',
    explanation: 'Undivided ancestral title limits vendor right to convey entire parcel.'
  },
  {
    source: 'n-fmb-sketch',
    target: 'n-title-deed',
    relation: 'depends_on',
    label: 'Survey Grounding',
    explanation: 'Certified revenue sketch needed to corroborate schedule of parent deed.'
  }
];

export const EvidenceDependencyGraph: React.FC<EvidenceDependencyGraphProps> = ({
  caseTitle = 'Ramesh Kumar vs. Suresh Kumar & Ors.',
  caseNumber = 'O.S. 402/2024'
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<EvidenceNode | null>(INITIAL_NODES[0]);
  const [selectedRelationFilter, setSelectedRelationFilter] = useState<'all' | 'contradictions' | 'dependencies' | 'corroborations'>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Filtered links and connected nodes
  const { filteredNodes, filteredLinks } = useMemo(() => {
    let links = INITIAL_LINKS;
    if (selectedRelationFilter === 'contradictions') {
      links = INITIAL_LINKS.filter(l => l.relation === 'contradicts');
    } else if (selectedRelationFilter === 'dependencies') {
      links = INITIAL_LINKS.filter(l => l.relation === 'depends_on');
    } else if (selectedRelationFilter === 'corroborations') {
      links = INITIAL_LINKS.filter(l => l.relation === 'corroborates' || l.relation === 'supersedes');
    }

    const connectedNodeIds = new Set<string>();
    links.forEach(l => {
      connectedNodeIds.add(typeof l.source === 'object' ? (l.source as any).id : l.source);
      connectedNodeIds.add(typeof l.target === 'object' ? (l.target as any).id : l.target);
    });

    const nodes = selectedRelationFilter === 'all' 
      ? INITIAL_NODES 
      : INITIAL_NODES.filter(n => connectedNodeIds.has(n.id));

    return { filteredNodes: nodes, filteredLinks: links };
  }, [selectedRelationFilter]);

  // Recharts metric calculations
  const chartData = useMemo(() => {
    const relationCounts = {
      Corroborates: INITIAL_LINKS.filter(l => l.relation === 'corroborates').length,
      Contradicts: INITIAL_LINKS.filter(l => l.relation === 'contradicts').length,
      'Depends On': INITIAL_LINKS.filter(l => l.relation === 'depends_on').length,
      Supersedes: INITIAL_LINKS.filter(l => l.relation === 'supersedes').length
    };

    return Object.entries(relationCounts).map(([name, count]) => ({
      name,
      count
    }));
  }, []);

  // Node color mapping
  const getNodeColor = (status: EvidenceNode['status']) => {
    switch (status) {
      case 'Verified':
        return '#047857'; // emerald-700
      case 'Contradicted':
        return '#B91C1C'; // red-700
      case 'Missing':
        return '#B45309'; // amber-700
      case 'Unverified':
      default:
        return '#4B5563'; // gray-600
    }
  };

  const getLinkColor = (relation: EvidenceLink['relation']) => {
    switch (relation) {
      case 'contradicts':
        return '#DC2626'; // red-600
      case 'depends_on':
        return '#D97706'; // amber-600
      case 'corroborates':
        return '#059669'; // emerald-600
      case 'supersedes':
        return '#2563EB'; // blue-600
      default:
        return '#9CA3AF';
    }
  };

  // D3 Force Simulation Effect
  useEffect(() => {
    if (!svgRef.current) return;

    const width = 800;
    const height = 520;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Setup arrow markers for directed links
    const defs = svg.append('defs');

    ['corroborates', 'contradicts', 'depends_on', 'supersedes'].forEach(rel => {
      defs.append('marker')
        .attr('id', `arrow-${rel}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 28) // position at circle radius
        .attr('refY', 0)
        .attr('markerWidth', 7)
        .attr('markerHeight', 7)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', getLinkColor(rel as any));
    });

    // Container for zoom/pan
    const container = svg.append('g').attr('class', 'graph-container');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 2.5])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
        setZoomLevel(Math.round(event.transform.k * 100) / 100);
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    // Clone data for simulation
    const nodesData = filteredNodes.map(d => ({ ...d }));
    const linksData = filteredLinks.map(d => ({ ...d }));

    const simulation = d3.forceSimulation<EvidenceNode>(nodesData)
      .force('link', d3.forceLink<EvidenceNode, EvidenceLink>(linksData).id(d => d.id).distance(140))
      .force('charge', d3.forceManyBody().strength(-480))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(45));

    // Links group
    const linkGroup = container.append('g').attr('class', 'links');

    const link = linkGroup.selectAll<SVGLineElement, EvidenceLink>('line')
      .data(linksData)
      .enter()
      .append('line')
      .attr('stroke', (d: EvidenceLink) => getLinkColor(d.relation))
      .attr('stroke-width', (d: EvidenceLink) => d.relation === 'contradicts' ? 2.5 : 2)
      .attr('stroke-dasharray', (d: EvidenceLink) => d.relation === 'contradicts' ? '5,4' : d.relation === 'depends_on' ? '3,3' : 'none')
      .attr('marker-end', (d: EvidenceLink) => `url(#arrow-${d.relation})`)
      .attr('opacity', 0.85);

    // Link label badges
    const linkLabels = linkGroup.selectAll<SVGTextElement, EvidenceLink>('.link-label')
      .data(linksData)
      .enter()
      .append('text')
      .attr('class', 'link-label')
      .attr('font-size', '9px')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('font-weight', 'bold')
      .attr('fill', (d: EvidenceLink) => getLinkColor(d.relation))
      .attr('text-anchor', 'middle')
      .text((d: EvidenceLink) => d.label);

    // Nodes group
    const nodeGroup = container.append('g').attr('class', 'nodes');

    const drag = d3.drag<SVGGElement, EvidenceNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    const node = nodeGroup.selectAll<SVGGElement, EvidenceNode>('.node')
      .data(nodesData)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('cursor', 'pointer')
      .call(drag as any)
      .on('click', (_, d: EvidenceNode) => {
        const originalNode = INITIAL_NODES.find(n => n.id === d.id);
        if (originalNode) setSelectedNode(originalNode);
      });

    // Outer ring for selected node
    node.append('circle')
      .attr('r', 24)
      .attr('fill', (d: EvidenceNode) => getNodeColor(d.status))
      .attr('stroke', '#1A1A1A')
      .attr('stroke-width', 2.5)
      .attr('opacity', 0.95);

    // Center icon/letter
    node.append('text')
      .attr('dy', 4)
      .attr('text-anchor', 'middle')
      .attr('fill', '#FFFFFF')
      .attr('font-size', '10px')
      .attr('font-weight', 'black')
      .attr('font-family', 'ui-monospace, monospace')
      .text((d: EvidenceNode) => {
        if (d.type === 'Document') return 'DOC';
        if (d.type === 'Digital') return 'DIG';
        if (d.type === 'Statutory') return 'ACT';
        if (d.type === 'Opponent') return 'OPP';
        return 'EV';
      });

    // Node label under circle
    node.append('text')
      .attr('dy', 38)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-family', 'serif')
      .attr('font-weight', 'bold')
      .attr('fill', '#1A1A1A')
      .text((d: EvidenceNode) => d.title.length > 20 ? d.title.substring(0, 18) + '...' : d.title);

    // Simulation tick handler
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabels
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2 - 4);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [filteredNodes, filteredLinks]);

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    if (direction === 'in') {
      svg.transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.25);
    } else if (direction === 'out') {
      svg.transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.8);
    } else {
      svg.transition().duration(250).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    }
  };

  return (
    <div className="bg-[#FDFCFB] border-2 border-[#1A1A1A] p-5 space-y-5 shadow-xs text-[#1A1A1A]">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-[#1A1A1A] pb-4">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1A1A1A] text-amber-400 px-2.5 py-0.5 mb-1">
            <Network className="w-3.5 h-3.5 text-amber-400" />
            <span>Interactive Node-Link Dependency Graph</span>
          </div>
          <h2 className="font-serif text-2xl font-bold italic text-[#1A1A1A]">
            Evidence Interdependency & Contradiction Topology
          </h2>
          <p className="text-xs text-[#555555]">
            D3 Force-Directed Network mapping corroboration chains, statutory prerequisites, and contradictory opposing filings for {caseNumber}.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono font-bold">
          <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-600 text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-700" />
            Corroborates
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 bg-red-50 border border-red-600 text-red-800">
            <span className="w-2 h-2 rounded-full bg-red-700" />
            Contradicts (Conflict)
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-600 text-amber-800">
            <span className="w-2 h-2 rounded-full bg-amber-700" />
            Depends On (Missing Link)
          </span>
        </div>
      </div>

      {/* Control Strip & Filter Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F5F2EF] p-2.5 border border-[#1A1A1A]">
        {/* Filter Selection */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-[#B45309]" />
            <span>Filter Links:</span>
          </span>
          
          {(['all', 'contradictions', 'dependencies', 'corroborations'] as const).map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setSelectedRelationFilter(filterKey)}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                selectedRelationFilter === filterKey
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-slate-500'
              }`}
            >
              {filterKey === 'all' && `All Links (${INITIAL_LINKS.length})`}
              {filterKey === 'contradictions' && `Contradictions (${INITIAL_LINKS.filter(l => l.relation === 'contradicts').length})`}
              {filterKey === 'dependencies' && `Prerequisites (${INITIAL_LINKS.filter(l => l.relation === 'depends_on').length})`}
              {filterKey === 'corroborations' && `Corroborations (${INITIAL_LINKS.filter(l => l.relation === 'corroborates' || l.relation === 'supersedes').length})`}
            </button>
          ))}
        </div>

        {/* Zoom & Canvas Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => handleZoom('in')}
            className="p-1.5 bg-white border border-[#1A1A1A] hover:bg-slate-100"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5 text-[#1A1A1A]" />
          </button>
          <button
            onClick={() => handleZoom('out')}
            className="p-1.5 bg-white border border-[#1A1A1A] hover:bg-slate-100"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5 text-[#1A1A1A]" />
          </button>
          <button
            onClick={() => handleZoom('reset')}
            className="p-1.5 bg-white border border-[#1A1A1A] hover:bg-slate-100"
            title="Reset Graph Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#1A1A1A]" />
          </button>
          <span className="font-mono text-[10px] text-slate-600 px-1 font-bold">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>
      </div>

      {/* Main Diagram Area: D3 SVG + Node Inspector Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* D3 SVG Canvas */}
        <div className="lg:col-span-2 bg-[#F9F7F5] border-2 border-[#1A1A1A] relative min-h-[520px] overflow-hidden flex items-center justify-center">
          <svg
            ref={svgRef}
            viewBox="0 0 800 520"
            className="w-full h-full select-none"
            style={{ minHeight: '520px' }}
          />

          <div className="absolute bottom-2 left-2 bg-[#1A1A1A]/90 text-amber-300 px-2 py-1 text-[9px] font-mono border border-slate-700 pointer-events-none">
            Drag nodes to re-organize • Click node to inspect details
          </div>
        </div>

        {/* Right Inspector & Recharts Summary */}
        <div className="space-y-4 flex flex-col justify-between">
          
          {/* Selected Node Details Card */}
          {selectedNode ? (
            <div className="p-4 bg-[#F5F2EF] border-2 border-[#1A1A1A] space-y-3">
              <div className="flex items-start justify-between gap-2 border-b border-[#1A1A1A] pb-2">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.2 border ${
                      selectedNode.status === 'Verified'
                        ? 'bg-emerald-700 text-white border-emerald-800'
                        : selectedNode.status === 'Contradicted'
                        ? 'bg-rose-700 text-white border-rose-800'
                        : selectedNode.status === 'Missing'
                        ? 'bg-amber-700 text-white border-amber-800'
                        : 'bg-slate-700 text-white border-slate-800'
                    }`}>
                      {selectedNode.status}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600 font-bold">
                      {selectedNode.type}
                    </span>
                  </div>
                  <h3 className="font-serif font-bold italic text-base text-[#1A1A1A]">
                    {selectedNode.title}
                  </h3>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Admissibility</span>
                  <span className="font-serif font-bold text-lg text-[#1A1A1A]">{selectedNode.strengthScore}%</span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2 bg-emerald-50/70 border border-emerald-200">
                  <strong className="text-emerald-800 uppercase text-[9px] tracking-wider block font-bold mb-0.5">
                    ✔ What this proves:
                  </strong>
                  <p className="font-serif italic text-slate-800">{selectedNode.proves}</p>
                </div>

                <div className="p-2 bg-rose-50/70 border border-rose-200">
                  <strong className="text-rose-800 uppercase text-[9px] tracking-wider block font-bold mb-0.5">
                    ❌ Evidentiary Limitation:
                  </strong>
                  <p className="font-serif italic text-slate-800">{selectedNode.cannotProve}</p>
                </div>
              </div>

              {/* Connected Links Summary */}
              <div className="pt-2 border-t border-slate-300">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600 block mb-1.5">
                  Interdependent Relationships:
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {INITIAL_LINKS.filter(l => l.source === selectedNode.id || l.target === selectedNode.id).map((link, idx) => (
                    <div key={idx} className="p-1.5 bg-white border border-slate-300 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1A1A1A]">{link.label}</span>
                        <span className="text-[9px] font-mono uppercase font-bold text-[#B45309]">{link.relation}</span>
                      </div>
                      <p className="text-[10px] text-slate-600 font-serif italic">{link.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-[#F5F2EF] border-2 border-[#1A1A1A] text-center text-slate-500 italic text-xs">
              Click any node in the diagram to inspect evidentiary parameters.
            </div>
          )}

          {/* Recharts Bar Chart: Evidentiary Dependency Distribution */}
          <div className="p-3 bg-[#F5F2EF] border-2 border-[#1A1A1A] space-y-2">
            <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-1.5">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#1A1A1A] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#B45309]" />
                <span>Dependency Link Distribution</span>
              </span>
              <span className="text-[9px] font-mono text-slate-500 font-bold">{INITIAL_LINKS.length} Total Links</span>
            </div>

            <div className="h-28 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'serif' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#B45309', color: '#fff', fontSize: '11px' }}
                    itemStyle={{ color: '#FBBF24' }}
                  />
                  <Bar dataKey="count" fill="#1A1A1A">
                    {chartData.map((entry, index) => {
                      const colors = ['#059669', '#DC2626', '#D97706', '#2563EB'];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
