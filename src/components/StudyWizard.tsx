'use client';

import { useState, useTransition } from 'react';
import { createStudyAction } from '@/app/actions';
import { StudyPlan, Persona } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface Props {
    projectId: string;
    availablePersonas: Persona[];
}

export default function StudyWizard({ projectId, availablePersonas }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState(''); // New State for Title
    const [formData, setFormData] = useState<StudyPlan>({
        background: '',
        purpose: '',
        target: '',
        utilization: '',
        researchQuestions: [''],
        methodology: { type: 'unknown', reason: '' }
    });
    // const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]); // Removed Step 7

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

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const newStudyId = await createStudyAction(projectId, title, formData, []); // Pass title and empty array for personas
            if (newStudyId) {
                startTransition(() => {
                    router.push(`/projects/${projectId}/studies/${newStudyId}/guide`);
                });
            } else {
                throw new Error("Failed to get new study ID");
            }
        } catch (e: any) {
            console.error("Study creation error:", e);
            alert(`Failed to create study: ${e.message || 'Unknown error'}`);
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden min-h-[500px] flex flex-col">
            {/* Progress Bar */}
            <div className="bg-slate-50 h-2 w-full">
                <div
                    className="h-full bg-brand-600 transition-all duration-300"
                    style={{ width: `${(step / 6) * 100}%` }}
                ></div>
            </div>

            <div className="p-8 flex-1 flex flex-col">
                <div className="mb-8">
                    <span className="text-brand-600 font-bold text-sm tracking-wide uppercase">Step {step} of 6</span>
                    <h2 className="text-2xl font-bold text-slate-900 mt-2">
                        {step === 1 && "기본 정보 (배경)"}
                        {step === 2 && "인터뷰 목적"}
                        {step === 3 && "타겟 고객 (응답자)"}
                        {step === 4 && "결과 활용 계획"}
                        {step === 5 && "검증할 가설 (핵심 질문)"}
                        {step === 6 && "조사 방법론"}
                    </h2>
                    <div className="bg-brand-50 text-brand-800 text-sm p-4 rounded-lg mt-4 border border-brand-100 italic">
                        {step === 1 && "💡 이번 인터뷰의 이름과 배경을 적어주세요. 관리하기 편한 이름을 지어주세요."}
                        {step === 2 && "💡 이번 인터뷰를 통해 꼭 알아내야 하는 한 가지는 무엇인가요?"}
                        {step === 3 && "💡 누구를 인터뷰해야 할까요? 타겟 고객의 직업, 상황, 행동 패턴 등을 묘사해주세요."}
                        {step === 4 && "💡 인터뷰 결과가 나오면 어떻게 활용할까요? 어떤 의사결정에 영향을 주나요?"}
                        {step === 5 && "💡 검증하고 싶은 구체적인 가설들을 나열해주세요."}
                        {step === 6 && "💡 정량(설문), 정성(인터뷰), 혹은 복합적인 방법 중 무엇을 쓸까요?"}
                    </div>
                </div>

                <div className="space-y-6 flex-1 min-h-[400px]">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">인터뷰 이름</label>
                                <input
                                    type="text"
                                    className="w-full text-lg p-3 border rounded-xl focus:ring-2 ring-brand-500 outline-none"
                                    placeholder="예: 1차 검증 심층 인터뷰"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">인터뷰 배경</label>
                                <textarea
                                    className="w-full text-base p-4 border rounded-xl focus:ring-2 ring-brand-500 outline-none min-h-[200px] resize-none"
                                    placeholder="예: 결제 과정에서 복잡함을 호소하는 CS가 증가하고 있습니다..."
                                    value={formData.background}
                                    onChange={(e) => updateField('background', e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                    {step === 2 && (
                        <textarea
                            className="w-full text-base p-4 border rounded-xl focus:ring-2 ring-brand-500 outline-none flex-1 min-h-[300px] resize-none"
                            placeholder="예: 결제 이탈의 주된 원인을 파악한다."
                            value={formData.purpose}
                            onChange={(e) => updateField('purpose', e.target.value)}
                            autoFocus
                        />
                    )}
                    {step === 3 && (
                        <textarea
                            className="w-full text-base p-4 border rounded-xl focus:ring-2 ring-brand-500 outline-none flex-1 min-h-[300px] resize-none"
                            placeholder="예: 주 3회 이상 배달앱을 사용하는 30대 직장인..."
                            value={formData.target}
                            onChange={(e) => updateField('target', e.target.value)}
                            autoFocus
                        />
                    )}
                    {step === 4 && (
                        <textarea
                            className="w-full text-base p-4 border rounded-xl focus:ring-2 ring-brand-500 outline-none flex-1 min-h-[300px] resize-none"
                            placeholder="예: 결제 페이지 UI 개편 시 반영할 예정입이다."
                            value={formData.utilization}
                            onChange={(e) => updateField('utilization', e.target.value)}
                            autoFocus
                        />
                    )}
                    {step === 5 && (
                        <div className="space-y-3 h-full overflow-y-auto max-h-[400px] pr-2">
                            {formData.researchQuestions.map((q, i) => (
                                <div key={i} className="flex gap-2 w-full">
                                    <span className="pt-3 font-bold text-slate-400 text-sm min-w-[24px]">P{i + 1}</span>
                                    <input
                                        className="flex-1 min-w-0 p-3 border rounded-lg focus:ring-2 ring-brand-500 outline-none block w-full text-base"
                                        placeholder="검증할 질문 혹은 가설 입력..."
                                        value={q}
                                        onChange={(e) => handleQuestionChange(i, e.target.value)}
                                        autoFocus={i === formData.researchQuestions.length - 1}
                                    />
                                </div>
                            ))}
                            <button onClick={addQuestion} className="text-brand-600 text-sm font-medium hover:underline pl-8">
                                + 질문 추가하기
                            </button>
                        </div>
                    )}
                    {step === 6 && (
                        <div className="grid grid-cols-3 gap-4 h-full content-start">
                            {(['idp', 'survey', 'ut'] as const).map(type => (
                                <div
                                    key={type}
                                    onClick={() => updateField('methodology', { ...formData.methodology, type: type })}
                                    className={`p-6 rounded-xl border-2 cursor-pointer transition text-center h-[200px] flex flex-col justify-center items-center ${formData.methodology?.type === type
                                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                                        : 'border-slate-100 hover:border-brand-300'
                                        }`}
                                >
                                    <div className="text-3xl mb-4">
                                        {type === 'idp' ? '🗣️' :
                                            type === 'survey' ? '📊' : '⚖️'}
                                    </div>
                                    <div className="font-bold text-lg mb-1">
                                        {type === 'idp' ? '정성 조사 (인터뷰)' :
                                            type === 'survey' ? '정량 조사 (설문)' : '복합 조사'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-8 flex justify-between pt-4 border-t border-slate-100">
                    {step > 1 ? (
                        <button
                            onClick={() => setStep(s => s - 1)}
                            className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition"
                        >
                            이전
                        </button>
                    ) : <div></div>}

                    {step < 6 ? (
                        <button
                            onClick={() => setStep(s => s + 1)}
                            className="px-8 py-3 rounded-xl bg-slate-900 text-white font-medium hover:bg-black transition shadow-lg"
                        >
                            다음
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-8 py-3 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 transition shadow-lg animate-pulse"
                        >
                            {loading ? '생성 중...' : '인터뷰 기획 완료'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

