import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
    MessageSquare, Share2, ArrowBigUp, ArrowBigDown,
    MoreHorizontal, User, RefreshCw, Send, Ghost, Trash2, CornerDownRight, Shield, Coins, ArrowLeft, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SkeletonLoader from '../SkeletonLoader';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function CommunityFeed() {
    const navigate = useNavigate();
    const { userProfile: profile } = useAuth();
    const [posts, setPosts] = useState([]);
    const [newPost, setNewPost] = useState('');
    const [loading, setLoading] = useState(true);
    const [isPosting, setIsPosting] = useState(false);
    const [sortMethod, setSortMethod] = useState('hot'); // Default 'hot' per request
    const [userVotes, setUserVotes] = useState({});
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [toasts, setToasts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);

    const addToast = (message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    // Moderation
    const PROFANITY_LIST = ['badword', 'abuse', 'kill', 'hate', 'gross', 'spam']; // Example list - usually stored in DB or edge function

    // Check Status
    const isBanned = profile?.status === 'banned';

    // Helper: Check Content & Auto-Mod
    const checkContent = async (text) => {
        const lowerText = text.toLowerCase();
        const hasProfanity = PROFANITY_LIST.some(word => lowerText.includes(word));

        if (hasProfanity) {
            // 1. Increment Warning
            const newCount = (profile?.warnings_count || 0) + 1;
            const isBan = newCount > 2;
            const status = isBan ? 'banned' : 'warned';
            const msg = `Your content matched our filter ("${text.substring(0, 10)}..."). Strike ${newCount}/3.`;

            const { error } = await supabase.from('profiles').update({
                warnings_count: newCount,
                latest_warning_message: msg,
                status: status
            }).eq('id', profile.id);

            if (error) {
                console.error("Auto-Mod Update Failed", error);
                addToast("Content blocked by server", "error");
            } else {
                addToast("Content Blocked! Strike added.", "error");
                setTimeout(() => window.location.reload(), 2000); // Give time for toast
            }
            return false;
        }
        return true;
    };

    // Comments State
    const [activePostId, setActivePostId] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loadingComments, setLoadingComments] = useState(false);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        fetchPosts();

        // Fallback to HTTP Polling since Vercel Serverless doesn't support WebSocket endpoints.
        const intervalId = setInterval(() => {
            if (navigator.onLine) fetchPosts(false);
        }, 15000); // 15 seconds polling

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [sortMethod, profile]); // Refetch when sort changes or profile loads

    const fetchPosts = async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            let query = supabase
                .from('community_posts')
                .select('*');

            if (sortMethod === 'new') {
                query = query.order('created_at', { ascending: false });
            } else {
                query = query
                    .order('likes', { ascending: false })
                    .order('created_at', { ascending: false });
            }

            const { data: postsData, error: postsError } = await query;
            if (postsError) throw postsError;

            if (postsData && postsData.length > 0) {
                // Fetch comment counts ONLY for these posts to optimize
                const postIds = postsData.map(p => p.id);
                const { data: commentCounts, error: countError } = await supabase
                    .from('community_comments')
                    .select('post_id')
                    .in('post_id', postIds);

                const counts = {};
                if (commentCounts) {
                    commentCounts.forEach(c => {
                        counts[c.post_id] = (counts[c.post_id] || 0) + 1;
                    });
                }

                setPosts(postsData.map(p => ({
                    ...p,
                    comment_count: counts[p.id] || 0
                })));


                // Fetch User Votes for these posts
                if (profile?.id) {
                    const { data: votesData, error: votesError } = await supabase
                        .from('community_post_likes')
                        .select('post_id, vote_type')
                        .eq('user_id', profile.id)
                        .in('post_id', postsData.map(p => p.id));

                    if (votesError) {
                        console.error("Error fetching user votes:", votesError);
                    }

                    if (votesData) {
                        const votesMap = {};
                        votesData.forEach(v => {
                            votesMap[v.post_id] = v.vote_type;
                        });
                        setUserVotes(votesMap);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching community feed:", error);
            if (!navigator.onLine || error.message?.includes('Failed to fetch') || error.status === 500) {
                setIsOffline(true);
            }
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    // --- COMMUNITY ACTIONS ---

    const handleVote = async (postId, currentLikes, direction) => {
        if (isBanned) {
            addToast("Your account is currently restricted.", "warning");
            return;
        }
        if (isOffline) {
            addToast("You are currently offline", "warning");
            return;
        }

        const oldVote = userVotes[postId] || 0;
        if (oldVote === direction) return; // Already voted this way

        // 1. Optimistic Update
        const newLikes = currentLikes - oldVote + direction;
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: newLikes } : p));
        setUserVotes(prev => ({ ...prev, [postId]: direction }));

        try {
            // Update DB via Secure RPC (Preferred for atomic increments)
            const { error } = await supabase.rpc('toggle_post_vote', {
                target_post_id: postId,
                voting_user_id: profile.id,
                new_vote_type: direction
            });

            if (error) throw error;
            addToast("Vote updated", "info");
        } catch (error) {
            console.error("Vote failed:", error);
            // Rollback
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: currentLikes } : p));
            setUserVotes(prev => ({ ...prev, [postId]: oldVote }));
            addToast("Failed to record vote", "error");
        }
    };

    const handleDelete = async (postId) => {
        const postToDelete = posts.find(p => p.id === postId);
        // Optimistic Delete
        setPosts(prev => prev.filter(p => p.id !== postId));
        addToast("Post removing...", "info");

        try {
            const { error } = await supabase.from('community_posts').delete().eq('id', postId);
            if (error) throw error;
            addToast("Post deleted", "success");
        } catch (error) {
            console.error("Delete failed:", error);
            // Rollback
            if (postToDelete) setPosts(prev => [postToDelete, ...prev]);
            addToast("Failed to delete post", "error");
        }
    };

    const handlePost = async () => {
        if (!newPost.trim() || isPosting || isOffline) return;
        if (isBanned) return;

        const isSafe = await checkContent(newPost);
        if (!isSafe) return;

        setIsPosting(true);
        addToast("Publishing post...", "info");

        try {
            const { data, error } = await supabase
                .from('community_posts')
                .insert([{
                    content: newPost,
                    user_id: profile.id,
                    author_name: profile.full_name
                }])
                .select()
                .single();

            if (error) throw error;

            setPosts(prev => [data, ...prev]);
            setNewPost("");
            addToast("Post published!", "success");
        } catch (error) {
            console.error("Post failed:", error);
            addToast("Failed to publish post", "error");
        } finally {
            setIsPosting(false);
        }
    };

    const toggleComments = async (post) => {
        if (activePostId === post.id) {
            setActivePostId(null);
            setComments([]);
            return;
        }

        setActivePostId(post.id);
        setComments([]);
        setLoadingComments(true);

        const { data, error } = await supabase
            .from('community_comments')
            .select('*')
            .eq('post_id', post.id)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Error loading comments", error);
            addToast("Failed to load comments", "error");
        }

        if (data) setComments(data);
        setLoadingComments(false);
    };

    const handleComment = async () => {
        if (!newComment.trim() || !activePostId || isOffline) return;
        if (isBanned) return;

        const isSafe = await checkContent(newComment);
        if (!isSafe) return;

        addToast("Adding comment...", "info");

        try {
            const { data, error } = await supabase
                .from('community_comments')
                .insert([{
                    post_id: activePostId,
                    content: newComment,
                    user_id: profile.id,
                    author_name: profile.full_name
                }])
                .select()
                .single();

            if (error) throw error;

            setComments(prev => [...prev, data]);
            setNewComment("");
            addToast("Comment added", "success");
        } catch (error) {
            console.error("Comment failed:", error);
            addToast("Failed to add comment", "error");
        }
    };

    const handleDeleteComment = async (commentId) => {
        const commentToDelete = comments.find(c => c.id === commentId);
        // Optimistic Delete
        setComments(prev => prev.filter(c => c.id !== commentId));

        try {
            const { error } = await supabase.from('community_comments').delete().eq('id', commentId);
            if (error) throw error;
            addToast("Comment removed", "success");
        } catch (error) {
            console.error("Comment delete failed:", error);
            if (commentToDelete) setComments(prev => [...prev, commentToDelete]);
            addToast("Failed to remove comment", "error");
        }
    };

    // --- UI HELPERS ---
    const timeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}d`;
    };

    const filteredPosts = posts.filter(p =>
        p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.author_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return (
        <div className="min-vh-100 pb-5" style={{ background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)' }}>
            {/* Header / Sort - Sticky with Glass Effect */}
            <div className="sticky-top glass-nav py-3 mb-4 shadow-sm">
                <div className="container d-flex align-items-center justify-content-between" style={{ maxWidth: '640px' }}>
                    <div className="d-flex align-items-center gap-2 flex-grow-1">
                        <button
                            onClick={() => navigate(-1)}
                            className="btn btn-link p-0 text-dark d-flex align-items-center justify-content-center hover-scale"
                            style={{ width: '40px', height: '40px' }}
                        >
                            <ArrowLeft size={24} />
                        </button>
                        {!isSearching ? (
                            <h4 className="fw-bold mb-0 text-dark d-none d-sm-block" style={{ letterSpacing: '-0.5px' }}>Community</h4>
                        ) : (
                            <div className="flex-grow-1 mx-2">
                                <input
                                    autoFocus
                                    type="text"
                                    className="form-control form-control-sm glass-card border-0 py-2 px-3 w-100"
                                    placeholder="Search posts..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onBlur={() => !searchQuery && setIsSearching(false)}
                                    style={{ borderRadius: '100px', fontSize: '0.9rem' }}
                                />
                            </div>
                        )}
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <button
                            onClick={() => setIsSearching(!isSearching)}
                            className={`btn btn-link p-2 hover-scale ${isSearching ? 'text-primary' : 'text-muted'}`}
                        >
                            <Search size={20} />
                        </button>

                        <div className="d-flex align-items-center gap-3">
                            {/* Segmented Control for Sorting */}
                            <div className="segmented-control p-1 shadow-sm">
                                <button
                                    onClick={() => setSortMethod('new')}
                                    className={`btn btn-sm px-3 ${sortMethod === 'new' ? 'active shadow-sm' : ''} `}
                                >
                                    New
                                </button>
                                <button
                                    onClick={() => setSortMethod('hot')}
                                    className={`btn btn-sm px-3 btn-hot ${sortMethod === 'hot' ? 'active shadow-sm' : ''} `}
                                >
                                    Hot
                                </button>
                            </div>

                            {/* Hope Coins Display */}
                            <div className="badge bg-amber-400 text-dark px-3 py-2 rounded-pill shadow-sm d-flex align-items-center gap-2 border border-white border-opacity-50"
                                style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', boxShadow: '0 0 15px rgba(245, 158, 11, 0.3)' }}>
                                <Coins size={16} className="text-white" />
                                <span className="fw-bold text-white">{profile?.hope_coins || 0}</span>
                            </div>

                            <button onClick={fetchPosts} className="btn btn-link text-muted p-1 hover-scale">
                                <RefreshCw size={18} className={loading ? "spin-anim" : ""} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Account Restricted Banner (Phase 3) */}
                <AnimatePresence>
                    {isBanned && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="banned-banner"
                        >
                            <div className="container d-flex align-items-center justify-content-center gap-2" style={{ maxWidth: '640px' }}>
                                <Shield size={16} />
                                <span>Account Restricted. You can read but cannot interact.</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="container" style={{ maxWidth: '640px' }}>

                {/* Create Post Input (Reddit Style) */}
                <div className="mb-4" onClick={() => isBanned && addToast("Your account is currently restricted.", "warning")}>
                    <div className={`glass-card p-2 d-flex align-items-center gap-2 shadow-sm ${isBanned ? 'opacity-50' : ''}`} style={{ cursor: isBanned ? 'not-allowed' : 'text' }}>
                        <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 36, height: 36 }}>
                            <User size={18} />
                        </div>
                        <input
                            type="text"
                            className="form-control bg-transparent border-0 small"
                            placeholder={isBanned ? "Account restricted" : isOffline ? "You are offline" : "Create Post"}
                            value={newPost}
                            disabled={isBanned || isOffline}
                            onChange={e => setNewPost(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handlePost()}
                            style={{ color: 'var(--text-main)' }}
                        />
                        <button
                            disabled={!newPost.trim() || isPosting || isOffline || isBanned}
                            onClick={handlePost}
                            className="btn btn-link p-2 text-primary hover-scale"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>

                {/* Offline / Error State */}
                {isOffline && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="clay-card p-4 text-center mb-4 border-0"
                        style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}
                    >
                        <div className="text-danger mb-2">
                            <Ghost size={32} className="opacity-50" />
                        </div>
                        <h6 className="fw-bold text-danger mb-1">Connection Lost</h6>
                        <p className="small text-muted mb-3">We're having trouble connecting to the community servers. Please check your internet connection.</p>
                        <button
                            onClick={() => {
                                setIsOffline(false);
                                fetchPosts();
                            }}
                            className="btn btn-sm btn-outline-danger rounded-pill px-4 fw-bold"
                        >
                            Try Reconnecting
                        </button>
                    </motion.div>
                )}

                {/* Feed */}
                <div className="d-flex flex-column gap-4">
                    <AnimatePresence mode="wait">
                        {loading ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <SkeletonLoader type="card" count={3} />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="content"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="d-flex flex-column gap-4"
                            >
                                {filteredPosts.map(post => (
                                    <motion.div
                                        key={post.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, height: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="glass-card d-flex flex-column overflow-hidden hover-lift"
                                    >
                                        <div className="d-flex">
                                            {/* Voting Column */}
                                            <div className="d-flex flex-column align-items-center py-3 gap-1" style={{ width: '56px', background: 'rgba(0,0,0,0.03)' }}>
                                                <button
                                                    onClick={() => handleVote(post.id, post.likes, 1)}
                                                    className={`btn btn-link p-0 hover-scale ${userVotes[post.id] === 1 ? 'text-danger' : 'text-muted'}`}
                                                >
                                                    <ArrowBigUp size={28} fill={userVotes[post.id] === 1 ? "currentColor" : "none"} strokeWidth={1.5} />
                                                </button>
                                                <span className={`fw-bold ${userVotes[post.id] === 1 ? 'text-danger' : userVotes[post.id] === -1 ? 'text-primary' : 'text-dark'}`} style={{ fontSize: '0.9rem' }}>
                                                    {post.likes || 0}
                                                </span>
                                                <button
                                                    onClick={() => handleVote(post.id, post.likes, -1)}
                                                    className={`btn btn-link p-0 hover-scale ${userVotes[post.id] === -1 ? 'text-primary' : 'text-muted'}`}
                                                >
                                                    <ArrowBigDown size={28} fill={userVotes[post.id] === -1 ? "currentColor" : "none"} strokeWidth={1.5} />
                                                </button>
                                            </div>

                                            {/* Content Area */}
                                            <div className="p-3 flex-grow-1 d-flex flex-column">
                                                {/* Post Metadata */}
                                                <div className="d-flex align-items-center gap-2 mb-2 text-muted" style={{ fontSize: '0.75rem' }}>
                                                    <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: 20, height: 20 }}>
                                                        {post.author_name?.charAt(0).toUpperCase() || 'S'}
                                                    </div>
                                                    <span className="fw-bold text-dark">u/{post.author_name?.replace(/\s+/g, '').toLowerCase() || 'student'}</span>
                                                    <span>•</span>
                                                    <span>{timeAgo(post.created_at)}</span>

                                                    {(profile?.id === post.user_id || profile?.is_admin) && (
                                                        <button
                                                            onClick={() => handleDelete(post.id)}
                                                            className="btn btn-link p-0 text-danger ms-auto opacity-50 hover-opacity-100"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Post Content */}
                                                <div className="mb-3">
                                                    <p className="mb-0 text-dark opacity-90" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '1rem' }}>
                                                        {post.content}
                                                    </p>
                                                </div>

                                                {/* Bottom Actions */}
                                                <div className="d-flex gap-2">
                                                    <button
                                                        onClick={() => toggleComments(post)}
                                                        className={`btn btn-sm rounded-pill px-3 d-flex align-items-center gap-2 transition-all ${activePostId === post.id ? 'bg-primary bg-opacity-10 text-primary' : 'bg-light text-muted'}`}
                                                    >
                                                        <MessageSquare size={16} />
                                                        <span className="fw-bold">{post.comment_count > 0 ? post.comment_count : 'Comment'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Comment Section */}
                                        <AnimatePresence>
                                            {activePostId === post.id && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="border-top border-secondary border-opacity-10"
                                                    style={{ background: 'rgba(0,0,0,0.02)' }}
                                                >
                                                    <div className="p-3">
                                                        {/* Inline Comment Input */}
                                                        <div className="d-flex align-items-center gap-2 mb-3">
                                                            <input
                                                                className="form-control form-control-sm border-0 shadow-sm glass-card"
                                                                placeholder="Write a comment..."
                                                                value={newComment}
                                                                onChange={e => setNewComment(e.target.value)}
                                                                onKeyDown={e => e.key === 'Enter' && handleComment()}
                                                                style={{ borderRadius: '12px', height: '36px' }}
                                                            />
                                                            <button
                                                                disabled={!newComment.trim() || loadingComments}
                                                                onClick={handleComment}
                                                                className="btn btn-sm btn-primary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 hover-scale shadow-sm"
                                                                style={{
                                                                    width: '36px',
                                                                    height: '36px',
                                                                    padding: '0',
                                                                    background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                                                                    border: 'none',
                                                                    opacity: (!newComment.trim() || loadingComments) ? 0.4 : 1,
                                                                    boxShadow: (!newComment.trim() || loadingComments) ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.2)',
                                                                    display: 'inline-flex'
                                                                }}
                                                            >
                                                                <Send size={16} style={{ marginLeft: '1px', marginTop: '-1px' }} />
                                                            </button>
                                                        </div>

                                                        {/* Comments List */}
                                                        {loadingComments ? (
                                                            <SkeletonLoader type="text" count={2} />
                                                        ) : comments.filter(c => c.post_id === post.id).length > 0 ? (
                                                            <div className="d-flex flex-column gap-3 ps-2 border-start border-primary border-opacity-10">
                                                                {comments.filter(c => c.post_id === post.id).map(comment => (
                                                                    <div key={comment.id} className="small">
                                                                        <div className="d-flex justify-content-between mb-1">
                                                                            <span className="fw-bold text-dark opacity-75">u/{comment.author_name?.toLowerCase()}</span>
                                                                            <span className="text-muted" style={{ fontSize: '0.7rem' }}>{timeAgo(comment.created_at)}</span>
                                                                        </div>
                                                                        <p className="mb-0 text-dark opacity-80">{comment.content}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-center text-muted small mb-0 opacity-50">No comments yet.</p>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {filteredPosts.length === 0 && !loading && (
                        <div className="text-center py-5 text-muted glass-card border-0">
                            <Ghost size={48} className="mb-3 opacity-25" />
                            <p className="fw-bold">{searchQuery ? 'No results found' : 'Wow, such empty.'}</p>
                        </div>
                    )}
                </div>

                {/* Toast System Rendering */}
                <div className="toast-container">
                    <AnimatePresence>
                        {toasts.map(toast => (
                            <motion.div
                                key={toast.id}
                                initial={{ x: 100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 100, opacity: 0 }}
                                className={`toast-item toast-${toast.type}`}
                            >
                                <span className="small fw-bold">{toast.message}</span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* FAB (Phase 5) */}
            <AnimatePresence>
                {!isBanned && !isOffline && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.1, translateY: -5 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsComposeModalOpen(true)}
                        className="fab-button"
                    >
                        <Send size={28} />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Compose Modal (Phase 5) */}
            <AnimatePresence>
                {isComposeModalOpen && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="compose-modal"
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                        >
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h5 className="fw-bold mb-0">Create Post</h5>
                                <button
                                    onClick={() => setIsComposeModalOpen(false)}
                                    className="btn-close"
                                ></button>
                            </div>
                            <div className="mb-4">
                                <textarea
                                    className="form-control glass-card border-0 p-3"
                                    rows="5"
                                    placeholder="What's on your mind?"
                                    value={newPost}
                                    onChange={(e) => setNewPost(e.target.value)}
                                    autoFocus
                                    style={{ background: '#f8fafc', borderRadius: '16px' }}
                                ></textarea>
                            </div>
                            <div className="d-flex justify-content-end gap-2">
                                <button
                                    onClick={() => setIsComposeModalOpen(false)}
                                    className="btn btn-link text-muted fw-bold"
                                    style={{ textDecoration: 'none' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={!newPost.trim() || isPosting}
                                    onClick={async () => {
                                        await handlePost();
                                    }}
                                    className="btn btn-primary rounded-pill px-4 fw-bold shadow-lg hover-scale"
                                    style={{
                                        background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                                        border: 'none',
                                        opacity: (!newPost.trim() || isPosting) ? 0.6 : 1,
                                        boxShadow: (!newPost.trim() || isPosting) ? 'none' : undefined
                                    }}
                                >
                                    {isPosting ? 'Posting...' : 'Post to Community'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
