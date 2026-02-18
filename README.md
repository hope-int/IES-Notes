# HOPE-Edu-Hub — User Guide & Features

HOPE-Edu-Hub is an AI-first educational notes and content platform built with React + Vite and Supabase for authentication and persistence. It bundles interactive AI tools (content generation, slide/project generation, and code simulation) with a community resource hub for students and educators.

This README contains a complete user guide, feature descriptions, quick setup, and developer notes.

## 🌟 Overview

**HOPE-Edu-Hub** is a next-generation academic platform designed for an **AI-Native** collaborative learning experience. It evolves beyond simple file sharing into a **comprehensive AI-powered academic assistant**. It combines instant note access, a self-moderating community, and a suite of **Agentic AI Tools** that can synthesize presentations, simulate code execution, act as a Socratic tutor, and even **turn your PDF notes into audio podcasts**.

HOPE-Edu-Hub helps students and instructors create, share, and iterate on course materials using integrated AI assistants. Key capabilities include:

### 🛡️ Puter AI Activation & Security
The system leverages **Puter.js** for secure, cloud-based AI inference.
*   **Verified Compute**: Ensures all AI-driven simulations and background tasks run in a secure, authorized sandbox.
*   **Privacy-First**: PDF processing and Text-to-Speech generation happen locally or in ephemeral cloud instances, respecting user data.

### 🧠 Reasoning-First AI Routing
The system uses a sophisticated cascade of models tailored to specific tasks:
1.  **Deep Logic & Coding**: **DeepSeek-R1 / Llama 70B** for complex code analysis and Socratic reasoning.
2.  **Creative & Conversational**: **LFM-2.5** for natural language tasks like podcast scripting and chat.
3.  **Visual Intelligence**: **Nemotron-12B-VL** for analyzing images and diagrams.

---

## Features (User-facing)

### 1. 🎙️ Podcast Classes (Refined & Enhanced)
*Your personal AI Audio Tutor, now with a premium studio experience.*

**Key Capabilities:**
*   **Premium App-Like Experience**: A completely redesigned, **neumorphic UI** featuring a fluid **audio visualizer**, glassmorphic details, and a modern "Squircle" aesthetic that feels right at home on your device.
*   **AI Radio Host Persona**: Converts dry PDF notes into engaging, radio-style scripts. The AI host summarizes key concepts, uses analogies, and makes studying feel like listening to a favorite show.
*   **Smart Audio Engine**: Automatically **chunks large documents** to bypass generation limits, sewing them together into a seamless audio experience.
*   **Offline Ready**: Features a dedicated **Download/Save** button so you can keep your classes forever and listen without an internet connection.
*   **Full Playback Control**: Includes a custom gradient progress slider, variable speed playback (1x - 2x), history persistence, and auto-play logic.

### 2. 🚀 Zero to Hero (NEW!)
*Your personal AI Socratic Tutor.*

**Key Capabilities:**
*   **Socratic Method**: Instead of giving direct answers, this AI guide asks leading questions to help you derive the solution yourself.
*   **Concept Mastery**: Perfect for preparing for vivas, interviews, or deep-diving into fundamental concepts.
*   **Step-by-Step Guidance**: Breaks down complex problems into manageable cognitive steps.

### 3. 🖥️ J-Compiler: AI-Powered Code Studio
*A next-gen innovative IDE that simulates a full compiler environment using deep reasoning.*

**Key Capabilities:**
*   **Zero-Tolerance Debugging**: Acts as a **Pedantic Auditor**, scanning for typos, logic flaws, and architectural errors.
*   **Interactive Terminal Simulation**: Simulates a real shell session, handling `stdin`/`stdout` logically for a full execution flow.
*   **Markdown Audits**: Provides structured, high-level analysis of code health and potential edge cases.
*   **Auto-Correction**: Generates "100% Valid" fix suggestions that follow industry best practices.

### 4. 📽️ Agentic Content Generator
*A suite of tools to automate your academic workload.*

**Tools Available:**
*   **Presentation**: Generates full PPT slide decks with content structure.
*   **Report**: Creates detailed academic reports in Markdown/LaTeX format.
*   **Assignment**: Generates quizzes and practice questions from syllabus topics.
*   **Mini/Major Projects**: Architects entire project suites including abstracts, code structure, and documentation.

### 5. Resource Hub & Community
*   **Browse**: Navigate notes via Department → Semester → Subject.
*   **Upload**: Share resources (`PublicUploadModal`).
*   **Rank**: Upvote resources and view highly-rated materials (`CommunityFeed`).

---

## How to Use — Quick Walkthrough

Prerequisites: a Supabase project (for auth/storage) and an AI API key if you want remote model usage.

1.  **Sign up / Sign in**
    *   Use the registration flow (`Registration.jsx`) to create an account. Many features require authentication.

2.  **Navigate the Resource Hub**
    *   Use the main UI to filter by Department / Semester / Subject and explore or upload materials.

3.  **Generate Slides**
    *   Open the `AgenticPPTGenerator` from the UI, supply a topic and goals, then follow the prompts.
    *   Use the refine chat to edit slide text, layout, or visuals before exporting.

4.  **Use the J-Compiler**
    *   Open the compiler component (look for `JCompiler.jsx`) and paste code or describe desired behaviour.
    *   Run simulation: the component will present audit results and suggested fixes.

5.  **Create a Project**
    *   Use `ProjectGenerator.jsx` to run the interview flow. When complete, download the generated `.zip` containing docs and scaffolding.

6.  **Create a Podcast**
    *   Go to **AI Tutor > Podcast Classes**. Upload a PDF to generate and play an audio class.

---

## Setup & Development

### Frontend & Tech Stack
*   **Framework**: React 19 + Vite
*   **Styling**: Bootstrap 5 + Custom CSS (Claymorphism & Glassmorphism)
*   **Animations**: `framer-motion` for fluid state transitions.
*   **Icons**: `lucide-react`.
*   **AI Engine**: Puter.js (Accessing LFM-2.5, DeepSeek, etc.)
*   **Persistence**: Supabase (PostgreSQL) + LocalStorage.

### Installation

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/justin-john-mathew/ies-notes-clay.git
    cd ies-notes-clay
    npm install
    ```

2.  **Environment Setup**:
    Create a `.env` file in the project root with your Supabase credentials:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

3.  **Run Dev Server**:
    ```bash
    npm run dev
    ```

4.  **Build for Production**:
    ```bash
    npm run build
    ```

---

## Project Structure (High Level)

*   `src/` — React app source
    *   `App.jsx`, `main.jsx` — app entry points
    *   `supabaseClient.js` — Supabase initialization
    *   `components/` — AI components and UI (e.g., `PodcastClasses.jsx`, `JCompiler.jsx`, `AIChat.jsx`)
    *   `utils/` — AI service utilities, specialized logic (`puterUtils.js`, `pdfUtils.js`, `aiService.js`)
*   `public/` — static assets
*   `api/` — serverless-style API handlers (if used)

---

## Security & Troubleshooting

*   **Security**: Keep `VITE_SUPABASE_ANON_KEY` and any AI API keys out of public repos.
*   **AI Issues**: If AI features fail, check the browser console. Puter.js requires an active session (handled via popup).
*   **Supabase**: Ensure RLS policies are correctly configured for your table structure.

---

## Philosophy

**HOPE-Edu-Hub** prioritizes **Speed, Beauty, and Accuracy**. Every feature—from the Podcast Player to the J-Compiler—is designed to empower engineering students with the **superpowers** of AI, making learning faster, deeper, and more enjoyable.

**Developed with ❤️ for the HOPE Community.**
