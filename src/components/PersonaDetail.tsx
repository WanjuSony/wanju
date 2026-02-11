import { useState } from 'react';
import { Persona, RealInterview } from '@/lib/types';
import Link from 'next/link';

import { reanalyzePersonaAction } from '@/app/actions/persona';

interface Props {
    persona: Persona;
    interviews: RealInterview[];
    projectId: string;
    onClose: () => void;
    onSave: (updatedPersona: Persona) => Promise<void>;
    studies?: any[]; // Allow optional for backward compatibility if needed, but best to be specific
}

export function PersonaDetail({ persona, interviews, projectId, onClose, onSave, studies = [] }: Props) {
    // ... existing hooks
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Persona>(persona);
    const [saving, setSaving] = useState(false);
    const [reanalyzing, setReanalyzing] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(formData);
            setIsEditing(false);
        } catch (e) {
            console.error(e);
            alert('Failed to save persona');
        } finally {
            setSaving(false);
        }
    };

    const handleReanalyze = async () => {
        if (!confirm('연결된 모든 인터뷰를 바탕으로 페르소나를 재분석 및 보완하시겠습니까?')) return;
        setReanalyzing(true);
        try {
            const updated = await reanalyzePersonaAction(projectId, persona.id);
            if (updated) {
                setFormData(updated);
                alert('페르소나가 재분석되었습니다. 최신 데이터가 반영되었습니다.');
            }
        } catch (e: any) {
            console.error(e);
            alert('재분석 중 오류가 발생했습니다: ' + e.message);
        } finally {
            setReanalyzing(false);
        }
    };

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleNestedChange = (parent: keyof Persona, field: string, value: string) => {
        setFormData(prev => {
            if (parent === 'behavioral') {
                return { ...prev, behavioral: { ...prev.behavioral, [field]: value } };
            }
            return prev;
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
            <div className={`w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300 ${isEditing ? 'bg-slate-50' : ''}`}>
                <div className="p-8">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-8 sticky top-0 bg-white/80 backdrop-blur-md p-4 -mx-4 rounded-xl border border-slate-100 z-10 shadow-sm">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-700 shrink-0">
                                {formData.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0 pr-4">
                                {isEditing ? (
                                    <div className="space-y-2">
                                        <input
                                            value={formData.name}
                                            onChange={e => handleChange('name', e.target.value)}
                                            className="text-xl font-bold border rounded px-2 py-1 w-full"
                                            placeholder="Name"
                                        />
                                        <input
                                            value={formData.role}
                                            onChange={e => handleChange('role', e.target.value)}
                                            className="text-sm text-slate-500 border rounded px-2 py-1 w-full"
                                            placeholder="Role"
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                            {formData.name}
                                            {formData.source === 'real' && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">Real</span>}
                                        </h2>
                                        <p className="text-sm text-slate-500 break-keep mt-1 leading-snug">
                                            {formData.role} @ {formData.company || 'N/A'}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            {isEditing ? (
                                <>
                                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg font-bold whitespace-nowrap">Cancel</button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap"
                                    >
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={handleReanalyze}
                                        disabled={reanalyzing}
                                        className="px-4 py-2 text-sm font-bold text-brand-600 bg-white border border-brand-200 rounded-lg hover:bg-brand-50 flex items-center gap-2 disabled:opacity-50 whitespace-nowrap shadow-sm transition-all"
                                    >
                                        {reanalyzing ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                                                분석 중...
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-lg">↻</span> 재분석
                                            </>
                                        )}
                                    </button>
                                    <button onClick={() => setIsEditing(true)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-bold border border-slate-200 bg-white whitespace-nowrap shadow-sm hover:bg-slate-50 transition-all">
                                        Edit
                                    </button>
                                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 shrink-0">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="space-y-8">
                        {formData.basis && (
                            <div className="bg-brand-50 p-6 rounded-xl border border-brand-100">
                                <h3 className="text-sm font-bold text-brand-800 uppercase mb-2">💡 생성 배경 (Basis)</h3>
                                {isEditing ? (
                                    <textarea
                                        value={formData.basis}
                                        onChange={e => handleChange('basis', e.target.value)}
                                        className="w-full text-sm p-2 border rounded" rows={3}
                                    />
                                ) : (
                                    <p className="text-brand-900 leading-relaxed text-sm">{formData.basis}</p>
                                )}
                            </div>
                        )}

                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-3 border-b pb-2">배경 및 현황</h3>
                            {isEditing ? (
                                <textarea
                                    value={formData.background}
                                    onChange={e => handleChange('background', e.target.value)}
                                    className="w-full p-3 border rounded-lg text-sm h-32"
                                />
                            ) : (
                                <p className="text-slate-700 leading-relaxed whitespace-pre-line text-sm">{formData.background}</p>
                            )}
                        </div>

                        {formData.lifestyle && (
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 mb-3 border-b pb-2">라이프스타일 & 행동 패턴</h3>
                                <p className="text-slate-700 leading-relaxed whitespace-pre-line text-sm">
                                    {formData.lifestyle}
                                </p>
                            </div>
                        )}

                        <div className="bg-slate-50 p-6 rounded-xl space-y-6">
                            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">심층 분석 (Deep Dive)</h3>

                            <div>
                                <span className="text-xs font-bold text-slate-500 uppercase block mb-2">MBTI</span>
                                {isEditing ? (
                                    <input value={formData.mbti || ''} onChange={e => handleChange('mbti', e.target.value)} className="border rounded px-2 py-1 w-full text-sm" />
                                ) : (
                                    <div className="flex flex-col">
                                        <span className="text-3xl font-black text-slate-800 tracking-widest leading-none mb-2">
                                            {(formData.mbti || 'N/A').split(/[\s-]/)[0]}
                                        </span>
                                        {(formData.mbti || '').split(/[\s-]/).length > 1 && (
                                            <span className="text-sm text-slate-700 leading-relaxed block break-keep">
                                                {(formData.mbti || '').split(/[\s-]/).slice(1).join(' ')}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div>
                                <span className="text-xs font-bold text-slate-500 uppercase block mb-2">사회적 관계</span>
                                {isEditing ? (
                                    <input value={formData.socialRelationships || ''} onChange={e => handleChange('socialRelationships', e.target.value)} className="border rounded px-2 py-1 w-full text-sm" />
                                ) : (
                                    <p className="text-sm text-slate-700 leading-relaxed">{formData.socialRelationships || '-'}</p>
                                )}
                            </div>

                            <div>
                                <span className="text-xs font-bold text-slate-500 uppercase block mb-2">언어적 특징 & 태도</span>
                                <p className="text-sm text-slate-700 leading-relaxed">{formData.linguisticTraits || '-'}</p>
                            </div>

                            {formData.emotionalNeeds && (
                                <div className="grid grid-cols-2 gap-6 pt-2 border-t border-slate-200">
                                    <div>
                                        <span className="text-xs font-bold text-slate-500 uppercase block mb-2 text-red-500">정서적 결핍</span>
                                        <ul className="list-disc list-inside space-y-1 text-slate-600 text-sm">
                                            {formData.emotionalNeeds.deficiencies?.map((d, i) => <li key={i}>{d}</li>)}
                                        </ul>
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-slate-500 uppercase block mb-2 text-brand-500">욕망</span>
                                        <ul className="list-disc list-inside space-y-1 text-slate-600 text-sm">
                                            {formData.emotionalNeeds.desires?.map((d, i) => <li key={i}>{d}</li>)}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-50 p-6 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    동기 (Motivations)
                                </h4>
                                <ul className="list-disc list-inside space-y-2 text-slate-700 text-sm marker:text-slate-300 pl-2">
                                    {formData.psychographics?.motivations?.map((m, i) => <li key={i} className="-indent-4 pl-4">{m}</li>)}
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    고통점 (Pain Points)
                                </h4>
                                <ul className="list-disc list-inside space-y-2 text-slate-700 text-sm marker:text-red-300 pl-2">
                                    {formData.psychographics?.painPoints?.map((p, i) => <li key={i} className="-indent-4 pl-4">{p}</li>)}
                                </ul>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-xl">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">행동 특성</h3>
                            <div className="space-y-4">
                                <div>
                                    <span className="text-xs font-bold text-slate-500 uppercase block mb-1">의사소통 스타일</span>
                                    {isEditing ? (
                                        <input
                                            value={formData.behavioral?.communicationStyle || ''}
                                            onChange={e => handleNestedChange('behavioral', 'communicationStyle', e.target.value)}
                                            className="w-full border rounded px-2 py-1 text-sm"
                                        />
                                    ) : (
                                        <p className="text-slate-700 text-sm">{formData.behavioral?.communicationStyle}</p>
                                    )}
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-500 uppercase block mb-1">의사결정 방식</span>
                                    <p className="text-slate-700 text-sm">{formData.behavioral?.decisionMakingProcess}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                    <span className="text-lg">📊</span> 연결된 인터뷰 ({interviews.length})
                                </h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {interviews.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 text-sm">
                                        연결된 실제 인터뷰 기록이 아직 없습니다.
                                    </div>
                                ) : (
                                    interviews.map(interview => {
                                        // Dynamic Title Logic
                                        let displayTitle = interview.title;
                                        const study = studies.find((s: any) => s.id === interview.studyId);

                                        if (study) {
                                            const idx = study.sessions.findIndex((s: any) => s.id === interview.id);
                                            // Only override if we can determine the index AND it has a participant linked
                                            if (idx !== -1 && interview.participantId) {
                                                displayTitle = `${idx + 1}. ${persona.name}`;
                                            }
                                        }

                                        return (
                                            <Link
                                                key={interview.id}
                                                href={`/projects/${projectId}/studies/${interview.studyId}/interview/${interview.id}`}
                                                className="block p-4 hover:bg-slate-50 transition group"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <div className="font-bold text-slate-900 group-hover:text-brand-600 transition text-sm mb-1 truncate max-w-[300px]">
                                                            {displayTitle}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 flex items-center gap-2 flex-wrap">
                                                            {study && (
                                                                <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 font-bold uppercase tracking-v-tight">
                                                                    {study.title}
                                                                </span>
                                                            )}
                                                            <span className="flex items-center gap-1">📅 {interview.date}</span>
                                                            {interview.startTime && <span className="flex items-center gap-1">🕒 {interview.startTime} - {interview.endTime}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="text-brand-500 opacity-0 group-hover:opacity-100 transition translate-x-1 group-hover:translate-x-0">
                                                        &rarr;
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {formData.interviewGuide && (
                            <div className="border-2 border-slate-100 rounded-xl overflow-hidden">
                                <div className="bg-slate-100 px-6 py-3 font-bold text-slate-700">
                                    🎤 인터뷰 가이드 (Tips)
                                </div>
                                <div className="p-6 space-y-6">
                                    <div>
                                        <h4 className="font-bold text-slate-900 mb-2 text-sm">검증 포인트</h4>
                                        <ul className="space-y-2">
                                            {formData.interviewGuide.checkPoints?.map((Point, i) => (
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
                                            {formData.interviewGuide.communicationTips?.map((Tip, i) => (
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
