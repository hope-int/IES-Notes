import React, { useState, useEffect, useRef } from 'react';
import { 
    Heart, Share2, Briefcase, Search, Filter, Clock, MapPin, 
    Building, ChevronDown, Check, ArrowLeft, Image as ImageIcon, PlusCircle,
    Home, MessageCircle, Sparkles, TrendingUp, Info, Bookmark, ExternalLink,
    Flag, AlertTriangle, Phone, FileText, X, Send, Bot, UsersRound
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import UserAvatar from '../UserAvatar';
import { getInternshipPosts, getLikedPostIds, toggleLikePostLocal, reportInternshipPost } from '../../utils/internshipService';
import { getAICompletion } from '../../utils/aiService';

export default function InternshipFeed({ studentProfile, onBack }) {
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [likedIds, setLikedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('For You'); // "For You", "All", or specific tags
    const [selectedPost, setSelectedPost] = useState(null); // For fullscreen poster view
    const [toastMessage, setToastMessage] = useState(null);
    const [timeTick, setTimeTick] = useState(Date.now());

    // Double tap animation tracker
    const [likePulseId, setLikePulseId] = useState(null);

    // Scroll header and bottom nav visibility tracker
    const [showHeader, setShowHeader] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    // Disclaimer states
    const [disclaimerAction, setDisclaimerAction] = useState(null);

    // Reporting states
    const [reportingPost, setReportingPost] = useState(null);
    const [reportReason, setReportReason] = useState('Spam / Fraud');
    const [reportDetails, setReportDetails] = useState('');
    const [submittingReport, setSubmittingReport] = useState(false);

    // Ask AI state variables
    const [aiChatPost, setAiChatPost] = useState(null);
    const [aiMessages, setAiMessages] = useState([]);
    const [aiInput, setAiInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        // Add hide-scrollbar class to body when on feed
        document.body.classList.add('hide-scrollbar');
        return () => {
            document.body.classList.remove('hide-scrollbar');
        };
    }, []);

    useEffect(() => {
        loadPosts();
        setLikedIds(getLikedPostIds());
        
        // Auto refresh remaining time calculations every 30 seconds
        const timer = setInterval(() => {
            setTimeTick(Date.now());
        }, 30000);
        return () => clearInterval(timer);
    }, [studentProfile]);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY && currentScrollY > 50) {
                setShowHeader(false);
                window.dispatchEvent(new CustomEvent('hope_hide_bottom_nav', { detail: true }));
            } else {
                setShowHeader(true);
                window.dispatchEvent(new CustomEvent('hope_hide_bottom_nav', { detail: false }));
            }
            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.dispatchEvent(new CustomEvent('hope_hide_bottom_nav', { detail: false }));
        };
    }, [lastScrollY]);

    const normalizeWebLink = (url) => {
        const trimmed = (url || '').trim();
        if (!trimmed) return '';
        if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return `https://${trimmed}`;
    };

    const getWhatsAppChatUrl = (phoneNumber) => {
        const digits = (phoneNumber || '').replace(/\D/g, '');
        return digits ? `https://wa.me/${digits}` : '';
    };

    const getPhoneCallUrl = (phoneNumber) => {
        const dialValue = (phoneNumber || '').replace(/[^\d+]/g, '');
        return dialValue ? `tel:${dialValue}` : '';
    };

    const handleActionClick = (type, label, url) => {
        if (!url) {
            showToast(`${label} is not available for this post.`);
            return;
        }
        setDisclaimerAction({ type, label, url });
    };

    const handleDisclaimerConfirm = () => {
        if (disclaimerAction) {
            if (disclaimerAction.url.startsWith('tel:')) {
                window.location.href = disclaimerAction.url;
            } else {
                window.open(disclaimerAction.url, '_blank', 'noopener,noreferrer');
            }
            setDisclaimerAction(null);
        }
    };

    const handleReportSubmit = async (e) => {
        e.preventDefault();
        if (!reportingPost) return;
        setSubmittingReport(true);
        const success = await reportInternshipPost(
            reportingPost.id, 
            reportingPost.company_name, 
            reportReason, 
            reportDetails, 
            studentProfile
        );
        setSubmittingReport(false);
        if (success) {
            showToast("Report submitted successfully. Thank you!");
            setReportingPost(null);
            setReportReason('Spam / Fraud');
            setReportDetails('');
        } else {
            showToast("Failed to submit report. Please try again.");
        }
    };

    const loadPosts = async () => {
        setLoading(true);
        const data = await getInternshipPosts(studentProfile);
        setPosts(data);
        setLoading(false);
    };

    const handleLike = (postId, e) => {
        if (e) e.stopPropagation();
        const { isLiked } = toggleLikePostLocal(postId);
        
        // Update state
        setLikedIds(prev => 
            isLiked ? [...prev, postId] : prev.filter(id => id !== postId)
        );

        setPosts(prev => prev.map(post => {
            if (post.id === postId) {
                return {
                    ...post,
                    likes_count: Math.max(0, post.likes_count + (isLiked ? 1 : -1))
                };
            }
            return post;
        }));
    };

    // Double tap handler
    let lastTap = 0;
    const handleDoubleTap = (postId) => {
        const now = Date.now();
        const DOUBLE_PRESS_DELAY = 300;
        if (now - lastTap < DOUBLE_PRESS_DELAY) {
            if (!likedIds.includes(postId)) {
                handleLike(postId);
            }
            setLikePulseId(postId);
            setTimeout(() => setLikePulseId(null), 800);
        }
        lastTap = now;
    };

    const handleShare = (post, e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(`${post.company_name} is hiring: ${post.caption.substring(0, 80)}...`);
        showToast("Copied post details to clipboard!");
    };

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const getRemainingTimeText = (expiresAt) => {
        if (!expiresAt) return null;
        const diff = new Date(expiresAt) - new Date();
        if (diff <= 0) return 'Expired';
        
        const hrs = Math.floor(diff / 3600000);
        if (hrs < 24) {
            const mins = Math.floor((diff % 3600000) / 60000);
            return `${hrs}h ${mins}m`;
        }
        const days = Math.floor(hrs / 24);
        const remainingHrs = hrs % 24;
        return `${days}d ${remainingHrs}h`;
    };

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [aiMessages]);

    const handleAskAI = (post) => {
        const timeLeft = post.expires_at ? getRemainingTimeText(post.expires_at) : 'No expiration set';
        setAiChatPost(post);
        setAiMessages([
            {
                role: 'assistant',
                content: `Hi! I have reviewed this opportunity from **${post.company_name}**.

📍 **Location**: ${post.location || 'Not Specified'}
⏱️ **Time Left**: ${timeLeft}
🏷️ **Fields**: ${post.tags ? post.tags.join(', ') : 'General'}

How can I help you regarding this opportunity? Ask me about the application process, requirements, or anything else!`
            }
        ]);
        setAiInput('');
    };

    const handleSendAiMessage = async (e) => {
        if (e) e.preventDefault();
        if (!aiInput.trim() || aiLoading) return;

        const userMessage = { role: 'user', content: aiInput };
        const updatedMessages = [...aiMessages, userMessage];
        setAiMessages(updatedMessages);
        setAiInput('');
        setAiLoading(true);

        try {
            const timeLeft = aiChatPost.expires_at ? getRemainingTimeText(aiChatPost.expires_at) : 'No expiration set';
            const systemPrompt = `You are a helpful student assistant powered by the NVIDIA Nemotron model. You are discussing this specific opportunity posting:
- Company/Organization: ${aiChatPost.company_name}
- Location: ${aiChatPost.location || 'Unknown'}
- Poster Description: ${aiChatPost.caption}
- Poster Image URL: ${aiChatPost.image_url || 'None'}
- Remaining Time to Apply: ${timeLeft}
- Actions Available:
  * Google Form: ${aiChatPost.google_form_link || 'None'}
  * WhatsApp Group/Channel/Broadcast: ${aiChatPost.whatsapp_link || 'None'}
  * WhatsApp Chat: ${aiChatPost.whatsapp_number || 'None'}
  * Phone Number: ${aiChatPost.phone_number || 'None'}

Rules:
1. Be concise, highly professional, and encouraging.
2. Read the poster description to clear doubts.
3. Keep responses under 3 paragraphs and use bullet points where helpful.
4. If they ask how to apply, tell them which action button is available.`;

            const formattedHistory = [
                { role: 'system', content: systemPrompt },
                ...updatedMessages.map(m => ({ role: m.role, content: m.content }))
            ];

            await getAICompletion(formattedHistory, {
                model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
                actionType: 'chat',
                onToken: (token, fullText) => {
                    setAiMessages([...updatedMessages, { role: 'assistant', content: fullText }]);
                }
            });

        } catch (error) {
            console.error("Ask AI error:", error);
            setAiMessages([...updatedMessages, { role: 'assistant', content: `Sorry, I encountered an issue: ${error.message}` }]);
        } finally {
            setAiLoading(false);
        }
    };

    const allTags = ['Internship', 'Remote', 'On-site', 'Computer Science & Engineering', 'Robotics and Artificial Intelligence', 'Electronics & Communication Engineering', 'Civil Engineering', 'Mechanical Engineering'];

    // Filter logic
    const filteredPosts = posts.filter(post => {
        const matchesSearch = 
            post.caption.toLowerCase().includes(searchTerm.toLowerCase()) ||
            post.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            post.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        if (activeFilter === 'For You' && studentProfile) {
            const dept = studentProfile.department || '';
            const sem = studentProfile.semester || '';
            const matchKeys = [dept, sem].filter(Boolean).map(k => k.toLowerCase());
            return post.tags.some(tag => 
                matchKeys.some(mk => tag.toLowerCase().includes(mk) || mk.includes(tag.toLowerCase()))
            ) || post.tags.includes('Internship') || post.tags.includes('Remote');
        }

        if (activeFilter === 'All' || activeFilter === 'For You') {
            return true;
        }

        return post.tags.some(tag => tag.toLowerCase() === activeFilter.toLowerCase());
    });

    const isStudentDept = (tagName) => {
        if (!studentProfile?.department) return false;
        return tagName.toLowerCase().includes(studentProfile.department.toLowerCase()) || 
               studentProfile.department.toLowerCase().includes(tagName.toLowerCase());
    };

    return (
        <div className="min-vh-100" style={{ background: 'var(--bg-main, #f8fafc)' }}>
            {/* Sticky LinkedIn Top Header */}
            <header 
                className="sticky-top bg-white border-bottom py-2 shadow-sm" 
                style={{ 
                    zIndex: 1020, 
                    backdropFilter: 'blur(10px)', 
                    background: 'rgba(255, 255, 255, 0.95)',
                    transform: showHeader ? 'translateY(0)' : 'translateY(-100%)',
                    transition: 'transform 0.3s ease-in-out'
                }}
            >
                <div className="container-xl d-flex align-items-center justify-content-between px-3" style={{ maxWidth: '1200px' }}>
                    
                    {/* Brand Logo & Search */}
                    <div className="d-flex align-items-center gap-3 flex-grow-1 flex-md-grow-0" style={{ maxWidth: '400px' }}>
                        <div 
                            onClick={() => navigate('/')} 
                            className="d-flex align-items-center gap-2 cursor-pointer select-none"
                            style={{ cursor: 'pointer' }}
                        >
                            <img src="/hope-logo.png" alt="Logo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                            <span className="fw-bold fs-5 d-none d-sm-inline text-dark">HOPE<span className="text-primary">.Jobs</span></span>
                        </div>
                        <div className="position-relative flex-grow-1">
                            <Search size={16} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
                            <input
                                type="text"
                                className="form-control form-control-sm rounded-pill bg-light border-0 ps-5"
                                placeholder="Search opportunities..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ fontSize: '13px', height: '34px' }}
                            />
                        </div>
                    </div>

                    {/* Navigation Actions */}
                    <div className="d-flex align-items-center gap-4 ms-3">
                        <button 
                            onClick={() => navigate('/')} 
                            className="btn btn-link text-decoration-none p-0 d-flex flex-column align-items-center text-muted hover-primary transition-all border-0 bg-transparent"
                            style={{ fontSize: '11px' }}
                        >
                            <Home size={20} className="text-secondary" />
                            <span className="d-none d-md-inline mt-1 text-muted">Home</span>
                        </button>
                        <button 
                            onClick={() => navigate('/community')} 
                            className="btn btn-link text-decoration-none p-0 d-flex flex-column align-items-center text-muted hover-primary transition-all border-0 bg-transparent"
                            style={{ fontSize: '11px' }}
                        >
                            <MessageCircle size={20} className="text-secondary" />
                            <span className="d-none d-md-inline mt-1 text-muted">Community</span>
                        </button>
                        <button 
                            onClick={() => navigate('/feed')} 
                            className="btn btn-link text-decoration-none p-0 d-flex flex-column align-items-center text-primary transition-all border-0 bg-transparent"
                            style={{ fontSize: '11px' }}
                        >
                            <Briefcase size={20} className="text-primary" />
                            <span className="d-none d-md-inline mt-1 text-primary fw-bold">Jobs</span>
                        </button>
                        <button 
                            onClick={() => navigate('/ai-tutor')} 
                            className="btn btn-link text-decoration-none p-0 d-flex flex-column align-items-center text-muted hover-primary transition-all border-0 bg-transparent"
                            style={{ fontSize: '11px' }}
                        >
                            <Sparkles size={20} className="text-secondary" />
                            <span className="d-none d-md-inline mt-1 text-muted">Studio</span>
                        </button>
                        {studentProfile && (
                            <div className="d-flex align-items-center border-start ps-3 gap-2">
                                <div className="d-none d-lg-block text-end">
                                    <div className="fw-bold text-dark" style={{ fontSize: '12px', lineHeight: '1.2' }}>{studentProfile.full_name?.split(' ')[0]}</div>
                                    <span className="text-muted" style={{ fontSize: '10px' }}>Sem {studentProfile.semester || '4'}</span>
                                </div>
                                <div className="rounded-circle overflow-hidden shadow-sm" style={{ width: '32px', height: '32px' }}>
                                    <UserAvatar userProfile={studentProfile} size={32} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="container-xl py-4 px-3" style={{ maxWidth: '1200px' }}>
                <div className="row g-4">
                    
                    {/* Left Column: Student Quick Details */}
                    <div className="col-lg-3 d-none d-lg-block">
                        <div className="clay-card bg-white border border-light shadow-sm rounded-4 overflow-hidden position-sticky" style={{ top: '80px' }}>
                            <div className="bg-gradient" style={{ height: '65px', background: 'linear-gradient(135deg, var(--primary-accent, #3b82f6) 0%, #4f46e5 100%)' }} />
                            
                            <div className="text-center px-3 pb-3 position-relative" style={{ marginTop: '-32px' }}>
                                <div className="d-inline-block rounded-circle border border-4 border-white overflow-hidden shadow-sm bg-white mb-2" style={{ width: '64px', height: '64px' }}>
                                    <UserAvatar userProfile={studentProfile} size={64} />
                                </div>
                                <h6 className="fw-bold mb-0 text-dark">{studentProfile?.full_name || 'Guest User'}</h6>
                                <span className="text-muted small d-block mb-2">{studentProfile?.department || 'IES Student'}</span>
                                <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2.5 py-1 text-xs" style={{ fontSize: '11px' }}>
                                    Semester {studentProfile?.semester || 'N/A'}
                                </span>
                            </div>

                            <div className="border-top border-light px-3 py-2.5 bg-light bg-opacity-30">
                                <div className="d-flex justify-content-between align-items-center text-muted small mb-1.5">
                                    <span>Profile views</span>
                                    <span className="fw-bold text-primary">48</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center text-muted small">
                                    <span>My Saved Items</span>
                                    <span className="fw-bold text-primary">12</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Middle Column: Active Feed */}
                    <div className="col-lg-6 col-md-12">
                        {/* Personalized Banner */}
                        {studentProfile && (
                            <div className="clay-card p-3 mb-4 d-flex align-items-center gap-3 bg-white border shadow-sm rounded-4">
                                <div className="p-3 bg-primary bg-opacity-10 rounded-circle text-primary">
                                    <Briefcase size={22} />
                                </div>
                                <div className="flex-grow-1">
                                    <h6 className="fw-bold mb-1">Personalized Feed Active</h6>
                                    <p className="text-muted small mb-0">
                                        Showing matches for <span className="fw-bold text-dark">{studentProfile.department || 'Your Department'}</span>, Semester <span className="fw-bold text-dark">{studentProfile.semester || 'Current'}</span>.
                                    </p>
                                </div>
                                {studentProfile?.is_admin && (
                                    <button 
                                        onClick={() => showToast("Tip: Go to Admin Panel -> Internships to add new opportunities.")}
                                        className="btn btn-xs btn-outline-primary rounded-pill px-3 py-1.5 d-flex align-items-center gap-1.5 small"
                                    >
                                        <PlusCircle size={14} /> Post
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Filter Chips Scrollable */}
                        <div className="mb-4">
                            <div className="d-flex gap-2 overflow-auto pb-2 scrollbar-none hide-scrollbar" style={{ whiteSpace: 'nowrap' }}>
                                <button
                                    onClick={() => setActiveFilter('For You')}
                                    className={`btn rounded-pill px-3 py-1.5 btn-sm fw-medium transition-all flex-shrink-0 border-0 ${activeFilter === 'For You' ? 'bg-primary text-white shadow' : 'bg-white border text-dark'}`}
                                >
                                    ✨ For You
                                </button>
                                <button
                                    onClick={() => setActiveFilter('All')}
                                    className={`btn rounded-pill px-3 py-1.5 btn-sm fw-medium transition-all flex-shrink-0 border-0 ${activeFilter === 'All' ? 'bg-primary text-white shadow' : 'bg-white border text-dark'}`}
                                >
                                    All
                                </button>
                                {allTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => setActiveFilter(tag)}
                                        className={`btn rounded-pill px-3 py-1.5 btn-sm fw-medium transition-all flex-shrink-0 border-0 ${activeFilter === tag ? 'bg-primary text-white shadow' : 'bg-white border text-dark'} ${isStudentDept(tag) ? 'border-primary' : ''}`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Feed List */}
                        {loading ? (
                            <div className="text-center py-5">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <p className="text-muted mt-3">Loading custom opportunities...</p>
                            </div>
                        ) : filteredPosts.length === 0 ? (
                            <div className="text-center py-5 clay-card bg-white rounded-4 border border-dashed">
                                <Briefcase size={48} className="text-muted mb-3 opacity-50" />
                                <h5 className="fw-bold">No postings found</h5>
                                <p className="text-muted small">Try adjusting your filters or search criteria.</p>
                                <button onClick={() => { setActiveFilter('All'); setSearchTerm(''); }} className="btn btn-sm btn-primary rounded-pill px-4 mt-2">
                                    Reset Filters
                                </button>
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-4">
                                {filteredPosts.map(post => {
                                    const isLiked = likedIds.includes(post.id);
                                    return (
                                        <motion.div
                                            key={post.id}
                                            layout
                                            initial={{ opacity: 0, y: 30 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="clay-card bg-white overflow-hidden rounded-4 shadow-sm border border-light"
                                        >
                                            {/* Post Header */}
                                            <div className="p-3 d-flex align-items-center justify-content-between border-bottom border-light">
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="d-flex align-items-center justify-content-center bg-primary bg-opacity-10 rounded-circle text-primary fw-bold text-uppercase" style={{ width: '40px', height: '40px', fontSize: '14px' }}>
                                                        {post.company_name?.substring(0, 2) || 'OP'}
                                                    </div>
                                                    <div>
                                                        <h6 className="fw-bold mb-0">{post.company_name}</h6>
                                                        <small className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                                                            <MapPin size={10} /> {post.location}
                                                        </small>
                                                    </div>
                                                </div>
                                                <div className="d-flex flex-column align-items-end gap-1">
                                                    <div className="text-muted small d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                                                        <Clock size={12} />
                                                        {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    </div>
                                                    {post.expires_at && (
                                                        <span 
                                                            className="badge bg-danger bg-opacity-10 text-danger d-flex align-items-center gap-1 rounded-pill px-2 py-0.5 border border-danger-subtle" 
                                                            style={{ fontSize: '10px', fontWeight: '600' }}
                                                        >
                                                            ⏱️ Disappears in: {getRemainingTimeText(post.expires_at)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Post Media with Double Tap Liking */}
                                            <div 
                                                className="position-relative bg-light cursor-pointer select-none overflow-hidden d-flex justify-content-center align-items-center"
                                                style={{ minHeight: '300px', maxHeight: '500px' }}
                                                onClick={() => handleDoubleTap(post.id)}
                                            >
                                                <img 
                                                    src={post.image_url} 
                                                    alt="Internship Poster" 
                                                    className="w-100 h-100 object-fit-cover"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80';
                                                    }}
                                                />
                                                
                                                {/* Double Tap Heart Animation */}
                                                <AnimatePresence>
                                                    {likePulseId === post.id && (
                                                        <motion.div 
                                                            initial={{ scale: 0, opacity: 0 }}
                                                            animate={{ scale: [0, 1.2, 1], opacity: [0, 0.9, 0] }}
                                                            exit={{ opacity: 0 }}
                                                            transition={{ duration: 0.6, ease: "easeOut" }}
                                                            className="position-absolute text-white"
                                                        >
                                                            <Heart size={80} fill="white" className="text-danger filter-drop-shadow" />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                {/* Fullscreen icon */}
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setSelectedPost(post); }}
                                                    className="position-absolute bottom-0 end-0 m-3 btn btn-sm btn-dark bg-opacity-70 rounded-circle text-white p-2 border-0"
                                                    style={{ backdropFilter: 'blur(4px)' }}
                                                >
                                                    <ImageIcon size={16} />
                                                </button>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="px-3 pt-3 pb-2 d-flex justify-content-between align-items-center">
                                                <div className="d-flex align-items-center gap-3">
                                                    <button 
                                                        onClick={(e) => handleLike(post.id, e)} 
                                                        className="btn btn-link p-0 text-decoration-none d-flex align-items-center gap-1.5 transition-all text-dark hover-scale"
                                                    >
                                                        <Heart 
                                                            size={24} 
                                                            fill={isLiked ? "#ef4444" : "none"} 
                                                            className={isLiked ? "text-danger" : "text-dark"} 
                                                        />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => handleShare(post, e)} 
                                                        className="btn btn-link p-0 text-decoration-none text-dark hover-scale"
                                                    >
                                                        <Share2 size={22} />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleAskAI(post); }} 
                                                        className="btn btn-link p-0 text-decoration-none text-dark hover-scale d-flex align-items-center gap-1"
                                                        title="Ask AI about this opportunity"
                                                        style={{ color: '#4f46e5' }}
                                                    >
                                                        <Sparkles size={20} className="text-primary" />
                                                        <span className="small fw-bold text-primary" style={{ fontSize: '12px' }}>Ask AI</span>
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setReportingPost(post); }} 
                                                        className="btn btn-link p-0 text-decoration-none text-muted hover-scale"
                                                        title="Report Post"
                                                    >
                                                        <Flag size={20} className="text-secondary opacity-75 hover-text-danger transition-colors" />
                                                    </button>
                                                </div>
                                                
                                                {/* Likes counter */}
                                                <span className="fw-bold small text-dark">
                                                    {post.likes_count || 0} {post.likes_count === 1 ? 'like' : 'likes'}
                                                </span>
                                            </div>

                                            {/* Post Caption */}
                                            <div className="px-3 pb-3">
                                                <p className="mb-2 text-dark" style={{ fontSize: '13.5px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                                    <span className="fw-bold me-2">{post.company_name}</span>
                                                    {post.caption}
                                                </p>
                                                
                                                {/* Tag pills */}
                                                <div className="d-flex flex-wrap gap-1.5 mt-2">
                                                    {post.tags.map(tag => {
                                                        const isSelected = activeFilter === tag;
                                                        return (
                                                            <span 
                                                                key={tag} 
                                                                onClick={() => setActiveFilter(tag)}
                                                                className={`badge rounded-pill px-2.5 py-1 cursor-pointer transition-all border ${
                                                                    isSelected ? 'bg-primary text-white border-primary' : 
                                                                    isStudentDept(tag) ? 'bg-primary bg-opacity-10 text-primary border-primary border-opacity-30' : 
                                                                    'bg-light text-muted border-transparent'
                                                                }`}
                                                                style={{ fontSize: '10.5px', fontWeight: '500' }}
                                                            >
                                                                {tag}
                                                            </span>
                                                        );
                                                    })}
                                                </div>

                                                {/* Apply / Contact Actions */}
                                                {(post.google_form_link || post.whatsapp_link || post.whatsapp_number || post.phone_number) && (
                                                    <div className="mt-3 pt-3 border-top border-light d-flex flex-wrap gap-2">
                                                        {post.google_form_link && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleActionClick('google_form_link', 'Google Form', normalizeWebLink(post.google_form_link));
                                                                }}
                                                                className="btn btn-sm btn-primary bg-gradient rounded-pill px-3 py-1.5 d-flex align-items-center gap-1.5 text-white border-0 shadow-sm"
                                                                style={{ fontSize: '11.5px', fontWeight: '600' }}
                                                                title="Open Google Form"
                                                            >
                                                                <FileText size={13} /> Apply via Google Form
                                                            </button>
                                                        )}
                                                        {post.whatsapp_link && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleActionClick('whatsapp_link', 'WhatsApp Group/Channel/Broadcast', normalizeWebLink(post.whatsapp_link));
                                                                }}
                                                                className="btn btn-sm btn-success bg-gradient rounded-pill px-3 py-1.5 d-flex align-items-center gap-1.5 text-white border-0 shadow-sm"
                                                                style={{ fontSize: '11.5px', fontWeight: '600', backgroundColor: '#25D366', borderColor: '#25D366' }}
                                                                title="Open WhatsApp group, channel, or broadcast link"
                                                            >
                                                                <UsersRound size={13} /> WA Group/Channel
                                                            </button>
                                                        )}
                                                        {post.whatsapp_number && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleActionClick('whatsapp_number', 'WhatsApp Chat', getWhatsAppChatUrl(post.whatsapp_number));
                                                                }}
                                                                className="btn btn-sm btn-outline-success rounded-pill px-3 py-1.5 d-flex align-items-center gap-1.5 shadow-sm"
                                                                style={{ fontSize: '11.5px', fontWeight: '600', color: '#25D366', borderColor: '#25D366' }}
                                                                title="Open direct WhatsApp chat"
                                                            >
                                                                <MessageCircle size={13} /> Chat on WhatsApp
                                                            </button>
                                                        )}
                                                        {post.phone_number && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleActionClick('phone_number', 'Phone Call', getPhoneCallUrl(post.phone_number));
                                                                }}
                                                                className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1.5 d-flex align-items-center gap-1.5 shadow-sm"
                                                                style={{ fontSize: '11.5px', fontWeight: '600' }}
                                                                title="Call this phone number"
                                                            >
                                                                <Phone size={13} /> Call HR ({post.phone_number})
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Trending Tags & Tips Sidebar */}
                    <div className="col-lg-3 d-none d-lg-block">
                        <div className="clay-card bg-white border border-light shadow-sm rounded-4 p-3 position-sticky" style={{ top: '80px' }}>
                            <h6 className="fw-bold text-dark d-flex align-items-center gap-2 mb-3">
                                <TrendingUp size={16} className="text-primary" />
                                Recommended Tags
                            </h6>
                            <div className="d-flex flex-wrap gap-1.5 mb-4">
                                {allTags.slice(0, 5).map(tag => (
                                    <span 
                                        key={tag}
                                        onClick={() => setActiveFilter(tag)}
                                        className={`badge rounded-pill px-2.5 py-1.5 cursor-pointer transition-all border ${
                                            activeFilter === tag ? 'bg-primary text-white border-primary' : 'bg-light text-muted border-transparent hover-bg-secondary'
                                        }`}
                                        style={{ fontSize: '11px', fontWeight: '500' }}
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                            
                            <div className="border-top border-light pt-3">
                                <h6 className="fw-bold text-dark mb-2 small d-flex align-items-center gap-1.5">
                                    <Info size={14} className="text-primary" />
                                    Job Search Advice
                                </h6>
                                <p className="text-muted small mb-0" style={{ lineHeight: '1.4' }}>
                                    Your profile details determine which placements are suggested in your <strong>✨ For You</strong> tab. Keep your course profile updated to catch matching jobs before they disappear!
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Fullscreen image viewer Modal */}
            <AnimatePresence>
                {selectedPost && (
                    <div 
                        className="modal-overlay d-flex align-items-center justify-content-center p-3"
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1100 }}
                        onClick={() => setSelectedPost(null)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="position-relative d-flex flex-column align-items-center"
                            style={{ maxWidth: '95vw', maxHeight: '90vh' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <img 
                                src={selectedPost.image_url} 
                                alt="Poster Highres" 
                                className="img-fluid rounded shadow-lg object-fit-contain" 
                                style={{ maxHeight: '80vh' }}
                            />
                            <div className="text-white text-center mt-3 px-3">
                                <h5 className="fw-bold mb-1">{selectedPost.company_name}</h5>
                                <p className="small text-white-50">{selectedPost.caption.substring(0, 100)}...</p>
                                <button className="btn btn-light rounded-pill px-4 mt-2 fw-bold" onClick={() => setSelectedPost(null)}>
                                    Close Poster
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Custom toast notification */}
            <AnimatePresence>
                {toastMessage && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: 20, x: '-50%' }}
                        className="position-fixed bottom-0 start-50 translate-middle-x mb-4 px-4 py-2 bg-dark text-white rounded-pill shadow-lg text-center"
                        style={{ zIndex: 1200, fontSize: '13px' }}
                    >
                        {toastMessage}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Disclaimer Modal */}
            <AnimatePresence>
                {disclaimerAction && (
                    <div 
                        className="modal-overlay d-flex align-items-center justify-content-center p-3"
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1100 }}
                        onClick={() => setDisclaimerAction(null)}
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-4 shadow-xl border p-4 text-center position-relative"
                            style={{ maxWidth: '400px', width: '100%' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="d-inline-flex p-3 bg-warning bg-opacity-10 rounded-circle text-warning mb-3">
                                <AlertTriangle size={32} />
                            </div>
                            <h5 className="fw-bold text-dark mb-2">External Link Disclaimer</h5>
                            <p className="text-muted small mb-4" style={{ lineHeight: '1.5' }}>
                                This is not part of, affiliated by, or produced by the HOPE platform. Open at your own risk. We are not responsible for any scam that may occur.
                            </p>
                            <div className="d-flex gap-2">
                                <button 
                                    className="btn btn-light rounded-pill flex-grow-1 fw-bold"
                                    onClick={() => setDisclaimerAction(null)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    className="btn btn-primary rounded-pill flex-grow-1 fw-bold"
                                    onClick={handleDisclaimerConfirm}
                                >
                                    Proceed
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Report Post Modal */}
            <AnimatePresence>
                {reportingPost && (
                    <div 
                        className="modal-overlay d-flex align-items-center justify-content-center p-3"
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1100 }}
                        onClick={() => setReportingPost(null)}
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-4 shadow-xl border p-4 position-relative"
                            style={{ maxWidth: '450px', width: '100%' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                    <Flag size={20} className="text-danger" />
                                    Report Opportunity
                                </h5>
                                <button 
                                    className="btn-close" 
                                    onClick={() => setReportingPost(null)}
                                />
                            </div>

                            <form onSubmit={handleReportSubmit}>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted">Reason for reporting</label>
                                    <select 
                                        className="form-select rounded-3"
                                        value={reportReason}
                                        onChange={e => setReportReason(e.target.value)}
                                        required
                                    >
                                        <option value="Spam / Fraud">Spam / Fraud</option>
                                        <option value="Expired Opportunity">Expired Opportunity</option>
                                        <option value="Inappropriate Content">Inappropriate Content</option>
                                        <option value="Incorrect Information">Incorrect Information</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div className="mb-4">
                                    <label className="form-label small fw-bold text-muted">Additional Details (Optional)</label>
                                    <textarea 
                                        className="form-control rounded-3"
                                        rows="3"
                                        placeholder="Please provide details to help us audit this post..."
                                        value={reportDetails}
                                        onChange={e => setReportDetails(e.target.value)}
                                        style={{ fontSize: '13px' }}
                                    />
                                </div>

                                <div className="d-flex gap-2">
                                    <button 
                                        type="button"
                                        className="btn btn-light rounded-pill flex-grow-1 fw-bold"
                                        onClick={() => setReportingPost(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        className="btn btn-danger rounded-pill flex-grow-1 fw-bold d-flex align-items-center justify-content-center gap-1.5"
                                        disabled={submittingReport}
                                    >
                                        {submittingReport ? (
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                                        ) : (
                                            <>Submit Report</>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Ask AI Floating Chat Box */}
            <AnimatePresence>
                {aiChatPost && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.95 }}
                        transition={{ type: "spring", damping: 25, stiffness: 350 }}
                        className="position-fixed bottom-0 end-0 m-4 shadow-lg rounded-4 overflow-hidden border border-light"
                        style={{ 
                            width: '380px', 
                            height: '500px', 
                            maxHeight: '85vh', 
                            maxWidth: '90vw', 
                            zIndex: 1060,
                            background: 'rgba(255, 255, 255, 0.92)',
                            backdropFilter: 'blur(20px)',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.15)'
                        }}
                    >
                        {/* Chat Header */}
                        <div className="p-3 bg-primary text-white d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center gap-2">
                                <div className="bg-white bg-opacity-20 p-1.5 rounded-circle text-white d-flex align-items-center justify-content-center">
                                    <Bot size={18} />
                                </div>
                                <div>
                                    <h6 className="fw-bold mb-0" style={{ fontSize: '14px' }}>Opportunity Assistant</h6>
                                    <span className="text-white-50" style={{ fontSize: '10px' }}>Ask about {aiChatPost.company_name}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setAiChatPost(null)}
                                className="btn btn-link text-white p-0 opacity-75 hover-opacity-100 border-0 bg-transparent"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-grow-1 p-3 overflow-auto d-flex flex-column gap-2.5 hide-scrollbar">
                            {aiMessages.map((msg, index) => {
                                const isUser = msg.role === 'user';
                                return (
                                    <div 
                                        key={index} 
                                        className={`d-flex ${isUser ? 'justify-content-end' : 'justify-content-start'}`}
                                    >
                                        <div 
                                            className={`p-3 rounded-4 shadow-sm ${isUser ? 'bg-primary text-white rounded-tr-none' : 'bg-light text-dark rounded-tl-none'}`}
                                            style={{ 
                                                maxWidth: '85%', 
                                                fontSize: '13px', 
                                                lineHeight: '1.5',
                                                borderTopRightRadius: isUser ? '4px' : '16px',
                                                borderTopLeftRadius: !isUser ? '4px' : '16px',
                                                whiteSpace: 'pre-wrap'
                                            }}
                                        >
                                            {/* Basic Bold Parser for markdown */}
                                            {msg.content.split('**').map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)}
                                        </div>
                                    </div>
                                );
                            })}
                            {aiLoading && (
                                <div className="d-flex justify-content-start">
                                    <div className="bg-light text-muted p-2 px-3 rounded-4 rounded-tl-none d-flex align-items-center gap-1" style={{ borderTopLeftRadius: '4px', fontSize: '12px' }}>
                                        <span className="spinner-grow spinner-grow-sm text-secondary" role="status" style={{ width: '6px', height: '6px' }} />
                                        <span className="spinner-grow spinner-grow-sm text-secondary" role="status" style={{ width: '6px', height: '6px', animationDelay: '0.2s' }} />
                                        <span className="spinner-grow spinner-grow-sm text-secondary" role="status" style={{ width: '6px', height: '6px', animationDelay: '0.4s' }} />
                                        <span className="ms-1">AI thinking...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSendAiMessage} className="p-3 border-top bg-white bg-opacity-50 d-flex gap-2">
                            <input 
                                type="text"
                                className="form-control form-control-sm rounded-pill border border-light shadow-sm px-3"
                                placeholder="Ask a question..."
                                value={aiInput}
                                onChange={e => setAiInput(e.target.value)}
                                disabled={aiLoading}
                                style={{ fontSize: '13px', height: '38px' }}
                            />
                            <button 
                                type="submit" 
                                className="btn btn-primary rounded-circle p-2 d-flex align-items-center justify-content-center border-0 shadow"
                                disabled={aiLoading || !aiInput.trim()}
                                style={{ width: '38px', height: '38px' }}
                            >
                                <Send size={16} />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
