# 🎓 HOPE-Edu-Hub: The Academic Super-Platform

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.io/)
[![Puter](https://img.shields.io/badge/Puter-Infrastructure-blue?style=for-the-badge)](https://puter.com/)

**HOPE-Edu-Hub** is an AI-first educational ecosystem designed to empower students and educators. It transforms static notes into dynamic learning experiences through integrated AI agents, specialized content generators, and a pro-grade productivity suite.

---

## 🚀 Key Modules & Product Suites

### 📝 HOPE Docs (Professional Writing Suite) [BETA]
A high-fidelity document editor inspired by Google Docs, built for academic writing.
- **A4 Digital Canvas**: Pixel-perfect A4 layout with professional margins and physical paper simulation.
- **Native PDF Engine**: Instant export to PDF preserving all rich-text formatting.
- **Auto-Sync Storage**: Debounced persistence to LocalStorage and cloud, ensuring zero data loss.
- **Rich Editor**: Powered by Tiptap with support for headings, lists, quotes, and code blocks.

### 📊 HOPE Sheets (Engineering Spreadsheets) [BETA]
A minimalist, high-performance spreadsheet engine for data analysis and engineering calculations.
- **High-Density Grid**: Virtualized rendering for seamless 100x26 grid navigation.
- **O(1) Update Logic**: Direct-indexing engine to eliminate typing lag in large datasets.
- **Formula Bar**: Dedicated `fx` input area with selection tracking and cell context.
- **Minimalist Aesthetic**: Clean, glassmorphic design focused on data visibility.

### 💻 J-Compiler (AI Code Studio)
An interactive development environment for students to learn and simulate terminal logic.
- **Virtual Execution**: AI-powered simulations of code logic and terminal outputs.
- **Intelligent Linter**: Real-time breakdown of syntax errors and logic flaws.
- **Markdown Docs**: Generates clean, documented explanations for complex code snippets.

### 🎙️ Podcast Class & Revision Kits
Revolutionizing how students consume notes.
- **AI Narration**: Converts PDF/Text into immersive audio classes.
- **Study Handbooks**: Generates concise, exam-ready revision kits with 2-column print layouts.
- **Variable Audio**: Multi-speed playback and offline MP3 downloads.

### 🤖 24/7 Agentic Tutor Suite
Your personalized learning companion.
- **Hero Chat**: Context-aware AI tutor with session memory and profile adaptation.
- **Study Roadmaps**: Dynamically generated career and skill paths based on user goals.
- **Instant Slides**: AI Presentation generator that creates slide decks from prompt to PPTX.

---

## 🛠️ Tech Stack & Architecture

### Frontend Architecture
- **Framework**: React 19 (Main), Next.js App Router (Integrated Modules)
- **Styling**: Tailwind CSS v4 (Native Vite Integration)
- **State Management**: React Context + Hooks + LocalStorage Persistence
- **Animations**: Framer Motion for premium micro-interactions

### Engineering & Libraries
- **Spreadsheet Engine**: `@silevis/reactgrid`
- **Text Editor**: `@tiptap/react` + Starter Kit
- **AI Core**: Google Gemini 2.0 Flash / OpenRouter Integration
- **Backend & Auth**: Supabase (PostgreSQL, RLS, Storage)
- **Cloud Infrastructure**: Puter.js (Edge compute and file orchestration)

---

## 📂 Project Structure

```bash
├── src/
│   ├── components/
│   │   ├── HopeDocs/      # Document editor suite
│   │   ├── HopeSheets/    # Spreadsheet engine
│   │   ├── AITutor/       # AI Chat and Dashboard
│   │   ├── Presentation/  # Slide generation logic
│   │   └── Roadmap/       # Career path visualization
│   ├── utils/             # AI prompts and shared storage logic
│   ├── index.css          # Tailwind v4 configuration and global themes
│   └── App.jsx            # Routing and Global Navigation
├── vite.config.js         # Optimized build pipeline with Tailwind v4 plugin
└── README.md              # Project Documentation
```

---

## ⚙️ Development Setup

### Prerequisites
- Node.js (v18+)
- NPM or PNPM
- Supabase Project credentials

### Installation & Launch
1. **Repository Setup**
   ```bash
   git clone https://github.com/hope-int/IES-Notes.git
   cd IES-Notes
   ```

2. **Dependency Installation**
   ```bash
   npm install --legacy-peer-deps  # Required for React 19 + Spreadsheet compatibility
   ```

3. **Environment Setup**
   Configure `.env`:
   ```env
   VITE_SUPABASE_URL=your_url
   VITE_SUPABASE_ANON_KEY=your_key
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

---

## 🛡️ Security & Privacy
- **Row Level Security (RLS)**: Every user's documents and sheets are sandboxed at the database level.
- **Encrypted Persistence**: Sensitive user preferences are handled via secure session tokens.
- **Local-First Design**: Auto-save engines prioritize local speed before cloud synchronization.

---

<p align="center">
  Built with ❤️ for the future of education by the <b>HOPE Team</b>
</p>
