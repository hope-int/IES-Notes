import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, ExternalLink, Search, Book, Zap, Database, Code, FolderPlus,
  Cpu, ChevronRight, ArrowLeft, Users, Building, Settings,
  FileText, Heart, Shield, LogOut, User, Bell, MessageCircle, Home, Upload, Download, Sparkles, GraduationCap
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { useLocation, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Registration from './Registration';
import PublicUploadModal from './PublicUploadModal';
import CreateFolderModal from './CreateFolderModal';
import AdminPanel from './AdminPanel';
import AdminLoginModal from './AdminLoginModal';
import StudentProfile from './StudentProfile';
import JCompiler from './components/JCompiler';
import PuterAuthPopup from './components/PuterAuthPopup';
import ZeroToHero from './components/ZeroToHero/ZeroToHero';
import PodcastClasses from './components/Podcast/PodcastClasses';
import HandbookGenerator from './components/Handbook/HandbookGenerator';
import PresentationGenerator from './components/Presentation/PresentationGenerator';
import ReportGenerator from './components/Report/ReportGenerator';
import AssignmentGenerator from './components/Assignment/AssignmentGenerator';
import ProjectGenerator from './components/Project/ProjectGenerator';
import RoadmapCanvas from './components/Roadmap/RoadmapCanvas';
import HopeDocsLayout from './components/HopeDocs/HopeDocsLayout';
import HopeSheetsLayout from './components/HopeSheets/HopeSheetsLayout';

import CommunityFeed from './CommunityFeed';
import AIChat from './components/AITutor/AITutor';
import AITutorDashboard from './components/AITutor/AITutorDashboard';
import { getDeviceId, getClientIp } from './utils/deviceUtils';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useAuth } from './contexts/AuthContext';

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
import InstallPWA from './components/InstallPWA';

function App() {
  /* Navigation & Routing */
  const location = useLocation();
  const navigate = useNavigate();

  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);

  // Auth State
  const { session, userProfile, initializing, showAdmin, setShowAdmin, warningMessage, showWarningModal, dismissWarning, handleLogout: contextLogout, handleRegistrationComplete: contextRegistrationComplete } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isPuterAuthNeeded, setIsPuterAuthNeeded] = useState(false);




  // Tab State
  // Determine initial tab based on URL if possible, otherwise default to home
  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname.includes('/community')) return 'community';
    if (location.pathname.includes('/ai-chat')) return 'ai';
    return 'home';
  });

  // Sync activeTab with URL changes or Navigation State
  useEffect(() => {
    if (location.state?.tab === 'community') setActiveTab('community');
    else if (location.pathname.includes('/community')) setActiveTab('community');
    else if (location.pathname.includes('/ai-')) setActiveTab('ai');
    else if (location.pathname === '/') setActiveTab('home');
  }, [location.pathname, location.state]);




  // Route Handling: Check if we are on a special route (e.g. /compiler, /admin)
  const isSpecialRoute = ['/compiler', '/admin', '/zero-to-hero', '/podcast-classes', '/handbook', '/presentation', '/report', '/assignment', '/mini-project', '/final-project', '/roadmap', '/ai-chat', '/ai-tutor', '/docs', '/sheets'].includes(location.pathname);

  // Warning State
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isPuterSignedIn, setIsPuterSignedIn] = useState(false);

  // Navigation State
  const [navStack, setNavStack] = useState([{ type: 'home', title: 'Home', id: null }]);

  // Data State
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [notes, setNotes] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);

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
    if (userProfile && userProfile.semester_id && navStack.length === 1 && navStack[0].type === 'home') {
      setNavStack([
        { type: 'sem', id: userProfile.semester_id, title: userProfile.semester_name || 'My Semester' }
      ]);
      fetchSubjects(userProfile.semester_id);
    }
  }, [userProfile]);

  // Robustly check (and wait for) Puter.js to initialize
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 20; // Try for ~10 seconds (20 * 500ms)

    const checkPuterAuth = () => {
      // Check if signed in OR successfully used as guest previously
      const isGuest = localStorage.getItem('hope_puter_guest_confirmed') === 'true';
      if (isGuest) {
        setIsPuterSignedIn(true);
        return true;
      }

      if (window.puter && window.puter.auth) {
        const signedIn = window.puter.auth.isSignedIn();
        setIsPuterSignedIn(signedIn);
        return signedIn; // Consistent return type
      }
      return false;
    };

    // Check immediately
    if (!checkPuterAuth()) {
      const interval = setInterval(() => {
        attempts++;
        if (checkPuterAuth() || attempts >= maxAttempts) {
          clearInterval(interval);
        }
      }, 500);

      return () => clearInterval(interval);
    }
  }, []);

  const handleRegistrationComplete = async (profile) => {
    contextRegistrationComplete(profile);
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
    // Save current state to the LAST item in the stack (which is the current view)
    // We need to modify the current stack's last item to include the filter state
    // But navStack is state.

    // Better approach: The stack represents the PATH. 
    // When we push a NEW item, we are leaving the current one.
    // We should save the `activeFilter` into the item we are leaving.

    const currentStackItem = navStack[navStack.length - 1];
    const updatedCurrentItem = { ...currentStackItem, savedFilter: activeFilter };
    const newStackStart = navStack.slice(0, -1);

    setNavStack([...newStackStart, updatedCurrentItem, { type: nextType, title: item.name || item.title, id: item.id, data: item }]);

    setSearchTerm('');
    // Default to 'My' instead of 'All' if that's preferred, or keep 'All'. 
    // User said "when tapped on a subject folder, it goes to the 'All' sort... update Home UI...".
    // Actually user said: "when tapped on a subject folder, it goes to the 'All' sort and when tapped back it shows the 'All' sort it should show the my sort."
    // So when entering a new view, we might want to default to 'My' or 'All' (App defaults to 'All' in line 308).
    // Let's keep 'All' for new views (as usually you want to see everything in a folder), 
    // but CRITICALLY when going BACK, we restore.
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
      // Restore filter if it was saved
      if (prevView.savedFilter) {
        setActiveFilter(prevView.savedFilter);
      }

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
    await contextLogout();
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
      <InstallPWA />
      <AnimatePresence>
        {isPuterAuthNeeded && (
          <PuterAuthPopup onAuthComplete={(success) => {
            setIsPuterAuthNeeded(false);
            if (success) {
              setIsPuterSignedIn(true);
            }
          }} />
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
        <div className={`min-vh-100 transition-colors ${isSpecialRoute ? '' : 'pb-32'}`}>

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
                      <img src="/hope-logo.png" alt="Logo" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                    </div>
                    <div className="d-none d-md-flex flex-column">
                      <span className="fw-bold fs-4 lh-1" style={{ color: 'var(--text-main)' }}>HOPE<span style={{ color: 'var(--primary-accent)' }}>-Edu-Hub</span></span>
                      {userProfile && (
                        <small className="text-muted d-block" style={{ fontSize: '0.85rem', marginTop: '2px' }}>
                          Welcome, <span className="text-dark fw-bold">{userProfile.full_name?.split(' ')[0]}</span> • {userProfile.semester ? userProfile.semester.replace('Semester', 'Sem') : 'Student'}
                        </small>
                      )}
                    </div>
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
                  </div >
                </div >

                <div className="d-flex align-items-center gap-3">
                  <button
                    onClick={() => {
                      setShowSearch(!showSearch);
                      // Auto focus if showing?
                    }}
                    className="btn btn-link p-2 rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: '48px', height: '48px', padding: 0, border: 'none' }}
                    title="Search"
                  >
                    <Search size={22} className={showSearch ? "text-primary" : "text-secondary"} />
                  </button>

                  <button
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                    }}
                    className="btn btn-link p-2 rounded-circle d-flex align-items-center justify-content-center position-relative"
                    style={{ width: '48px', height: '48px', padding: 0, border: 'none' }}
                    title="Notifications"
                  >
                    <Bell size={22} className="text-secondary" />
                    {announcements.length > 0 && <span className="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle">
                      <span className="visually-hidden">New alerts</span>
                    </span>}
                  </button>

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

                  {/* Notifications Popover */}
                  <AnimatePresence>
                    {showNotifications && (
                      <>
                        <div className="position-fixed top-0 start-0 w-100 h-100 z-2" onClick={() => setShowNotifications(false)}></div>
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="position-absolute clay-card p-3 p-md-4 shadow-xl z-3"
                          style={{ top: '80px', right: '20px', width: '320px', maxWidth: '90vw' }}
                        >
                          <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><Bell size={16} className="text-primary" /> Notifications</h6>
                          <div className="overflow-auto custom-scrollbar" style={{ maxHeight: '300px' }}>
                            {announcements.length > 0 ? announcements.map((ann, i) => (
                              <div key={i} className="glass-panel p-3 mb-2 rounded d-flex align-items-start gap-2 border-0" style={{ background: 'rgba(56, 189, 248, 0.05)' }}>
                                <div className="bg-primary rounded-circle flex-shrink-0 mt-2" style={{ width: 6, height: 6 }}></div>
                                <div className="small text-secondary">{ann.content}</div>
                              </div>
                            )) : <p className="text-muted small text-center py-3">No new updates.</p>}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>

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
                {/* Header Text Moved to Nav, so this large header is removed */}
              </AnimatePresence>

              <section className="container pb-5">
                {activeTab === 'home' && (
                  <>
                    {/* Search Bar - Toggleable */}
                    <AnimatePresence>
                      {showSearch && (
                        <motion.div
                          initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                          animate={{ height: 'auto', opacity: 1, marginBottom: '2rem' }}
                          exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="clay-card no-hover p-2 rounded-pill d-flex align-items-center ps-4 shadow-sm border border-secondary border-opacity-25 search-focus mx-auto" style={{ maxWidth: '600px' }}>
                            <Search size={22} className="text-muted" />
                            <input
                              type="text"
                              placeholder="Search subjects, notes..."
                              className="bg-transparent border-0 p-3 ms-2 w-100 fs-5 outline-none"
                              style={{ outline: 'none', boxShadow: 'none' }}
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              autoFocus
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Controls (Back | Admin Actions | Filters) */}
                    <div className="row mb-5 align-items-center justify-content-center g-3">
                      <div className="col-12 d-flex align-items-center justify-content-center gap-3 flex-wrap">
                        {/* Back Button */}
                        {navStack.length > 1 && (
                          <button onClick={handleBack} className="clay-button rounded-circle p-0" style={{ width: '48px', height: '48px' }}>
                            <ArrowLeft size={20} />
                          </button>
                        )}

                        {/* My vs All Scope */}
                        <div className="d-flex gap-2 bg-white rounded-pill p-1 shadow-sm border border-light">
                          <button
                            onClick={() => {
                              setActiveFilter('My');
                              if (userProfile?.semester_id) {
                                if (currentView.type !== 'sem' || currentView.id !== userProfile.semester_id) {
                                  setNavStack([
                                    { type: 'sem', id: userProfile.semester_id, title: userProfile.semester_name || 'My Semester' }
                                  ]);
                                  fetchSubjects(userProfile.semester_id);
                                }
                              }
                            }}
                            className={`btn rounded-pill px-4 py-2 fw-bold border-0 transition-all ${activeFilter === 'My' ? 'text-white shadow-sm' : 'text-muted'} `}
                            style={{ background: activeFilter === 'My' ? 'var(--primary-accent)' : 'transparent' }}
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
                            className={`btn rounded-pill px-4 py-2 fw-bold border-0 transition-all ${activeFilter === 'All' ? 'text-white shadow-sm' : 'text-muted'} `}
                            style={{ background: activeFilter === 'All' ? 'var(--primary-accent)' : 'transparent' }}
                          >
                            All
                          </button>
                        </div>

                        {/* Admin Only: Create Folder Button */}
                        {userProfile?.is_admin && (currentView.type === 'dept' || currentView.type === 'sem') && (
                          <button
                            onClick={() => setShowCreateModal(true)}
                            className="btn btn-light rounded-circle p-0 shadow-sm d-flex align-items-center justify-content-center flex-shrink-0"
                            style={{ width: '48px', height: '48px', border: '1px solid #e2e8f0' }}
                            title="Add Folder"
                          >
                            <FolderPlus size={20} className="text-secondary" />
                          </button>
                        )}

                        {/* Admin Only: Upload Button */}
                        {userProfile?.is_admin && currentView.type === 'subject' && (
                          <button
                            onClick={() => setShowUploadModal(true)}
                            className="btn btn-primary rounded-circle p-0 shadow-sm d-flex align-items-center justify-content-center flex-shrink-0"
                            style={{ width: '48px', height: '48px', background: 'var(--primary-accent)', border: 'none' }}
                            title="Upload Note"
                          >
                            <Upload size={20} />
                          </button>
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
              {activeTab === 'community' && <CommunityFeed />}

              {/* AI Tutor Tab */}
              {/* AI Tutor Tab removed (now a Route) */}



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
          )
          }

          {/* Routes (Always Rendered) */}
          <Routes>
            <Route path="/zero-to-hero" element={<ZeroToHero onBack={() => window.history.back()} />} />
            <Route path="/podcast-classes" element={<PodcastClasses onBack={() => window.history.back()} />} />
            <Route path="/handbook" element={<HandbookGenerator onBack={() => window.history.back()} />} />

            {/* New Standalone Content Tool Routes */}
            <Route path="/presentation" element={<PresentationGenerator onBack={() => window.history.back()} />} />
            <Route path="/report" element={<ReportGenerator onBack={() => window.history.back()} />} />
            <Route path="/assignment" element={<AssignmentGenerator onBack={() => window.history.back()} />} />
            <Route path="/mini-project" element={<ProjectGenerator type="mini-project" onBack={() => window.history.back()} />} />
            <Route path="/final-project" element={<ProjectGenerator type="final-project" onBack={() => window.history.back()} />} />
            <Route path="/roadmap" element={<RoadmapCanvas />} />

            <Route path="/admin" element={session || userProfile ? <AdminPanel /> : <Navigate to="/" />} />
            <Route path="/compiler" element={session || userProfile ? <JCompiler /> : <Navigate to="/" />} />
            <Route path="/ai-tutor" element={<AITutorDashboard />} />
            <Route path="/ai-chat" element={<AIChat />} />
            <Route path="/docs" element={<HopeDocsLayout onBack={() => navigate(-1)} />} />
            <Route path="/sheets" element={<HopeSheetsLayout onBack={() => navigate(-1)} />} />
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
        </div >
      )
      }
      {/* Floating Navigation Bar - Global */}
      {location.pathname !== '/ai-chat' && location.pathname !== '/docs' && location.pathname !== '/sheets' && location.pathname !== '/presentation' && location.pathname !== '/report' && (
        <div className="position-fixed bottom-0 start-0 w-100 p-4 d-flex justify-content-center" style={{ pointerEvents: 'none', zIndex: 1055 }}>
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
              onClick={() => navigate('/')}
              className={`btn rounded-pill px-4 py-2 d-flex align-items-center gap-2 fw-bold transition-all ${activeTab === 'home' && location.pathname === '/' ? 'bg-primary text-white shadow-lg' : 'text-dark hover-bg-light opacity-75'} `}
            >
              <Home size={20} /> <span className={activeTab === 'home' && location.pathname === '/' ? 'd-inline' : 'd-none d-sm-inline'}>Home</span>
            </button>
            <button
              onClick={() => navigate('/', { state: { tab: 'community' } })}
              className={`btn rounded-pill px-4 py-2 d-flex align-items-center gap-2 fw-bold transition-all ${activeTab === 'community' && location.pathname === '/' ? 'bg-primary text-white shadow-lg' : 'text-dark hover-bg-light opacity-75'} `}
            >
              <MessageCircle size={20} /> <span className={activeTab === 'community' && location.pathname === '/' ? 'd-inline' : 'd-none d-sm-inline'}>Community</span>
            </button>

            <button
              onClick={() => {
                if (!isPuterSignedIn) {
                  setIsPuterAuthNeeded(true);
                } else {
                  navigate('/ai-tutor');
                }
              }}
              className={`btn rounded-pill px-4 py-2 d-flex align-items-center gap-2 fw-bold transition-all ${location.pathname.startsWith('/ai-') ? 'bg-primary text-white shadow-lg' : 'text-dark hover-bg-light opacity-75'} `}
            >
              <Sparkles size={20} />
              <span className={location.pathname.startsWith('/ai-') ? 'd-inline' : 'd-none d-sm-inline'}>
                {isPuterSignedIn ? "HOPE Studio" : "Unlock Studio"}
              </span>
            </button>
          </motion.div>
        </div>
      )}

    </>
  );
}

export default App;
