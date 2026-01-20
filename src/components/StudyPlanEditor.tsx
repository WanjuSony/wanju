'use client';

import { useState } from 'react';
import { updateStudyPlanAction } from '@/app/actions';
import { StudyPlan } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface Props {
    projectId: string;
    studyId: string;
    initialPlan: StudyPlan;
}

export default function StudyPlanEditor({ projectId, studyId, initialPlan }: Props) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<StudyPlan>(initialPlan);

    const updateField = (field: keyof StudyPlan, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleQuestionChange = (index: number, value: string) => {
        const newQuestions = [...formData.researchQuestions];
        newQuestions[index] = value;
        updateField('researchQuestions', newQuestions);
    };

    const addQuestion = () => {
        updateField('researchQuestions', [...formData.researchQuestions, '']);
    };

    const removeQuestion = (index: number) => {
        const newQuestions = formData.researchQuestions.filter((_, i) => i !== index);
        updateField('researchQuestions', newQuestions);
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await updateStudyPlanAction(projectId, studyId, formData);
        } catch (e) {
            console.error(e);
            alert("Failed to update plan");
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h2 className="text-xl font-bold text-slate-900">인터뷰 기획 수정</h2>
                <button
                    onClick={() => router.back()}
                    className="text-slate-500 hover:text-slate-800 text-sm font-medium"
                >
                    취소
                </button>
            </div>

            <div className="p-8 space-y-8">
                {/* Background */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">인터뷰 배경</label>
                    <textarea
                        className="w-full text-base p-3 border rounded-lg focus:ring-2 ring-brand-500 outline-none min-h-[100px] resize-none"
                        value={formData.background}
                        onChange={(e) => updateField('background', e.target.value)}
                    />
                </div>

                {/* Purpose */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">인터뷰 목적</label>
                    <textarea
                        className="w-full text-base p-3 border rounded-lg focus:ring-2 ring-brand-500 outline-none min-h-[80px] resize-none"
                        value={formData.purpose}
                        onChange={(e) => updateField('purpose', e.target.value)}
                    />
                </div>

                {/* Target */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">타겟 고객 (응답자)</label>
                    <textarea
                        className="w-full text-base p-3 border rounded-lg focus:ring-2 ring-brand-500 outline-none min-h-[80px] resize-none"
                        value={formData.target}
                        onChange={(e) => updateField('target', e.target.value)}
                    />
                </div>

                {/* Hypotheses */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">검증할 가설 (핵심 질문)</label>
                    <div className="space-y-3">
                        {formData.researchQuestions.map((q, i) => (
                            <div key={i} className="flex gap-2 w-full">
                                <span className="pt-3 font-bold text-slate-400 text-sm min-w-[24px]">Q{i + 1}</span>
                                <input
                                    className="flex-1 min-w-0 p-3 border rounded-lg focus:ring-2 ring-brand-500 outline-none block w-full text-base"
                                    value={q}
                                    onChange={(e) => handleQuestionChange(i, e.target.value)}
                                />
                                <button onClick={() => removeQuestion(i)} className="text-slate-300 hover:text-red-500 px-2">&times;</button>
                            </div>
                        ))}
                        <button onClick={addQuestion} className="text-brand-600 text-sm font-medium hover:underline pl-8">
                            + 질문 추가하기
                        </button>
                    </div>
                </div>

                {/* Utilization - Optional, maybe less important to edit freely */}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-6 py-3 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 transition shadow-md"
                >
                    {loading ? '저장 중...' : '수정 사항 저장'}
                </button>
            </div>
        </div>
    );
}
