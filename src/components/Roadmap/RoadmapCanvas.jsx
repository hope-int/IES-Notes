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
import { Loader2, Menu, X } from 'lucide-react';



// Basic hook for media queries
const useMediaQuery = (query) => {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        const media = window.matchMedia(query);
        if (media.matches !== matches) {
            setMatches(media.matches);
        }
        const listener = () => setMatches(media.matches);
        window.addEventListener('resize', listener);
        return () => window.removeEventListener('resize', listener);
    }, [matches, query]);
    return matches;
};

const nodeTypes = { custom: CustomNode };

const RoadmapCanvas = () => {
    const { userProfile: profile } = useAuth();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [selectedNode, setSelectedNode] = useState(null);
    const [isCheckingDB, setIsCheckingDB] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Adaptive Architecture specific hook
    const isMobile = useMediaQuery('(max-width: 768px)');


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
    const saveRoadmapToDB = async (currentNodes, currentEdges) => {
        if (!profile?.id) return;
        try {
            const { error } = await supabase
                .from('user_roadmaps')
                .upsert({
                    user_id: profile.id,
                    nodes: currentNodes,
                    edges: currentEdges,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

            if (error) console.error("Error saving roadmap to Supabase:", error);
        } catch (err) {
            console.error("Unknown error saving to DB:", err);
        }
    };

    // Handle Wizard Completion
    const handleRoadmapGenerated = useCallback(async (data) => {
        // Trust the AI's provided x/y coordinates directly
        setNodes(data.nodes);
        setEdges(data.edges);
        setIsWizardOpen(false);

        // Persist to DB immediately
        await saveRoadmapToDB(data.nodes, data.edges);
    }, [profile, setNodes, setEdges]);

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
        setImmediate(() => saveRoadmapToDB(nextNodes, edges));

    }, [edges, setNodes]);

    if (isCheckingDB) {
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center bg-[var(--bg-page)] text-[var(--text-main)]">
                <Loader2 className="w-12 h-12 text-[var(--primary-accent)] animate-spin mb-4" />
                <h2 className="text-xl font-bold">Synchronizing Neuro-Link...</h2>
                <p className="text-sm text-[var(--text-muted)] mt-2">Checking for saved learning paths.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col transition-colors duration-300 overflow-hidden relative">
            {isWizardOpen ? (
                <RoadmapWizard onRoadmapGenerated={handleRoadmapGenerated} />
            ) : (
                <>
                    {/* Sticky Header */}
                    <header className="sticky top-0 z-40 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    if (isMobile) {
                                        window.history.back();
                                    } else {
                                        setIsSidebarOpen(!isSidebarOpen);
                                    }
                                }}
                                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                {isMobile ? <X size={20} /> : <Menu size={20} />}
                            </button>
                            <h1 className="text-xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent truncate max-w-[200px] md:max-w-xs">
                                {profile?.full_name ? `${profile.full_name.split(' ')[0]}'s Path` : 'Learning Path'}
                            </h1>
                        </div>

                        <button
                            onClick={() => setIsWizardOpen(true)}
                            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2"
                        >
                            <span className="hidden sm:inline">Generate New</span>
                            <span className="sm:hidden">New</span>
                        </button>
                    </header>

                    {/* Main Content Area */}
                    <main className="flex-1 relative flex">

                        {/* Desktop Sidebar */}
                        {!isMobile && (
                            <div className={`
                                flex-shrink-0 flex-col bg-white border-r border-slate-200 z-30 p-6 transition-all duration-300 ease-in-out
                                ${isSidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 overflow-hidden px-0 border-r-0'}
                            `}>
                                <button onClick={() => window.history.back()} className="mb-6 flex w-max items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
                                    ← Back to Dashboard
                                </button>

                                <div className="flex flex-col flex-1">
                                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                                        Welcome to your interactive skill tree. Unlock nodes to master your engineering goal.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Adaptive Canvas */}
                        <div className="flex-1 h-[calc(100vh-4rem)] relative">
                            {isMobile ? (
                                <div className="h-full overflow-y-auto">
                                    <MobileTimeline nodes={nodes} onSelectNode={setSelectedNode} />
                                </div>
                            ) : (
                                <ReactFlow
                                    nodes={nodes}
                                    edges={edges}
                                    onNodesChange={onNodesChange}
                                    onEdgesChange={onEdgesChange}
                                    nodeTypes={nodeTypes}
                                    onNodeClick={onNodeClick}
                                    fitView
                                    fitViewOptions={{ padding: 0.5 }}
                                    defaultEdgeOptions={{
                                        type: 'smoothstep',
                                        animated: true,
                                        style: { stroke: '#cbd5e1', strokeWidth: 2 },
                                    }}
                                >
                                    <Background color="#cbd5e1" gap={20} size={1} variant="dots" className="opacity-40" />
                                    <Controls className="bg-white border border-slate-200 shadow-sm rounded-lg text-slate-600 space-y-1" />
                                </ReactFlow>
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
