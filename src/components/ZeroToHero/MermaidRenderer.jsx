import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sanitizeMermaid, validateMermaidSyntax } from '../../utils/security';

// Lazy-load Mermaid default export only when needed to minimize initial bundle
const loadMermaid = async () => {
  const mermaid = (await import('mermaid')).default;
  if (!mermaid.detected) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'neutral',
      themeVariables: {
        primaryColor: 'var(--ktu-primary, #2563eb)',
        primaryTextColor: 'var(--ktu-primary-text, #fff)',
        primaryBorderColor: 'var(--ktu-primary-border, #1e40af)',
        lineColor: 'var(--ktu-line, #64748b)',
        secondaryColor: 'var(--ktu-secondary, #f1f5f9)',
        tertiaryColor: 'var(--ktu-tertiary, #cbd5e1)'
      },
      flowchart: { curve: 'basis', padding: 15, nodeSpacing: 30 },
      sequence: { actorMargin: 50, boxMargin: 10, messageMargin: 20 },
      class: { titleMargin: 10, padding: 8 },
      state: { fontSize: 12, titleFontSize: 14 }
    });
    mermaid.detected = true;
  }
  return mermaid;
};

const MermaidRenderer = ({ 
  code, 
  diagramId, 
  proficiency = 0.5, 
  theme = 'light',
  onExpand, 
  onExport, 
  onRegenerate,
  ariaLabel 
}) => {
  const [svg, setSvg] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef(null);
  const renderId = `mermaid-${diagramId}-${Date.now()}`;

  // Complexity scaling based on proficiency
  const getMaxNodes = useCallback((prof) => {
    if (prof < 0.3) return 8;   // Novice: simple linear flows
    if (prof < 0.7) return 15;  // Intermediate: moderate branching
    return 25;                  // Advanced: complex architectures
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const renderDiagram = async () => {
      try {
        setIsLoading(true);
        
        // Sanitize and validate
        const cleanedCode = sanitizeMermaid(code);
        const validation = await validateMermaidSyntax(cleanedCode);
        
        if (!validation.valid) {
          throw new Error(validation.suggestion || 'Diagram validation failed');
        }
        
        // Enforce complexity budget
        const nodeCount = (validation.code.match(/[\[\(]/g) || []).length;
        if (nodeCount > getMaxNodes(proficiency)) {
          throw new Error(`Diagram exceeds complexity limit for current proficiency level. Request simplification or advance to unlock complex diagrams.`);
        }
        
        // Load and render
        const m = await loadMermaid();
        const { svg: renderedSvg } = await m.render(renderId, validation.code);
        
        if (isMounted) {
          setSvg(renderedSvg);
          setError(null);
          
          // Cache rendered SVG for performance
          try {
            const cacheKey = `mermaid:${btoa(validation.code).slice(0, 32)}`;
            localStorage.setItem(cacheKey, JSON.stringify({
              svg: renderedSvg,
              timestamp: Date.now(),
              theme
            }));
          } catch (e) {
            // Cache failure is non-critical
            console.debug('Mermaid cache write failed:', e);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setSvg(null);
          
          // Log to observability pipeline
          if (window.logTelemetry) {
            window.logTelemetry('mermaid_render_error', {
              diagramId,
              error: err.message,
              proficiency,
              codeLength: code.length
            });
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    // Check cache first for performance
    const tryCache = () => {
      try {
        const cacheKey = `mermaid:${btoa(sanitizeMermaid(code)).slice(0, 32)}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { svg: cachedSvg, timestamp, theme: cachedTheme } = JSON.parse(cached);
          // Invalidate cache after 24h or if theme changed
          if (Date.now() - timestamp < 86400000 && cachedTheme === theme) {
            setSvg(cachedSvg);
            setIsLoading(false);
            return true;
          }
        }
      } catch (e) {
        // Cache read failure: proceed to render
      }
      return false;
    };
    
    if (!tryCache()) {
      renderDiagram();
    }
    
    return () => { isMounted = false; };
  }, [code, diagramId, proficiency, theme, getMaxNodes, renderId]);

  // Zoom/pan handlers for mobile accessibility
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      
      const scale = parseFloat(container.dataset.scale || '1');
      const newScale = Math.max(0.5, Math.min(3, scale + (e.deltaY > 0 ? -0.1 : 0.1)));
      container.dataset.scale = newScale;
      container.style.transform = `scale(${newScale})`;
    }
  }, []);

  if (isLoading) {
    return (
      <div className="mermaid-loader py-4 text-center" role="status" aria-live="polite">
        <div className="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
        <span className="text-muted" style={{ fontSize: '0.9rem' }}>Generating visual logic flow...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mermaid-error alert alert-warning p-4 rounded-4 clay-card border border-warning border-opacity-50" role="alert" aria-label="Diagram rendering error">
        <div className="d-flex align-items-center gap-2 mb-2">
          <span className="fs-5" aria-hidden="true">⚠️</span>
          <strong className="text-warning-emphasis">Visual Logic Unavailable</strong>
        </div>
        <p className="text-muted small mb-3">{error}</p>
        <div className="d-flex gap-2">
          <button 
            onClick={() => onRegenerate?.('simplify')}
            className="btn btn-sm btn-outline-warning rounded-pill px-3"
            aria-label="Request simplified diagram"
          >
            🔄 Simplify Layout
          </button>
          <button 
            onClick={() => onExpand?.('code')}
            className="btn btn-sm btn-outline-secondary rounded-pill px-3"
            aria-label="View raw Mermaid code"
          >
            &lt;/&gt; View Code
          </button>
        </div>
        <details className="mt-3">
          <summary className="text-muted small cursor-pointer">Technical Details</summary>
          <pre className="bg-dark text-white p-3 rounded-3 mt-2 overflow-auto" style={{ fontSize: '0.85em' }}><code>{code}</code></pre>
        </details>
      </div>
    );
  }

  return (
    <div 
      className="mermaid-container position-relative overflow-hidden p-3 rounded-4 bg-white border border-light"
      role="graphics-document"
      aria-label={ariaLabel || "Algorithm visualization"}
      onWheel={handleWheel}
      ref={containerRef}
      data-scale="1"
      style={{ minHeight: '150px' }}
    >
      <div 
        className="mermaid-svg-wrapper overflow-auto d-flex justify-content-center"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      
      {/* Accessibility: hidden descriptive summary for screen readers */}
      <div className="visually-hidden" id={`desc-${diagramId}`}>
        {ariaLabel || "Interactive diagram: use zoom controls to explore. Nodes represent concepts; arrows show logical flow."}
      </div>
      
      {/* Action toolbar - styled cleanly */}
      <div className="position-absolute bottom-0 end-0 p-2 d-flex gap-1" role="toolbar" aria-label="Diagram controls" style={{ zIndex: 5 }}>
        <button 
          onClick={() => onExpand?.('fullscreen')}
          className="btn btn-sm btn-light shadow-sm rounded-circle p-1 d-flex align-items-center justify-content-center"
          style={{ width: 28, height: 28 }}
          title="Expand"
          aria-label="Expand diagram"
        >
          🔍
        </button>
        <button 
          onClick={() => onExport?.('svg')}
          className="btn btn-sm btn-light shadow-sm rounded-circle p-1 d-flex align-items-center justify-content-center"
          style={{ width: 28, height: 28 }}
          title="Download as SVG"
          aria-label="Export as SVG"
        >
          📥
        </button>
        <button 
          onClick={() => onExpand?.('code')}
          className="btn btn-sm btn-light shadow-sm rounded-circle p-1 d-flex align-items-center justify-content-center"
          style={{ width: 28, height: 28 }}
          title="View source"
          aria-label="View source code"
        >
          &lt;/&gt;
        </button>
        <button 
          onClick={() => onRegenerate?.('refine')}
          className="btn btn-sm btn-light shadow-sm rounded-circle p-1 d-flex align-items-center justify-content-center"
          style={{ width: 28, height: 28 }}
          title="Regenerate"
          aria-label="Regenerate diagram"
        >
          🔄
        </button>
      </div>
      
      {/* Proficiency-gated complexity hint */}
      {proficiency < 0.7 && (
        <div className="position-absolute bottom-0 start-0 p-2 text-muted" style={{ fontSize: '0.75rem' }}>
          <span>💡 Advance proficiency to unlock complex diagrams</span>
        </div>
      )}
    </div>
  );
};

export default React.memo(MermaidRenderer);
