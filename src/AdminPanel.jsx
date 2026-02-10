import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
    LayoutDashboard, FilePlus, Bell, Send, Trash2, Upload,
    CheckCircle, AlertCircle, Loader, ChevronDown, Folder, Users, Shield, Lock, Search, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminPanel({ onBack }) {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    // Stats
    const [stats, setStats] = useState({ notes: 0, users: 0, announcements: 0 });

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        const { count: noteCount } = await supabase.from('notes').select('*', { count: 'exact', head: true });
        const { count: annCount } = await supabase.from('announcements').select('*', { count: 'exact', head: true });
        // User count requires calling our new RPC or just guessing if we can't count auth.users directly
        // Usually plain client can't count all users. We'll leave it as estimated or fetch from public profiles.
        const { count: profileCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

        setStats({ notes: noteCount || 0, users: profileCount || 0, announcements: annCount || 0 });
    };

    const SidebarItem = ({ id, icon: Icon, label }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`w-100 d-flex align-items-center gap-3 px-4 py-3 border-0 transition-all text-start ${activeTab === id ? 'bg-white shadow-sm text-primary fw-bold' : 'text-muted bg-transparent'}`}
            style={{ borderRadius: '0 24px 24px 0', borderLeft: activeTab === id ? '4px solid var(--primary-accent)' : '4px solid transparent' }}
        >
            <Icon size={20} />
            <span>{label}</span>
        </button>
    );

    return (
        <div className="d-flex min-vh-100 bg-light">
            {/* Sidebar */}
            <div className="d-none d-md-flex flex-column gap-2 py-4 bg-light border-end" style={{ width: '280px' }}>
                <div className="px-4 mb-4">
                    <h4 className="fw-bold" style={{ color: 'var(--text-main)' }}>Admin<span className="text-primary">Panel</span></h4>
                </div>
                <SidebarItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
                <SidebarItem id="upload" icon={FilePlus} label="Manage Content" />
                <SidebarItem id="announcements" icon={Bell} label="Announcements" />
                <SidebarItem id="notifications" icon={Send} label="Push Notifications" />
                <SidebarItem id="team" icon={Users} label="Manage Team" />

                <div className="mt-auto px-4">
                    <button onClick={onBack} className="btn btn-outline-secondary w-100 rounded-pill">Exit Admin</button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-grow-1 p-4 overflow-auto" style={{ maxHeight: '100vh' }}>
                {/* Mobile Header */}
                <div className="d-md-none d-flex justify-content-between align-items-center mb-4">
                    <h4 className="fw-bold m-0">Admin</h4>
                    <button onClick={onBack} className="btn btn-sm btn-light">Exit</button>
                </div>

                {/* Mobile Tabs */}
                <div className="d-flex d-md-none gap-2 overflow-auto mb-4 pb-2">
                    {[
                        { id: 'dashboard', icon: LayoutDashboard },
                        { id: 'upload', icon: FilePlus },
                        { id: 'announcements', icon: Bell },
                        { id: 'notifications', icon: Send },
                        { id: 'team', icon: Users }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`btn rounded-circle p-3 flex-shrink-0 ${activeTab === tab.id ? 'btn-primary' : 'btn-light'}`}
                        >
                            <tab.icon size={20} />
                        </button>
                    ))}
                </div>

                {/* Messages always visible if present */}
                <AnimatePresence>
                    {message && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className={`alert ${message.type === 'error' ? 'alert-danger' : 'alert-success'} d-flex align-items-center gap-2 mb-4 shadow-sm`}
                        >
                            {message.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
                            {message.text}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Tab Content Transition */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'dashboard' && (
                            <div>
                                <h2 className="mb-4 fw-bold">Overview</h2>
                                <div className="row g-4">
                                    <StatCard label="Total Notes" value={stats.notes} icon={Folder} color="var(--primary-accent)" />
                                    <StatCard label="Registered Users" value={stats.users} icon={CheckCircle} color="#10B981" />
                                    <StatCard label="Announcements" value={stats.announcements} icon={Bell} color="#F59E0B" />
                                </div>
                            </div>
                        )}

                        {activeTab === 'upload' && <ManageContent setMessage={setMessage} />}
                        {activeTab === 'announcements' && <ManageAnnouncements setMessage={setMessage} />}
                        {activeTab === 'notifications' && <SendNotifications setMessage={setMessage} />}
                        {activeTab === 'team' && <ManageTeam setMessage={setMessage} />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

const StatCard = ({ label, value, icon: Icon, color }) => (
    <div className="col-12 col-md-4">
        <div className="clay-card p-4 d-flex align-items-center gap-3 h-100">
            <div className="p-3 rounded-circle text-white shadow-sm" style={{ backgroundColor: color }}>
                <Icon size={24} />
            </div>
            <div>
                <h3 className="fw-bold mb-0">{value}</h3>
                <small className="text-muted">{label}</small>
            </div>
        </div>
    </div>
);

// --- Sub-Components ---

// --- Manage Content (Folder Browser) ---
function ManageContent({ setMessage }) {
    const [viewStack, setViewStack] = useState([{ type: 'root', name: 'Departments', id: null }]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    // State for creating new item
    const [newItemName, setNewItemName] = useState('');
    const [newItemDesc, setNewItemDesc] = useState('');
    const [newItemLink, setNewItemLink] = useState('');
    const [saving, setSaving] = useState(false);

    const currentView = viewStack[viewStack.length - 1];

    useEffect(() => {
        fetchItems();
    }, [currentView]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            let data = [];
            if (currentView.type === 'root') {
                const { data: depts } = await supabase.from('departments').select('*').order('name');
                data = depts;
            } else if (currentView.type === 'dept') {
                const { data: sems } = await supabase.from('semesters').select('*').eq('department_id', currentView.id).order('name');
                data = sems;
            } else if (currentView.type === 'sem') {
                const { data: subs } = await supabase.from('subjects').select('*').eq('semester_id', currentView.id).order('name');
                data = subs;
            } else if (currentView.type === 'subject') {
                const { data: notes } = await supabase.from('notes').select('*').eq('subject_id', currentView.id).order('created_at', { ascending: false });
                data = notes;
            }
            setItems(data || []);
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to load content' });
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = (item) => {
        const nextType =
            currentView.type === 'root' ? 'dept' :
                currentView.type === 'dept' ? 'sem' :
                    currentView.type === 'sem' ? 'subject' : null;

        if (nextType) {
            setViewStack([...viewStack, { type: nextType, name: item.name, id: item.id }]);
        }
    };

    const handleBack = () => {
        if (viewStack.length > 1) {
            setViewStack(viewStack.slice(0, -1));
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        if (!newItemName) return;

        setSaving(true);
        try {
            let error = null;
            if (currentView.type === 'dept') {
                // Add Semester
                const { error: err } = await supabase.from('semesters').insert({
                    name: newItemName,
                    department_id: currentView.id
                });
                error = err;
            } else if (currentView.type === 'sem') {
                // Add Subject
                const { error: err } = await supabase.from('subjects').insert({
                    name: newItemName,
                    semester_id: currentView.id
                });
                error = err;
            } else if (currentView.type === 'subject') {
                // Add Note (Link)
                const { error: err } = await supabase.from('notes').insert({
                    title: newItemName,
                    description: newItemDesc,
                    file_url: newItemLink,
                    subject_id: currentView.id,
                    year: new Date().getFullYear()
                });
                error = err;
            }

            if (error) throw error;

            setMessage({ type: 'success', text: 'Item created successfully' });
            setNewItemName('');
            setNewItemDesc('');
            setNewItemLink('');
            setShowAddModal(false);
            fetchItems(); // Refresh
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to create item' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure? This action is irreversible.")) return;

        try {
            let table = '';
            if (currentView.type === 'dept') table = 'semesters'; // deleting a sem from dept view
            else if (currentView.type === 'sem') table = 'subjects'; // deleting subject
            else if (currentView.type === 'subject') table = 'notes'; // deleting note

            // Actually, we list items belonging to currentView. So if we are in 'dept', items are 'semesters'.
            // deleting an item means deleting from the table of that item type.

            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;

            setMessage({ type: 'success', text: 'Deleted successfully' });
            fetchItems();
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to delete' });
        }
    };

    // Helper to get correct table/type for deletion logic
    // If we are VIEWING a Dept (type=root), the items are Depts (but we usually don't delete depts here for safety? Let's assume we can't delete top-level depts easily without SQL)
    // Actually, let's implement delete for leaf nodes mostly.

    const canAdd = ['dept', 'sem', 'subject'].includes(currentView.type);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div className="d-flex align-items-center gap-2">
                    {viewStack.length > 1 && (
                        <button onClick={handleBack} className="btn btn-light rounded-circle p-2 me-2">
                            <ChevronDown size={20} style={{ transform: 'rotate(90deg)' }} />
                        </button>
                    )}
                    <h2 className="fw-bold mb-0">{currentView.name}</h2>
                </div>
                {canAdd && (
                    <button onClick={() => setShowAddModal(true)} className="btn btn-primary rounded-pill px-4 d-flex align-items-center gap-2 fw-bold">
                        <FilePlus size={18} />
                        {currentView.type === 'subject' ? 'Add Resource' : 'Create Folder'}
                    </button>
                )}
            </div>

            {/* Breadcrumbs */}
            <div className="mb-4 text-muted small">
                {viewStack.map((v, i) => (
                    <span key={i}>
                        {i > 0 && ' > '}
                        <span className={i === viewStack.length - 1 ? 'fw-bold text-dark' : ''}>{v.name}</span>
                    </span>
                ))}
            </div>

            {/* Content Grid */}
            <div className="row g-3">
                {items.length === 0 && !loading && (
                    <div className="col-12 text-center py-5 text-muted border border-dashed rounded-4">
                        <Folder size={48} className="mb-2 opacity-25" />
                        <p>Empty Folder</p>
                    </div>
                )}

                {loading && <div className="col-12 text-center"><Loader className="animate-spin text-primary" /></div>}

                {items.map(item => (
                    <div key={item.id} className="col-md-6 col-lg-4">
                        <div
                            onClick={() => currentView.type !== 'subject' && handleNavigate(item)}
                            className="clay-card p-3 h-100 d-flex flex-column justify-content-between cursor-pointer hover-scale transition-all"
                            style={{ cursor: currentView.type !== 'subject' ? 'pointer' : 'default' }}
                        >
                            <div className="d-flex align-items-start justify-content-between mb-3">
                                <div className="p-2 rounded-3 bg-light text-primary">
                                    {currentView.type === 'subject' ? <FileText size={24} /> : <Folder size={24} />}
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                    className="btn btn-sm btn-light text-danger rounded-circle p-1"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <div>
                                <h6 className="fw-bold mb-1 text-truncate">{item.name || item.title}</h6>
                                {currentView.type === 'subject' && (
                                    <>
                                        <p className="small text-muted mb-2 line-clamp-2">{item.description || 'No description'}</p>
                                        <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary w-100 rounded-pill">
                                            Open Resource
                                        </a>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create/Add Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="modal-overlay d-flex align-items-center justify-content-center" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white p-4 rounded-4 shadow-lg" style={{ width: '90%', maxWidth: '500px' }}>
                            <h4 className="fw-bold mb-3">{currentView.type === 'subject' ? 'Add Resource' : 'Create Folder'}</h4>
                            <form onSubmit={handleAddItem}>
                                <div className="mb-3">
                                    <label className="fw-bold small text-muted">Name/Title</label>
                                    <input className="form-control bg-light border-0 py-2" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Enter name..." autoFocus />
                                </div>

                                {currentView.type === 'subject' && (
                                    <>
                                        <div className="mb-3">
                                            <label className="fw-bold small text-muted">Google Drive / Resource Link</label>
                                            <input type="url" className="form-control bg-light border-0 py-2" value={newItemLink} onChange={e => setNewItemLink(e.target.value)} placeholder="https://..." />
                                        </div>
                                        <div className="mb-3">
                                            <label className="fw-bold small text-muted">Description (Optional)</label>
                                            <textarea className="form-control bg-light border-0 py-2" rows="3" value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)} placeholder="Brief details..." />
                                        </div>
                                    </>
                                )}

                                <div className="d-flex gap-2 justify-content-end mt-4">
                                    <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-light rounded-pill px-4">Cancel</button>
                                    <button type="submit" disabled={!newItemName || saving} className="btn btn-primary rounded-pill px-4 fw-bold">
                                        {saving ? <Loader size={16} className="animate-spin" /> : 'Create'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </motion.div>
    );
}

function ManageAnnouncements({ setMessage }) {
    const [items, setItems] = useState([]);
    const [newContent, setNewContent] = useState('');

    const fetchAnnouncements = async () => {
        const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
        setItems(data || []);
    };

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newContent) return;

        const { error } = await supabase.from('announcements').insert({ content: newContent });
        if (!error) {
            setNewContent('');
            fetchAnnouncements();
            setMessage({ type: 'success', text: 'Announcement Added' });
        } else {
            setMessage({ type: 'error', text: 'Error adding' });
        }
    };

    const handleDelete = async (id) => {
        await supabase.from('announcements').delete().eq('id', id);
        fetchAnnouncements();
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="mb-4 fw-bold">Announcements</h2>
            <div className="row g-4">
                <div className="col-md-6">
                    <div className="clay-card p-4">
                        <h5 className="fw-bold mb-3">Create New</h5>
                        <form onSubmit={handleAdd}>
                            <textarea
                                className="clay-input w-100 p-3 mb-3"
                                rows="4"
                                placeholder="What's new?"
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                            />
                            <button className="btn btn-primary w-100 py-2 rounded-2 fw-bold">Publish to Home</button>
                        </form>
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="d-flex flex-column gap-3">
                        {items.map(item => (
                            <div key={item.id} className="clay-card p-3 d-flex justify-content-between align-items-center bg-white">
                                <span className="fw-medium text-muted">{item.content}</span>
                                <button onClick={() => handleDelete(item.id)} className="btn btn-light rounded-circle text-danger p-2"><Trash2 size={18} /></button>
                            </div>
                        ))}
                        {items.length === 0 && <p className="text-muted text-center">No active announcements.</p>}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function SendNotifications({ setMessage }) {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');

    const handleSend = async (e) => {
        e.preventDefault();
        if (!title || !body) return;

        // In a real app, this would trigger a remote edge function
        // For now, we save to DB for polling or history
        const { error } = await supabase.from('notifications').insert({ title, message: body });

        if (!error) {
            setTitle('');
            setBody('');
            setMessage({ type: 'success', text: 'Notification queued successfully' });
        } else {
            setMessage({ type: 'error', text: 'Failed to send' });
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="mb-4 fw-bold">Push Notifications</h2>
            <div className="clay-card p-5 mx-auto text-center" style={{ maxWidth: '600px' }}>
                <div className="bg-light rounded-circle p-4 d-inline-flex mb-4">
                    <Send size={40} className="text-primary" />
                </div>
                <p className="text-muted mb-4">Send instant alerts to all students using the app.</p>

                <form onSubmit={handleSend} className="text-start">
                    <div className="mb-3">
                        <label className="fw-bold small text-muted">Title</label>
                        <input className="clay-input w-100 p-3" placeholder="Alert Title" value={title} onChange={e => setTitle(e.target.value)} />
                    </div>
                    <div className="mb-4">
                        <label className="fw-bold small text-muted">Message</label>
                        <textarea className="clay-input w-100 p-3" rows="3" placeholder="Message content..." value={body} onChange={e => setBody(e.target.value)} />
                    </div>
                    <button className="btn btn-primary w-100 py-3 rounded-pill fw-bold bg-dark border-0">
                        Send Blast
                    </button>
                </form>
            </div>
        </motion.div>
    );
}

function ManageTeam({ setMessage }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Warn Modal State
    const [warnUser, setWarnUser] = useState(null);
    const [warnMsg, setWarnMsg] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // Use the new RPC to get all users + status
            const { data, error } = await supabase.rpc('get_all_users_for_admin');
            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to load users' });
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (user, action) => {
        if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;

        try {
            if (action === 'banned') {
                const { error } = await supabase.rpc('update_user_status', {
                    target_user_id: user.id,
                    new_status: 'banned',
                    warning_msg: 'Account Banned by Admin.'
                });
                if (error) throw error;
                setMessage({ type: 'success', text: 'User Banned' });
            } else if (action === 'delete') {
                // Delete from Public Profiles (Cascade should handle auth.users if set up, but usually we can't delete auth.users from client easily without Service Key)
                // For this demo, we delete profile, which effectively removes them from the app logic.
                const { error } = await supabase.from('profiles').delete().eq('id', user.id);
                if (error) throw error;
                setMessage({ type: 'success', text: 'User Data Deleted' });
            } else if (action === 'active') {
                const { error } = await supabase.rpc('update_user_status', {
                    target_user_id: user.id,
                    new_status: 'active',
                    warning_msg: null
                });
                if (error) throw error;
                setMessage({ type: 'success', text: 'User Unbanned' });
            }

            fetchUsers();
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: `Action failed: ${err.message}` });
        }
    };

    const submitWarning = async () => {
        if (!warnUser || !warnMsg) return;
        try {
            const { error } = await supabase.rpc('update_user_status', {
                target_user_id: warnUser.id,
                new_status: 'warned',
                warning_msg: warnMsg
            });
            if (error) throw error;
            setMessage({ type: 'success', text: 'Warning Sent' });
            setWarnUser(null);
            setWarnMsg('');
            fetchUsers();
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to warn' });
        }
    };

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="mb-4 fw-bold">Manage Users</h2>

            <div className="clay-card p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div className="position-relative" style={{ minWidth: '300px' }}>
                        <Search size={18} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
                        <input
                            type="text"
                            className="clay-input w-100 py-2 ps-5"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="table table-hover align-middle">
                        <thead className="table-light">
                            <tr>
                                <th className="border-0 rounded-start-3 ps-3">User</th>
                                <th className="border-0">Status</th>
                                <th className="border-0">Warnings</th>
                                <th className="border-0">Joined</th>
                                <th className="border-0 rounded-end-3 text-end pe-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && <tr><td colSpan="5" className="text-center py-4"><Loader className="animate-spin text-primary" /></td></tr>}
                            {!loading && filteredUsers.length === 0 && <tr><td colSpan="5" className="text-center py-4 text-muted">No users found.</td></tr>}

                            {filteredUsers.map(user => (
                                <tr key={user.id}>
                                    <td className="ps-3">
                                        <div className="fw-bold">{user.full_name || 'Unknown'}</div>
                                    </td>
                                    <td>
                                        <span className={`badge rounded-pill px-3 py-2 fw-bold ${user.status === 'banned' ? 'bg-danger bg-opacity-10 text-danger' :
                                            user.status === 'warned' ? 'bg-warning bg-opacity-10 text-warning' :
                                                'bg-success bg-opacity-10 text-success'
                                            }`}>
                                            {user.status?.toUpperCase() || 'ACTIVE'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="d-flex align-items-center gap-1">
                                            <span className={`fw-bold ${user.warnings_count > 0 ? 'text-danger' : 'text-muted'}`}>{user.warnings_count || 0}</span>
                                            {user.warnings_count > 0 && <AlertCircle size={14} className="text-danger" />}
                                        </div>
                                    </td>
                                    <td className="text-muted small">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="text-end pe-3">
                                        <div className="d-flex justify-content-end gap-2">
                                            {user.status !== 'banned' ? (
                                                <>
                                                    <button onClick={() => setWarnUser(user)} className="btn btn-sm btn-light text-warning fw-bold" title="Warn User">
                                                        Warn
                                                    </button>
                                                    <button onClick={() => handleAction(user, 'banned')} className="btn btn-sm btn-light text-danger fw-bold" title="Ban User">
                                                        Ban
                                                    </button>
                                                </>
                                            ) : (
                                                <button onClick={() => handleAction(user, 'active')} className="btn btn-sm btn-light text-success fw-bold">
                                                    Unban
                                                </button>
                                            )}
                                            <button onClick={() => handleAction(user, 'delete')} className="btn btn-sm btn-light text-secondary" title="Delete Data">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Warning Modal */}
            <AnimatePresence>
                {warnUser && (
                    <div className="modal-overlay d-flex align-items-center justify-content-center" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-4 rounded-4 shadow-lg" style={{ width: '90%', maxWidth: '400px' }}>
                            <div className="text-center mb-3">
                                <div className="bg-warning bg-opacity-10 text-warning rounded-circle p-3 d-inline-flex mb-2">
                                    <AlertCircle size={32} />
                                </div>
                                <h5 className="fw-bold">Warn {warnUser.full_name}</h5>
                                <p className="text-muted small">This message will popup on their screen.</p>
                            </div>
                            <textarea
                                className="form-control bg-light border-0 mb-3"
                                rows="3"
                                placeholder="Reason for warning..."
                                value={warnMsg}
                                onChange={e => setWarnMsg(e.target.value)}
                            />
                            <div className="d-flex gap-2">
                                <button onClick={() => setWarnUser(null)} className="btn btn-light w-100 rounded-pill fw-bold">Cancel</button>
                                <button onClick={submitWarning} className="btn btn-warning w-100 rounded-pill fw-bold text-white">Send Warning</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </motion.div>
    );
}
