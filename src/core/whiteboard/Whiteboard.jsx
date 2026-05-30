import React, { useEffect, useRef, useState } from 'react';
import { useWhiteboardStore } from '../../stores/useWhiteboardStore';
import { eventBus } from '../events/EventBus';
import { rendererPipeline } from './RendererPipeline';
import MermaidRenderer from '../../components/ZeroToHero/MermaidRenderer';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const Whiteboard = ({ width = 800, height = 450 }) => {
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);
    const { drawEvents, currentEquation, activeDiagram, isDrawing, setIsDrawing } = useWhiteboardStore();
    const [renderedEquation, setRenderedEquation] = useState(null);
    const [elements, setElements] = useState([]); // Dynamic overlay items (text, eq, etc.)
    const [activeDragId, setActiveDragId] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    
    // Initialize the rendering pipeline
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        rendererPipeline.init(canvas, width, height);
    }, [width, height]);
    
    // Sync incoming bus drawing commands directly into the Layer Manager of Renderer Pipeline
    useEffect(() => {
        const handleNewDrawEvent = (event) => {
            const { type, payload } = event;
            if (type === 'DRAW_STROKE') {
                rendererPipeline.addStroke(payload);
            } else if (type === 'DRAW_CLEAR') {
                rendererPipeline.clear();
                setElements([]);
                setRenderedEquation(null);
            } else if (type === 'RUN_GRAPH_RENDER') {
                rendererPipeline.addGraphPlot(payload);
            }
        };
        
        const subStroke = eventBus.subscribe('DRAW_STROKE', handleNewDrawEvent);
        const subClear = eventBus.subscribe('DRAW_CLEAR', handleNewDrawEvent);
        const subGraph = eventBus.subscribe('RUN_GRAPH_RENDER', handleNewDrawEvent);
        
        return () => {
            subStroke();
            subClear();
            subGraph();
        };
    }, []);

    // Render mathematical expressions dynamically
    useEffect(() => {
        if (currentEquation) {
            try {
                const html = katex.renderToString(currentEquation, {
                    throwOnError: false,
                    displayMode: true
                });
                setRenderedEquation(html);
                
                // Add to overlays list
                setElements(prev => [...prev, {
                    id: crypto.randomUUID(),
                    type: 'equation',
                    html,
                    x: width / 2 - 150,
                    y: height / 2 - 50,
                    scale: 1
                }]);

                // Render highlighting stroke around equation bounding box
                rendererPipeline.addStroke({
                    id: crypto.randomUUID(),
                    points: [
                        [width/2 - 180, height/2 - 60],
                        [width/2 + 180, height/2 - 60],
                        [width/2 + 180, height/2 + 60],
                        [width/2 - 180, height/2 + 60],
                        [width/2 - 180, height/2 - 60]
                    ],
                    color: '#3b82f6',
                    width: 2,
                    duration: 1000,
                    startTime: 0
                });
            } catch (err) {
                console.error("KaTeX failed to render", err);
            }
        }
    }, [currentEquation]);

    // Render diagram SVG flows
    useEffect(() => {
        if (activeDiagram) {
            // Also add as draggable/zoomable HTML element
            const diagramId = `diag-${Date.now()}`;
            setElements(prev => [...prev, {
                id: crypto.randomUUID(),
                type: 'diagram',
                code: activeDiagram,
                diagramId,
                x: width / 2 - 180,
                y: height / 2 - 120,
                scale: 0.8
            }]);
        }
    }, [activeDiagram]);

    const startDrag = (e, id) => {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const el = elements.find(item => item.id === id);
        if (!el) return;
        
        setActiveDragId(id);
        setDragOffset({
            x: clientX - el.x,
            y: clientY - el.y
        });
    };

    const handlePointerMove = (e) => {
        if (!activeDragId) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        setElements(prev => prev.map(item => {
            if (item.id === activeDragId) {
                return {
                    ...item,
                    x: clientX - dragOffset.x,
                    y: clientY - dragOffset.y
                };
            }
            return item;
        }));
    };

    const handlePointerUp = () => {
        setActiveDragId(null);
    };

    const zoomElement = (id, delta) => {
        setElements(prev => prev.map(item => {
            if (item.id === id) {
                return {
                    ...item,
                    scale: Math.max(0.4, Math.min(2.0, item.scale + delta))
                };
            }
            return item;
        }));
    };

    const removeElement = (id) => {
        setElements(prev => prev.filter(item => item.id !== id));
    };

    return (
        <div className="position-relative border border-secondary border-opacity-25 rounded-4 shadow-sm overflow-hidden bg-slate-50 text-dark" style={{ width, height }}>
            <canvas 
                ref={canvasRef} 
                className="position-absolute top-0 start-0 w-100 h-100" 
                style={{ zIndex: 1 }}
            />
            
            {/* HTML layered overlays for beautiful equations and diagrams */}
            <div 
                ref={overlayRef}
                className="position-absolute top-0 start-0 w-100 h-100 pointer-events-none"
                style={{ zIndex: 2 }}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
            >
                {elements.map((el) => {
                    if (el.type === 'equation') {
                        return (
                            <div 
                                key={el.id}
                                className="position-absolute p-3 bg-white border border-primary border-opacity-20 shadow-sm rounded-3 animate-fade-in pointer-events-auto"
                                style={{ 
                                    left: el.x, 
                                    top: el.y, 
                                    transform: `scale(${el.scale})`,
                                    transformOrigin: 'top left',
                                    zIndex: el.id === activeDragId ? 99 : 10,
                                    cursor: 'move',
                                    minWidth: '200px'
                                }}
                                onMouseDown={(e) => startDrag(e, el.id)}
                                onTouchStart={(e) => startDrag(e, el.id)}
                            >
                                <div className="d-flex justify-content-between align-items-center mb-2 bg-light px-2 py-1 rounded border" style={{ fontSize: '0.75rem' }}>
                                    <span className="small fw-semibold text-secondary font-monospace">Math Equation</span>
                                    <div className="d-flex gap-1">
                                        <button onClick={(e) => { e.stopPropagation(); zoomElement(el.id, 0.1); }} className="btn btn-xs btn-outline-secondary p-0 px-1 font-monospace" style={{ fontSize: '0.7rem' }}>+</button>
                                        <button onClick={(e) => { e.stopPropagation(); zoomElement(el.id, -0.1); }} className="btn btn-xs btn-outline-secondary p-0 px-1 font-monospace" style={{ fontSize: '0.7rem' }}>-</button>
                                        <button onClick={(e) => { e.stopPropagation(); removeElement(el.id); }} className="btn btn-xs btn-outline-danger p-0 px-1 font-monospace" style={{ fontSize: '0.7rem' }}>×</button>
                                    </div>
                                </div>
                                <div dangerouslySetInnerHTML={{ __html: el.html }} />
                            </div>
                        );
                    }
                    if (el.type === 'diagram') {
                        return (
                            <div 
                                key={el.id}
                                className="position-absolute p-3 bg-white border border-primary border-opacity-20 shadow-sm rounded-3 animate-fade-in pointer-events-auto"
                                style={{ 
                                    left: el.x, 
                                    top: el.y, 
                                    transform: `scale(${el.scale})`,
                                    transformOrigin: 'top left',
                                    zIndex: el.id === activeDragId ? 99 : 10,
                                    cursor: 'move',
                                    width: '350px'
                                }}
                                onMouseDown={(e) => startDrag(e, el.id)}
                                onTouchStart={(e) => startDrag(e, el.id)}
                            >
                                <div className="d-flex justify-content-between align-items-center mb-2 bg-light px-2 py-1 rounded border" style={{ fontSize: '0.75rem' }}>
                                    <span className="small fw-semibold text-secondary font-monospace">Logical Diagram</span>
                                    <div className="d-flex gap-1">
                                        <button onClick={(e) => { e.stopPropagation(); zoomElement(el.id, 0.1); }} className="btn btn-xs btn-outline-secondary p-0 px-1 font-monospace" style={{ fontSize: '0.7rem' }}>+</button>
                                        <button onClick={(e) => { e.stopPropagation(); zoomElement(el.id, -0.1); }} className="btn btn-xs btn-outline-secondary p-0 px-1 font-monospace" style={{ fontSize: '0.7rem' }}>-</button>
                                        <button onClick={(e) => { e.stopPropagation(); removeElement(el.id); }} className="btn btn-xs btn-outline-danger p-0 px-1 font-monospace" style={{ fontSize: '0.7rem' }}>×</button>
                                    </div>
                                </div>
                                <MermaidRenderer code={el.code} diagramId={el.diagramId} theme="light" />
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
            
            {/* Animated Draw Indicator */}
            {isDrawing && (
                <div className="position-absolute top-0 end-0 m-3 px-3 py-1 bg-primary text-white text-xs rounded-pill shadow-sm d-flex align-items-center gap-2 z-3">
                    <span className="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span>
                    <span>AI Drawing...</span>
                </div>
            )}
        </div>
    );
};

export default Whiteboard;
