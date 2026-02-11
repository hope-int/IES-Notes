# IES Notes: The Future of Academic Learning 🚀✨

![IES Notes](http://via.placeholder.com/1200x500?text=IES+Notes:+Your+Academic+Superpower)

## 🌟 What is IES Notes?
**IES Notes** is not just a study app; it's an **AI-powered academic ecosystem** designed exclusively for the students of IES College of Engineering. We've transformed the traditional way of accessing notes into a dynamic, interactive, and intelligent experience.

It combines **instant access to study materials** with a **safe, real-time community** and a personal **AI Tutor** that knows your syllabus inside out.

---

## 🤖 Why This is Innovative for Students?

This platform solves the biggest pain points of engineering students:

### 1. **Visual Learning with "Justin AI"** 🧠🎨
Most AI chatbots just give you text. **Justin AI** (our custom-built tutor based on aurora-alpha) goes further:
- **Draws Diagrams**: Ask for a flowchart or block diagram, and it renders a crisp Mermaid chart or SVG instantly.
- **Solves Math**: Handles complex engineering math with LaTeX rendering.
- **Context-Aware**: It knows your name, department, semester, and syllabus. It doesn't just "guess"; it tutors you based on your curriculum.
- **Smart History**: Remembers your previous study sessions so you can pick up right where you left off.

### 2. **A Fair & Safe Community** ⚖️🗳️
We've built a social space that encourages quality discussion:
- **One-User-One-Vote**: A robust, database-backed voting system ensures that the best content rises to the top ("Hot" sorting).
- **Vote Toggling**: Flexible interaction allows you to change your mind freely.
- **Auto-Moderation**: An intelligent system automatically filters profanity and warns/bans bad actors, keeping the space safe for everyone without constant manual oversight.

### 3. **Seamless Access & Sync** 🔄📲
- **UID-Based Login**: No passwords to forget. Your unique student ID is your key.
- **Device Agnostic**: Start reading on your laptop, continue on your phone. Your favorites, chats, and feed sync instantly.
- **PWA Ready**: Install it as a native app on your phone for offline-first capabilities.

---

## ✨ Key Features Breakdown

### 📚 Intelligent Content Management
- **Hierarchical Browsing**: Navigate effortlessly: **Department > Semester > Subject**.
- **Smart Filters**: Toggle between "Core" and "Labs" instantly.
- **Direct Resource Links**: One-tap access to notes hosted on Google Drive or other clouds.

### 💬 Real-Time Community Feed
- **Live Updates**: See new posts and announcements the moment they happen.
- **Threaded Comments**: Engage in deep discussions with classmates.
- **Dynamic Sorting**: View "New" posts or see what's "Hot" based on our custom ranking algorithm.

### 🛡️ Student Dashboard & Security
- **Personal Profile**: Track your contributions and standing.
- **Admin Panel**: Powerful tools for faculty to manage content and users.
- **Privacy First**: Secure Row Level Security (RLS) ensures your data is only yours.

---

## 🛠️ Built With Modern Tech

- **Frontend**: React 18, Vite, Framer Motion (for buttery smooth animations).
- **Backend & Realtime**: Supabase (PostgreSQL, Auth, Realtime Subscriptions).
- **AI Engine**: Google aurora-alpha (via OpenRouter).
- **Rendering**: Mermaid.js (Diagrams), KaTeX (Math), Lucide React (Icons).
- **Styling**: Bootstrap 5 + Custom Glassmorphism CSS.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- A Supabase Project

### Installation

1.  **Clone the Repo**:
    ```bash
    git clone https://github.com/your-username/ies-notes-clay.git
    cd ies-notes-clay
    ```

2.  **Install Magic**:
    ```bash
    npm install
    ```

3.  **Configure Env**:
    Create a `.env` file:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    VITE_OPENROUTER_API_KEY=your_openrouter_key
    ```

4.  **Launch**:
    ```bash
    npm run dev
    ```

---

## 🤝 Join the Innovation
This project is a testament to what students can build for students. 

**Developed with ❤️ for IES College of Engineering.**
