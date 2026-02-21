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
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import { Loader2 } from 'lucide-react';

const nodeTypes = {
    custom: CustomNode
};

const RoadmapCanvas = () => {
    const { userProfile: profile } = useAuth();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [selectedNode, setSelectedNode] = useState(null);
    const [isCheckingDB, setIsCheckingDB] = useState(true);


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
        <div className="w-full h-screen bg-[var(--bg-page)] text-[var(--text-main)] transition-colors duration-300">
            {isWizardOpen ? (
                <RoadmapWizard onRoadmapGenerated={handleRoadmapGenerated} />
            ) : (
                <>
                    <div className="absolute top-4 left-4 z-10 clay-card p-4 rounded-xl border border-white/40 shadow-lg min-w-[250px]">
                        <button onClick={() => window.history.back()} className="mb-2 flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--primary-accent)]">
                            ← Back
                        </button>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-[var(--primary-accent)] to-[var(--secondary-accent)] bg-clip-text text-transparent">
                            {profile?.full_name ? `${profile.full_name.split(' ')[0]}'s Path` : 'Your Learning Path'}
                        </h1>
                        <p className="text-xs text-[var(--text-muted)] mt-1">Unlock nodes to master your goal</p>
                        <button
                            onClick={() => setIsWizardOpen(true)}
                            className="mt-3 text-xs text-[var(--primary-accent)] hover:text-[var(--secondary-accent)] underline font-medium"
                        >
                            Generate New Roadmap
                        </button>
                    </div>

                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        nodeTypes={nodeTypes}
                        onNodeClick={onNodeClick}
                        fitView
                        defaultEdgeOptions={{
                            animated: true,
                            style: { stroke: 'var(--text-muted)', strokeWidth: 2 },
                        }}
                    >
                        <Background color="var(--text-muted)" gap={20} size={1} variant="dots" className="opacity-20" />
                        <Controls className="bg-white border-2 border-gray-100 shadow-xl rounded-lg text-gray-600 space-y-1" />
                    </ReactFlow>

                    <NodeDrawer
                        node={selectedNode}
                        isOpen={!!selectedNode}
                        onClose={() => setSelectedNode(null)}
                        onComplete={handleNodeCompletion}
                    />
                </>
            )}
        </div>
    );
};

export default RoadmapCanvas;
