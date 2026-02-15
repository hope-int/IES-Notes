
// Current implementation:
// <iframe srcDoc={currentSlide.html} ... />

// Problem: 
// Changing srcDoc causes a full re-render of the iframe, including script parsing (Mermaid.js) and layout.

// Solution:
// 1. Memoize the iframe content or structure? No, srcDoc change still triggers reload.
// 2. Pre-render all slides? 
//    We can render a SINGLE iframe that contains ALL slides hidden/shown via CSS.
//    Or, we can cache the iframes? (too heavy).

// Better Solution:
// Render ALL slides into ONE iframe document.
// Use javascript inside the iframe to show/hide slides based on a message from the parent.
// OR
// Use the "Exported HTML" approach where all slides are in one HTML file and we just navigate them.

// Let's go with the "Single Iframe, All Slides" approach.
// When slides array changes (generation update), we update the single iframe's body.
// But wait, generation happens one by one.

// Revised Approach for "Preview":
// We can use a simpler `div` based preview with Shadow DOM or just scoped styles if possible?
// Iframe is good for isolation.
// If we use srcDoc, we pay the price.

// Optimization:
// Instead of changing `srcDoc` on every slide change:
// 1. Keep the iframe mounted.
// 2. PostMessage the new slide HTML to the iframe.
// 3. Iframe script replaces `document.body.innerHTML`.
// This avoids reloading the `head` scripts (Mermaid, Fonts, CSS).

// Plan:
// 1. Create a constant `previewTemplate` that has the `<head>` scripts and a listener for `message`.
// 2. In `AgenticPPTGenerator`, mount the iframe ONCE with this template.
// 3. inside `useEffect` watching `currentSlideIndex`, send `postMessage` with the new HTML.
// 4. Iframe receives message -> updates body -> re-runs mermaid.init().

const previewTemplate = `
<!DOCTYPE html>
<html>
<head>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>mermaid.initialize({startOnLoad:false, theme: 'dark'});</script>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; font-family: 'Outfit', sans-serif; background: #020617; color: #f8fafc; transition: opacity 0.3s ease; }
        ::-webkit-scrollbar { display: none; }
        .slide-content { height: 100%; width: 100%; animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
    <div id="app"></div>
    <script>
        window.addEventListener('message', (event) => {
            const { html } = event.data;
            const app = document.getElementById('app');
            app.style.opacity = '0';
            
            setTimeout(() => {
                app.innerHTML = '<div class="slide-content">' + html + '</div>';
                
                // Re-init mermaid
                try {
                    mermaid.run({ nodes: document.querySelectorAll('.mermaid') });
                } catch(e) { console.error(e); }
                
                app.style.opacity = '1';
            }, 100); // Short fade for smoothness
        });
    </script>
</body>
</html>
`;

// In Component:
// <iframe srcDoc={previewTemplate} onLoad={(e) => setIframeRef(e.target)} ... />
// useEffect(() => { iframeRef?.contentWindow.postMessage({ html: slides[current].html }, '*') }, [current, slides]);

