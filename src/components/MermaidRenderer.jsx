import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';

const MermaidRenderer = ({ chart }) => {
    const [svgContent, setSvgContent] = useState('');
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        setSvgContent('');
        setIsError(false);

        if (chart) {
            const renderDiagram = async () => {
                try {
                    mermaid.initialize({
                        startOnLoad: false,
                        theme: 'default',
                        securityLevel: 'loose',
                        fontFamily: 'Outfit, sans-serif',
                        suppressErrorRendering: true,
                    });

                    const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                    const { svg } = await mermaid.render(id, chart);
                    setSvgContent(svg);
                } catch (err) {
                    console.error("Mermaid rendering failed:", err);
                    setIsError(true);
                }
            };
            renderDiagram();
        }
    }, [chart]);

    if (isError) {
        return (
            <div className="p-3 bg-light border rounded text-muted small">
                <p className="mb-1 fw-bold text-danger">⚠️ Diagram Syntax Error</p>
                <code className="d-block bg-white p-2 text-dark rounded border mt-2 overflow-auto text-wrap" style={{ fontSize: '0.75rem', maxHeight: '200px' }}>
                    {chart}
                </code>
            </div>
        );
    }

    if (!svgContent) return <div className="p-3 text-center text-muted small">Loading diagram...</div>;

    return (
        <div
            className="mermaid-container my-3 bg-white p-3 rounded-3 shadow-sm overflow-auto d-flex justify-content-center"
            dangerouslySetInnerHTML={{ __html: svgContent }}
        />
    );
};

export default MermaidRenderer;
