
# IES Notes: The AI-Native Academic Ecosystem 🚀✨

![IES Notes](http://via.placeholder.com/1200x500?text=IES+Notes:+Your+Academic+Superpower)

## 🌟 Overview
**IES Notes** is a next-generation academic platform designed exclusively for IES College of Engineering. It evolves beyond simple file sharing into a **comprehensive AI-powered academic assistant**. It combines instant note access, a self-moderating community, and a suite of **Agentic AI Tools** that can synthesize presentations, reports, simulate code execution, and generate entire engineering projects from scratch.

---

## 🤖 The AI Content Engine (Architecture 4.0)

IES Notes features a robust, **Zero-Tolerance AI Architecture** designed for clinical precision and developer-grade reliability.

### 🛡️ Puter AI Activation & Security
The system now includes a **Mandatory Puter AI Environment Verification**. 
*   **First-Time Setup**: New users are met with a premium, non-removable activation popup to authorize their Puter Cloud environment. 
*   **Verified Compute**: This ensures all AI-driven simulations and background tasks run in a secure, authorized sandbox, providing enhanced reliability for the J-Compiler and AI Tutor.

### 🧠 Reasoning-First AI Routing
The system uses a sophisticated 3-layer cascade, now featuring high-reasoning models:

1.  **Elite Logic Routing (J-Compiler)**: 
    *   **Model**: **DeepSeek-R1 Distill Llama 70B** via Groq.
    *   **Capabilities**: Uses Chain-of-Thought reasoning to perform deep audits. It doesn't just guess; it "thinks" through the logic execution path like a human senior developer.
2.  **General Tasks**: Routed to **Puter.js** (Hosted LFM-2.5) for instant, free responses.
3.  **Resilience Layers**:
    *   **Custom Circuit Breakers**: Automatic failure detection with exponential backoff.
    *   **Secure Backend Proxy**: API calls are routed through Vercel Serverless Functions to protect keys.

---

## 🛠️ Feature Suite

### 1. 🖥️ J-Compiler: AI-Powered Code Studio
*A next-gen innovative IDE that simulates a full compiler environment using deep reasoning.*

**Key Capabilities:**
*   **Zero-Tolerance Debugging**: The compiler acts as a **Pedantic Auditor**. It scans every character for typos, missing semicolons, case-sensitivity issues, and logic flaws (like infinite loops).
*   **Interactive Terminal Simulation**: Simulates a real shell session, handling standard input (`stdin`) logically to provide a full execution flow without manual interaction.
*   **Deep Analysis (Markdown)**: If a build fails, the AI provides a structured **Markdown Audit**. It uses headers and bullet points to list specific architectural flaws and syntax errors.
*   **Auto-Correction**: Provides a "100% Valid" suggested fix that can be copied with one click, ensuring the fixed code is free of formatting artifacts.
*   **Reverse Engineer Mode**: Uses DeepSeek-R1 to architect perfect, industry-standard code based on a desired output description.

### 2. 📽️ Agentic Web-Slides Generator
*A multi-step AI agent acting as both Creative Director and UI Designer.*

**Workflow:**
1.  **Director Phase (Planning)**: Drafts a "Creative Brief" & JSON Storyboard.
2.  **Designer Phase (Iterative Synthesis)**: Generates high-fidelity HTML/CSS with `postMessage` isolation for instant rendering.
3.  **Refine Loop**: Chat with individual slides to modify the DOM in real-time.
4.  **Output**: Exports a self-contained `Presentation.html` with Mermaid.js support.

### 3. 🏗️ Intelligent Project Architect
*An interview-based system for generating Mini & Major Projects.*

**Workflow:**
1.  **Technical Interview**: Generates 5 context-aware questions to define project scope.
2.  **Parallel Synthesis**: Forks into Abstract, Report (Markdown), and Code (full module architecture) streams.
3.  **Output**: Bundles the entire documentation and source code into a `.zip` file.

---

## 📱 Core Features

### 📚 Visual Resource Hub
*   **Deep Linking**: Navigate via `Department > Semester > Subject`.
*   **Smart Filters**: Toggle between `Core` and `Labs` instantly.
*   **Claymorphism UI**: A tactile, 3D design system that feels responsive and "alive."

### ⚖️ Self-Governing Community
*   **Weighted Ranking**: Notes are ranked by student interaction.
*   **AI Moderation**: Real-time filtering of abusive content.
*   **Student Dashboard**: Track favorites and manage academic preferences.

---

## 🛠️ Technical Architecture

### Frontend Layer
*   **Framework**: React 19 + Vite
*   **State Management**: custom-built stack navigation for fluid transitions.
*   **Animations**: `framer-motion` for complex UI state changes.

### AI & Data Layer
*   **Primary Engine**: Groq (DeepSeek-R1 & Llama 3.3).
*   **Identity & Persistence**: Supabase (PostgreSQL) + Puter Auth.
*   **Realtime**: Supabase RLS policies and channel subscriptions.

---

## 🚀 Getting Started

### Installation

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/justin-john-mathew/ies-notes-clay.git
    cd ies-notes-clay
    npm install
    ```

2.  **Environment Setup**:
    Create a `.env` file with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_GROQ_API_KEY`.

3.  **Run Dev Server**:
    ```bash
    npm run dev
    ```

---

## 🤝 Philosophy

**IES Notes** prioritizes **Speed, Beauty, and Accuracy**. Every feature—from the J-Compiler's audits to the Student Profile—is designed to empower engineering students with the tools of the future.

**Developed with ❤️ for IES College of Engineering.**
