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
import { MagnifyingGlassIcon, PlusIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
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
    case 'ROOT_RELATED': return 'var(--rel-root)';
    case 'DERIVED_FROM': return 'var(--rel-derived)';
    case 'RELATED_TO': return 'var(--rel-related)';
    default: return 'var(--border-strong)';
  }
};

const formatRelType = (type: string) => type.replace('_', ' ').toLowerCase();

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
  
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [connections, setConnections] = useState<{ word: string; type: RelationshipType }[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<{ word?: string; count?: number; message?: string } | null>(null);

  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [isCreatingEdge, setIsCreatingEdge] = useState(false);

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
        interactionWidth: 25,
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
    
    // Clear toast after 4s
    setTimeout(() => setSuccessToast(null), 4000);

    // Refetch the graph data to include the new node and edges
    await fetchData();

    // Use the search effect to center on the new word
    setSearchQuery(word);
  }, [fetchData]);

  const onConnect = useCallback((connection: Connection) => {
    setPendingConnection(connection);
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
    // fetchData() is not strictly necessary here because ReactFlow removes it visually, 
    // but good to keep state in sync if you want, though ReactFlow handles the visual removal nicely.
  }, []);

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

  return (
    <div style={{ width: '100%', height: '100%' }} className="relative bg-background overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--border-strong)" gap={16} />
        <Controls className="!bg-surface-elevated !border-border !fill-foreground" />
        
        <Panel position="top-center" className="bg-surface-elevated p-3 rounded-xl shadow-md border border-border w-72 md:w-80 m-4 z-10">
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
      </ReactFlow>

      <GraphSidebar 
        word={selectedWord} 
        connections={connections} 
        onClose={() => setSelectedWord(null)} 
      />

      {/* Floating Action Button */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className={`absolute bottom-6 z-10 p-4 bg-accent hover:bg-accent/90 text-accent-foreground rounded-full shadow-lg transition-all duration-300 hover:scale-105 ${
          selectedWord ? 'right-[344px] md:right-[408px]' : 'right-6'
        }`}
        aria-label="Add Word"
      >
        <PlusIcon className="w-6 h-6" />
      </button>

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
    </div>
  );
}

export default function GraphPage() {
  return (
    <div style={{ width: '100vw', height: 'calc(100vh - 64px)' }} className="relative">
      <ReactFlowProvider>
        <GraphInner />
      </ReactFlowProvider>
    </div>
  );
}
