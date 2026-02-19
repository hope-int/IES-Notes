import React, { useState, useEffect } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Save, FileDown, ArrowLeft, Share2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import EditorToolbar from './EditorToolbar';
import DocumentCanvas from './DocumentCanvas';

const HopeDocsLayout = ({ onBack }) => {
    const [title, setTitle] = useState(localStorage.getItem('hope_doc_title') || 'Untitled Document');
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [showShareToast, setShowShareToast] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Placeholder.configure({
                placeholder: "Start writing your masterpiece, or type '/' for commands...",
            }),
        ],
        content: localStorage.getItem('hope_doc_content') || '',
        onUpdate: ({ editor }) => {
            handleAutoSave(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'focus:outline-none min-h-[500px]',
            },
        },
    });

    // Auto-save logic
    const handleAutoSave = (content) => {
        setIsSaving(true);
        localStorage.setItem('hope_doc_content', content);
        localStorage.setItem('hope_doc_title', title);

        // Debounce simulation
        const timer = setTimeout(() => {
            setIsSaving(false);
            setLastSaved(new Date().toLocaleTimeString());
        }, 800);
        return () => clearTimeout(timer);
    };

    const handleNew = () => {
        if (confirm('Create a new document? Current changes will be cleared.')) {
            editor.commands.setContent('');
            setTitle('Untitled Document');
            localStorage.removeItem('hope_doc_content');
            localStorage.removeItem('hope_doc_title');
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleAutoSave(editor.getHTML());
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                window.print();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editor, title]);

    useEffect(() => {
        localStorage.setItem('hope_doc_title', title);
    }, [title]);

    const handleExport = async () => {
        setIsSaving(true);
        const doc = new jsPDF('p', 'pt', 'a4');
        const content = editor.getHTML();

        // Basic PDF export - for a real editor we'd use html2canvas or better jspdf logic
        // For now, we'll implement a clean text-based export or a placeholder download
        doc.html(document.querySelector('.prose'), {
            callback: function (doc) {
                doc.save(`${title}.pdf`);
                setIsSaving(false);
            },
            margin: [40, 40, 40, 40],
            autoPaging: 'text',
            x: 0,
            y: 0,
            width: 520, // A4 width minus margins
            windowWidth: 800
        });
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 3000);
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans selection:bg-blue-100 relative">
            {/* Share Toast */}
            <AnimatePresence>
                {showShareToast && (
                    <motion.div
                        initial={{ y: -100, opacity: 0 }}
                        animate={{ y: 20, opacity: 1 }}
                        exit={{ y: -100, opacity: 0 }}
                        className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3"
                    >
                        <Check size={18} className="text-green-400" />
                        <span className="font-medium text-sm">Link copied to clipboard!</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Top Navigation Bar */}
            <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between sticky top-0 z-[100] h-16">
                <div className="flex items-center gap-2 flex-1">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-blue-600"
                        title="Back to Dashboard"
                    >
                        <ArrowLeft size={22} />
                    </button>

                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="text-lg font-medium bg-transparent border-transparent hover:border-gray-300 focus:border-blue-500 rounded px-2 py-0.5 outline-none transition-all w-auto max-w-[400px] text-gray-800 truncate"
                            />
                            <div className="p-1 rounded hover:bg-gray-100 cursor-pointer text-gray-400">
                                <motion.div animate={{ opacity: isSaving ? [0.4, 1, 0.4] : 1 }}>
                                    <Save size={14} />
                                </motion.div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 px-2 -mt-1">
                            <div className="flex items-center gap-4 text-xs text-gray-600">
                                <button onClick={handleNew} className="hover:bg-gray-100 px-1.5 py-0.5 rounded cursor-pointer transition-colors">File (New)</button>
                                <button onClick={() => editor.chain().focus().undo().run()} className="hover:bg-gray-100 px-1.5 py-0.5 rounded cursor-pointer transition-colors">Edit (Undo)</button>
                                <button className="hover:bg-gray-100 px-1.5 py-0.5 rounded cursor-pointer transition-colors">View</button>
                                <button className="hover:bg-gray-100 px-1.5 py-0.5 rounded cursor-pointer transition-colors">Insert</button>
                                <button className="hover:bg-gray-100 px-1.5 py-0.5 rounded cursor-pointer transition-colors">Format</button>
                            </div>
                            <div className="h-3 w-[1px] bg-gray-200"></div>
                            <span className="text-[10px] text-gray-400 font-medium">
                                {isSaving ? 'Saving...' : lastSaved ? `Last saved at ${lastSaved}` : 'All changes saved'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={handleShare}
                        className="hidden md:flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-full transition-all text-sm font-semibold"
                    >
                        <Share2 size={18} className="text-gray-500" />
                        <span>Share</span>
                    </button>

                    <div className="h-8 w-[1px] bg-gray-200 mx-1 hidden md:block"></div>

                    <button
                        onClick={handleExport}
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 py-2.5 shadow-md hover:shadow-lg transition-all text-sm font-bold active:scale-95 disabled:opacity-50"
                    >
                        <FileDown size={18} />
                        <span>{isSaving ? 'Processing...' : 'Export'}</span>
                    </button>

                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform">
                        JD
                    </div>
                </div>
            </header>

            {/* Editor Area */}
            <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center">
                <EditorToolbar editor={editor} />
                <div className="w-full max-w-full pb-20">
                    <DocumentCanvas editor={editor} />
                </div>
            </main>
        </div>
    );
};

export default HopeDocsLayout;
