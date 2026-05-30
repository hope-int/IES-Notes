export class KnowledgeGraph {
    constructor() {
        this.nodes = new Map(); // conceptId -> { id, label, status, performance, confusionWeight }
        this.edges = []; // array of { from, to, weight }
    }

    addNode(id, label, metadata = {}) {
        this.nodes.set(id, {
            id,
            label,
            status: metadata.status || 'locked', // 'locked' | 'unlocked' | 'mastered'
            performance: metadata.performance || 1.0, // 0.0 - 1.0
            confusionWeight: metadata.confusionWeight || 0.0,
            ...metadata
        });
    }

    addEdge(from, to, weight = 1.0) {
        if (!this.edges.some(e => e.from === from && e.to === to)) {
            this.edges.push({ from, to, weight });
        }
    }

    // Topological Sort to generate lesson path (DAG traversal)
    generateLessonPath(targetConceptId) {
        const path = [];
        const visited = new Set();
        const temp = new Set();

        const visit = (nodeId) => {
            if (temp.has(nodeId)) {
                console.warn("Cycle detected in Knowledge Graph DAG!");
                return;
            }
            if (!visited.has(nodeId)) {
                temp.add(nodeId);
                // Find all prerequisites
                const prerequisites = this.edges
                    .filter(e => e.to === nodeId)
                    .map(e => e.from);
                
                prerequisites.forEach(prereq => visit(prereq));
                
                temp.delete(nodeId);
                visited.add(nodeId);
                path.push(nodeId);
            }
        };

        visit(targetConceptId);
        return path.map(id => this.nodes.get(id)).filter(Boolean);
    }

    // Update weights and performance dynamically based on quiz results
    assessPerformance(conceptId, score) {
        const node = this.nodes.get(conceptId);
        if (!node) return;

        // Exponential moving average for performance tracking
        node.performance = (node.performance * 0.4) + (score * 0.6);
        node.confusionWeight = 1.0 - node.performance;

        if (node.performance >= 0.8) {
            node.status = 'mastered';
        } else if (node.performance < 0.5) {
            node.status = 'unlocked'; // Needs study
            // Propagate confusion to successor concepts (successors' prerequisite weight increases)
            this.edges.forEach(edge => {
                if (edge.from === conceptId) {
                    edge.weight = Math.min(2.0, edge.weight + 0.2); // Increase edge dependency weight
                }
            });
        }

        // Unlock next nodes whose prerequisites are met
        this.unlockEligibleNodes();
    }

    unlockEligibleNodes() {
        this.nodes.forEach((node, id) => {
            if (node.status === 'locked') {
                const prerequisites = this.edges.filter(e => e.to === id);
                const allMet = prerequisites.every(e => {
                    const prereqNode = this.nodes.get(e.from);
                    return prereqNode && prereqNode.status === 'mastered';
                });

                if (allMet) {
                    node.status = 'unlocked';
                }
            }
        });
    }

    serialize() {
        return {
            nodes: Array.from(this.nodes.values()),
            edges: this.edges
        };
    }

    deserialize(data) {
        this.nodes.clear();
        this.edges = [];
        if (data.nodes) {
            data.nodes.forEach(n => this.nodes.set(n.id, n));
        }
        if (data.edges) {
            this.edges = data.edges;
        }
    }
}

export const knowledgeGraph = new KnowledgeGraph();
