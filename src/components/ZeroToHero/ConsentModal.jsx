import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { PrivacyPolicy, UserAgreement } from '../../assets/legalDocs';

const ConsentModal = ({ onConsentComplete }) => {
    const [privacyAgreed, setPrivacyAgreed] = useState(false);
    const [termsAgreed, setTermsAgreed] = useState(false);

    // Document Viewer Modal State
    const [activeDocument, setActiveDocument] = useState(null); // 'privacy' | 'terms' | null

    const allAgreed = privacyAgreed && termsAgreed;

    const handleSubmit = () => {
        if (allAgreed && onConsentComplete) {
            onConsentComplete();
        }
    };

    const documents = {
        'privacy': { title: 'Privacy Policy', content: PrivacyPolicy },
        'terms': { title: 'User Agreement', content: UserAgreement }
    };

    return (
        <div className="fixed inset-0 min-h-screen bg-gray-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            {/* The Consent Screen Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="max-w-md w-full bg-white/90 backdrop-blur-xl shadow-2xl rounded-2xl p-8 border border-white/20 relative"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="text-purple-600 w-8 h-8" strokeWidth={3} />
                    </div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-indigo-700">
                        Almost There!
                    </h2>
                    <p className="text-gray-600 mt-2 text-sm">
                        Before diving into HOPE Edu Hub, please review and accept our terms to ensure a safe learning environment.
                    </p>
                </div>

                <div className="space-y-4 mb-8">
                    {/* Checkbox 1: Privacy Policy */}
                    <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex-shrink-0 mt-0.5">
                            <input
                                type="checkbox"
                                className="peer appearance-none rounded-full w-6 h-6 border-2 border-gray-300 checked:bg-purple-600 checked:border-purple-600 transition-all cursor-pointer"
                                checked={privacyAgreed}
                                onChange={(e) => setPrivacyAgreed(e.target.checked)}
                            />
                            <Check
                                size={14}
                                className="absolute pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                                strokeWidth={4}
                            />
                        </div>
                        <span className="text-gray-700 text-sm leading-relaxed select-none">
                            I have read and agree to the{' '}
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); setActiveDocument('privacy'); }}
                                className="text-purple-600 font-semibold hover:underline"
                            >
                                Privacy Policy
                            </button>
                        </span>
                    </label>

                    {/* Checkbox 2: User Agreement */}
                    <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex-shrink-0 mt-0.5">
                            <input
                                type="checkbox"
                                className="peer appearance-none rounded-full w-6 h-6 border-2 border-gray-300 checked:bg-purple-600 checked:border-purple-600 transition-all cursor-pointer"
                                checked={termsAgreed}
                                onChange={(e) => setTermsAgreed(e.target.checked)}
                            />
                            <Check
                                size={14}
                                className="absolute pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                                strokeWidth={4}
                            />
                        </div>
                        <span className="text-gray-700 text-sm leading-relaxed select-none">
                            I have read and agree to the{' '}
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); setActiveDocument('terms'); }}
                                className="text-indigo-600 font-semibold hover:underline"
                            >
                                User Agreement
                            </button>
                        </span>
                    </label>
                </div>

                {/* The Action Button */}
                <button
                    onClick={handleSubmit}
                    disabled={!allAgreed}
                    className={`w-full py-3.5 rounded-xl font-bold text-white transition-all shadow-md ${
                    allAgreed
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-lg hover:scale-[1.02] active:scale-95'
                        : 'bg-gray-300 cursor-not-allowed text-gray-500 shadow-none'
                }`}
                >
                Enter HOPE Edu Hub
            </button>
        </motion.div>

            {/* The Document View Modal */ }
    <AnimatePresence>
        {activeDocument && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
            >
                {/* Backdrop for the inner modal */}
                <div
                    className="absolute inset-0 bg-black/40"
                    onClick={() => setActiveDocument(null)}
                />

                <motion.div
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 20 }}
                    className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()} // Prevent clicking inside from closing
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="text-xl font-bold text-gray-800">
                            {documents[activeDocument].title}
                        </h3>
                        <button
                            onClick={() => setActiveDocument(null)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 overflow-y-auto max-h-[60vh] prose prose-sm prose-purple max-w-none">
                        <ReactMarkdown>
                            {documents[activeDocument].content}
                        </ReactMarkdown>
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end">
                        <button
                            onClick={() => {
                                // Auto-check the respective box upon "Accept & Close"
                                if (activeDocument === 'privacy') setPrivacyAgreed(true);
                                if (activeDocument === 'terms') setTermsAgreed(true);
                                setActiveDocument(null);
                            }}
                            className="px-6 py-2.5 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
                        >
                            Accept & Close
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
        </div >
    );
};

export default ConsentModal;
