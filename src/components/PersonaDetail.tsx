import { Persona } from "@/lib/types";

interface Props {
    persona: Persona;
    onClose: () => void;
}

export function PersonaDetail({ persona, onClose }: Props) {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
                <div className="p-8">
                    <div className="flex justify-between items-start mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-700">
                                {persona.name.charAt(0)}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">{persona.name}</h2>
                                <p className="text-slate-500">{persona.role} @ {persona.company}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>

                    <div className="space-y-8">
                        {/* Basis of Creation */}
                        {persona.basis && (
                            <div className="bg-brand-50 p-6 rounded-xl border border-brand-100">
                                <h3 className="text-sm font-bold text-brand-800 uppercase mb-2">💡 생성 배경 (Basis of Persona)</h3>
                                <p className="text-brand-900 leading-relaxed text-sm">
                                    {persona.basis}
                                </p>
                            </div>
                        )}

                        {/* Background */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-3 border-b pb-2">배경 및 현황</h3>
                            <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                                {persona.background}
                            </p>
                        </div>

                        {/* Lifestyle */}
                        {persona.lifestyle && (
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-3 border-b pb-2">라이프스타일 & 행동 패턴</h3>
                                <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                                    {persona.lifestyle}
                                </p>
                            </div>
                        )}

                        {/* Deep Psychology */}
                        <div className="bg-slate-50 p-6 rounded-xl space-y-6">
                            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">심층 분석 (Deep Dive)</h3>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <span className="text-xs font-bold text-slate-500 uppercase block mb-1">MBTI</span>
                                    <div className="text-xl font-black text-slate-800 tracking-widest">{persona.mbti || 'N/A'}</div>
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-500 uppercase block mb-1">사회적 관계 & 영향력</span>
                                    <p className="text-sm text-slate-700">{persona.socialRelationships || '-'}</p>
                                </div>
                            </div>

                            <div>
                                <span className="text-xs font-bold text-slate-500 uppercase block mb-1">언어적 특징 & 태도</span>
                                <p className="text-sm text-slate-700">{persona.linguisticTraits || '-'}</p>
                            </div>

                            {persona.emotionalNeeds && (
                                <div className="grid grid-cols-2 gap-6 pt-2">
                                    <div>
                                        <span className="text-xs font-bold text-slate-500 uppercase block mb-1 text-red-500">정서적 결핍 (Deficiencies)</span>
                                        <ul className="list-disc list-inside space-y-1 text-slate-600 text-sm">
                                            {persona.emotionalNeeds.deficiencies.map((d, i) => <li key={i}>{d}</li>)}
                                        </ul>
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-slate-500 uppercase block mb-1 text-brand-500">욕망 (Desires)</span>
                                        <ul className="list-disc list-inside space-y-1 text-slate-600 text-sm">
                                            {persona.emotionalNeeds.desires.map((d, i) => <li key={i}>{d}</li>)}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Psychographics */}
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-bold text-slate-700 mb-2">동기 (Motivations)</h4>
                                <ul className="list-disc list-inside space-y-1 text-slate-600 text-sm">
                                    {persona.psychographics.motivations.map((m, i) => <li key={i}>{m}</li>)}
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-700 mb-2">고통점 (Pain Points)</h4>
                                <ul className="list-disc list-inside space-y-1 text-red-600 text-sm">
                                    {persona.psychographics.painPoints.map((p, i) => <li key={i}>{p}</li>)}
                                </ul>
                            </div>
                        </div>

                        {/* Behavioral */}
                        <div className="bg-slate-50 p-6 rounded-xl">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">행동 특성</h3>
                            <div className="space-y-4">
                                <div>
                                    <span className="text-xs font-bold text-slate-500 uppercase block mb-1">의사소통 스타일</span>
                                    <p className="text-slate-700 text-sm">{persona.behavioral.communicationStyle}</p>
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-500 uppercase block mb-1">의사결정 방식</span>
                                    <p className="text-slate-700 text-sm">{persona.behavioral.decisionMakingProcess}</p>
                                </div>
                            </div>
                        </div>

                        {/* Interview Guide */}
                        {persona.interviewGuide && (
                            <div className="border-2 border-slate-100 rounded-xl overflow-hidden">
                                <div className="bg-slate-100 px-6 py-3 font-bold text-slate-700">
                                    🎤 인터뷰 가이드 (Tips for Interviewer)
                                </div>
                                <div className="p-6 space-y-6">
                                    <div>
                                        <h4 className="font-bold text-slate-900 mb-2 text-sm">검증 포인트</h4>
                                        <ul className="space-y-2">
                                            {persona.interviewGuide.checkPoints.map((Point, i) => (
                                                <li key={i} className="flex gap-2 items-start text-sm text-slate-700">
                                                    <span className="text-brand-500 mt-0.5">✓</span>
                                                    {Point}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 mb-2 text-sm">대화 팁</h4>
                                        <ul className="space-y-2">
                                            {persona.interviewGuide.communicationTips.map((Tip, i) => (
                                                <li key={i} className="flex gap-2 items-start text-sm text-slate-700">
                                                    <span className="text-green-500 mt-0.5">💡</span>
                                                    {Tip}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
