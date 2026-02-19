import React from 'react';
import {
    Bold, Italic, Underline,
    Heading1, Heading2,
    List, ListOrdered,
    AlignCenter, AlignLeft, AlignRight,
    Undo, Redo, Quote, Code
} from 'lucide-react';

const ToolbarButton = ({ onClick, isActive, children, title }) => (
    <button
        onClick={e => {
            e.preventDefault();
            onClick();
        }}
        title={title}
        className={`p-1.5 rounded transition-all flex items-center justify-center min-w-[32px] h-8 ${isActive
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-600 hover:bg-gray-100'
            }`}
    >
        {children}
    </button>
);

const Divider = () => <div className="w-[1px] h-4 bg-gray-200 mx-1" />;

const EditorToolbar = ({ editor }) => {
    if (!editor) return null;

    return (
        <div className="w-full bg-[#edf2fa] border-b border-gray-200 sticky top-16 z-[90] py-1 flex justify-center shadow-inner">
            <div className="bg-white px-3 py-1 rounded-full flex gap-1 items-center max-w-fit mx-auto border border-gray-200 shadow-sm mt-1 mb-1">
                <div className="flex items-center gap-0.5">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().undo().run()}
                        title="Undo"
                    >
                        <Undo size={16} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().redo().run()}
                        title="Redo"
                    >
                        <Redo size={16} />
                    </ToolbarButton>
                </div>

                <Divider />

                <div className="flex items-center gap-0.5">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive('bold')}
                        title="Bold"
                    >
                        <Bold size={16} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive('italic')}
                        title="Italic"
                    >
                        <Italic size={16} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        isActive={editor.isActive('underline')}
                        title="Underline"
                    >
                        <Underline size={16} />
                    </ToolbarButton>
                </div>

                <Divider />

                <div className="flex items-center gap-0.5">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        isActive={editor.isActive('heading', { level: 1 })}
                        title="H1"
                    >
                        <Heading1 size={16} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        isActive={editor.isActive('heading', { level: 2 })}
                        title="H2"
                    >
                        <Heading2 size={16} />
                    </ToolbarButton>
                </div>

                <Divider />

                <div className="flex items-center gap-0.5">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        isActive={editor.isActive('bulletList')}
                        title="Bullet List"
                    >
                        <List size={16} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        isActive={editor.isActive('orderedList')}
                        title="Ordered List"
                    >
                        <ListOrdered size={16} />
                    </ToolbarButton>
                </div>

                <Divider />

                <div className="flex items-center gap-0.5">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().setTextAlign('left').run()}
                        isActive={editor.isActive({ textAlign: 'left' })}
                        title="Left"
                    >
                        <AlignLeft size={16} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().setTextAlign('center').run()}
                        isActive={editor.isActive({ textAlign: 'center' })}
                        title="Center"
                    >
                        <AlignCenter size={16} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().setTextAlign('right').run()}
                        isActive={editor.isActive({ textAlign: 'right' })}
                        title="Right"
                    >
                        <AlignRight size={16} />
                    </ToolbarButton>
                </div>

                <Divider />

                <div className="flex items-center gap-0.5">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        isActive={editor.isActive('blockquote')}
                        title="Quote"
                    >
                        <Quote size={16} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        isActive={editor.isActive('codeBlock')}
                        title="Code"
                    >
                        <Code size={16} />
                    </ToolbarButton>
                </div>
            </div>
        </div>
    );
};

export default EditorToolbar;
