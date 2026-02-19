import React from 'react';
import { EditorContent } from '@tiptap/react';

const DocumentCanvas = ({ editor }) => {
    return (
        <div
            className="bg-white shadow-[0_0_15px_rgba(0,0,0,0.05),0_10px_30px_rgba(0,0,0,0.1)] min-h-[1123px] w-[794px] mx-auto mt-4 mb-20 px-[96px] py-[96px] transition-all relative group"
            style={{
                // Exact A4 proportions (210mm x 297mm) at 96 DPI
                width: '210mm',
                minHeight: '297mm',
            }}
        >
            <div className="prose prose-slate prose-lg max-w-none focus:outline-none prose-headings:font-bold prose-headings:text-slate-900 prose-p:leading-relaxed prose-p:text-slate-800">
                <EditorContent editor={editor} />
            </div>

            {/* Subtle page indicator at bottom */}
            <div className="absolute bottom-8 left-0 w-full px-[96px] flex justify-between items-center text-[10px] text-gray-300 font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none select-none">
                <span>HOPE • DOCUMENT ENGINE v4</span>
                <span>PAGE 1</span>
            </div>
        </div>
    );
};

export default DocumentCanvas;
