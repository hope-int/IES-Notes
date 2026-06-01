import React, { useCallback, useState, useEffect, useMemo } from 'react';
import ReactFlow, {
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

import CustomNode from './CustomNode';
import NodeDrawer from './NodeDrawer';
import RoadmapWizard from './RoadmapWizard';
import MobileTimeline from './MobileTimeline';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import { Loader2, Menu, BrainCircuit, Target, Zap, ArrowLeft, Activity, Layers, Sparkles } from 'lucide-react';



// Basic hook for media queries
const useMediaQuery = (query) => {
    const [matches, setMatches] = useState(() => (
        typeof window !== 'undefined' ? window.matchMedia(query).matches : false
    ));

    useEffect(() => {
        const media = window.matchMedia(query);
        const listener = (event) => setMatches(event.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, [query]);

    return matches;
};

const RoadmapCanvas = () => {
    // Memoize static ReactFlow props to silence Warning 002
    const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);
    const edgeTypes = useMemo(() => ({}), []);
    const defaultEdgeOptions = useMemo(() => ({
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#93c5fd', strokeWidth: 2 },
    }), []);


    const { userProfile: profile } = useAuth();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);


    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [selectedNode, setSelectedNode] = useState(null);
    const [isCheckingDB, setIsCheckingDB] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [metadata, setMetadata] = useState(null);

    // Adaptive Architecture specific hook
    const isMobile = useMediaQuery('(max-width: 768px)');

    // Calculate Global Mastery Progress
    const completedCount = nodes.filter(n => n.data.status === 'completed').length;
    const totalCount = nodes.length;
    const globalProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;


    // Initial Database Check
    useEffect(() => {
        const fetchExistingRoadmap = async () => {
            if (!profile?.id) return;
            setIsCheckingDB(true);
            try {
                const { data, error } = await supabase
                    .from('user_roadmaps')
                    .select('*')
                    .eq('user_id', profile.id)
                    .maybeSingle();

                if (error && error.code !== 'PGRST116') {
                    console.error("Error fetching roadmap:", error);
                }

                if (data && data.nodes && data.nodes.length > 0) {
                    setNodes(data.nodes);
                    setEdges(data.edges);
                    if (data.metadata) setMetadata(data.metadata);
                    setIsWizardOpen(false);
                } else {
                    // No roadmap found, open wizard
                    setIsWizardOpen(true);
                }
            } catch (err) {
                console.error("Unknown error checking DB:", err);
                setIsWizardOpen(true);
            } finally {
                setIsCheckingDB(false);
            }
        };

        fetchExistingRoadmap();
    }, [profile, setNodes, setEdges]);

    // DB Sync Helper
    const saveRoadmapToDB = useCallback(async (currentNodes, currentEdges, currentMetadata = null) => {
        if (!profile?.id) return;
        try {
            const { error } = await supabase
                .from('user_roadmaps')
                .upsert({
                    user_id: profile.id,
                    nodes: currentNodes,
                    edges: currentEdges,
                    metadata: currentMetadata || metadata,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

            if (error) console.error("Error saving roadmap to Supabase:", error);
        } catch (err) {
            console.error("Unknown error saving to DB:", err);
        }
    }, [metadata, profile?.id]);

    // Handle Wizard Completion
    const handleRoadmapGenerated = useCallback(async (data) => {
        // Trust the AI's provided x/y coordinates directly
        setNodes(data.nodes);
        setEdges(data.edges);
        setMetadata(data._metadata);
        setIsWizardOpen(false);

        // Persist to DB immediately
        await saveRoadmapToDB(data.nodes, data.edges, data._metadata);
    }, [saveRoadmapToDB, setNodes, setEdges]);


    // Handle Node Click
    const onNodeClick = useCallback((event, node) => {
        if (node.data.status === 'locked') {
            // Optional: Shake animation or toast "finish previous step first!"
            return;
        }
        setSelectedNode(node);
    }, []);

    // Handle "Mark as Completed" action
    const handleNodeCompletion = useCallback(async (nodeId) => {
        // We need to capture the *new* state to save it correctly
        let nextNodes = [];

        setNodes((nds) => {
            // 1. Mark current node as completed
            const updatedNodes = nds.map((node) => {
                if (node.id === nodeId) {
                    return { ...node, data: { ...node.data, status: 'completed' } };
                }
                return node;
            });

            // 2. Find connected nodes and unlock them
            const connectedEdges = edges.filter(e => e.source === nodeId);
            connectedEdges.forEach(edge => {
                const targetNodeIndex = updatedNodes.findIndex(n => n.id === edge.target);
                if (targetNodeIndex !== -1) {
                    // Only unlock if it was locked. If it's already completed or active, leave it.
                    if (updatedNodes[targetNodeIndex].data.status === 'locked') {
                        updatedNodes[targetNodeIndex] = {
                            ...updatedNodes[targetNodeIndex],
                            data: { ...updatedNodes[targetNodeIndex].data, status: 'active' }
                        };
                    }
                }
            });

            nextNodes = updatedNodes;
            return updatedNodes;
        });

        // Close drawer after completion
        setSelectedNode(null);

        // Save new state offline/online
        setTimeout(() => saveRoadmapToDB(nextNodes, edges), 0);

    }, [edges, saveRoadmapToDB, setNodes]);

    if (isCheckingDB) {
        return (
            <div className="roadmap-loading">
                <div className="roadmap-loading-mark">
                    <Loader2 className="animate-spin" size={30} />
                </div>
                <h2>Syncing Study Roadmap</h2>
                <p>Checking your saved learning path.</p>
            </div>
        );
    }

    return (
        <div className="roadmap-shell">
            <div className="roadmap-ambient" aria-hidden="true">
                <span className="roadmap-ambient-grid" />
                <span className="roadmap-ambient-glare" />
            </div>

            {isWizardOpen ? (
                <RoadmapWizard onRoadmapGenerated={handleRoadmapGenerated} />
            ) : (
                <>

                    {/* Sticky Header with Progress */}
                    <header className="roadmap-header">
                        <div className="roadmap-header-inner">
                            <div className="roadmap-title-group">
                                <button
                                    onClick={() => {
                                        if (isMobile) {
                                            window.history.back();
                                        } else {
                                            setIsSidebarOpen(!isSidebarOpen);
                                        }
                                    }}
                                    className="roadmap-icon-button"
                                    aria-label={isMobile ? 'Back' : 'Toggle roadmap panel'}
                                >
                                    {isMobile ? <ArrowLeft size={20} /> : <Menu size={20} />}
                                </button>
                                <div className="roadmap-brand-mark">
                                    <BrainCircuit size={20} />
                                </div>
                                <div className="roadmap-title-copy">
                                    <h1>Study Roadmap Engine</h1>
                                    <span>
                                        {profile?.full_name ? `${profile.full_name}'s Adaptive Path` : 'Active Session'}
                                    </span>
                                </div>
                            </div>

                            <div className="roadmap-header-actions">
                                <div className="roadmap-master-chip">
                                    <span>Mastery</span>
                                    <strong>{globalProgress}%</strong>
                                    <Target size={16} />
                                </div>
                                <div className="roadmap-master-chip is-muted">
                                    <span>Nodes</span>
                                    <strong>{completedCount}/{totalCount}</strong>
                                    <Layers size={16} />
                                </div>
                                <button
                                    onClick={() => setIsWizardOpen(true)}
                                    className="roadmap-primary-action"
                                >
                                    <Zap size={16} />
                                    <span className="hidden sm:inline">Re-Calibrate</span>
                                    <span className="sm:hidden">Reset</span>
                                </button>
                            </div>
                        </div>

                        {/* Header Progress Bar */}
                        <div className="roadmap-progress-track">
                            <div
                                className="roadmap-progress-fill"
                                style={{ width: `${globalProgress}%` }}
                            />
                        </div>
                    </header>

                    {/* Main Content Area */}
                    <main className="roadmap-workspace">

                        {/* Desktop Sidebar */}
                        {!isMobile && (
                            <div className={`
                                roadmap-side-panel
                                ${isSidebarOpen ? 'is-open' : ''}
                            `}>
                                <button onClick={() => window.history.back()} className="roadmap-back-link">
                                    <ArrowLeft size={16} /> Back to Dashboard
                                </button>

                                <div className="roadmap-side-content">
                                    <div className="roadmap-side-hero">
                                        <Sparkles size={18} />
                                        <span>Adaptive study path</span>
                                        <p>Unlock nodes, finish focused tasks, and keep your learning sequence visible.</p>
                                    </div>

                                    <div className="roadmap-side-stats">
                                        <div>
                                            <span>Completed</span>
                                            <strong>{completedCount}</strong>
                                        </div>
                                        <div>
                                            <span>Total</span>
                                            <strong>{totalCount}</strong>
                                        </div>
                                    </div>

                                    {/* Diagnostic Info Section */}
                                    {metadata && (
                                        <div className="roadmap-diagnostics">
                                            <div className="roadmap-diagnostics-title">
                                                <Activity size={15} />
                                                <span>Generation Signal</span>
                                            </div>
                                            <div className="roadmap-diagnostics-list">
                                                <div>
                                                    <span>AI Engine</span>
                                                    <strong>{metadata.provider}</strong>
                                                </div>
                                                <div>
                                                    <span>Model</span>
                                                    <strong>{metadata.model || 'Standard'}</strong>
                                                </div>
                                                <div className="roadmap-diagnostic-grid">
                                                    <span>{metadata.latency?.toFixed(2) || '--'}s</span>
                                                    <span>{metadata.nodeCount || totalCount} nodes</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}


                        {/* Adaptive Canvas */}
                        <div className="roadmap-canvas-stage">
                            {isMobile ? (
                                <div className="roadmap-mobile-frame">
                                    <MobileTimeline nodes={nodes} onSelectNode={setSelectedNode} />
                                </div>
                            ) : (
                                <div className="roadmap-flow-wrap">
                                    <ReactFlow
                                        nodes={nodes}
                                        edges={edges}
                                        onNodesChange={onNodesChange}
                                        onEdgesChange={onEdgesChange}
                                        nodeTypes={nodeTypes}
                                        edgeTypes={edgeTypes}
                                        onNodeClick={onNodeClick}
                                        fitView
                                        fitViewOptions={{ padding: 0.5 }}
                                        defaultEdgeOptions={defaultEdgeOptions}

                                    >
                                        <Background color="#bfdbfe" gap={22} size={1} variant="dots" className="roadmap-flow-background" />
                                        <Controls className="roadmap-flow-controls" />
                                    </ReactFlow>
                                    <div className="roadmap-canvas-hint">
                                        <BrainCircuit size={15} />
                                        <span>Click an unlocked node to open study tasks</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>

                    <NodeDrawer

                        node={selectedNode}
                        isOpen={!!selectedNode}
                        isMobile={isMobile}
                        onClose={() => setSelectedNode(null)}
                        onComplete={handleNodeCompletion}
                    />
                </>
            )}
        </div>
    );
};

export default RoadmapCanvas;
