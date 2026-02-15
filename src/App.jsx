import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, ExternalLink, Search, Book, Zap, Database, Code, FolderPlus,
  Cpu, ChevronRight, ArrowLeft, Users, Building, Settings,
  FileText, Heart, Shield, LogOut, User, Bell, MessageCircle, Home, Upload, Download, Sparkles, GraduationCap
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { useLocation, Routes, Route, Navigate } from 'react-router-dom';
import Registration from './Registration';
import PublicUploadModal from './PublicUploadModal';
import CreateFolderModal from './CreateFolderModal';
import AdminPanel from './AdminPanel';
import AdminLoginModal from './AdminLoginModal';
import StudentProfile from './StudentProfile';
import JCompiler from './components/JCompiler';
import PuterAuthPopup from './components/PuterAuthPopup';

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

import SplashScreen from './SplashScreen';
import SkeletonLoader from './components/SkeletonLoader';

function App() {
  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);

  // Auth State
  const [session, setSession] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isPuterAuthNeeded, setIsPuterAuthNeeded] = useState(false);


  const [activeTab, setActiveTab] = useState('home');
  const location = useLocation();

  // Route Handling: Check if we are on a special route (e.g. /compiler, /admin)
  const isSpecialRoute = ['/compiler', '/admin'].includes(location.pathname);

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
    const saved = localStorage.getItem('hope-favorites');
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
    const storedProfile = localStorage.getItem('hope_student_profile');
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

        await fetchProfile(deviceLink.user_id);
      }
    }


    // 4. Check Puter Auth
    if (window.puter) {
      if (!window.puter.auth.isSignedIn()) {
        setIsPuterAuthNeeded(true);
      }
    } else {
      // Library might still be loading, check again after delay
      setTimeout(() => {
        if (window.puter && !window.puter.auth.isSignedIn()) {
          setIsPuterAuthNeeded(true);
        }
      }, 2000);
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
    localStorage.setItem('hope-favorites', JSON.stringify(favorites));
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
    localStorage.removeItem('hope_student_profile');
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

  if (showSplash) return <SplashScreen onComplete={() => setShowSplash(false)} isAppReady={!initializing} />;

  if (initializing) return null; // Wait for splash or data

  if (!session && !userProfile) return <Registration onComplete={handleRegistrationComplete} />;

  return (
    <>
      <AnimatePresence>
        {isPuterAuthNeeded && (
          <PuterAuthPopup onAuthComplete={() => setIsPuterAuthNeeded(false)} />
        )}
      </AnimatePresence>

      {showAdmin ? (
        <AdminPanel onBack={() => setShowAdmin(false)} />
      ) : showProfile ? (
        <StudentProfile
          session={session}
          onBack={() => setShowProfile(false)}
          refreshProfile={() => fetchProfile(session?.user?.id || userProfile?.id)}
          onLogout={handleLogout}
          onOpenAdmin={() => setShowAdmin(true)}
        />
      ) : (
        <div className="min-vh-100 pb-5 transition-colors">

          {!isSpecialRoute && (
            <>
              {/* Navigation / Header */}
              <nav className="container py-4 d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-4">
                  <div
                    onClick={() => setShowAdminLogin(true)}
                    className="d-flex align-items-center gap-2 cursor-pointer"
                  >
                    <div className="clay-card d-flex align-items-center justify-content-center p-2 rounded-3 border-0">
                      <GraduationCap size={28} style={{ color: 'var(--primary-accent)' }} />
                    </div>
                    <span className="fw-bold fs-3 d-none d-md-block lh-1" style={{ color: 'var(--text-main)' }}>HOPE<span style={{ color: 'var(--primary-accent)' }}>-Edu-Hub</span></span>
                  </div >

                  <div className="d-none d-md-flex align-items-center gap-2 overflow-auto ms-3 hide-scrollbar" style={{ maxWidth: '40vw' }}>
                    {navStack.map((step, index) => (
                      <div key={index} className="d-flex align-items-center">
                        {index > 0 && <ChevronRight size={14} className="text-secondary mx-1" />}
                        <span
                          onClick={() => handleBreadcrumbClick(index)}
                          className={`text-nowrap px-2 py-1 rounded transition-all ${index === navStack.length - 1 ? 'fw-bold glass-panel shadow-sm' : 'text-secondary'}`}
                          style={{
                            cursor: 'pointer',
                            color: index === navStack.length - 1 ? 'var(--primary-accent)' : undefined,
                            background: index === navStack.length - 1 ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                            border: index === navStack.length - 1 ? '1px solid var(--primary-accent)' : 'none'
                          }}
                        >
                          {step.type === 'home' ? 'Home' : step.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div >

                <div className="d-flex align-items-center gap-3">
                  {/* Favorites Button */}
                  <button
                    onClick={() => {
                      if (currentView.type === 'favorites') {
                        setNavStack(prev => prev.slice(0, -1)); // Toggle Off 
                      } else {
                        setNavStack(prev => [...prev, { type: 'favorites', title: 'My Favorites', id: 'favs' }]); // Toggle On
                      }
                    }}
                    className={`btn btn-link p-2 rounded-circle d-flex align-items-center justify-content-center ${currentView.type === 'favorites' ? 'active-fav-btn' : ''} `}
                    style={{ width: '48px', height: '48px', padding: 0, border: 'none' }}
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
                    <div className="bg-primary bg-opacity-25 rounded-circle p-1 d-flex shadow-inner align-items-center justify-content-center" style={{ width: 32, height: 32 }}>
                      {userProfile && userProfile.full_name ? (
                        <span className="fw-bold text-white">{userProfile.full_name.charAt(0).toUpperCase()}</span>
                      ) : (
                        <User size={20} className="text-white" />
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
                    className="d-flex d-md-none btn btn-primary p-0 rounded-circle align-items-center justify-content-center"
                    style={{ width: '48px', height: '48px' }}
                  >
                    <span className="fw-bold text-white">{userProfile?.full_name?.charAt(0) || <User size={22} />}</span>
                  </button>
                </div>
              </nav >

              <AnimatePresence>
                {/* Header - Only Visible on Home */}
                {activeTab === 'home' && (
                  <motion.header
                    className="container px-md-5 position-relative overflow-hidden mt-2 mb-5"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="row align-items-center gy-5 gx-lg-5">
                      <div className="col-lg-6 text-center text-lg-start z-1">
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                          <h1 className="fw-bolder display-5 display-md-3 mb-3 lh-sm" style={{ color: 'var(--text-main)' }}>
                            {userProfile ? (
                              currentView.type === 'favorites' ? (
                                <>
                                  <span className="text-gradient">My Favorites</span>
                                  <span className="fs-5 fs-md-2 text-muted fw-normal d-block mt-2">
                                    Your saved shortcuts
                                  </span>
                                </>
                              ) : (
                                <>
                                  Welcome, <span className="text-gradient">{userProfile.full_name?.split(' ')[0]}</span>
                                  <br />
                                  <span className="fs-5 fs-md-2 text-muted fw-normal d-block mt-2">
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
                          <p className="text-muted fs-6 fs-md-5 mb-5">Access all your HOPE Community notes. Developed by Justin.</p>
                        </motion.div>
                      </div>
                      <div className="col-lg-6 z-1 ps-lg-5">
                        <div className="clay-card p-4 h-100">
                          <div className="overflow-auto custom-scrollbar" style={{ maxHeight: '160px' }}>
                            {announcements.length > 0 ? announcements.map((ann, i) => (
                              <div key={i} className="glass-panel p-3 mb-2 rounded d-flex align-items-center gap-2 border-0" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <div className="bg-primary rounded-circle flex-shrink-0" style={{ width: 8, height: 8 }}></div>
                                <div className="small text-secondary">{ann.content}</div>
                              </div>
                            )) : <p className="text-muted small">No new updates.</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.header>
                )}
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
                        <div className="clay-card p-2 rounded-pill d-flex align-items-center flex-grow-1 ps-4 shadow-sm border border-secondary border-opacity-25 search-focus">
                          <Search size={22} className="text-muted" />
                          <input
                            type="text"
                            placeholder="Search..."
                            className="bg-transparent border-0 p-3 ms-2 w-100 fs-5 outline-none"
                            style={{ outline: 'none', boxShadow: 'none' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>

                        {/* Admin Only: Create Folder Button */}
                        {userProfile?.is_admin && (currentView.type === 'dept' || currentView.type === 'sem') && (
                          <button
                            onClick={() => setShowCreateModal(true)}
                            className="btn btn-light rounded-circle p-0 shadow-sm d-flex align-items-center justify-content-center flex-shrink-0"
                            style={{ width: '56px', height: '56px', border: '1px solid #e2e8f0' }}
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
                            setActiveFilter('My');
                            if (userProfile?.semester_id) {
                              // Force Semester View for "My"
                              if (currentView.type !== 'sem' || currentView.id !== userProfile.semester_id) {
                                setNavStack([
                                  { type: 'sem', id: userProfile.semester_id, title: userProfile.semester_name || 'My Semester' }
                                ]);
                                fetchSubjects(userProfile.semester_id);
                              }
                            } else {
                              // If no semester assigned, maybe go to home but keep filter active?
                            }
                          }}
                          className={`btn rounded-pill px-4 py-2 fw-bold border-0 ${activeFilter === 'My' ? 'text-white shadow-lg' : 'text-muted'} `}
                          style={{ background: activeFilter === 'My' ? 'var(--primary-accent)' : 'var(--glass-surface)' }}
                        >
                          My
                        </button>

                        <button
                          onClick={() => {
                            setActiveFilter('All');
                            if (navStack.length > 0 && navStack[0].type !== 'home') {
                              setNavStack([{ type: 'home', title: 'Home', id: null }]);
                              fetchDepartments();
                            }
                          }}
                          className={`btn rounded-pill px-4 py-2 fw-bold border-0 ${activeFilter === 'All' ? 'text-white shadow-lg' : 'text-muted'} `}
                          style={{ background: activeFilter === 'All' ? 'var(--primary-accent)' : 'var(--glass-surface)' }}
                        >
                          All
                        </button>

                        {/* Subject Filters (Only visible in Semester View) */}
                        {currentView.type === 'sem' && (
                          <>
                            <div className="vr mx-2 bg-secondary opacity-50"></div>
                            {['Core', 'Labs'].map(filter => (
                              <button
                                key={filter}
                                onClick={() => setActiveFilter(filter)}
                                className={`btn rounded-pill px-4 py-2 fw-bold border-0 ${activeFilter === filter ? 'text-white shadow-lg' : 'text-muted'} `}
                                style={{ background: activeFilter === filter ? 'var(--primary-accent)' : 'var(--glass-surface)' }}
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
                      <div className="row g-4">
                        <SkeletonLoader type="card" count={6} />
                      </div>
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
                                  <div className="clay-card h-100">
                                    <div className="p-4 d-flex flex-column gap-3 hover-scale h-100">
                                      <div className="d-flex justify-content-between">
                                        <div className="p-3 rounded-4" style={{ background: 'rgba(239, 68, 68, 0.1)' }}><FileText size={28} className="text-danger" /></div>
                                        <Download size={20} className="text-muted" />
                                      </div>
                                      <div>
                                        <h6 className="fw-bold mb-1">{item.title || item.name}</h6>
                                        <small className="text-muted">{item.year ? `Year: ${item.year} ` : '2026'}</small>
                                        {item.description && <p className="small text-secondary mb-0 mt-1 text-truncate opacity-75">{item.description}</p>}
                                      </div>
                                    </div>
                                  </div>
                                </a>
                              ) : currentView.type === 'sem' || (currentView.type === 'favorites' && !item.file_url) ? (
                                <div className="clay-card h-100">
                                  <div className="p-4 d-flex flex-column gap-3 cursor-pointer hover-scale h-100">
                                    <div className="d-flex justify-content-between">
                                      <div className="p-3 rounded-4" style={{ background: 'rgba(56, 189, 248, 0.1)' }}><Book size={28} className="text-primary" /></div>
                                      <button
                                        onClick={(e) => toggleFavorite(e, item)}
                                        className="btn btn-link p-0 text-muted favorite-btn"
                                        style={{ transform: favorites.some(f => f.id === item.id) ? 'scale(1.1)' : 'scale(1)', transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
                                      >
                                        <Heart
                                          size={24}
                                          fill={favorites.some(f => f.id === item.id) ? "#ef4444" : "none"}
                                          className={favorites.some(f => f.id === item.id) ? "text-danger" : ""}
                                          style={{ filter: favorites.some(f => f.id === item.id) ? 'drop-shadow(0 2px 4px rgba(239, 68, 68, 0.3))' : 'none' }}
                                        />
                                      </button>
                                    </div>
                                    <div>
                                      <h5 className="fw-bold mb-1">{item.name || item.title}</h5>
                                      <small className="text-muted">Tap to view notes</small>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="clay-card h-100">
                                  <div className="p-4 d-flex align-items-center gap-3 cursor-pointer hover-scale h-100">
                                    <div className="p-3 rounded-4" style={{ background: 'rgba(56, 189, 248, 0.1)' }}>
                                      {currentView.type === 'home' ? (
                                        <div className="text-primary">
                                          {renderIcon(item.icon)}
                                        </div>
                                      ) : <Folder size={32} className="text-warning" />}
                                    </div>
                                    <span className="fw-bold fs-5">{item.name}</span>
                                  </div>
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
              <div className="position-fixed bottom-0 start-0 w-100 p-4 z-3 d-flex justify-content-center" style={{ pointerEvents: 'none' }}>
                <motion.div
                  whileHover={{
                    y: -10,
                    scale: 1.02,
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  className="clay-card rounded-pill p-2 d-flex gap-2 shadow-lg glass-panel"
                  style={{ pointerEvents: 'auto', background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,0,0,0.05)' }}
                >
                  <button
                    onClick={() => setActiveTab('home')}
                    className={`btn rounded-pill px-4 py-2 d-flex align-items-center gap-2 fw-bold transition-all ${activeTab === 'home' ? 'bg-primary text-white shadow-lg' : 'text-dark hover-bg-light opacity-75'} `}
                  >
                    <Home size={20} /> <span className={activeTab === 'home' ? 'd-inline' : 'd-none d-sm-inline'}>Home</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('community')}
                    className={`btn rounded-pill px-4 py-2 d-flex align-items-center gap-2 fw-bold transition-all ${activeTab === 'community' ? 'bg-primary text-white shadow-lg' : 'text-dark hover-bg-light opacity-75'} `}
                  >
                    <MessageCircle size={20} /> <span className={activeTab === 'community' ? 'd-inline' : 'd-none d-sm-inline'}>Community</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('ai')}
                    className={`btn rounded-pill px-4 py-2 d-flex align-items-center gap-2 fw-bold transition-all ${activeTab === 'ai' ? 'bg-primary text-white shadow-lg' : 'text-dark hover-bg-light opacity-75'} `}
                  >
                    <Sparkles size={20} /> <span className={activeTab === 'ai' ? 'd-inline' : 'd-none d-sm-inline'}>AI Tutor</span>
                  </button>
                </motion.div>
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
                  />
                )}
              </AnimatePresence>
            </>
          )}

          {/* Routes (Always Rendered) */}
          <Routes>
            <Route path="/admin" element={session || userProfile ? <AdminPanel /> : <Navigate to="/" />} />
            <Route path="/compiler" element={session || userProfile ? <JCompiler /> : <Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Warning Modal */}
          <AnimatePresence>
            {showWarningModal && warningMessage && (
              <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)' }}>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="modal-dialog modal-dialog-centered"
                >
                  <div className="modal-content clay-card border-0">
                    <div className="modal-header border-bottom border-secondary border-opacity-25">
                      <h5 className="modal-title fw-bold text-warning">Notice</h5>
                    </div>
                    <div className="modal-body">
                      <p className="mb-0">{warningMessage}</p>
                    </div>
                    <div className="modal-footer border-top border-secondary border-opacity-25">
                      <button type="button" className="btn btn-primary rounded-pill px-4" onClick={dismissWarning}>
                        Acknowledge
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}

export default App;
