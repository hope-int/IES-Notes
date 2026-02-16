# HOPE-Edu-Hub — User Guide & Features

HOPE-Edu-Hub is an AI-first educational notes and content platform built with React + Vite and Supabase for authentication and persistence. It bundles interactive AI tools (content generation, slide/project generation, and code simulation) with a community resource hub for students and educators.

This README contains a complete user guide, feature descriptions, quick setup, and developer notes.

**Table of contents**
- Overview
- Features (user-facing)
- How to use (walkthrough)
- Setup & Development
- Project structure
- Security & data notes
- Troubleshooting
- Contributing

---

## Overview

HOPE-Edu-Hub helps students and instructors create, share, and iterate on course materials using integrated AI assistants. Key capabilities include:

- AI-assisted note and slide generation
- Agentic project scaffolding and exporting
- An AI-powered J-Compiler that audits and simulates code
- Community feed with moderation and ranking
- Client-side persistence for generated PPTs and assets

---

## Features (User-facing)

1. J-Compiler (Code Studio)
   - Simulate code execution and interactive terminal flows.
   - Receive detailed Markdown-formatted diagnostics and suggested fixes.
   - Use reverse-engineer mode to generate code from desired outputs.

2. Agentic PPT / Web-Slides Generator
   - Multi-stage generation: planning, design, refine, and export.
   - Edit individual slides via chat-style interactions and export a self-contained HTML presentation.

3. Intelligent Project Architect
   - Guided interview prompts to collect requirements.
   - Produces documentation (Markdown), modular code skeletons, and a zipped bundle for download.

4. AI Chat & Content Generators
   - `AIChat` and `ContentGenerator` components provide text/content generation, paraphrasing, and summaries.

5. Resource Hub & Community
   - Browse notes via Department → Semester → Subject.
   - Upload and share resources (`PublicUploadModal`).
   - Upvote/rank resources and view community activity (`CommunityFeed`).

6. Persistence and Offline Support
   - Generated slides and PPT artifacts are saved with `pptDB.js` and optionally in IndexedDB for offline retrieval.

7. Admin & User Management
   - Admin panel and login modal for managing content and moderation.

---

## How to Use — Quick Walkthrough

Prerequisites: a Supabase project (for auth/storage) and an AI API key if you want remote model usage.

1. Sign up / Sign in
   - Use the registration flow (`Registration.jsx`) to create an account. Many features require authentication via Supabase (`supabaseClient.js`).

2. Navigate the Resource Hub
   - Use the main UI to filter by Department / Semester / Subject and explore or upload materials.

3. Generate Slides
   - Open the `AgenticPPTGenerator` from the UI, supply a topic and goals, then follow the prompts.
   - Use the refine chat to edit slide text, layout, or visuals before exporting.

4. Use the J-Compiler
   - Open the compiler component (look for `JCompiler.jsx`) and paste code or describe desired behaviour.
   - Run simulation: the component will present audit results and suggested fixes.

5. Create a Project
   - Use `ProjectGenerator.jsx` to run the interview flow. When complete, download the generated `.zip` containing docs and scaffolding.

6. Share and Moderate
   - Upload files via `PublicUploadModal.jsx`. Community ranking and AI moderation are applied automatically.

---

## Setup & Development

Clone and install dependencies:

```bash
git clone https://github.com/hope-int/IES-Notes.git
cd IES-Notes
npm install
```

Create a `.env` file in the project root with the following variables:

- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon/public key
- `VITE_AI_API_KEY` — (optional) key for any external AI service used by `api/ai-completion.js`

Run the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Notes:
- The repository uses Vite and React with JSX components located under `src/`.
- `api/ai-completion.js` provides a serverless-style endpoint for AI completions — inspect before enabling externally.

---

## Project Structure (high level)

- `src/` — React app source
  - `App.jsx`, `main.jsx` — app entry points
  - `supabaseClient.js` — Supabase initialization and helper functions
  - `components/` — AI components and content generators (e.g., `AgenticPPTGenerator.jsx`, `ProjectGenerator.jsx`, `JCompiler.jsx`)
  - `utils/` — AI service utilities, IndexedDB helpers, PPT rendering plans (`aiService.js`, `pptDB.js`, `indexedDB.js`)
- `api/` — simple serverless-style API handlers (e.g., `ai-completion.js`)
- `public/` — static assets and dataset
- `create_syllabus_folders.py` — helper script for generating folder scaffolding

---

## Security & Data Notes

- Keep `VITE_SUPABASE_ANON_KEY` and any AI API keys out of public repos. Use environment variables in deployment.
- `api/ai-completion.js` should be reviewed before exposing a public endpoint; it may proxy requests to external AI services and could leak keys if misconfigured.
- Uploaded content is stored via Supabase — review RLS policies in your Supabase project for access control.

---

## Troubleshooting

- If the app fails to start, run `npm install` again and confirm `.env` values are set.
- If AI features are not responding, check the API key and logs for `api/ai-completion.js` requests.
- For Supabase auth issues, verify that your project's URL and anon key are correct and that the project's CORS and redirect settings allow your dev server origin.

---

## Contributing

- Contributions are welcome. Typical workflow:
  1. Fork the repo
  2. Create a feature branch
  3. Open a PR describing changes and the motivation

---

## License & Attribution

State your license here (e.g., MIT) or add a `LICENSE` file.

---

If you want, I can also:
- add a short `DEVELOPER.md` for component-level notes
- run the app locally in the container and verify the dev server
- extract and document the API surface for `api/ai-completion.js` and `supabaseClient.js`

Tell me which of those you'd like me to do next.
