import katex from 'katex';
import { eventBus } from '../events/EventBus';

class RendererPipeline {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.width = 800;
        this.height = 450;
        this.deviceMode = 'desktop'; // 'desktop' | 'mobile_low_end'
        this.layers = {
            background: [],
            strokes: [],
            equations: [],
            diagrams: [],
            highlights: [],
            interactions: [],
            replay: []
        };
        
        this.activePencilColor = '#0f172a';
        this.strokeWidth = 3;
        this.isLowPerformanceMode = false;
        
        // Listen to timeline clock ticks to sync animations
        eventBus.subscribe('TIMELINE_TICK', (e) => {
            this.updateAnimations(e.payload.currentTimeMs);
        });
    }

    init(canvas, width = 800, height = 450) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = width;
        this.height = height;

        // Auto detect mobile limitations
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /iphone|ipad|ipod|android|blackberry|mini|windows\sphone/i.test(userAgent);
        this.isLowPerformanceMode = isMobile;
        this.deviceMode = isMobile ? 'mobile_low_end' : 'desktop';

        this.setupCanvas();
        this.renderAll();
    }

    setupCanvas() {
        if (!this.canvas) return;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        this.ctx.scale(dpr, dpr);
        
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }

    setLowPerformanceMode(enable) {
        this.isLowPerformanceMode = enable;
        this.deviceMode = enable ? 'mobile_low_end' : 'desktop';
    }

    addStroke(stroke) {
        // Apply stroke simplification if on low-end device (Rule 8: mobile rules)
        let processedPoints = stroke.points;
        if (this.isLowPerformanceMode) {
            processedPoints = this.simplifyPoints(stroke.points, 2);
        }

        // Apply spline interpolation for smooth handwriting
        const smoothPoints = this.interpolateSplines(processedPoints);

        const newStroke = {
            id: stroke.id || crypto.randomUUID(),
            points: smoothPoints,
            color: stroke.color || this.activePencilColor,
            width: stroke.width || this.strokeWidth,
            duration: stroke.duration || 800,
            startTime: stroke.startTime || 0,
            progress: 0
        };

        this.layers.strokes.push(newStroke);
        this.renderAll();
    }

    simplifyPoints(points, tolerance) {
        if (points.length <= 2) return points;
        // Simple radial distance point reduction
        const result = [points[0]];
        let lastPt = points[0];
        
        for (let i = 1; i < points.length - 1; i++) {
            const pt = points[i];
            const dist = Math.hypot(pt[0] - lastPt[0], pt[1] - lastPt[1]);
            if (dist > tolerance) {
                result.push(pt);
                lastPt = pt;
            }
        }
        result.push(points[points.length - 1]);
        return result;
    }

    interpolateSplines(points) {
        if (points.length < 3) return points;
        // Catmull-Rom spline interpolation implementation
        const interpolated = [];
        interpolated.push(points[0]);
        
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i === 0 ? 0 : i - 1];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];
            
            const steps = this.isLowPerformanceMode ? 3 : 6; // Halve calculations for low-end mobile
            for (let t = 1; t <= steps; t++) {
                const alpha = t / steps;
                const alphaSqr = alpha * alpha;
                const alphaCube = alphaSqr * alpha;
                
                const x = 0.5 * (
                    (2 * p1[0]) +
                    (-p0[0] + p2[0]) * alpha +
                    (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * alphaSqr +
                    (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * alphaCube
                );
                const y = 0.5 * (
                    (2 * p1[1]) +
                    (-p0[1] + p2[1]) * alpha +
                    (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * alphaSqr +
                    (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * alphaCube
                );
                interpolated.push([x, y]);
            }
        }
        return interpolated;
    }

    addEquation(eq) {
        const id = eq.id || crypto.randomUUID();
        const html = katex.renderToString(eq.latex, {
            throwOnError: false,
            displayMode: true
        });

        const newEq = {
            id,
            latex: eq.latex,
            html,
            x: eq.x || this.width / 2 - 150,
            y: eq.y || this.height / 2 - 60,
            scale: 0.1, // Animate scale up
            targetScale: 1.0,
            variables: eq.variables || [],
            activeHighlightVar: null,
            startTime: eq.startTime || 0,
            duration: eq.duration || 1000
        };

        this.layers.equations.push(newEq);
        this.renderAll();
    }

    addDiagram(diag) {
        // Convert Mermaid diagram into animated Educational Scene Graph node representations
        const nodes = this.parseMermaidAST(diag.mermaid);
        
        const newDiagram = {
            id: diag.id || crypto.randomUUID(),
            nodes,
            startTime: diag.startTime || 0,
            duration: diag.duration || 2000,
            progress: 0
        };

        this.layers.diagrams.push(newDiagram);
        this.renderAll();
    }

    parseMermaidAST(mermaidText) {
        // Light AST Node extraction to derive visual coordinates
        const lines = mermaidText.split('\n');
        const nodes = [];
        const edges = [];
        let yOffset = 60;
        let xOffset = 100;

        lines.forEach(line => {
            const trimmed = line.trim();
            // Parse node: e.g. A[Intro]
            const nodeMatch = trimmed.match(/^([A-Za-z0-9]+)\[(.*)\]/);
            if (nodeMatch) {
                nodes.push({
                    id: nodeMatch[1],
                    label: nodeMatch[2],
                    x: xOffset,
                    y: yOffset,
                    opacity: 0,
                    scale: 0.5
                });
                xOffset += 180;
                if (xOffset > this.width - 150) {
                    xOffset = 100;
                    yOffset += 100;
                }
            }
            
            // Parse edges: e.g. A --> B
            const edgeMatch = trimmed.match(/^([A-Za-z0-9]+)\s*-->\s*([A-Za-z0-9]+)/);
            if (edgeMatch) {
                edges.push({
                    from: edgeMatch[1],
                    to: edgeMatch[2],
                    progress: 0
                });
            }
        });

        return { nodes, edges };
    }

    updateAnimations(timeMs) {
        let needsRedraw = false;

        // 1. Animate strokes
        this.layers.strokes.forEach(stroke => {
            if (timeMs >= stroke.startTime && stroke.progress < 1) {
                const elapsed = timeMs - stroke.startTime;
                stroke.progress = Math.min(1, elapsed / stroke.duration);
                needsRedraw = true;
            }
        });

        // 2. Animate equations progressive scale
        this.layers.equations.forEach(eq => {
            if (timeMs >= eq.startTime && eq.scale < eq.targetScale) {
                const elapsed = timeMs - eq.startTime;
                eq.scale = Math.min(eq.targetScale, 0.1 + (elapsed / eq.duration) * 0.9);
                needsRedraw = true;
            }
        });

        // 3. Animate diagrams
        this.layers.diagrams.forEach(diag => {
            if (timeMs >= diag.startTime && diag.progress < 1) {
                const elapsed = timeMs - diag.startTime;
                diag.progress = Math.min(1, elapsed / diag.duration);
                
                // Progressively fade in nodes and draw edges
                const { nodes, edges } = diag.nodes;
                nodes.forEach((n, idx) => {
                    const nodeDelay = idx * 300;
                    if (elapsed > nodeDelay) {
                        n.opacity = Math.min(1, (elapsed - nodeDelay) / 400);
                        n.scale = Math.min(1, 0.5 + ((elapsed - nodeDelay) / 400) * 0.5);
                    }
                });

                edges.forEach((edge, idx) => {
                    const edgeDelay = (idx + 1) * 450;
                    if (elapsed > edgeDelay) {
                        edge.progress = Math.min(1, (elapsed - edgeDelay) / 500);
                    }
                });

                needsRedraw = true;
            }
        });

        if (needsRedraw) {
            this.renderAll();
        }
    }

    addGraphPlot(plot) {
        if (!this.layers.graphs) {
            this.layers.graphs = [];
        }
        this.layers.graphs.push({
            id: plot.id || crypto.randomUUID(),
            equation: plot.equation,
            formula: plot.formula || 'Math.sin(x)',
            startTime: plot.startTime || 0
        });
        this.renderAll();
    }

    clear() {
        this.layers = {
            background: [],
            strokes: [],
            equations: [],
            diagrams: [],
            highlights: [],
            interactions: [],
            replay: [],
            graphs: []
        };
        this.renderAll();
    }

    renderAll() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Layer 1: BackgroundLayer
        this.renderBackground();

        // Layer 1.5: Graphs
        this.renderGraphs();

        // Layer 2: StrokeLayer (Handwriting)
        this.renderStrokes();

        // Layer 3: DiagramLayer (Mermaid Nodes & Connections)
        this.renderDiagrams();

        // Layer 4: HighlightLayer
        this.renderHighlights();

        // Layer 5: ReplayLayer
        this.renderReplayIndicators();
    }

    renderGraphs() {
        if (!this.layers.graphs) return;
        this.layers.graphs.forEach(graph => {
            const centerX = this.width / 2;
            const centerY = this.height / 2;
            const scaleX = 50; 
            const scaleY = 50;
            
            // Draw axis grid
            this.ctx.strokeStyle = '#e2e8f0';
            this.ctx.lineWidth = 1;
            
            // Draw coordinate axis
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#94a3b8';
            this.ctx.lineWidth = 2;
            // X Axis
            this.ctx.moveTo(50, centerY);
            this.ctx.lineTo(this.width - 50, centerY);
            // Y Axis
            this.ctx.moveTo(centerX, 30);
            this.ctx.lineTo(centerX, this.height - 30);
            this.ctx.stroke();
            
            // Axis labels & ticks
            this.ctx.fillStyle = '#64748b';
            this.ctx.font = '10px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'top';
            
            for (let xVal = -6; xVal <= 6; xVal++) {
                if (xVal === 0) continue;
                const xPos = centerX + xVal * scaleX;
                if (xPos < 50 || xPos > this.width - 50) continue;
                this.ctx.beginPath();
                this.ctx.moveTo(xPos, centerY - 4);
                this.ctx.lineTo(xPos, centerY + 4);
                this.ctx.stroke();
                this.ctx.fillText(xVal.toString(), xPos, centerY + 6);
            }
            
            this.ctx.textAlign = 'right';
            this.ctx.textBaseline = 'middle';
            for (let yVal = -4; yVal <= 4; yVal++) {
                if (yVal === 0) continue;
                const yPos = centerY - yVal * scaleY;
                if (yPos < 30 || yPos > this.height - 30) continue;
                this.ctx.beginPath();
                this.ctx.moveTo(centerX - 4, yPos);
                this.ctx.lineTo(centerX + 4, yPos);
                this.ctx.stroke();
                this.ctx.fillText(yVal.toString(), centerX - 6, yPos);
            }
            
            // Plot curve
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#3b82f6'; // Premium primary blue
            this.ctx.lineWidth = 3;
            
            let first = true;
            const step = 0.05;
            for (let x = -6; x <= 6; x += step) {
                let y;
                try {
                    // Safe parsing for mathematical formula
                    const f = graph.formula
                        .replace(/Math\./g, '')
                        .replace(/sin/g, 'Math.sin')
                        .replace(/cos/g, 'Math.cos')
                        .replace(/tan/g, 'Math.tan')
                        .replace(/pow/g, 'Math.pow')
                        .replace(/exp/g, 'Math.exp')
                        .replace(/log/g, 'Math.log')
                        .replace(/sqrt/g, 'Math.sqrt')
                        .replace(/pi/g, 'Math.PI')
                        .replace(/\bx\b/g, `(${x})`);
                    y = eval(f);
                } catch (e) {
                    y = null;
                }
                
                if (typeof y !== 'number' || isNaN(y) || !isFinite(y)) continue;
                
                const canvasX = centerX + x * scaleX;
                const canvasY = centerY - y * scaleY;
                
                if (canvasX >= 50 && canvasX <= this.width - 50 && canvasY >= 30 && canvasY <= this.height - 30) {
                    if (first) {
                        this.ctx.moveTo(canvasX, canvasY);
                        first = false;
                    } else {
                        this.ctx.lineTo(canvasX, canvasY);
                    }
                }
            }
            this.ctx.stroke();
            
            // Equation legend label
            this.ctx.fillStyle = '#1e293b';
            this.ctx.font = 'bold 14px sans-serif';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Graph: ${graph.equation || ''}`, 60, 50);
        });
    }

    renderBackground() {
        // Slate 50 clean chalkboard background
        this.ctx.fillStyle = '#f8fafc';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Soft visual grid lines for textbook feel
        this.ctx.strokeStyle = '#e2e8f0';
        this.ctx.lineWidth = 0.5;
        const gridSize = 40;
        
        for (let x = gridSize; x < this.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        for (let y = gridSize; y < this.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
    }

    renderStrokes() {
        this.layers.strokes.forEach(stroke => {
            const points = stroke.points;
            if (points.length < 2) return;

            this.ctx.beginPath();
            this.ctx.strokeStyle = stroke.color;
            this.ctx.lineWidth = stroke.width;
            
            const targetCount = Math.floor(stroke.progress * points.length);
            if (targetCount < 2) return;

            this.ctx.moveTo(points[0][0], points[0][1]);
            for (let i = 1; i < targetCount; i++) {
                this.ctx.lineTo(points[i][0], points[i][1]);
            }
            this.ctx.stroke();
        });
    }

    renderDiagrams() {
        this.layers.diagrams.forEach(diag => {
            const { nodes, edges } = diag.nodes;

            // Render Edges/Lines
            edges.forEach(edge => {
                const fromNode = nodes.find(n => n.id === edge.from);
                const toNode = nodes.find(n => n.id === edge.to);
                
                if (fromNode && toNode && edge.progress > 0) {
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = '#94a3b8'; // Slate 400
                    this.ctx.lineWidth = 2;
                    
                    const startX = fromNode.x + 40;
                    const startY = fromNode.y;
                    const endX = toNode.x - 40;
                    const endY = toNode.y;

                    const dx = endX - startX;
                    const dy = endY - startY;

                    this.ctx.moveTo(startX, startY);
                    this.ctx.lineTo(startX + dx * edge.progress, startY + dy * edge.progress);
                    this.ctx.stroke();

                    // Arrowhead rendering at the end of progress
                    if (edge.progress === 1) {
                        this.drawArrowhead(startX, startY, endX, endY);
                    }
                }
            });

            // Render Nodes
            nodes.forEach(node => {
                if (node.opacity > 0) {
                    this.ctx.save();
                    this.ctx.globalAlpha = node.opacity;
                    this.ctx.translate(node.x, node.y);
                    this.ctx.scale(node.scale, node.scale);

                    // Box outline
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.strokeStyle = '#3b82f6'; // Indigo boundary
                    this.ctx.lineWidth = 2.5;
                    this.ctx.beginPath();
                    this.ctx.roundRect(-50, -25, 100, 50, 8);
                    this.ctx.fill();
                    this.ctx.stroke();

                    // Text label
                    this.ctx.fillStyle = '#1e293b';
                    this.ctx.font = 'bold 13px sans-serif';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText(node.label, 0, 0);

                    this.ctx.restore();
                }
            });
        });
    }

    drawArrowhead(fromx, fromy, tox, toy) {
        const angle = Math.atan2(toy - fromy, tox - fromx);
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.beginPath();
        this.ctx.moveTo(tox, toy);
        this.ctx.lineTo(tox - 10 * Math.cos(angle - Math.PI / 6), toy - 10 * Math.sin(angle - Math.PI / 6));
        this.ctx.lineTo(tox - 10 * Math.cos(angle + Math.PI / 6), toy - 10 * Math.sin(angle + Math.PI / 6));
        this.ctx.fill();
    }

    renderHighlights() {
        this.layers.highlights.forEach(hl => {
            this.ctx.fillStyle = 'rgba(253, 224, 71, 0.4)'; // Yellow highlight transparent
            this.ctx.beginPath();
            this.ctx.arc(hl.x, hl.y, hl.radius || 20, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    renderReplayIndicators() {
        this.layers.replay.forEach(rep => {
            this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
            this.ctx.lineWidth = 1.5;
            this.ctx.setLineDash([5, 3]);
            this.ctx.beginPath();
            this.ctx.rect(rep.x - 5, rep.y - 5, rep.w + 10, rep.h + 10);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        });
    }
}

export const rendererPipeline = new RendererPipeline();
