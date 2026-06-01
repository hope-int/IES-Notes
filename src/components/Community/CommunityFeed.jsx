import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
    MessageSquare, ArrowBigUp, ArrowBigDown, User, RefreshCw, Send, Trash2,
    Shield, Coins, ArrowLeft, Search, Flame, Clock3, Radio, Sparkles, Users,
    PenLine, X, WifiOff, MessageCircle, Activity, ShieldCheck, Plus, Inbox,
    Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SkeletonLoader from '../SkeletonLoader';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const MotionDiv = motion.div;
const MotionButton = motion.button;

export default function CommunityFeed() {
    const navigate = useNavigate();
    const { userProfile: profile } = useAuth();
    const [posts, setPosts] = useState([]);
    const [newPost, setNewPost] = useState('');
    const [loading, setLoading] = useState(true);
    const [isPosting, setIsPosting] = useState(false);
    const [sortMethod, setSortMethod] = useState('hot');
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

    const PROFANITY_LIST = ['badword', 'abuse', 'kill', 'hate', 'gross', 'spam'];
    const isBanned = profile?.status === 'banned';

    const checkContent = async (text) => {
        const lowerText = text.toLowerCase();
        const hasProfanity = PROFANITY_LIST.some(word => lowerText.includes(word));

        if (hasProfanity) {
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
                addToast("Content blocked. Strike added.", "error");
                setTimeout(() => window.location.reload(), 2000);
            }
            return false;
        }
        return true;
    };

    const [activePostId, setActivePostId] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loadingComments, setLoadingComments] = useState(false);

    const fetchPosts = React.useCallback(async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            const withTimeout = (promise, timeoutMs = 12000) => Promise.race([
                promise,
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Community request timed out')), timeoutMs);
                })
            ]);

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

            const { data: postsData, error: postsError } = await withTimeout(query);
            if (postsError) throw postsError;

            if (postsData && postsData.length > 0) {
                const postIds = postsData.map(p => p.id);
                const { data: commentCounts, error: countError } = await supabase
                    .from('community_comments')
                    .select('post_id')
                    .in('post_id', postIds);

                if (countError) {
                    console.error("Error fetching comment counts:", countError);
                }

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
                } else {
                    setUserVotes({});
                }
            } else {
                setPosts([]);
                setUserVotes({});
            }
        } catch (error) {
            console.error("Error fetching community feed:", error);
            if (!navigator.onLine || error.message?.includes('Failed to fetch') || error.status === 500) {
                setIsOffline(true);
            }
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [profile?.id, sortMethod]);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        fetchPosts();

        const intervalId = setInterval(() => {
            if (navigator.onLine) fetchPosts(false);
        }, 15000);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [fetchPosts]);

    const handleVote = async (postId, currentLikes, direction) => {
        if (isBanned) {
            addToast("Your account is currently restricted.", "warning");
            return;
        }
        if (isOffline) {
            addToast("You are currently offline", "warning");
            return;
        }
        if (!profile?.id) {
            addToast("Profile is still loading", "warning");
            return;
        }

        const oldVote = userVotes[postId] || 0;
        if (oldVote === direction) return;

        const newLikes = currentLikes - oldVote + direction;
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: newLikes } : p));
        setUserVotes(prev => ({ ...prev, [postId]: direction }));

        try {
            const { error } = await supabase.rpc('toggle_post_vote', {
                target_post_id: postId,
                voting_user_id: profile.id,
                new_vote_type: direction
            });

            if (error) throw error;
            addToast("Vote updated", "info");
        } catch (error) {
            console.error("Vote failed:", error);
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: currentLikes } : p));
            setUserVotes(prev => ({ ...prev, [postId]: oldVote }));
            addToast("Failed to record vote", "error");
        }
    };

    const handleDelete = async (postId) => {
        const postToDelete = posts.find(p => p.id === postId);
        setPosts(prev => prev.filter(p => p.id !== postId));
        addToast("Post removing...", "info");

        try {
            const { error } = await supabase.from('community_posts').delete().eq('id', postId);
            if (error) throw error;
            addToast("Post deleted", "success");
        } catch (error) {
            console.error("Delete failed:", error);
            if (postToDelete) setPosts(prev => [postToDelete, ...prev]);
            addToast("Failed to delete post", "error");
        }
    };

    const handlePost = async () => {
        if (!newPost.trim() || isPosting || isOffline) return false;
        if (isBanned) return false;
        if (!profile?.id) {
            addToast("Profile is still loading", "warning");
            return false;
        }

        const content = newPost.trim();
        const isSafe = await checkContent(content);
        if (!isSafe) return false;

        setIsPosting(true);
        addToast("Publishing post...", "info");

        try {
            const { data, error } = await supabase
                .from('community_posts')
                .insert([{
                    content,
                    user_id: profile.id,
                    author_name: profile.full_name || 'Student'
                }])
                .select()
                .single();

            if (error) throw error;

            setPosts(prev => [{ ...data, comment_count: 0 }, ...prev]);
            setNewPost("");
            addToast("Post published!", "success");
            return true;
        } catch (error) {
            console.error("Post failed:", error);
            addToast("Failed to publish post", "error");
            return false;
        } finally {
            setIsPosting(false);
        }
    };

    const toggleComments = async (post) => {
        if (activePostId === post.id) {
            setActivePostId(null);
            setComments([]);
            setNewComment('');
            return;
        }

        setActivePostId(post.id);
        setComments([]);
        setNewComment('');
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
        if (!profile?.id) {
            addToast("Profile is still loading", "warning");
            return;
        }

        const content = newComment.trim();
        const isSafe = await checkContent(content);
        if (!isSafe) return;

        addToast("Adding comment...", "info");

        try {
            const { data, error } = await supabase
                .from('community_comments')
                .insert([{
                    post_id: activePostId,
                    content,
                    user_id: profile.id,
                    author_name: profile.full_name || 'Student'
                }])
                .select()
                .single();

            if (error) throw error;

            setComments(prev => [...prev, data]);
            setPosts(prev => prev.map(p => (
                p.id === activePostId
                    ? { ...p, comment_count: (p.comment_count || 0) + 1 }
                    : p
            )));
            setNewComment("");
            addToast("Comment added", "success");
        } catch (error) {
            console.error("Comment failed:", error);
            addToast("Failed to add comment", "error");
        }
    };

    const handleDeleteComment = async (commentId) => {
        const commentToDelete = comments.find(c => c.id === commentId);
        setComments(prev => prev.filter(c => c.id !== commentId));

        try {
            const { error } = await supabase.from('community_comments').delete().eq('id', commentId);
            if (error) throw error;
            if (commentToDelete?.post_id) {
                setPosts(prev => prev.map(p => (
                    p.id === commentToDelete.post_id
                        ? { ...p, comment_count: Math.max((p.comment_count || 1) - 1, 0) }
                        : p
                )));
            }
            addToast("Comment removed", "success");
        } catch (error) {
            console.error("Comment delete failed:", error);
            if (commentToDelete) setComments(prev => [...prev, commentToDelete]);
            addToast("Failed to remove comment", "error");
        }
    };

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

    const filteredPosts = posts.filter(p => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return (
            p.content?.toLowerCase().includes(query) ||
            p.author_name?.toLowerCase().includes(query)
        );
    });

    const displayName = profile?.full_name || 'Student';
    const studentHandle = displayName.replace(/\s+/g, '').toLowerCase();
    const totalCommentCount = posts.reduce((total, post) => total + (post.comment_count || 0), 0);
    const activeSortLabel = sortMethod === 'hot' ? 'Hot signals' : 'Newest signals';

    return (
        <div className="community-hub-shell">
            <div className="community-hub-ambient" aria-hidden="true">
                <span className="community-hub-grid" />
                <span className="community-hub-glare" />
            </div>

            <nav className="community-hub-nav">
                <div className="community-nav-brand">
                    <button
                        onClick={() => navigate(-1)}
                        className="community-icon-button"
                        aria-label="Back"
                    >
                        <ArrowLeft size={19} />
                    </button>
                    <div className="community-brand-mark">
                        <Sparkles size={19} />
                    </div>
                    <div className="community-brand-copy">
                        <h1>Community</h1>
                        <span>Campus signal network</span>
                    </div>
                </div>

                <div className="community-nav-actions">
                    <label className={`community-search ${isSearching || searchQuery ? 'is-active' : ''}`}>
                        <Search size={17} />
                        <input
                            type="text"
                            placeholder="Search discussions"
                            value={searchQuery}
                            onFocus={() => setIsSearching(true)}
                            onBlur={() => !searchQuery && setIsSearching(false)}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    setIsSearching(false);
                                }}
                                aria-label="Clear search"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </label>

                    <div className="community-sort-switch" role="group" aria-label="Sort posts">
                        <button
                            type="button"
                            onClick={() => setSortMethod('new')}
                            className={sortMethod === 'new' ? 'is-active' : ''}
                        >
                            <Clock3 size={15} />
                            New
                        </button>
                        <button
                            type="button"
                            onClick={() => setSortMethod('hot')}
                            className={sortMethod === 'hot' ? 'is-active' : ''}
                        >
                            <Flame size={15} />
                            Hot
                        </button>
                    </div>

                    <div className="community-coin-pill">
                        <Coins size={16} />
                        <span>{profile?.hope_coins || 0}</span>
                    </div>

                    <button
                        type="button"
                        onClick={() => fetchPosts()}
                        className="community-icon-button"
                        aria-label="Refresh posts"
                    >
                        <RefreshCw size={17} className={loading ? 'spin-anim' : ''} />
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsComposeModalOpen(true)}
                        disabled={isBanned || isOffline}
                        className="community-primary-button"
                    >
                        <Plus size={17} />
                        <span>New Signal</span>
                    </button>
                </div>
            </nav>

            <main className="community-hub-main">
                <section className="community-feed-column">
                    <MotionDiv
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="community-command-card"
                    >
                        <div className="community-command-copy">
                            <span className="community-kicker">
                                <Compass size={15} />
                                Campus Pulse
                            </span>
                            <h2>Student threads that move with the work.</h2>
                            <p>Ask, share, and solve with the same focused HOPE workspace language.</p>
                        </div>

                        <div className="community-metric-strip">
                            <div>
                                <strong>{posts.length}</strong>
                                <span>Signals</span>
                            </div>
                            <div>
                                <strong>{totalCommentCount}</strong>
                                <span>Replies</span>
                            </div>
                            <div>
                                <strong>{activeSortLabel}</strong>
                                <span>Sorting</span>
                            </div>
                        </div>

                        <div
                            className={`community-composer ${isBanned ? 'is-disabled' : ''}`}
                            onClick={() => isBanned && addToast("Your account is currently restricted.", "warning")}
                        >
                            <div className="community-avatar is-self">
                                <User size={18} />
                            </div>
                            <div className="community-composer-body">
                                <textarea
                                    placeholder={isBanned ? 'Account restricted' : isOffline ? 'You are offline' : 'Start a community signal'}
                                    value={newPost}
                                    disabled={isBanned || isOffline}
                                    onChange={e => setNewPost(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handlePost();
                                        }
                                    }}
                                />
                                <div className="community-composer-footer">
                                    <span>{newPost.trim().length ? `${newPost.trim().length} chars` : 'Ready'}</span>
                                    <button
                                        type="button"
                                        disabled={!newPost.trim() || isPosting || isOffline || isBanned}
                                        onClick={handlePost}
                                        className="community-primary-button is-compact"
                                    >
                                        <Send size={16} />
                                        {isPosting ? 'Posting' : 'Post'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </MotionDiv>

                    <AnimatePresence>
                        {isOffline && (
                            <MotionDiv
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="community-alert is-offline"
                            >
                                <WifiOff size={18} />
                                <div>
                                    <strong>Connection lost</strong>
                                    <span>Community updates will resume after reconnecting.</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOffline(false);
                                        fetchPosts();
                                    }}
                                >
                                    Retry
                                </button>
                            </MotionDiv>
                        )}

                        {isBanned && (
                            <MotionDiv
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="community-alert is-restricted"
                            >
                                <Shield size={18} />
                                <div>
                                    <strong>Account restricted</strong>
                                    <span>You can read threads, but posting and voting are paused.</span>
                                </div>
                            </MotionDiv>
                        )}
                    </AnimatePresence>

                    <div className="community-feed-toolbar">
                        <div>
                            <span>{filteredPosts.length} visible</span>
                            <h3>{searchQuery ? 'Search Results' : 'Live Threads'}</h3>
                        </div>
                        <div className="community-status-chip">
                            <span className={isOffline ? 'is-offline' : ''} />
                            {isOffline ? 'Offline' : 'Live'}
                        </div>
                    </div>

                    <div className="community-post-stack">
                        <AnimatePresence mode="wait">
                            {loading ? (
                                <MotionDiv
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="community-loading"
                                >
                                    <SkeletonLoader type="card" count={3} />
                                </MotionDiv>
                            ) : (
                                <MotionDiv
                                    key="content"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="community-post-list"
                                >
                                    {filteredPosts.map(post => {
                                        const postComments = comments.filter(c => c.post_id === post.id);
                                        const authorName = post.author_name || 'Student';
                                        const authorHandle = authorName.replace(/\s+/g, '').toLowerCase();
                                        const isActive = activePostId === post.id;

                                        return (
                                            <MotionDiv
                                                key={post.id}
                                                initial={{ opacity: 0, y: 14 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.98, height: 0 }}
                                                transition={{ duration: 0.24 }}
                                                className={`community-post-card ${isActive ? 'is-open' : ''}`}
                                            >
                                                <div className="community-vote-rail">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleVote(post.id, post.likes, 1)}
                                                        className={userVotes[post.id] === 1 ? 'is-up' : ''}
                                                        aria-label="Upvote"
                                                    >
                                                        <ArrowBigUp size={27} fill={userVotes[post.id] === 1 ? 'currentColor' : 'none'} strokeWidth={1.5} />
                                                    </button>
                                                    <strong className={userVotes[post.id] === 1 ? 'is-up' : userVotes[post.id] === -1 ? 'is-down' : ''}>
                                                        {post.likes || 0}
                                                    </strong>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleVote(post.id, post.likes, -1)}
                                                        className={userVotes[post.id] === -1 ? 'is-down' : ''}
                                                        aria-label="Downvote"
                                                    >
                                                        <ArrowBigDown size={27} fill={userVotes[post.id] === -1 ? 'currentColor' : 'none'} strokeWidth={1.5} />
                                                    </button>
                                                </div>

                                                <article className="community-post-main">
                                                    <header className="community-post-header">
                                                        <div className="community-author">
                                                            <div className="community-avatar">
                                                                {authorName.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <strong>{authorName}</strong>
                                                                <span>@{authorHandle} / {timeAgo(post.created_at)}</span>
                                                            </div>
                                                        </div>

                                                        {(profile?.id === post.user_id || profile?.is_admin) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelete(post.id)}
                                                                className="community-danger-button"
                                                                aria-label="Delete post"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        )}
                                                    </header>

                                                    <p className="community-post-content">{post.content}</p>

                                                    <div className="community-post-actions">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleComments(post)}
                                                            className={isActive ? 'is-active' : ''}
                                                        >
                                                            <MessageSquare size={16} />
                                                            <span>{post.comment_count > 0 ? `${post.comment_count} replies` : 'Reply'}</span>
                                                        </button>
                                                    </div>

                                                    <AnimatePresence>
                                                        {isActive && (
                                                            <MotionDiv
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="community-thread-panel"
                                                            >
                                                                <div className="community-comment-composer">
                                                                    <div className="community-avatar is-small">
                                                                        {displayName.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <input
                                                                        placeholder={isBanned ? 'Account restricted' : 'Write a reply'}
                                                                        value={newComment}
                                                                        disabled={isBanned || isOffline}
                                                                        onChange={e => setNewComment(e.target.value)}
                                                                        onKeyDown={e => e.key === 'Enter' && handleComment()}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        disabled={!newComment.trim() || loadingComments || isBanned || isOffline}
                                                                        onClick={handleComment}
                                                                    >
                                                                        <Send size={15} />
                                                                    </button>
                                                                </div>

                                                                {loadingComments ? (
                                                                    <div className="community-comment-loading">
                                                                        <SkeletonLoader type="text" count={2} />
                                                                    </div>
                                                                ) : postComments.length > 0 ? (
                                                                    <div className="community-comment-list">
                                                                        {postComments.map(comment => {
                                                                            const commentAuthor = comment.author_name || 'Student';
                                                                            return (
                                                                                <div key={comment.id} className="community-comment">
                                                                                    <div className="community-avatar is-small">
                                                                                        {commentAuthor.charAt(0).toUpperCase()}
                                                                                    </div>
                                                                                    <div className="community-comment-body">
                                                                                        <div className="community-comment-meta">
                                                                                            <strong>{commentAuthor}</strong>
                                                                                            <span>{timeAgo(comment.created_at)}</span>
                                                                                            {(profile?.id === comment.user_id || profile?.is_admin) && (
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => handleDeleteComment(comment.id)}
                                                                                                    aria-label="Delete comment"
                                                                                                >
                                                                                                    <Trash2 size={13} />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                        <p>{comment.content}</p>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : (
                                                                    <div className="community-no-comments">
                                                                        <MessageCircle size={18} />
                                                                        <span>No replies yet.</span>
                                                                    </div>
                                                                )}
                                                            </MotionDiv>
                                                        )}
                                                    </AnimatePresence>
                                                </article>
                                            </MotionDiv>
                                        );
                                    })}
                                </MotionDiv>
                            )}
                        </AnimatePresence>

                        {filteredPosts.length === 0 && !loading && (
                            <div className="community-empty-state">
                                <Inbox size={42} />
                                <h3>{searchQuery ? 'No matching signals' : 'No threads yet'}</h3>
                                <p>{searchQuery ? 'Try a different search.' : 'Start the first campus signal.'}</p>
                            </div>
                        )}
                    </div>
                </section>

                <aside className="community-side-rail">
                    <div className="community-rail-card is-profile">
                        <div className="community-profile-lockup">
                            <div className="community-avatar is-large">
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <span>Signed in as</span>
                                <strong>{displayName}</strong>
                                <small>@{studentHandle}</small>
                            </div>
                        </div>

                        <div className="community-rail-grid">
                            <div>
                                <Coins size={16} />
                                <strong>{profile?.hope_coins || 0}</strong>
                                <span>Coins</span>
                            </div>
                            <div>
                                <MessageSquare size={16} />
                                <strong>{totalCommentCount}</strong>
                                <span>Replies</span>
                            </div>
                            <div>
                                <Users size={16} />
                                <strong>{posts.length}</strong>
                                <span>Threads</span>
                            </div>
                        </div>
                    </div>

                    <div className="community-rail-card">
                        <div className="community-rail-title">
                            <Activity size={17} />
                            <span>Network Pulse</span>
                        </div>
                        <div className="community-pulse-list">
                            <div>
                                <span>Status</span>
                                <strong>{isOffline ? 'Offline' : 'Live'}</strong>
                            </div>
                            <div>
                                <span>Sort</span>
                                <strong>{activeSortLabel}</strong>
                            </div>
                            <div>
                                <span>Visible</span>
                                <strong>{filteredPosts.length}</strong>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsComposeModalOpen(true)}
                        disabled={isBanned || isOffline}
                        className="community-rail-compose"
                    >
                        <PenLine size={19} />
                        <span>
                            <strong>Compose Signal</strong>
                            <small>Share a question or update.</small>
                        </span>
                    </button>

                    <div className="community-rail-card">
                        <div className="community-rail-title">
                            <ShieldCheck size={17} />
                            <span>Community Guard</span>
                        </div>
                        <p className="community-rail-copy">
                            Respectful posts stay live. Restricted accounts can still read every thread.
                        </p>
                    </div>
                </aside>
            </main>

            <div className="community-toast-stack">
                <AnimatePresence>
                    {toasts.map(toast => (
                        <MotionDiv
                            key={toast.id}
                            initial={{ x: 80, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 80, opacity: 0 }}
                            className={`community-toast community-toast-${toast.type}`}
                        >
                            <span>{toast.message}</span>
                        </MotionDiv>
                    ))}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {!isBanned && !isOffline && (
                    <MotionButton
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.06, y: -4 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setIsComposeModalOpen(true)}
                        className="community-floating-compose"
                        aria-label="Create post"
                    >
                        <Send size={25} />
                    </MotionButton>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isComposeModalOpen && (
                    <MotionDiv
                        className="community-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <button
                            type="button"
                            className="community-modal-dismiss"
                            onClick={() => setIsComposeModalOpen(false)}
                            aria-label="Close compose"
                        />
                        <MotionDiv
                            className="community-compose-dialog"
                            initial={{ scale: 0.96, y: 18 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.96, y: 18 }}
                        >
                            <div className="community-dialog-header">
                                <div>
                                    <span>New Signal</span>
                                    <h3>Post to Community</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsComposeModalOpen(false)}
                                    aria-label="Close"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <textarea
                                className="community-dialog-textarea"
                                rows="7"
                                placeholder="Share a question, idea, note, or campus update."
                                value={newPost}
                                onChange={(e) => setNewPost(e.target.value)}
                                autoFocus
                            />

                            <div className="community-dialog-footer">
                                <span>{newPost.trim().length} chars</span>
                                <button
                                    type="button"
                                    onClick={() => setIsComposeModalOpen(false)}
                                    className="community-secondary-button"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={!newPost.trim() || isPosting}
                                    onClick={async () => {
                                        const posted = await handlePost();
                                        if (posted) setIsComposeModalOpen(false);
                                    }}
                                    className="community-primary-button"
                                >
                                    {isPosting ? 'Posting...' : 'Post to Community'}
                                </button>
                            </div>
                        </MotionDiv>
                    </MotionDiv>
                )}
            </AnimatePresence>
        </div>
    );
}
