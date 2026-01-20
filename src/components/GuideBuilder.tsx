'use client';

import { useState } from 'react';
import { updateGuideAction } from '@/app/actions';
import { DiscussionGuide } from '@/lib/types';

interface Props {
    projectId: string;
    initialGuide: DiscussionGuide;
}

export function GuideBuilder({ projectId, initialGuide }: Props) {
    const [questions, setQuestions] = useState<string[]>(initialGuide?.questions || []);
    const [newQuestion, setNewQuestion] = useState('');

    const handleAdd = async () => {
        if (!newQuestion.trim()) return;

        const updated = [...questions, newQuestion];
        setQuestions(updated);
        setNewQuestion('');

        await updateGuideAction(projectId, updated);
    };

    const handleRemove = async (index: number) => {
        const updated = questions.filter((_, i) => i !== index);
        setQuestions(updated);
        await updateGuideAction(projectId, updated);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-full flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                📋 Discussion Guide
                <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded">Manual Input</span>
            </h3>

            <div className="space-y-3 mb-6 flex-1 overflow-y-auto min-h-[200px]">
                {questions.map((q, i) => (
                    <div key={i} className="flex gap-3 items-start group bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="text-xs font-bold text-slate-400 mt-1">Q{i + 1}</span>
                        <p className="text-slate-700 flex-1 text-sm">{q}</p>
                        <button
                            onClick={() => handleRemove(i)}
                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                        >
                            &times;
                        </button>
                    </div>
                ))}
                {questions.length === 0 && (
                    <p className="text-slate-400 text-sm italic text-center py-8">No questions added. Start building your interview script.</p>
                )}
            </div>

            <div className="flex gap-2">
                <textarea
                    rows={2}
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAdd())}
                    placeholder="Type your question here..."
                    className="flex-1 px-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-brand-500 transition resize-none"
                />
                <button
                    onClick={handleAdd}
                    disabled={!newQuestion.trim()}
                    className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition self-end"
                >
                    Add
                </button>
            </div>
        </div>
    );
}
