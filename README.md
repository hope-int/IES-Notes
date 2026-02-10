# IES Notes: Your Academic Superpower 🚀

IES Notes is a comprehensive academic resource platform built for students and faculty. It provides a seamless way to share, manage, and access study materials while fostering a safe and engaging community.

![IES Notes Banner](/home/justin/.gemini/antigravity/brain/750515e9-45e4-4d17-984a-f8b72d5a4ebb/uploaded_media_1770734276020.png)

## ✨ Key Features

### 📚 Content Management System
- **Hierarchical Browsing**: Navigate resources by **Department > Semester > Subject**.
- **Smart Uploads**: Share notes via direct links (Google Drive, etc.) with titles and descriptions.
- **Admin Control**: Create new Departments, Semesters, and Subjects on the fly.

### 🛡️ User Management & Security
- **Role-Based Access Control (RBAC)**: Secure Admin Panel for managing the platform.
- **User Moderation**:
    - **Search**: Find users instantly.
    - **Warn**: Send warnings for inappropriate behavior.
    - **Ban**: Automatically or manually ban users from posting.
    - **Delete**: Remove user accounts.
- **Automated Moderation**:
    - **Profanity Filter**: Blocks harmful language in real-time.
    - **Three-Strike Rule**: Users are auto-banned after 3 warnings.

### 💬 Community & Engagement
- **Updates Feed**: Real-time announcements for students.
- **Favorites**: Save frequently accessed subjects for quick access.
- **Dark Mode**: Automatic theme switching based on preference.

## 🛠️ Technology Stack

- **Frontend**: React, Vite, Framer Motion (Animations), Lucide React (Icons), Bootstrap 5.
- **Backend**: Supabase (PostgreSQL, Authentication, Realtime, Storage).
- **Security**: Row Level Security (RLS) Policies, PostgreSQL RPC Functions.

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- Supabase Project

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/ies-notes.git
    cd ies-notes-clay
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    Create a `.env` file in the root directory:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Database Setup**:
    Run the SQL scripts located in `admin_scripts/` in your Supabase SQL Editor to set up tables and security policies. Start with `admin_setup_script.sql` and then `admin_updates.sql`.

5.  **Run the app**:
    ```bash
    npm run dev
    ```

## 🔐 Security Overview

- **SQL Injection Protection**: All client-side queries use Supabase's parameterized ORM. Server-side RPCs (`admin_updates.sql`) use PL/pgSQL strict typing and parameterized inputs.
- **XSS Protection**: React automatically escapes content. No usage of `dangerouslySetInnerHTML`.
- **Access Control**: Critical administrative actions (Warn, Ban, Delete) are protected by **Row Level Security (RLS)** policies and `SECURITY DEFINER` functions that strictly enforce `is_admin` checks on the server side.

## 📂 Project Structure

```
ies-notes-clay/
├── src/
│   ├── components/       # Reusable UI components
│   ├── AdminPanel.jsx    # Admin Dashboard & Moderation
│   ├── App.jsx           # Main Application Logic
│   ├── CommunityFeed.jsx # Social Features
│   └── supabaseClient.js # Supabase Configuration
├── admin_scripts/        # Database Schema & Security Scripts
├── public/               # Static Assets
└── package.json          # Dependencies
```

## 🤝 Contributing
Contributions are welcome! Please open an issue or submit a pull request.

---
**Developed with ❤️ for IES College of Engineering.**
