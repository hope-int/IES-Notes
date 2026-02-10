
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, ExternalLink, Search, Book, Zap, Database, Code, FolderPlus,
  Cpu, ChevronRight, ArrowLeft, Users, Building, Settings,
  FileText, Heart, Shield, LogOut, User, Bell, MessageCircle, Home, Upload, Download, Sparkles
} from 'lucide-react';
import { supabase } from './supabaseClient';
import Registration from './Registration';
import PublicUploadModal from './PublicUploadModal';
import CreateFolderModal from './CreateFolderModal';
import AdminPanel from './AdminPanel';
import AdminLoginModal from './AdminLoginModal';
import StudentProfile from './StudentProfile';

import CommunityFeed from './CommunityFeed';
import AIChat from './AIChat';
import { getDeviceId, getClientIp } from './utils/deviceUtils';
import 'bootstrap/dist/css/bootstrap.min.css';

// Mapping string icon names to components
const iconMap = {
  Code: Code,
  Database: Database,
  Zap: Zap,
  Cpu: Cpu,
  Book: Book,
  Users: Users,
  Building: Building,
  Settings: Settings,
};

function App() {
  // ... (state definitions are kept, just targeting the top imports effectively via context, but strict replacement requires matching lines)
  // Actually, I can just target the import block and the render block separately or together if close.
  // They are far apart. I will do two chunks.
  // Wait, I can only do ONE contiguous chunk with replace_file_content.
  // I should use multi_replace_file_content.
  // Auth State
  const [session, setSession] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);


  const [activeTab, setActiveTab] = useState('home');

  // Warning State
  const [warningMessage, setWarningMessage] = useState(null);
  const [showWarningModal, setShowWarningModal] = useState(false);

  // Navigation State
  const [navStack, setNavStack] = useState([{ type: 'home', title: 'Home', id: null }]);

  // Data State
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [notes, setNotes] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [activeFilter, setActiveFilter] = useState('My');
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('ies-favorites');
    return saved ? JSON.parse(saved) : [];
  });

  // --- Effects ---

  useEffect(() => {
    checkUserStatus();

    // Listen for Auth changes (for Admins)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserStatus = async () => {
    // 1. Check Local Storage for Student Profile (Main Flow)
    const storedProfile = localStorage.getItem('ies_student_profile');
    if (storedProfile) {
      const profile = JSON.parse(storedProfile);
      setUserProfile(profile);

      // DEEP LINKING: Start at Semester View if ID exists
      if (profile.semester_id) {
        setNavStack([
          { type: 'sem', id: profile.semester_id, title: profile.semester_name || 'My Semester' }
        ]);
        // Pre-fetch subjects for this view
        await fetchSubjects(profile.semester_id);
      }
      setInitializing(false);
      return;
    }

    // 2. Check Supabase Session (For Admins / Fallback)
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setSession(session);
      await fetchProfile(session.user.id);
    } else {
      // 3. Fallback: Auto-Login via Device ID
      const deviceId = getDeviceId();
      // Only attempt if we have a device ID (always true due to getter)
      const { data: deviceLink } = await supabase
        .from('user_devices')
        .select('user_id')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (deviceLink?.user_id) {
        console.log("Device recognized, logging in...", deviceLink.user_id);
        await fetchProfile(deviceLink.user_id);
      }
    }

    setInitializing(false);
  };

  const fetchProfile = async (userId) => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profile) {
      setUserProfile(profile);
      if (profile.is_admin) {
        setShowAdmin(true);
      }
      if (profile.latest_warning_message) {
        setWarningMessage(profile.latest_warning_message);
        setShowWarningModal(true);
      }
    }
  };

  const dismissWarning = async () => {
    if (!userProfile) return;
    setShowWarningModal(false);

    // Attempt to clear warning on server
    try {
      const { error } = await supabase.from('profiles').update({ latest_warning_message: null }).eq('id', userProfile.id);
      if (error) throw error;
      setWarningMessage(null);
    } catch (err) {
      console.error("Failed to dismiss warning", err);
    }
  };

  const handleRegistrationComplete = async (profile) => {
    setUserProfile(profile);
    if (profile.semester_id) {
      setNavStack([
        { type: 'sem', id: profile.semester_id, title: profile.semester_name || 'My Semester' }
      ]);
      await fetchSubjects(profile.semester_id);
    }
  };

  useEffect(() => {
    // Fetch initial data if user is logged in (either session or local profile)
    if (session || userProfile) {
      // If we are at 'home', fetch depts (though we might skip home now)
      if (navStack[0].type === 'home') fetchDepartments();
      fetchAnnouncements();
    }
  }, [session, userProfile]);

  useEffect(() => {
    localStorage.setItem('ies-favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // --- Data Fetching ---

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('content')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5);
    setAnnouncements(data || []);
  };

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('departments').select('*');
      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSemesters = async (deptId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('semesters')
        .select('*')
        .eq('department_id', deptId)
        .order('name');
      if (error) throw error;
      setSemesters(data || []);
    } catch (error) {
      console.error('Error fetching semesters:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async (semId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('semester_id', semId)
        .order('name');
      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotes = async (subjectId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- Navigation Handlers ---

  const currentView = navStack[navStack.length - 1];

  const handleNavigate = async (item, nextType) => {
    setNavStack([...navStack, { type: nextType, title: item.name || item.title, id: item.id, data: item }]);
    setSearchTerm('');
    setActiveFilter('All');

    if (nextType === 'dept') {
      await fetchSemesters(item.id);
    } else if (nextType === 'sem') {
      await fetchSubjects(item.id);
    } else if (nextType === 'subject') {
      await fetchNotes(item.id);
    }
  };

  const handleBack = () => {
    if (navStack.length > 1) {
      const prevStack = navStack.slice(0, -1);
      setNavStack(prevStack);

      const prevView = prevStack[prevStack.length - 1];
      if (prevView.type === 'home') fetchDepartments();
      else if (prevView.type === 'dept') fetchSemesters(prevView.id);
      else if (prevView.type === 'sem') fetchSubjects(prevView.id);
    }
  };

  const handleBreadcrumbClick = (index) => {
    const newStack = navStack.slice(0, index + 1);
    setNavStack(newStack);

    const view = newStack[newStack.length - 1];
    if (view.type === 'home') fetchDepartments();
    else if (view.type === 'dept') fetchSemesters(view.id);
    else if (view.type === 'sem') fetchSubjects(view.id);
  };

  const toggleFavorite = (e, item) => {
    e.stopPropagation();
    if (favorites.some(fav => fav.id === item.id)) {
      setFavorites(favorites.filter(fav => fav.id !== item.id));
    } else {
      setFavorites([...favorites, item]);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('ies_student_profile');
    setShowAdmin(false);
    setUserProfile(null);
    setNavStack([{ type: 'home', title: 'Home', id: null }]);
  };

  // --- Filtering ---

  const getFilteredItems = () => {
    let list = [];
    if (currentView.type === 'favorites') list = favorites;
    else if (currentView.type === 'home') list = departments;
    else if (currentView.type === 'dept') list = semesters;
    else if (currentView.type === 'sem') list = subjects;
    else if (currentView.type === 'subject') list = notes;

    if (searchTerm) {
      list = list.filter(item =>
        (item.name || item.title).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (currentView.type === 'sem' && activeFilter !== 'All' && activeFilter !== 'My') {
      if (activeFilter === 'Labs') list = list.filter(item => item.name.toLowerCase().includes('lab'));
      if (activeFilter === 'Core') list = list.filter(item => !item.name.toLowerCase().includes('lab'));
    }

    return list;
  };

  const filteredItems = getFilteredItems();

  const renderIcon = (iconName) => {
    const IconComponent = iconMap[iconName] || Folder;
    return <IconComponent size={40} />;
  };

  // Refresh Helper
  const refreshCurrentView = async () => {
    if (currentView.type === 'home') await fetchDepartments();
    else if (currentView.type === 'dept') await fetchSemesters(currentView.id);
    else if (currentView.type === 'sem') await fetchSubjects(currentView.id);
    else if (currentView.type === 'subject') await fetchNotes(currentView.id);
  };

  if (initializing) return <div className="text-center min-vh-100 d-flex align-items-center justify-content-center"><div className="spinner-border text-primary" role="status"></div></div>;

  if (!session && !userProfile) return <Registration onComplete={handleRegistrationComplete} />;

  if (showAdmin) return <AdminPanel onBack={() => setShowAdmin(false)} />;
  if (showProfile) return (
    <StudentProfile
      session={session}
      onBack={() => setShowProfile(false)}
      refreshProfile={() => fetchProfile(session?.user?.id || userProfile?.id)}
      onLogout={handleLogout}
      onOpenAdmin={() => setShowAdmin(true)}
    />
  );

  return (
    <div className="min-vh-100 pb-5 transition-colors">
      {/* Navigation / Header */}
      <nav className="container py-4 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-4">
          <div
            onClick={() => setShowAdminLogin(true)}
            className="d-flex align-items-center gap-2 cursor-pointer"
          >
            <div className="clay-card d-flex align-items-center justify-content-center p-2 rounded-3">
              <Book size={28} style={{ color: 'var(--primary-accent)' }} />
            </div>
            <span className="fw-bold fs-3 d-none d-md-block lh-1" style={{ color: 'var(--text-main)' }}>IES<span style={{ color: 'var(--primary-accent)' }}>Notes</span></span>
          </div >

          <div className="d-none d-md-flex align-items-center gap-2 overflow-auto ms-3 hide-scrollbar" style={{ maxWidth: '40vw' }}>
            {navStack.map((step, index) => (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRight size={14} className="text-muted mx-1" />}
                <span
                  onClick={() => handleBreadcrumbClick(index)}
                  className={`text - nowrap px - 2 py - 1 rounded transition - all ${index === navStack.length - 1 ? 'fw-bold bg-white shadow-sm' : 'text-muted'} `}
                  style={{
                    cursor: 'pointer',
                    color: index === navStack.length - 1 ? 'var(--primary-accent)' : undefined
                  }}
                >
                  {step.type === 'home' ? 'Home' : step.title}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div >

        <div className="d-flex align-items-center gap-3">
          {/* Favorites Button */}
          {/* Favorites Button */}
          <button
            onClick={() => {
              if (currentView.type === 'favorites') {
                setNavStack(prev => prev.slice(0, -1)); // Toggle Off (Go Back)
              } else {
                setNavStack(prev => [...prev, { type: 'favorites', title: 'My Favorites', id: 'favs' }]); // Toggle On
              }
            }}
            className={`clay - button p - 2 rounded - circle d - flex align - items - center justify - content - center ${currentView.type === 'favorites' ? 'active-fav-btn' : ''} `}
            style={{ width: '48px', height: '48px', padding: 0, background: currentView.type === 'favorites' ? 'var(--secondary-accent)' : undefined }}
            title="My Favorites"
          >
            <Heart size={22} className={favorites.length > 0 ? "text-danger" : ""} fill={favorites.length > 0 || currentView.type === 'favorites' ? "currentColor" : "none"} />
          </button>

          {/* Profile Pill - Student Dashboard */}
          <div
            onClick={() => setShowProfile(true)}
            className="d-none d-md-flex clay-card rounded-pill align-items-center gap-3 pe-4 ps-2 py-2 cursor-pointer hover-scale"
            style={{ maxHeight: '48px', transition: 'transform 0.2s' }}
            title="Student Dashboard"
          >
            <div className="bg-light rounded-circle p-1 d-flex shadow-inner align-items-center justify-content-center" style={{ width: 32, height: 32 }}>
              {userProfile && userProfile.full_name ? (
                <span className="fw-bold text-primary">{userProfile.full_name.charAt(0).toUpperCase()}</span>
              ) : (
                <User size={20} className="text-primary" />
              )}
            </div>
            <span className="fw-bold" style={{ color: 'var(--text-main)' }}>
              {userProfile && userProfile.full_name ? userProfile.full_name : 'Student'}
            </span>
            <Settings size={16} className="text-muted ms-2" />
          </div>

          {/* Mobile Menu Button - Also opens Dashboard */}
          <button
            onClick={() => setShowProfile(true)}
            className="d-flex d-md-none clay-button p-2 rounded-circle align-items-center justify-content-center"
            style={{ width: '48px', height: '48px', padding: 0 }}
          >
            <span className="fw-bold text-primary">{userProfile?.full_name?.charAt(0) || <User size={22} />}</span>
          </button>
        </div>
      </nav >

      <AnimatePresence>
        {/* Header - Always Visible */}
        <motion.header
          className="container px-md-5 position-relative overflow-hidden mt-2 mb-5"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <div className="row align-items-center gy-5 gx-lg-5">
            <div className="col-lg-6 text-center text-lg-start z-1">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <h1 className="fw-bolder display-3 mb-3 lh-sm" style={{ color: 'var(--text-main)' }}>
                  {userProfile ? (
                    currentView.type === 'favorites' ? (
                      <>
                        <span className="text-gradient">My Favorites</span>
                        <span className="fs-2 text-muted fw-normal d-block mt-2">
                          Your saved shortcuts
                        </span>
                      </>
                    ) : (
                      <>
                        Welcome, <span className="text-gradient">{userProfile.full_name?.split(' ')[0]}</span>
                        <br />
                        <span className="fs-2 text-muted fw-normal d-block mt-2">
                          {userProfile.department} {userProfile.semester && `• ${userProfile.semester} `}
                        </span>
                      </>
                    )
                  ) : (
                    <>
                      Your Academic <br /> <span className="text-gradient">Superpower</span>
                    </>
                  )}
                </h1>
                <p className="text-muted fs-5 mb-5">Access all your IES College notes. Developed by Justin.</p>
              </motion.div>
            </div>
            <div className="col-lg-6 z-1 ps-lg-5">
              <div className="clay-card p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h4 className="fw-bold mb-0">Latest Updates</h4>
                  <Bell size={20} className="text-muted" />
                </div>
                {announcements.length > 0 ? announcements.map((ann, i) => (
                  <div key={i} className="glass-panel p-2 mb-2 rounded d-flex align-items-center gap-2">
                    <div className="bg-primary rounded-circle" style={{ width: 6, height: 6 }}></div>
                    {ann.content}
                  </div>
                )) : <p className="text-muted small">No new updates.</p>}
              </div>
            </div>
          </div>
        </motion.header>
      </AnimatePresence>

      <section className="container mt-4 pb-5">
        {activeTab === 'home' && (
          <>
            {/* Controls */}
            <div className="row mb-5 align-items-center justify-content-center g-3">
              <div className="col-12 col-lg-8 d-flex align-items-center gap-3">
                {navStack.length > 1 && (
                  <button onClick={handleBack} className="clay-button rounded-circle p-0" style={{ width: '56px', height: '56px' }}>
                    <ArrowLeft size={24} />
                  </button>
                )}
                <div className="clay-card p-2 rounded-pill d-flex align-items-center flex-grow-1 ps-4 shadow-sm">
                  <Search size={22} className="text-muted" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="clay-input bg-transparent shadow-none border-0 p-3 ms-2 w-100 fs-5"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Admin Only: Create Folder Button */}
                {userProfile?.is_admin && (currentView.type === 'dept' || currentView.type === 'sem') && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn btn-light rounded-circle p-0 shadow-sm d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: '56px', height: '56px', border: 'none', background: 'var(--clay-bg)' }}
                    title="Add Folder"
                  >
                    <FolderPlus size={24} className="text-secondary" />
                  </button>
                )}

                {/* Admin Only: Upload Button */}
                {userProfile?.is_admin && currentView.type === 'subject' && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="btn btn-primary rounded-circle p-0 shadow-sm d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: '56px', height: '56px', background: 'var(--primary-accent)', border: 'none' }}
                    title="Upload Note"
                  >
                    <Upload size={24} />
                  </button>
                )}
              </div>
              {/* Global Scope & Filters */}
              <div className="col-12 d-flex gap-2 justify-content-center flex-wrap">
                {/* My vs All Scope */}
                <button
                  onClick={() => {
                    if (userProfile?.semester_id) {
                      setActiveFilter('My');
                      // Reset stack to just the semester view
                      setNavStack([
                        { type: 'sem', id: userProfile.semester_id, title: userProfile.semester_name || 'My Semester' }
                      ]);
                      fetchSubjects(userProfile.semester_id);
                    }
                  }}
                  className={`btn rounded - pill px - 4 py - 2 fw - bold border - 0 ${activeFilter === 'My' ? 'text-white' : 'text-muted'} `}
                  style={{ background: activeFilter === 'My' ? 'var(--primary-accent)' : 'var(--clay-bg)' }}
                >
                  My
                </button>

                <button
                  onClick={() => {
                    setActiveFilter('All');
                    setNavStack([{ type: 'home', title: 'Home', id: null }]);
                    fetchDepartments();
                  }}
                  className={`btn rounded - pill px - 4 py - 2 fw - bold border - 0 ${activeFilter === 'All' && currentView.type === 'home' ? 'text-white' : 'text-muted'} `}
                  style={{ background: activeFilter === 'All' && currentView.type === 'home' ? 'var(--primary-accent)' : 'var(--clay-bg)' }}
                >
                  All
                </button>

                {/* Subject Filters (Only visible in Semester View) */}
                {currentView.type === 'sem' && (
                  <>
                    <div className="vr mx-2"></div>
                    {['Core', 'Labs'].map(filter => (
                      <button
                        key={filter}
                        onClick={() => setActiveFilter(filter)}
                        className={`btn rounded - pill px - 4 py - 2 fw - bold border - 0 ${activeFilter === filter ? 'text-white' : 'text-muted'} `}
                        style={{ background: activeFilter === filter ? 'var(--primary-accent)' : 'var(--clay-bg)' }}
                      >
                        {filter}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Loading State */}
            {loading ? (
              <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>
            ) : (
              <motion.div className="row g-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Empty State */}
                {!loading && filteredItems.length === 0 && (
                  <div className="text-center w-100 text-muted">No items found.</div>
                )}

                {filteredItems.map((item) => (
                  <div className="col-12 col-md-6 col-lg-4" key={item.id}>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="h-100"
                      onClick={() => {
                        if (currentView.type === 'home') handleNavigate(item, 'dept');
                        else if (currentView.type === 'dept') handleNavigate(item, 'sem');
                        else if (currentView.type === 'sem') handleNavigate(item, 'subject');
                        else if (currentView.type === 'favorites') {
                          // Intelligent navigation based on item content
                          if (item.file_url) window.open(item.file_url, '_blank');
                          else handleNavigate(item, 'subject'); // Assume it's a subject folder
                        }
                      }}
                    >
                      {currentView.type === 'subject' || (currentView.type === 'favorites' && item.file_url) ? (
                        <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="text-decoration-none text-dark d-block h-100">
                          <div className="clay-card h-100 p-4 d-flex flex-column gap-3">
                            <div className="d-flex justify-content-between">
                              <div className="p-3 bg-light rounded-4"><FileText size={28} className="text-danger" /></div>
                              <Download size={20} className="text-muted" />
                            </div>
                            <div>
                              <h6 className="fw-bold mb-1">{item.title || item.name}</h6>
                              <small className="text-muted">{item.year ? `Year: ${item.year} ` : '2026'}</small>
                              {item.description && <p className="small text-muted mb-0 mt-1 text-truncate">{item.description}</p>}
                            </div>
                          </div>
                        </a>
                      ) : currentView.type === 'sem' || (currentView.type === 'favorites' && !item.file_url) ? (
                        <div className="clay-card h-100 p-4 d-flex flex-column gap-3 cursor-pointer">
                          <div className="d-flex justify-content-between">
                            <div className="p-3 bg-light rounded-4"><Book size={28} className="text-primary" /></div>
                            <button onClick={(e) => toggleFavorite(e, item)} className="btn btn-link p-0 text-muted">
                              <Heart size={24} fill={favorites.some(f => f.id === item.id) ? "red" : "none"} className={favorites.some(f => f.id === item.id) ? "text-danger" : ""} />
                            </button>
                          </div>
                          <div>
                            <h5 className="fw-bold mb-1">{item.name || item.title}</h5>
                            <small className="text-muted">Tap to view notes</small>
                          </div>
                        </div>
                      ) : (
                        <div className="clay-card h-100 p-4 d-flex align-items-center gap-3 cursor-pointer">
                          <div className="p-3 bg-light rounded-4">
                            {currentView.type === 'home' ? renderIcon(item.icon) : <Folder size={32} />}
                          </div>
                          <span className="fw-bold fs-5">{item.name}</span>
                        </div>
                      )}
                    </motion.div>
                  </div>
                ))}
              </motion.div>

            )}
          </>
        )}
      </section>

      {/* Community Tab */}
      {activeTab === 'community' && <CommunityFeed profile={userProfile} />}

      {/* AI Tutor Tab */}
      {activeTab === 'ai' && <AIChat profile={userProfile} setActiveTab={setActiveTab} />}

      {/* Floating Navigation Bar */}
      <div className="position-fixed bottom-0 start-0 w-100 p-3 z-3 d-flex justify-content-center" style={{ pointerEvents: 'none' }}>
        <div className="clay-card rounded-pill p-2 d-flex gap-2 shadow-lg" style={{ pointerEvents: 'auto', background: 'rgba(255, 255, 255, 0.9)' }}>
          <button
            onClick={() => setActiveTab('home')}
            className={`btn rounded-pill px-4 py-2 d-flex align-items-center gap-2 fw-bold transition-all ${activeTab === 'home' ? 'bg-primary text-white shadow' : 'text-muted hover-bg-light'}`}
          >
            <Home size={20} /> <span className={activeTab === 'home' ? 'd-inline' : 'd-none d-sm-inline'}>Home</span>
          </button>
          <button
            onClick={() => setActiveTab('community')}
            className={`btn rounded-pill px-4 py-2 d-flex align-items-center gap-2 fw-bold transition-all ${activeTab === 'community' ? 'bg-primary text-white shadow' : 'text-muted hover-bg-light'}`}
          >
            <MessageCircle size={20} /> <span className={activeTab === 'community' ? 'd-inline' : 'd-none d-sm-inline'}>Community</span>
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`btn rounded-pill px-4 py-2 d-flex align-items-center gap-2 fw-bold transition-all ${activeTab === 'ai' ? 'bg-primary text-white shadow' : 'text-muted hover-bg-light'}`}
          >
            <Sparkles size={20} /> <span className={activeTab === 'ai' ? 'd-inline' : 'd-none d-sm-inline'}>AI Tutor</span>
          </button>
        </div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <PublicUploadModal
            subjectId={currentView.data?.id}
            onClose={() => setShowUploadModal(false)}
            onUploadSuccess={refreshCurrentView}
          />
        )}
      </AnimatePresence>

      {/* Create Folder Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateFolderModal
            type={currentView.type === 'dept' ? 'sem' : 'subject'}
            parentId={currentView.data?.id}
            onClose={() => setShowCreateModal(false)}
            onSuccess={refreshCurrentView}
          />
        )}
      </AnimatePresence>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showAdminLogin && (
          <AdminLoginModal
            isOpen={showAdminLogin}
            onClose={() => setShowAdminLogin(false)}
            onLoginSuccess={(session) => {
              setSession(session);
              fetchProfile(session.user.id);
              setShowAdminLogin(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Warning Modal */}
      <AnimatePresence>
        {showWarningModal && (
          <div className="modal-overlay d-flex align-items-center justify-content-center" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000 }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-4 rounded-4 shadow-lg text-center mx-3"
              style={{ maxWidth: '400px' }}
            >
              <div className="mb-3 text-warning">
                <Shield size={48} />
              </div>
              <h4 className="fw-bold text-danger">Community Warning</h4>
              <p className="text-muted mb-4">{warningMessage}</p>
              <button onClick={dismissWarning} className="btn btn-warning w-100 rounded-pill fw-bold text-white py-2">
                I Understand
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default App;
