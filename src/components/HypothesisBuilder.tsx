'use client';

import { useState } from 'react';
import { updateHypothesesAction } from '@/app/actions';
import { Hypothesis } from '@/lib/types';

interface Props {
    projectId: string;
    initialHypotheses: Hypothesis[];
}

export function HypothesisBuilder({ projectId, initialHypotheses }: Props) {
    const [hypotheses, setHypotheses] = useState<Hypothesis[]>(initialHypotheses || []);
    const [newStatement, setNewStatement] = useState('');

    const handleAdd = async () => {
        if (!newStatement.trim()) return;

        const newHypothesis: Hypothesis = {
            id: Date.now().toString(),
            projectId,
            statement: newStatement,
            tags: []
        };

        const updated = [...hypotheses, newHypothesis];
        setHypotheses(updated);
        setNewStatement('');

        await updateHypothesesAction(projectId, updated);
    };

    const handleRemove = async (id: string) => {
        const updated = hypotheses.filter(h => h.id !== id);
        setHypotheses(updated);
        await updateHypothesesAction(projectId, updated);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                🧪 Hypotheses
                <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded">Manual Input</span>
            </h3>

            <div className="space-y-3 mb-6">
                {hypotheses.map(h => (
                    <div key={h.id} className="flex gap-3 items-start group">
                        <div className="mt-1.5 w-2 h-2 rounded-full bg-brand-500 shrink-0"></div>
                        <p className="text-slate-700 flex-1">{h.statement}</p>
                        <button
                            onClick={() => handleRemove(h.id)}
                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                        >
                            &times;
                        </button>
                    </div>
                ))}
                {hypotheses.length === 0 && (
                    <p className="text-slate-400 text-sm italic">No hypotheses defined yet. What do you want to verify?</p>
                )}
            </div>

            <div className="flex gap-2">
                <input
                    type="text"
                    value={newStatement}
                    onChange={(e) => setNewStatement(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder="e.g. Users will struggle to find the checkout button..."
                    className="flex-1 px-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-brand-500 transition"
                />
                <button
                    onClick={handleAdd}
                    disabled={!newStatement.trim()}
                    className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                    Add
                </button>
            </div>
        </div>
    );
}
