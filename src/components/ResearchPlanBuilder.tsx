'use client';

import { useState } from 'react';
import { ResearchPlan, ResearchMethodology } from '@/lib/types';

interface Props {
    projectGoal: string;
    onSave: (plan: ResearchPlan) => void;
}

export function ResearchPlanBuilder({ projectGoal, onSave }: Props) {
    const [purpose, setPurpose] = useState('');
    const [methodology, setMethodology] = useState<ResearchMethodology>('unknown');

    // Mock AI Recommendation logic
    const recommendMethodology = () => {
        const lower = purpose.toLowerCase() + " " + projectGoal.toLowerCase();
        if (lower.includes('usability') || lower.includes('task') || lower.includes('interface')) {
            return 'ut';
        } else if (lower.includes('rate') || lower.includes('how many') || lower.includes('quant')) {
            return 'survey';
        } else {
            return 'idp'; // In-depth interview default
        }
    };

    const currentRecommendation = recommendMethodology();

    const handleSave = () => {
        // Save logic would go here
        // For demo, we just print to console
        console.log("Saving plan", { purpose, methodology });
        alert("Plan saved! (Demo)");
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Research Plan</h3>

            <div className="mb-6 bg-slate-50 p-4 rounded-lg text-sm text-slate-600">
                <strong>Project Goal:</strong> {projectGoal}
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Interview Purpose</label>
                    <textarea
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 text-sm"
                        rows={3}
                        placeholder="What specifically do we want to verify in this session?"
                    />
                </div>

                <div className="p-4 bg-brand-50 border border-brand-100 rounded-lg">
                    <h4 className="text-brand-900 font-bold text-sm mb-2 flex items-center gap-2">
                        🤖 AI Recommendation
                    </h4>
                    <p className="text-brand-700 text-sm mb-3">
                        Based on your goal, I recommend:
                        <span className="font-bold ml-1 uppercase">
                            {currentRecommendation === 'ut' ? 'Usability Test (UT)' :
                                currentRecommendation === 'survey' ? 'Quantitative Survey' :
                                    'In-Depth Interview (IDP)'}
                        </span>
                    </p>

                    <div className="flex gap-2">
                        {(['idp', 'ut', 'survey'] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => setMethodology(m)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${methodology === m
                                        ? 'bg-brand-600 text-white border-brand-600'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
                                    }`}
                            >
                                {m.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    className="w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-black"
                >
                    Save Experiment Plan
                </button>
            </div>
        </div>
    );
}
