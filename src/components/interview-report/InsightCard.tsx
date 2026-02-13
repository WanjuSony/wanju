import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { StructuredInsight } from '@/lib/types';

interface Props {
    item: StructuredInsight;
    onJump: (ref: string) => void;
    onDelete?: (id: string) => void;
    onUpdate?: (id: string, data: any) => void;
    researchQuestions?: string[];
}

export function InsightCard({ item, onJump, onDelete, onUpdate, researchQuestions = [] }: Props) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false); // Add loading state
    const [editData, setEditData] = useState(() => {
        let mappedRQ = item.researchQuestion || '';
        const match = mappedRQ.match(/RQ\s?(\d+)/i);
        if (match) {
            mappedRQ = `RQ ${match[1]}`;
        }
        return { ...item, researchQuestion: mappedRQ };
    });

    const handleSave = async () => {
        if (onUpdate) {
            setIsSaving(true);
            try {
                await onUpdate(item.id, editData); // Assuming onUpdate can be awaited (Server Actions return promise)
                setIsEditing(false);
            } catch (e) {
                console.error("Save failed", e);
                alert("저장에 실패했습니다.");
            } finally {
                setIsSaving(false);
            }
        }
    };

    if (isEditing) {
        return (
            <div className="p-4 rounded-xl border border-brand-200 bg-brand-50/50">
                <div className="space-y-3">
                    {/* RQ Selector for Insights */}
                    {editData.type === 'insight' && researchQuestions.length > 0 && (
                        <select
                            value={editData.researchQuestion || ''}
                            onChange={e => setEditData({ ...editData, researchQuestion: e.target.value })}
                            className="w-full text-xs p-2 rounded border border-slate-300 bg-white"
                        >
                            <option value="">일반 (General - 리서치 질문 외)</option>
                            {researchQuestions.map((rq, idx) => (
                                <option key={idx} value={`RQ ${idx + 1}`}>
                                    RQ {idx + 1}: {rq.length > 60 ? rq.slice(0, 60) + '...' : rq}
                                </option>
                            ))}
                        </select>
                    )}

                    <div className="flex gap-2">
                        <select
                            value={editData.type}
                            onChange={e => setEditData({ ...editData, type: e.target.value as any })}
                            className="text-xs font-bold p-2 rounded border border-slate-300 bg-white"
                        >
                            <option value="insight">인사이트 (Insight)</option>
                            <option value="fact">사실 (Fact)</option>
                            <option value="action">액션 (Action)</option>
                        </select>
                        {/* Source Segment ID Edit */}
                        <input
                            type="text"
                            value={editData.sourceSegmentId || ''}
                            onChange={e => setEditData({ ...editData, sourceSegmentId: e.target.value })}
                            className="text-xs p-2 rounded border border-slate-300 flex-1"
                            placeholder="참조 구간 (예: 0:03)"
                        />
                    </div>

                    <textarea
                        value={editData.content}
                        onChange={e => setEditData({ ...editData, content: e.target.value })}
                        className="w-full text-xs p-2 rounded border border-slate-300 min-h-[60px]"
                        placeholder="Content"
                    />



                    {editData.type === 'insight' && (
                        <textarea
                            value={editData.meaning || ''}
                            onChange={e => setEditData({ ...editData, meaning: e.target.value })}
                            className="w-full text-xs p-2 rounded border border-slate-300 min-h-[40px]"
                            placeholder="의미 / 맥락 (Meaning)"
                            disabled={isSaving}
                        />
                    )}

                    {editData.type === 'action' && (
                        <textarea
                            value={editData.recommendation || ''}
                            onChange={e => setEditData({ ...editData, recommendation: e.target.value })}
                            className="w-full text-xs p-2 rounded border border-slate-300 min-h-[40px]"
                            placeholder="추천 (Recommendation)"
                            disabled={isSaving}
                        />
                    )}
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="text-xs px-3 py-1.5 rounded text-slate-500 hover:bg-slate-100"
                            disabled={isSaving}
                        >
                            취소
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`text-xs px-3 py-1.5 rounded text-white transition flex items-center gap-1 ${isSaving ? 'bg-slate-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700'}`}
                        >
                            {isSaving ? (
                                <>
                                    <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    저장 중...
                                </>
                            ) : (
                                '저장'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={`flex gap-3 p-4 rounded-xl border transition shadow-sm group relative ${item.source === 'user' ? 'bg-indigo-50/30 border-indigo-200' : 'bg-white border-slate-200 hover:border-brand-300'}`}>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg p-1 border border-slate-100 shadow-sm z-10">
                {onUpdate && (
                    <button onClick={() => setIsEditing(true)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 text-xs" title="Edit">
                        ✏️
                    </button>
                )}
                {onDelete && (
                    <button
                        onClick={() => {
                            if (confirm("정말 이 인사이트를 삭제하시겠습니까?")) onDelete(item.id);
                        }}
                        className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 rounded text-slate-400 hover:text-red-600 text-xs" title="Delete">
                        🗑️
                    </button>
                )}
            </div>

            <div className={`w-1 rounded-full flex-shrink-0 self-stretch ${item.type === 'insight' ? 'bg-brand-500' :
                item.type === 'action' ? 'bg-emerald-500' : 'bg-slate-300'
                }`}></div>
            <div className="flex-1 min-w-0">

                <div className="prose prose-sm prose-slate max-w-none mb-1">
                    <ReactMarkdown>{item.content}</ReactMarkdown>
                </div>

                {item.meaning && (
                    <div className="bg-slate-50 p-2 rounded-lg mt-2 text-xs text-slate-600 border border-slate-100">
                        <span className="font-bold text-slate-400 uppercase text-[10px]">이유 / 맥락 (Why / Context)</span>
                        <div className="mt-1"><ReactMarkdown>{item.meaning}</ReactMarkdown></div>
                    </div>
                )}

                {item.recommendation && (
                    <div className="bg-emerald-50/50 p-2 rounded-lg mt-2 text-xs text-emerald-700 border border-emerald-100">
                        <span className="font-bold text-emerald-400 uppercase text-[10px]">추천 (Recommendation)</span>
                        <div className="mt-1 font-medium"><ReactMarkdown>{item.recommendation}</ReactMarkdown></div>
                    </div>
                )}

                {/* Timestamp always at bottom */}
                {item.sourceSegmentId && (
                    <div className="flex flex-wrap gap-2 mt-2 justify-start">
                        {item.sourceSegmentId.split(',').map((ref, idx) => (
                            <button
                                key={idx}
                                onClick={() => onJump(ref.trim())}
                                className="text-[10px] text-slate-400 group-hover:text-brand-500 hover:underline transition bg-slate-50 px-2 py-1 rounded cursor-pointer border border-transparent hover:border-brand-100"
                            >
                                {ref.trim()} 🔗
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
