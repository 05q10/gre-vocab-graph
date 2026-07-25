'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Panel,
  Handle,
  Position,
  NodeProps,
  Background,
  Controls,
  MarkerType,
  Node,
  Edge,
  Connection
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { MagnifyingGlassIcon, PlusIcon, XMarkIcon, CheckCircleIcon, InformationCircleIcon, SparklesIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import GraphSidebar from '../../components/GraphSidebar';
import AddWordForm from '../../components/AddWordForm';
import { Word } from '../../types/words';
import { RelationshipType, RELATIONSHIP_TYPES } from '../../types/relationship';
import Link from 'next/link';

interface GraphData {
  nodes: { id: string; data: Word }[];
  edges: { id: string; source: string; target: string; type: RelationshipType; confidence: number }[];
}

// Custom Node for better styling
const WordNode = ({ data, selected }: NodeProps) => {
  return (
    <div className={`px-4 py-2 shadow-md rounded-lg border-2 bg-surface transition-all ${selected || data.highlighted ? 'border-accent ring-4 ring-accent/20' : 'border-border'} ${data.highlighted ? 'scale-110' : ''}`}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-foreground-muted" />
      <div className="font-bold text-foreground text-center text-sm">{data.word as string}</div>
      <div className="text-[10px] text-foreground-muted text-center uppercase mt-1">{data.partOfSpeech as string}</div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-foreground-muted" />
    </div>
  );
};

const nodeTypes = {
  wordNode: WordNode,
};

const getEdgeColor = (type: string) => {
  switch (type) {
    case 'SYNONYM_OF': return 'var(--rel-synonym)';
    case 'ANTONYM_OF': return 'var(--rel-antonym)';
    case 'SIMILAR_TO': return 'var(--rel-similar)';
    case 'CONFUSED_WITH': return 'var(--rel-confused)';
    case 'RELATED_TO': return 'var(--rel-related)';
    default: return 'var(--border-strong)';
  }
};

const formatRelType = (type: string) => type.replace('_', ' ').toLowerCase();

const LEGEND_ITEMS = [
  { type: 'SYNONYM_OF', color: 'var(--rel-synonym)', desc: 'Nearly identical meaning, interchangeable' },
  { type: 'ANTONYM_OF', color: 'var(--rel-antonym)', desc: 'Opposite meaning' },
  { type: 'SIMILAR_TO', color: 'var(--rel-similar)', desc: 'Overlapping meaning, but distinct' },
  { type: 'RELATED_TO', color: 'var(--rel-related)', desc: 'Shares a broad topic or theme' },
  { type: 'CONFUSED_WITH', color: 'var(--rel-confused)', desc: 'Mistaken identity / sound-alikes' },
];

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const nodeWidth = 140;
  const nodeHeight = 60;

  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { layoutedNodes, layoutedEdges: edges };
};

function GraphInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  
  const [isNlpOpen, setIsNlpOpen] = useState(false);
  const [nlpPrompt, setNlpPrompt] = useState('');
  const [isNlpLoading, setIsNlpLoading] = useState(false);
  
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [connections, setConnections] = useState<{ word: string; type: RelationshipType }[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<{ word?: string; count?: number; message?: string } | null>(null);

  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [isCreatingEdge, setIsCreatingEdge] = useState(false);
  
  const [selectedEdge, setSelectedEdge] = useState<{ id: string, source: string, target: string, type: string, x: number, y: number } | null>(null);

  const { fitView, setCenter } = useReactFlow();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/graph');
      if (!res.ok) throw new Error('Failed to fetch graph data');
      const data: GraphData = await res.json();
      
      const initialNodes = data.nodes.map((n) => ({
        id: n.id,
        type: 'wordNode',
        data: { ...n.data, highlighted: false },
        position: { x: 0, y: 0 },
      }));

      const initialEdges = data.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: true,
        interactionWidth: 44,
        label: formatRelType(e.type),
        labelStyle: { fill: getEdgeColor(e.type), fontWeight: 700, fontSize: 10 },
        labelBgStyle: { fill: 'var(--surface)' },
        style: { stroke: getEdgeColor(e.type), strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: getEdgeColor(e.type),
        },
      }));

      const { layoutedNodes, layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);
      
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Initial fit view once nodes are loaded
  useEffect(() => {
    if (nodes.length > 0 && !loading) {
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 800 });
      }, 100);
    }
  }, [loading, fitView]); // omitting nodes.length to only run once when loaded

  // Search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, highlighted: false } })));
      return;
    }

    const query = searchQuery.toLowerCase();
    let found = false;

    setNodes((nds) =>
      nds.map((n) => {
        const isMatch = (n.data.word as string).toLowerCase().includes(query);
        if (isMatch && !found) {
          found = true;
          setCenter(n.position.x + 70, n.position.y + 30, { zoom: 1.2, duration: 800 });
        }
        return { ...n, data: { ...n.data, highlighted: isMatch } };
      })
    );
  }, [searchQuery, setNodes, setCenter]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    setSelectedEdge(null);
    setSelectedWord(node.data as Word);
    
    // Find connections
    const conns: { word: string; type: RelationshipType }[] = [];
    edges.forEach((e) => {
      if (e.source === node.id) {
        conns.push({ word: e.target, type: e.label?.toString().toUpperCase().replace(' ', '_') as RelationshipType || 'RELATED_TO' });
      } else if (e.target === node.id) {
        conns.push({ word: e.source, type: e.label?.toString().toUpperCase().replace(' ', '_') as RelationshipType || 'RELATED_TO' });
      }
    });
    setConnections(conns);
  }, [edges]);

  const handleWordAdded = useCallback(async (word: string, count: number) => {
    setIsAddModalOpen(false);
    setSuccessToast({ word, count });
    
    setTimeout(() => setSuccessToast(null), 4000);

    await fetchData();
    setSearchQuery(word);
  }, [fetchData]);

  const onNavigateToWord = useCallback((wordString: string) => {
    const targetNode = nodes.find(n => (n.data.word as string) === wordString);
    if (targetNode) {
      setSelectedWord(targetNode.data as unknown as Word);
      
      const conns: { word: string; type: RelationshipType }[] = [];
      edges.forEach((e) => {
        if (e.source === targetNode.id) {
          conns.push({ word: e.target, type: e.label?.toString().toUpperCase().replace(' ', '_') as RelationshipType || 'RELATED_TO' });
        } else if (e.target === targetNode.id) {
          conns.push({ word: e.source, type: e.label?.toString().toUpperCase().replace(' ', '_') as RelationshipType || 'RELATED_TO' });
        }
      });
      setConnections(conns);
      setCenter(targetNode.position.x + 70, targetNode.position.y + 30, { zoom: 1.2, duration: 800 });
    }
  }, [nodes, edges, setCenter]);

  const handleDeleteRelationshipFromSidebar = useCallback(async (targetWordString: string, type: string) => {
    if (!selectedWord) return;
    try {
      await fetch('/api/relationship', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceWord: selectedWord.word,
          targetWord: targetWordString,
          type
        })
      });
      
      setEdges((eds) => eds.filter(e => {
        const matchesSourceTarget = (e.source === selectedWord.word && e.target === targetWordString) || (e.target === selectedWord.word && e.source === targetWordString);
        const matchesType = (e.label?.toString().toUpperCase().replace(' ', '_') || 'RELATED_TO') === type;
        return !(matchesSourceTarget && matchesType);
      }));
      
      setConnections((prev) => prev.filter(c => !(c.word === targetWordString && c.type === type)));
      
      setSuccessToast({ message: 'Relationship deleted successfully!' });
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      console.error('Failed to delete relationship:', err);
    }
  }, [selectedWord, setEdges]);

  const handleUpdateRemarks = useCallback((wordString: string, remarks: string) => {
    setNodes(nds => nds.map(node => {
      if ((node.data.word as string) === wordString) {
        return {
          ...node,
          data: {
            ...node.data,
            remarks
          }
        };
      }
      return node;
    }));
    
    setSelectedWord(prev => {
      if (prev && prev.word === wordString) {
        return { ...prev, remarks };
      }
      return prev;
    });
  }, [setNodes]);

  const onConnect = useCallback((connection: Connection) => {
    setPendingConnection(connection);
  }, []);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.label?.toString().toUpperCase().replace(' ', '_') || 'RELATED_TO',
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const handleCreateEdge = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pendingConnection) return;
    
    const formData = new FormData(e.currentTarget);
    const type = formData.get('type') as string;
    
    setIsCreatingEdge(true);
    try {
      const res = await fetch('/api/relationship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceWord: pendingConnection.source,
          targetWord: pendingConnection.target,
          type
        })
      });

      if (!res.ok) throw new Error('Failed to create relationship');
      
      setSuccessToast({ message: 'Relationship created successfully!' });
      setTimeout(() => setSuccessToast(null), 4000);
      setPendingConnection(null);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Error creating relationship');
    } finally {
      setIsCreatingEdge(false);
    }
  };

  const onEdgesDelete = useCallback(async (deletedEdges: Edge[]) => {
    for (const edge of deletedEdges) {
      try {
        const rawType = edge.label?.toString().toUpperCase().replace(' ', '_');
        await fetch('/api/relationship', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceWord: edge.source,
            targetWord: edge.target,
            type: rawType
          })
        });
      } catch (err) {
        console.error('Failed to delete edge:', err);
      }
    }
    setSuccessToast({ message: 'Relationship deleted successfully!' });
    setTimeout(() => setSuccessToast(null), 4000);
  }, []);

  const handleDeleteSelectedEdge = async () => {
    if (!selectedEdge) return;
    try {
      await fetch('/api/relationship', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceWord: selectedEdge.source,
          targetWord: selectedEdge.target,
          type: selectedEdge.type
        })
      });
      setEdges((eds) => eds.filter(e => e.id !== selectedEdge.id));
      setSuccessToast({ message: 'Relationship deleted successfully!' });
      setTimeout(() => setSuccessToast(null), 4000);
      setSelectedEdge(null);
    } catch (err) {
      console.error('Failed to delete edge:', err);
    }
  };

  const handleDeleteWord = async (wordToDelete: string) => {
    try {
      const res = await fetch('/api/word', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: wordToDelete })
      });
      if (res.ok) {
        setSuccessToast({ message: `Successfully deleted "${wordToDelete}".` });
        setTimeout(() => setSuccessToast(null), 4000);
        setSelectedWord(null);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete word');
      }
    } catch (e) {
      console.error(e);
      alert('Network error deleting word');
    }
  };

  const handleNlpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlpPrompt.trim()) return;
    setIsNlpLoading(true);
    try {
      const res = await fetch('/api/nlp', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: nlpPrompt }) 
      });
      const data = await res.json();
      
      if (!data.success) {
        setSuccessToast({ message: data.message || 'Failed to process command.' });
        setTimeout(() => setSuccessToast(null), 4000);
      } else if (data.type === 'COMMAND') {
        setSuccessToast({ message: data.message });
        setTimeout(() => setSuccessToast(null), 6000);
        await fetchData();
        setIsNlpOpen(false);
        setNlpPrompt('');
      } else if (data.type === 'QUERY') {
        setSuccessToast({ message: data.message });
        setTimeout(() => setSuccessToast(null), 4000);
        const queryWords = new Set((data.results || []).map((w: string) => w.toLowerCase()));
        
        setNodes((nds) => {
          let found = false;
          return nds.map((n) => {
            const isMatch = queryWords.has((n.data.word as string).toLowerCase());
            if (isMatch && !found) {
              found = true;
              setCenter(n.position.x + 70, n.position.y + 30, { zoom: 1.2, duration: 800 });
            }
            return { ...n, data: { ...n.data, highlighted: isMatch } };
          });
        });
        
        setIsNlpOpen(false);
        setNlpPrompt('');
      }
    } catch (err) {
      setSuccessToast({ message: 'Network error connecting to NLP service.' });
      setTimeout(() => setSuccessToast(null), 4000);
    } finally {
      setIsNlpLoading(false);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
    </div>;
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-antonym">{error}</div>;
  }

  if (nodes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold text-foreground mb-2">No words added yet</h2>
        <p className="text-foreground-muted mb-6">Add your first word to get started with the knowledge graph.</p>
        <Link href="/" className="bg-accent hover:bg-accent/90 text-accent-foreground px-6 py-3 rounded-xl font-medium transition-colors">
          Go to Home
        </Link>
      </div>
    );
  }

  const renderedNodes = useMemo(() => {
    if (!selectedWord) {
      return nodes.map(n => ({
        ...n,
        style: { ...n.style, opacity: 1, transition: 'opacity 0.3s ease' }
      }));
    }
    const connectedWords = new Set(connections.map(c => c.word));
    connectedWords.add(selectedWord.word);
    
    return nodes.map(n => {
      const isConnected = connectedWords.has(n.data.word as string);
      return {
        ...n,
        style: { ...n.style, opacity: isConnected ? 1 : 0.15, transition: 'opacity 0.3s ease' },
      };
    });
  }, [nodes, selectedWord, connections]);

  const renderedEdges = useMemo(() => {
    if (!selectedWord) {
      return edges.map(e => ({
        ...e,
        style: { ...e.style, opacity: 1, transition: 'opacity 0.3s ease' },
        labelStyle: { ...e.labelStyle, opacity: 1, fill: getEdgeColor(e.type || 'SYNONYM_OF') },
        animated: true,
      }));
    }
    
    const selectedNodeId = nodes.find(n => (n.data.word as string) === selectedWord.word)?.id;
    
    return edges.map(e => {
      const isConnected = e.source === selectedNodeId || e.target === selectedNodeId;
      return {
        ...e,
        style: { ...e.style, opacity: isConnected ? 1 : 0.05, transition: 'opacity 0.3s ease' },
        labelStyle: { ...e.labelStyle, opacity: isConnected ? 1 : 0.05, fill: getEdgeColor(e.type || 'SYNONYM_OF') },
        animated: isConnected,
      };
    });
  }, [edges, selectedWord, nodes]);

  return (
    <div style={{ width: '100%', height: '100%' }} className="relative bg-background overflow-hidden">
      <ReactFlow
        nodes={renderedNodes}
        edges={renderedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={() => setSelectedEdge(null)}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--border-strong)" gap={16} />
        <Controls className="!bg-surface-elevated !border-border !fill-foreground" />
        
        <Panel position="top-center" className="bg-surface-elevated p-3 rounded-xl shadow-md border border-border w-[calc(100vw-2rem)] sm:w-80 max-w-sm m-4 z-10">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-4 w-4 text-foreground-muted" />
            </div>
            <input
              type="text"
              placeholder="Search words..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surface text-sm border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-shadow"
            />
          </div>
        </Panel>

        {/* Legend Button and Panel are rendered outside ReactFlow to allow standard absolute positioning */}
      </ReactFlow>

      {/* Legend Toggle Button */}
      <button 
        onClick={() => setIsLegendOpen(true)}
        className={`absolute bottom-[100px] left-6 z-20 p-3 bg-surface-elevated border border-border shadow-md rounded-full text-foreground hover:text-accent transition-transform duration-300 ${isLegendOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
        aria-label="Open Legend"
      >
        <InformationCircleIcon className="w-6 h-6" />
      </button>

      {/* Sliding Legend Panel */}
      <div 
        className={`absolute bottom-6 left-6 z-30 bg-surface-elevated p-4 rounded-xl shadow-xl border border-border w-64 md:w-72 transition-transform duration-300 ease-in-out ${isLegendOpen ? 'translate-x-0 opacity-100' : '-translate-x-[150%] opacity-0 pointer-events-none'}`}
      >
        <button 
          onClick={() => setIsLegendOpen(false)} 
          className="absolute top-3 right-3 text-foreground-muted hover:text-foreground transition-colors"
          aria-label="Close Legend"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
        <h3 className="text-sm font-bold text-foreground mb-4">Relationship Guide</h3>
        <div className="space-y-3">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.type} className="flex items-start gap-3">
              <div className="w-3.5 h-3.5 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: item.color }} />
              <div>
                <div className="text-[11px] font-bold text-foreground leading-none mb-1">{item.type.replace('_', ' ')}</div>
                <div className="text-[10px] text-foreground-muted leading-snug">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <GraphSidebar 
        word={selectedWord} 
        connections={connections} 
        onClose={() => setSelectedWord(null)} 
        onNavigateToWord={onNavigateToWord}
        onDeleteRelationship={handleDeleteRelationshipFromSidebar}
        onUpdateRemarks={handleUpdateRemarks}
        onDeleteWord={handleDeleteWord}
      />

      {/* Floating Action Button (Add Word) */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className={`absolute bottom-6 z-[45] p-4 bg-accent hover:bg-accent/90 text-accent-foreground rounded-full shadow-lg transition-all duration-300 hover:scale-105 ${
          selectedWord ? 'right-6 sm:right-[344px] md:right-[408px]' : 'right-6'
        }`}
        aria-label="Add Word"
      >
        <PlusIcon className="w-6 h-6" />
      </button>

      {/* Floating Action Button (Ask AI) */}
      <button
        onClick={() => setIsNlpOpen(true)}
        className={`absolute bottom-24 z-[45] p-4 bg-surface-elevated hover:bg-surface border border-accent/30 text-accent rounded-full shadow-lg transition-all duration-300 hover:scale-105 ${
          selectedWord ? 'right-6 sm:right-[344px] md:right-[408px]' : 'right-6'
        }`}
        aria-label="Ask AI"
      >
        <SparklesIcon className="w-6 h-6" />
      </button>

      {/* NLP Prompt Modal */}
      {isNlpOpen && (
        <div className="absolute inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-surface-elevated rounded-2xl shadow-2xl border border-accent/30 p-6 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsNlpOpen(false)}
              className="absolute top-4 right-4 p-2 text-foreground-muted hover:text-foreground transition-colors"
              aria-label="Close NLP prompt"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <SparklesIcon className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-foreground">Ask AI or Command Graph</h2>
            </div>
            <form onSubmit={handleNlpSubmit}>
              <div className="relative">
                <textarea
                  value={nlpPrompt}
                  onChange={(e) => setNlpPrompt(e.target.value)}
                  placeholder="e.g. 'daunting is a synonym of intimidating' or 'words that mean elated'"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 pr-12 text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none h-24"
                  disabled={isNlpLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleNlpSubmit(e);
                    }
                  }}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isNlpLoading || !nlpPrompt.trim()}
                  className="absolute bottom-3 right-3 p-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:hover:bg-accent transition-colors"
                >
                  {isNlpLoading ? (
                    <div className="w-5 h-5 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <PaperAirplaneIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </form>
            <p className="text-xs text-foreground-muted mt-3">
              {isNlpLoading ? 'Processing your request... (ingesting new words may take a moment)' : 'Press Enter to submit. You can create edges or search the graph using plain English.'}
            </p>
          </div>
        </div>
      )}

      {/* Add Word Modal */}
      {isAddModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl">
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="absolute -top-12 right-0 p-2 text-foreground-muted hover:text-foreground bg-surface rounded-full shadow border border-border"
              aria-label="Close modal"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
            <AddWordForm onSuccessCallback={handleWordAdded} />
          </div>
        </div>
      )}

      {/* Success Toast */}
      {successToast && (
        <div className="absolute top-6 right-6 z-50 flex items-center space-x-3 p-4 rounded-xl bg-surface-elevated border-l-4 border-l-synonym shadow-lg animate-in fade-in slide-in-from-top-4">
          <CheckCircleIcon className="h-6 w-6 text-synonym flex-shrink-0" />
          <div className="text-sm">
            {successToast.word ? (
              <>
                <span className="font-bold text-foreground block">{successToast.word} added!</span>
                <span className="text-foreground-muted">{successToast.count} relationships mapped.</span>
              </>
            ) : (
              <span className="font-bold text-foreground block">{successToast.message}</span>
            )}
          </div>
        </div>
      )}

      {/* Add Edge Modal */}
      {pendingConnection && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-surface-elevated rounded-2xl shadow-xl border border-border p-6">
            <button 
              onClick={() => setPendingConnection(null)}
              className="absolute top-4 right-4 p-2 text-foreground-muted hover:text-foreground bg-surface rounded-full shadow border border-border"
              aria-label="Cancel"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-foreground mb-4">Create Relationship</h2>
            <p className="text-sm text-foreground-muted mb-6">
              Connect <strong>{pendingConnection.source}</strong> to <strong>{pendingConnection.target}</strong>
            </p>
            <form onSubmit={handleCreateEdge} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="type" className="block text-sm font-medium text-foreground">
                  Relationship Type
                </label>
                <select
                  name="type"
                  id="type"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-accent appearance-none"
                >
                  <option value="">Select type...</option>
                  {RELATIONSHIP_TYPES.map(t => (
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={isCreatingEdge}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-70"
              >
                {isCreatingEdge ? 'Creating...' : 'Create Edge'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edge Context Menu */}
      {selectedEdge && (
        <div 
          className="fixed z-50 bg-surface-elevated border border-border rounded-lg shadow-xl overflow-hidden min-w-[120px]"
          style={{ top: selectedEdge.y - 10, left: selectedEdge.x + 10 }}
        >
          <div className="px-3 py-2 text-xs font-semibold text-foreground-muted uppercase tracking-wider bg-surface border-b border-border">
            Relationship
          </div>
          <button
            onClick={handleDeleteSelectedEdge}
            className="w-full text-left px-4 py-3 text-sm text-antonym hover:bg-surface font-medium transition-colors flex items-center gap-2"
          >
            <XMarkIcon className="w-4 h-4" />
            Delete Edge
          </button>
        </div>
      )}
    </div>
  );
}

export default function GraphPage() {
  return (
    <div style={{ width: '100vw', height: 'calc(100dvh - 64px)' }} className="relative">
      <ReactFlowProvider>
        <GraphInner />
      </ReactFlowProvider>
    </div>
  );
}
