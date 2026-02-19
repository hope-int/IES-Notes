import React, { useState, useMemo, useCallback } from 'react';
import { ArrowLeft, Share2, FileSpreadsheet, Save, Download, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FormulaBar from './FormulaBar';
import SheetCanvas from './SheetCanvas';

const HopeSheetsLayout = ({ onBack }) => {
    const [title, setTitle] = useState('Untitled Spreadsheet');
    const [isSaving, setIsSaving] = useState(false);
    const rowsRef = React.useRef(null);

    // Initial Grid State
    const columns = useMemo(() => {
        const cols = [{ columnId: "header", width: 50 }]; // Row numbers column
        for (let i = 0; i < 26; i++) {
            cols.push({
                columnId: String.fromCharCode(65 + i),
                width: 100
            });
        }
        return cols;
    }, []);

    const [rows, setRows] = useState(() => {
        const initialRows = [];
        // Header Row
        initialRows.push({
            rowId: "header",
            cells: [
                { type: "header", text: "" },
                ...Array.from({ length: 26 }, (_, i) => ({
                    type: "header",
                    text: String.fromCharCode(65 + i)
                }))
            ]
        });
        // Data Rows
        for (let r = 1; r <= 100; r++) {
            initialRows.push({
                rowId: r,
                cells: [
                    { type: "header", text: `${r}` },
                    ...Array.from({ length: 26 }, () => ({
                        type: "text",
                        text: ""
                    }))
                ]
            });
        }
        return initialRows;
    });

    // Keep ref in sync for callbacks
    rowsRef.current = rows;

    const [activeCell, setActiveCell] = useState({ rowId: 1, columnId: 'A', value: '' });
    const saveTimeoutRef = React.useRef(null);

    const handleFocusChanged = useCallback((cell) => {
        if (cell) {
            const rowIndex = cell.rowId === 'header' ? 0 : parseInt(cell.rowId);
            const columnIndex = cell.columnId === 'header' ? 0 : cell.columnId.charCodeAt(0) - 64;
            const text = rowsRef.current[rowIndex]?.cells[columnIndex]?.text || '';
            setActiveCell({ rowId: cell.rowId, columnId: cell.columnId, value: text });
        }
    }, []);

    const handleChanges = useCallback((changes) => {
        setRows(prevRows => {
            const newRows = [...prevRows];
            let hasChanged = false;

            changes.forEach(change => {
                const rowIndex = change.rowId === "header" ? 0 : parseInt(change.rowId);
                const columnIndex = change.columnId === "header" ? 0 : change.columnId.charCodeAt(0) - 64;

                if (newRows[rowIndex]) {
                    const row = { ...newRows[rowIndex], cells: [...newRows[rowIndex].cells] };
                    if (row.cells[columnIndex].text !== change.newCell.text) {
                        row.cells[columnIndex] = {
                            ...row.cells[columnIndex],
                            text: change.newCell.text
                        };
                        newRows[rowIndex] = row;
                        hasChanged = true;
                    }
                }
            });
            return hasChanged ? newRows : prevRows;
        });

        // Debounce the saving indicator to prevent frequent re-renders
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        setIsSaving(true);
        saveTimeoutRef.current = setTimeout(() => {
            setIsSaving(false);
        }, 2000);
    }, []);

    const handleFormulaChange = useCallback((newValue) => {
        handleChanges([{
            rowId: activeCell.rowId,
            columnId: activeCell.columnId,
            newCell: { type: 'text', text: newValue }
        }]);
    }, [activeCell, handleChanges]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-blue-100 overflow-hidden">
            {/* Top Navigation Bar */}
            <header className="bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-between sticky top-0 z-[100] h-14">
                <div className="flex items-center gap-4 flex-1">
                    <button
                        onClick={onBack}
                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-green-600"
                    >
                        <ArrowLeft size={20} />
                    </button>

                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="text-base font-medium bg-transparent border-transparent hover:border-gray-300 focus:border-green-500 rounded px-2 py-0.5 outline-none transition-all w-auto max-w-[300px] text-gray-800 truncate"
                            />
                            {isSaving && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-[10px] text-gray-400 font-medium uppercase tracking-tight"
                                >
                                    Saving...
                                </motion.div>
                            )}
                        </div>
                        <div className="flex items-center gap-3 px-2 -mt-1">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">HOPE Sheets</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex -space-x-2 mr-2">
                        {[1, 2].map(i => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                {i === 1 ? 'JD' : 'AI'}
                            </div>
                        ))}
                    </div>

                    <button className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-md px-5 py-1.5 shadow-sm hover:shadow-md transition-all text-sm font-semibold active:scale-95">
                        <Share2 size={16} />
                        <span>Share</span>
                    </button>

                    <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center text-green-700 cursor-pointer hover:bg-green-100 transition-colors">
                        <Users size={16} />
                    </div>
                </div>
            </header>

            {/* Formula Bar */}
            <FormulaBar
                activeCellId={`${activeCell.columnId}${activeCell.rowId}`}
                value={activeCell.value}
                onChange={handleFormulaChange}
            />

            {/* Grid Canvas */}
            <main className="flex-1 bg-white">
                <SheetCanvas
                    rows={rows}
                    columns={columns}
                    onCellsChanged={handleChanges}
                    onFocusChanged={handleFocusChanged}
                />
            </main>
        </div>
    );
};

export default HopeSheetsLayout;
