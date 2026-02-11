import React, { useState } from 'react';

interface Props {
    onCancel: () => void;
    onSubmit: (data: any) => void;
    researchQuestions?: string[];
}

export function ManualInsightForm({ onCancel, onSubmit, researchQuestions = [] }: Props) {
    const [formData, setFormData] = useState({
        type: 'insight' as 'fact' | 'insight' | 'action',
        content: '',
        meaning: '',
        recommendation: '',
        sourceSegmentId: '',
        researchQuestion: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            {/* RQ Selector - Only show if type is insight */}
            {formData.type === 'insight' && researchQuestions.length > 0 && (
                <div className="mb-2">
                    <select
                        value={formData.researchQuestion}
                        onChange={e => setFormData({ ...formData, researchQuestion: e.target.value })}
                        className="w-full text-xs p-2 rounded border border-slate-300 bg-white"
                    >
                        <option value="">일반 (General - 리서치 질문 외)</option>
                        {researchQuestions.map((rq, idx) => (
                            <option key={idx} value={`RQ ${idx + 1}`}>
                                RQ {idx + 1}: {rq.length > 60 ? rq.slice(0, 60) + '...' : rq}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div className="flex gap-2 mb-2">
                <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                    className="text-xs font-bold p-2 rounded border border-slate-300 bg-white"
                >
                    <option value="insight">인사이트 (Insight)</option>
                    <option value="fact">사실 (Fact)</option>
                    <option value="action">액션 (Action)</option>
                </select>
                <input
                    type="text"
                    placeholder="참조 (예: 0:03)"
                    value={formData.sourceSegmentId}
                    onChange={e => setFormData({ ...formData, sourceSegmentId: e.target.value })}
                    className="text-xs p-2 rounded border border-slate-300 flex-1"
                />
            </div>
            <textarea
                placeholder="내용 (무엇을 발견했나요?)"
                required
                value={formData.content}
                onChange={e => setFormData({ ...formData, content: e.target.value })}
                className="w-full text-xs p-2 rounded border border-slate-300 min-h-[60px]"
            />
            {formData.type === 'insight' && (
                <textarea
                    placeholder="의미 / 맥락 (왜 중요한가요?)"
                    value={formData.meaning}
                    onChange={e => setFormData({ ...formData, meaning: e.target.value })}
                    className="w-full text-xs p-2 rounded border border-slate-300 min-h-[40px]"
                />
            )}
            {formData.type === 'action' && (
                <textarea
                    placeholder="추천 (무엇을 해야 하나요?)"
                    value={formData.recommendation}
                    onChange={e => setFormData({ ...formData, recommendation: e.target.value })}
                    className="w-full text-xs p-2 rounded border border-slate-300 min-h-[40px]"
                />
            )}
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5 rounded text-slate-500 hover:bg-slate-100">취소</button>
                <button type="submit" className="text-xs px-3 py-1.5 rounded bg-slate-800 text-white hover:bg-slate-700">인사이트 추가</button>
            </div>
        </form>
    );
}
