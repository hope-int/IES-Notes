import React from 'react';
import { ReactGrid } from "@silevis/reactgrid";
import "@silevis/reactgrid/styles.css";

const SheetCanvas = ({ rows, columns, onCellsChanged, onFocusChanged }) => {
    return (
        <div className="overflow-auto w-full h-[calc(100vh-130px)] bg-white custom-scrollbar">
            <ReactGrid
                rows={rows}
                columns={columns}
                onCellsChanged={onCellsChanged}
                onFocusChanged={onFocusChanged}
                enableFillHandle
                enableRangeSelection
                stickyTopRows={1}
                stickyLeftColumns={1}
            />

            <style>{`
                .reactgrid {
                    font-family: 'Inter', sans-serif !important;
                    font-size: 13px !important;
                }
                .reactgrid-content {
                    border-color: #e5e7eb !important;
                }
                .rg-header-cell {
                    background-color: #f9fafb !important;
                    font-weight: 600 !important;
                    color: #6b7280 !important;
                    border-bottom: 1px solid #e5e7eb !important;
                    border-right: 1px solid #e5e7eb !important;
                }
                .rg-cell {
                    border-bottom: 1px solid #f3f4f6 !important;
                    border-right: 1px solid #f3f4f6 !important;
                }
                .rg-cell.selected {
                    background-color: #eff6ff !important;
                    border: 2px solid #3b82f6 !important;
                    z-index: 10 !important;
                }
            `}</style>
        </div>
    );
};

export default React.memo(SheetCanvas);
