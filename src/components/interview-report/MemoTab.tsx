import TextareaAutosize from 'react-textarea-autosize';

interface MemoTabProps {
    notes: Record<string, string>; // parsed notes
    handleNoteUpdate: (blockId: string, value: string) => void;
    guideBlocks: { id: string; content: string; type: string }[];
}

export function MemoTab({
    notes,
    handleNoteUpdate,
    guideBlocks
}: MemoTabProps) {
    return (
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 relative scroll-smooth space-y-4">
            <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span>📝</span> 인터뷰 메모 (Interview Notes)
                </h3>

                {/* General Note */}
                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">General / Overall Impressions</label>
                    <TextareaAutosize
                        minRows={4}
                        placeholder="인터뷰 전반에 대한 메모를 자유롭게 작성하세요..."
                        className="w-full text-sm p-3 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition resize-none leading-relaxed"
                        defaultValue={notes['general'] || ''}
                        onBlur={(e) => handleNoteUpdate('general', e.target.value)}
                    />
                </div>

                {/* Per-Block Notes and Guide Content */}
                <div className="space-y-6">
                    {guideBlocks.map((block, idx) => {
                        if (block.type === 'section') {
                            return (
                                <div key={block.id} className="pt-8 pb-2 border-b-2 border-slate-100 mb-4">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{block.content}</h4>
                                </div>
                            );
                        }
                        if (block.type === 'script') {
                            return (
                                <div key={block.id} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 border-dashed">
                                    <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{block.content}</p>
                                </div>
                            );
                        }

                        // Default: Question
                        const questionIdx = guideBlocks.slice(0, idx + 1).filter(b => b.type === 'question').length;
                        return (
                            <div key={block.id} className="pt-4">
                                <div className="flex gap-2 mb-3 items-start">
                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 flex-shrink-0">Q{questionIdx}</span>
                                    <p className="text-sm font-bold text-slate-800 leading-snug">{block.content}</p>
                                </div>
                                <TextareaAutosize
                                    minRows={2}
                                    placeholder="이 질문에 대한 답변이나 특이사항 메모..."
                                    className="w-full text-sm p-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition shadow-sm"
                                    defaultValue={notes[block.id] || ''}
                                    onBlur={(e) => handleNoteUpdate(block.id, e.target.value)}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
