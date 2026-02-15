
# IES Notes: The AI-Native Academic Ecosystem 🚀✨

![IES Notes](http://via.placeholder.com/1200x500?text=IES+Notes:+Your+Academic+Superpower)

## 🌟 Overview
**IES Notes** is a next-generation academic platform designed exclusively for IES College of Engineering. It evolves beyond simple file sharing into a **comprehensive AI-powered academic assistant**. It combines instant note access, a self-moderating community, and a suite of **Agentic AI Tools** that can synthesize presentations, reports, simulate code execution, and generate entire engineering projects from scratch.

---

## 🤖 The AI Content Engine (Architecture 3.0)

IES Notes features a robust, **Self-Healing AI Architecture** designed for maximum reliability, speed, and zero cost where possible.

### 🧠 Hybrid AI Fallback & Routing System
The system uses a sophisticated 3-layer cascade to ensure the AI never fails, with intelligent routing based on the task type:

1.  **Task-Based Routing**:
    *   **Advanced Code Tasks (J-Compiler)**: Privileged routing directly to **Groq (Llama 3.3 70B)** via high-performance server-side or client-side keys for minimum latency and maximum reasoning capability.
    *   **General Tasks**: Routed to lighter, faster models first.

2.  **Resilience Layers**:
    *   **Primary (Client-Side)**: **Puter.js** (Hosted LFM-2.5). Completely free, runs directly in the browser via CDN.
        *   *Optimization*: Custom Circuit Breaker & Retry Logic (Exponential backoff) to handle network flakiness.
    *   **Secondary (Server-Side)**: **Secure Vercel Function** (`/api/ai-completion`).
        *   Routes to **OpenRouter** or **Groq** via secure backend.
        *   *Security*: API keys are stored server-side.
    *   **Tertiary (Local Dev/Emergency)**:
        *   **Client-Side Groq Fallback**: If backend fails, the system automatically attempts a direct client-side connection using `VITE_` prefixed keys (only in dev/authorized envs) as a last resort.

---

## 🛠️ Feature Suite

### 1. 🖥️ J-Compiler: AI-Powered Code Studio
*A next-gen innovative IDE that simulates a full compiler environment inside the browser.*

**Key Capabilities:**
*   **Interactive Terminal Simulation**: Not just a text box. The J-Compiler simulates a real shell session, handling standard input (`stdin`) interactively. You can run programs that ask for user input (e.g., `scanf`, `input()`, `cin`) and the AI will pause, wait for your input, and continue execution seamlessly.
*   **Multi-Language Support**: Auto-detects and runs Python, JavaScript, Java, C++, and HTML/CSS.
*   **AI Debugger**: If code fails, it doesn't just show an error. It provides a detailed **Error Explanation** and a **Suggested Fix** which you can copy with one click.
*   **Reverse Engineer Mode**: Describe what you want (e.g., "A Fibonacci sequence generator"), and it generates the logic and code for you.
*   **Smart UX**: 
    *   Debounced input handling.
    *   State-aware "Running" indicators.
    *   Auto-scrolling terminal output.
    *   Formatted code previews with syntax highlighting.

### 2. 📽️ Agentic Web-Slides Generator
*A multi-step AI agent acting as both Creative Director and UI Designer.*

**Workflow:**
1.  **Director Phase (Planning)**:
    *   The user provides a topic (e.g., "Quantum Computing").
    *   The **Planner Agent** drafts a "Creative Brief" & JSON Storyboard, deciding slide titles, layouts (Hero, Grid, Split), and visual prompts.
2.  **Designer Phase (Iterative Synthesis)**:
    *   The system iterates through the approved plan.
    *   **Designer Agent** generates raw, high-fidelity HTML/CSS for each slide.
    *   **Performance**: Uses `postMessage` isolation to render slides instantly without page reloads.
3.  **Refine Loop**:
    *   Users can chat with *individual slides* (e.g., "Make the background red," "Add a flowchart"). The AI modifies the DOM in real-time.
4.  **Output**: Exports a single, self-contained `Presentation.html` file with embedded navigation scripts and Mermaid.js support.

### 3. 🏗️ Intelligent Project Architect
*An interview-based system for generating Mini & Major Projects.*

**Workflow:**
1.  **Initialization**: User enters a broad topic.
2.  **Technical Interview**: The AI generates 5 context-aware questions (e.g., "Which tech stack?", "Hardware requirements?") to narrow the scope.
3.  **Parallel Synthesis**: Once the interview is complete, the system forks into three parallel streams:
    *   **Abstract Writer**: Creates a technical summary.
    *   **Report Author**: Writes a full 5-chapter Markdown report.
    *   **Code Architect**: Generates a file structure map and writes source code for all core modules.
4.  **Output**: Bundles everything into a downloadable `.zip` file.

---

## 📱 Core Features

### 📚 Visual Resource Hub
*   **Deep Linking**: Navigate via `Department > Semester > Subject`.
*   **Smart Filters**: Toggle between `Core` and `Labs` instantly.
*   **Offline First**: Built as a PWA for seamless access without internet.

### ⚖️ Self-Governing Community
*   **Weighted Voting**: A "Hacker News" style algorithm ranks notes and posts.
*   **Auto-Moderation**: AI layers filter profanity and abusive content automatically.
*   **Admin Panel**: A restricted dashboard for faculty to manage uploads and user content.

---

## 🛠️ Technical Architecture

### Frontend Layer
*   **Framework**: React 18 + Vite
*   **Routing**: Custom Stack Navigation (State-based) for fluid transitions + React Router for dedicated tools.
*   **Styling**: 
    *   **Claymorphism**: Custom CSS classes (`.clay-card`, `.clay-button`) for a tactile, 3D feel.
    *   **Glassmorphism**: Backdrop filters for premium overlays.
    *   **Animations**: `framer-motion` for complex entering/exiting sequences.

### AI & Data Layer
*   **Model Providers**: Groq (Primary for Code), Puter.js (General), OpenRouter (Fallback).
*   **Backend**: Vercel Serverless Functions (`/api`).
*   **Database**: Supabase (PostgreSQL) for user data, RLS policies, and realtime subscriptions.
*   **Generative Libraries**:
    *   `pptxgenjs`: Client-side PowerPoint generation.
    *   `jspdf`: Client-side PDF generation.
    *   `mermaid`: Client-side diagram rendering.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   Supabase Account
*   Groq API Key (Recommended for J-Compiler)

### Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/justin-john-mathew/ies-notes-clay.git
    cd ies-notes-clay
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    Create a `.env` file in the root.
    
    *For Production (Secure):*
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    # Note: API Keys are NOT here. Set them in Vercel Project Settings!
    ```

    *For Local Dev (Hybrid):*
    ```env
    # Standard Keys
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

    # Local Dev Keys (Prefix with VITE_ to allow client-side fallback)
    VITE_GROQ_API_KEY=your_key_here
    VITE_OPENROUTER_API_KEY=your_key_here
    ```

4.  **Run Locally**:
    
    **Option A: Standard (Client-Side Fallback)**
    ```bash
    npm run dev
    ```
    *Use this for most UI work. The app will detect the missing backend and use your local VITE_ keys.*

    **Option B: Full (Serverless Emulation)**
    ```bash
    vercel dev
    ```
    *Use this to test the actual secure backend logic.*

---

## 🤝 Contribution & Philosophy

**IES Notes** follows a "Student-First" development philosophy. We prioritize:
1.  **Speed**: No loading spinners where possible; aggressive caching.
2.  **Beauty**: Interfaces should inspire usage.
3.  **Safety**: Community spaces must be welcoming.
4.  **Innovation**: Constantly pushing the boundaries of what a web app can do (e.g., J-Compiler).

**Developed with ❤️ for IES College of Engineering.**
