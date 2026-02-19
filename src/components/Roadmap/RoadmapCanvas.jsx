
import React, { useCallback, useState } from 'react';
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

const nodeTypes = {
    custom: CustomNode,
};

const RoadmapCanvas = ({ profile }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isWizardOpen, setIsWizardOpen] = useState(true);
    const [selectedNode, setSelectedNode] = useState(null);

    // Handle Wizard Completion
    const handleRoadmapGenerated = useCallback((data) => {
        // Layout logic: Simple vertical spacing if x/y not provided well
        const layoutNodes = data.nodes.map((node, index) => ({
            ...node,
            position: node.position || { x: 250, y: index * 150 },
        }));

        setNodes(layoutNodes);
        setEdges(data.edges);
        setIsWizardOpen(false);
    }, [setNodes, setEdges]);

    // Handle Node Click
    const onNodeClick = useCallback((event, node) => {
        if (node.data.status === 'locked') {
            // Optional: Shake animation or toast "finish previous step first!"
            return;
        }
        setSelectedNode(node);
    }, []);

    // Handle "Mark as Completed" action
    const handleNodeCompletion = useCallback((nodeId) => {
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

            return updatedNodes;
        });

        // Close drawer after completion
        setSelectedNode(null);
    }, [edges, setNodes]);

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
