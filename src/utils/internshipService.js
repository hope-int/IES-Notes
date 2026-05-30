import { supabase } from '../supabaseClient.js';

const FALLBACK_KEY = 'hope_fallback_internships';
const PUTER_POSTS_KEY = 'hope_internship_posts';
const PUTER_REPORTS_KEY = 'hope_internship_reports';

const cleanOptionalText = (value) => (value || '').trim();

const normalizeOptionalUrl = (value) => {
    const trimmed = cleanOptionalText(value);
    if (!trimmed) return '';
    if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
};

const DEFAULT_MOCK_POSTS = [
    {
        id: 'mock-1',
        caption: 'Google is hiring Software Engineering Interns for Fall 2026! 🚀 Join the Google Cloud team to build next-generation scalable platforms. Open for S3/S5 Computer Science & Data Science students. Excellent coding skills in Python/Go required. Apply via the Google Form link below!',
        image_url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80',
        tags: ['Computer Science & Engineering', 'Computer Science (Data Science)', 'Internship', 'Remote'],
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        expires_at: new Date(Date.now() + 3600000 * 48).toISOString(),
        likes_count: 42,
        company_name: 'Google',
        location: 'Bangalore, India',
        google_form_link: 'https://forms.google.com'
    },
    {
        id: 'mock-2',
        caption: 'Tesla Autopilot Team is looking for Robotics & Computer Vision Research Interns! 🤖 Work directly on cutting-edge neural networks for self-driving cars. Deep learning expertise (PyTorch) and ROS experience are key. Apply today!',
        image_url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=600&q=80',
        tags: ['Robotics and Artificial Intelligence', 'Computer Science & Engineering', 'Internship', 'On-site'],
        created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
        expires_at: new Date(Date.now() + 3600000 * 12).toISOString(),
        likes_count: 31,
        company_name: 'Tesla',
        location: 'California, USA',
        whatsapp_link: 'https://chat.whatsapp.com'
    },
    {
        id: 'mock-3',
        caption: 'Intel Silicon Validation Group is hiring Hardware Design Interns! 💻 Get hands-on experience with VLSI, micro-architecture design, and chip debugging. Perfect opportunity for ECE & EEE students. Contact hiring manager directly.',
        image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
        tags: ['Electronics & Communication Engineering', 'Electrical & Electronics Engineering', 'Internship', 'Hybrid'],
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        expires_at: new Date(Date.now() + 3600000 * 120).toISOString(),
        likes_count: 27,
        company_name: 'Intel',
        location: 'Hyderabad, India',
        phone_number: '+919876543210',
        whatsapp_number: '+919876543210'
    }
];

// Initialize local storage fallback if not set
const getFallbackPosts = () => {
    const stored = localStorage.getItem(FALLBACK_KEY);
    if (!stored) {
        localStorage.setItem(FALLBACK_KEY, JSON.stringify(DEFAULT_MOCK_POSTS));
        return DEFAULT_MOCK_POSTS;
    }
    try {
        const posts = JSON.parse(stored);
        const updated = posts.map(p => {
            if (p.id === 'mock-1') p.expires_at = new Date(Date.now() + 3600000 * 48).toISOString();
            if (p.id === 'mock-2') p.expires_at = new Date(Date.now() + 3600000 * 12).toISOString();
            if (p.id === 'mock-3') p.expires_at = new Date(Date.now() + 3600000 * 120).toISOString();
            return p;
        });
        localStorage.setItem(FALLBACK_KEY, JSON.stringify(updated));
        return updated;
    } catch (e) {
        return DEFAULT_MOCK_POSTS;
    }
};

const saveFallbackPosts = (posts) => {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(posts));
};

export async function getInternshipPosts(studentProfile = null) {
    try {
        let allPosts = [];
        
        // Fetch from Supabase announcements table
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .like('content', 'HOPE_FEED_POST::%')
            .order('created_at', { ascending: false });

        if (!error && data) {
            allPosts = data.map(row => {
                try {
                    const jsonStr = row.content.substring('HOPE_FEED_POST::'.length);
                    const post = JSON.parse(jsonStr);
                    return {
                        ...post,
                        id: row.id,
                        created_at: row.created_at
                    };
                } catch (e) {
                    console.error("Failed to parse internship post JSON:", e);
                    return null;
                }
            }).filter(Boolean);
        }
        
        // If no posts fetched from Supabase, use fallback
        if (allPosts.length === 0) {
            allPosts = getFallbackPosts();
        }

        // Filter out expired posts
        const activePosts = allPosts.filter(post => {
            if (!post.expires_at) return true;
            return new Date(post.expires_at) > new Date();
        });

        return personalizePosts(activePosts, studentProfile);
    } catch (e) {
        console.warn("Unexpected error fetching internship posts, returning fallback:", e);
        const activePosts = getFallbackPosts().filter(post => {
            if (!post.expires_at) return true;
            return new Date(post.expires_at) > new Date();
        });
        return personalizePosts(activePosts, studentProfile);
    }
}

// Personalize posts by ranking/filtering based on student field
function personalizePosts(posts, studentProfile) {
    if (!studentProfile) return posts;

    const dept = studentProfile.department || '';
    const sem = studentProfile.semester || '';
    const matchTags = [dept, sem].filter(Boolean).map(t => t.toLowerCase());

    return [...posts].sort((a, b) => {
        const aMatch = a.tags.some(tag => matchTags.some(mt => tag.toLowerCase().includes(mt) || mt.includes(tag.toLowerCase())));
        const bMatch = b.tags.some(tag => matchTags.some(mt => tag.toLowerCase().includes(mt) || mt.includes(tag.toLowerCase())));

        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
    });
}

export async function createInternshipPost({ caption, imageUrl, tags, companyName, location, expiresAt, phoneNumber, whatsappNumber, whatsappLink, googleFormLink }) {
    const postData = {
        caption,
        image_url: imageUrl,
        tags: tags || [],
        company_name: companyName || 'Admin Announcement',
        location: location || 'Remote',
        expires_at: expiresAt || new Date(Date.now() + 3600000 * 24 * 7).toISOString(),
        likes_count: 0,
        phone_number: cleanOptionalText(phoneNumber),
        whatsapp_number: cleanOptionalText(whatsappNumber),
        whatsapp_link: normalizeOptionalUrl(whatsappLink),
        google_form_link: normalizeOptionalUrl(googleFormLink)
    };

    const payload = 'HOPE_FEED_POST::' + JSON.stringify(postData);

    try {
        const { data, error } = await supabase
            .from('announcements')
            .insert({
                content: payload,
                is_active: true
            })
            .select();

        if (error) throw error;

        const newPost = {
            id: data[0].id,
            ...postData,
            created_at: data[0].created_at
        };

        const fallbackPosts = getFallbackPosts();
        saveFallbackPosts([newPost, ...fallbackPosts]);

        return newPost;
    } catch (e) {
        console.warn("Unexpected error inserting internship post:", e);
        const newPost = {
            id: 'post-' + Date.now(),
            ...postData,
            created_at: new Date().toISOString()
        };
        const fallbackPosts = getFallbackPosts();
        saveFallbackPosts([newPost, ...fallbackPosts]);
        return newPost;
    }
}

export async function deleteInternshipPost(postId) {
    try {
        await supabase
            .from('announcements')
            .delete()
            .eq('id', postId);

        const fallbackPosts = getFallbackPosts();
        const filteredFallback = fallbackPosts.filter(p => p.id !== postId);
        saveFallbackPosts(filteredFallback);

        return true;
    } catch (e) {
        console.warn("Unexpected error deleting internship post:", e);
        return true;
    }
}

// Track likes locally in user device to allow offline/no-schema liking
export function getLikedPostIds() {
    try {
        return JSON.parse(localStorage.getItem('hope_liked_internships') || '[]');
    } catch (e) {
        return [];
    }
}

export function toggleLikePostLocal(postId) {
    try {
        const liked = getLikedPostIds();
        let updated;
        let isLiked = false;
        if (liked.includes(postId)) {
            updated = liked.filter(id => id !== postId);
        } else {
            updated = [...liked, postId];
            isLiked = true;
        }
        localStorage.setItem('hope_liked_internships', JSON.stringify(updated));
        
        // Also update local mock count if fallback
        const fallbackPosts = getFallbackPosts();
        const postIndex = fallbackPosts.findIndex(p => p.id === postId);
        if (postIndex !== -1) {
            fallbackPosts[postIndex].likes_count = Math.max(0, fallbackPosts[postIndex].likes_count + (isLiked ? 1 : -1));
            saveFallbackPosts(fallbackPosts);
        }
        return { isLiked, updated };
    } catch (e) {
        console.error("Failed to toggle post like locally:", e);
        return { isLiked: false, updated: [] };
    }
}

// Post Reporting Logic
export async function reportInternshipPost(postId, postCompanyName, reason, details, studentProfile) {
    const report = {
        id: 'rep-' + Date.now(),
        post_id: postId,
        company_name: postCompanyName || 'Unknown',
        reason,
        details: details || '',
        reported_at: new Date().toISOString(),
        reporter: studentProfile ? {
            id: studentProfile.id,
            name: studentProfile.full_name || 'Student',
            email: studentProfile.email || 'student@hope.com'
        } : { name: 'Guest Student' }
    };

    try {
        let currentReports = [];
        if (window.puter && window.puter.kv) {
            try {
                const res = await window.puter.kv.get(PUTER_REPORTS_KEY);
                if (res) currentReports = JSON.parse(res);
            } catch (e) {}
            currentReports.push(report);
            await window.puter.kv.set(PUTER_REPORTS_KEY, JSON.stringify(currentReports));
        } else {
            const stored = localStorage.getItem(PUTER_REPORTS_KEY);
            currentReports = stored ? JSON.parse(stored) : [];
            currentReports.push(report);
            localStorage.setItem(PUTER_REPORTS_KEY, JSON.stringify(currentReports));
        }
        return true;
    } catch (e) {
        console.error("Failed to submit post report:", e);
        return false;
    }
}

export async function getReportedInternshipPosts() {
    try {
        let reports = [];
        if (window.puter && window.puter.kv) {
            const res = await window.puter.kv.get(PUTER_REPORTS_KEY);
            if (res) reports = JSON.parse(res);
        } else {
            const stored = localStorage.getItem(PUTER_REPORTS_KEY);
            if (stored) reports = JSON.parse(stored);
        }
        return reports;
    } catch (e) {
        console.error("Failed to fetch reports:", e);
        return [];
    }
}

export async function dismissReport(reportId) {
    try {
        let reports = [];
        if (window.puter && window.puter.kv) {
            const res = await window.puter.kv.get(PUTER_REPORTS_KEY);
            if (res) reports = JSON.parse(res);
            reports = reports.filter(r => r.id !== reportId);
            await window.puter.kv.set(PUTER_REPORTS_KEY, JSON.stringify(reports));
        } else {
            const stored = localStorage.getItem(PUTER_REPORTS_KEY);
            if (stored) reports = JSON.parse(stored);
            reports = reports.filter(r => r.id !== reportId);
            localStorage.setItem(PUTER_REPORTS_KEY, JSON.stringify(reports));
        }
        return true;
    } catch (e) {
        console.error("Failed to dismiss report:", e);
        return false;
    }
}
