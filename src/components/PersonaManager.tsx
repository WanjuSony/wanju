'use client';

import { useState } from 'react';
import { Persona } from '@/lib/types';
import { createManualPersonaAction, createAIGeneratedPersonaAction } from '@/app/actions';

interface Props {
    projectId: string;
    personas: Persona[];
}

import { PersonaDetail } from './PersonaDetail';

export function PersonaManager({ projectId, personas }: Props) {
    const [isAdding, setIsAdding] = useState(false);
    const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">프로젝트 페르소나 풀 (Pool)</h2>
                <button
                    onClick={() => setIsAdding(true)}
                    className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:shadow-md transition flex items-center gap-2 transform hover:-translate-y-0.5"
                >
                    <span className="text-xl">+</span>
                    <span>페르소나 추가</span>
                </button>
            </div>

            {isAdding && (
                <div className="mb-8 bg-white border border-slate-100 rounded-2xl p-8 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex gap-4 mb-4 border-b border-slate-100 pb-2">
                        <button className="font-bold text-brand-600 border-b-2 border-brand-600 pb-1">🤖 AI 자동 생성</button>
                        <span className="text-slate-300">|</span>
                        <button className="text-slate-400 font-medium hover:text-slate-800" onClick={() => alert('수동 생성은 아직 준비중입니다. AI 생성을 이용해주세요.')}>✨ 수동 생성</button>
                    </div>

                    <h3 className="font-bold text-slate-900 mb-2">AI 페르소나 자동 생성</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        프로젝트 컨텍스트를 기반으로 AI가 페르소나를 자동으로 분석하여 생성합니다.
                        원하는 직업군만 입력해주세요.
                    </p>

                    <form action={async (formData) => {
                        await createAIGeneratedPersonaAction(projectId, formData);
                        setIsAdding(false);
                    }} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">타겟 직군 / 역할</label>
                            <input
                                name="role"
                                required
                                className="w-full p-4 border rounded-xl text-sm focus:ring-2 ring-brand-500 outline-none bg-slate-50/50"
                                placeholder="예: 회계사, UX 디자이너, 배달원..."
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">참고 자료 (선택)</label>
                            <input
                                type="file"
                                name="file"
                                accept=".pdf,.docx,.txt"
                                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                            />
                            <p className="text-xs text-slate-400 mt-2">인터뷰 스크립트, 기존 리서치 문서 등을 업로드하면 더 정확한 페르소나가 생성됩니다.</p>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={() => setIsAdding(false)} className="px-5 py-2.5 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-xl">취소</button>
                            <button type="submit" className="px-6 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 shadow-lg transition transform hover:scale-105">
                                AI 생성 시작
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {personas.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm">
                    <p className="text-slate-500 mb-2 font-medium">이 프로젝트에 등록된 페르소나가 없습니다.</p>
                    <p className="text-xs text-slate-400">새 연구를 시작하기 전에 여기서 페르소나를 미리 정의해보세요.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {personas.map(p => (
                        <div
                            key={p.id}
                            onClick={() => setSelectedPersona(p)}
                            className="bg-white border border-slate-100 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 cursor-pointer group relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-300 to-brand-500 opacity-0 group-hover:opacity-100 transition"></div>
                            <div className="flex items-center gap-4 mb-5">
                                <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-lg group-hover:bg-brand-600 group-hover:text-white transition shadow-sm">
                                    {(p.name || '?').charAt(0)}
                                </div>
                                <div>
                                    <div className="font-bold text-slate-900 group-hover:text-brand-600 transition">{p.name || 'Unknown Persona'}</div>
                                    <div className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full inline-block mt-1">{p.role}</div>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-3 mb-5 h-[63px] leading-relaxed">
                                {p.background}
                            </p>
                            <div className="border-t border-slate-50 pt-4 flex justify-between items-center">
                                <span className="text-[10px] text-slate-300 font-mono tracking-widest">#{p.id.slice(-4)}</span>
                                <span className="text-xs font-bold text-brand-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition transform translate-x-2 group-hover:translate-x-0">
                                    상세보기 &rarr;
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedPersona && (
                <PersonaDetail
                    persona={selectedPersona}
                    onClose={() => setSelectedPersona(null)}
                />
            )}
        </div>
    );
}
