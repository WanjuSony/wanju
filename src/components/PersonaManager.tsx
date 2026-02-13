'use client';

import { useState } from 'react';
import { Persona, RealInterview, ResearchStudy } from '@/lib/types';
import { createManualPersonaAction, createAIGeneratedPersonaAction, updatePersonaAction, deletePersonaAction } from '@/app/actions';
import { PersonaDetail } from './PersonaDetail';

interface Props {
    projectId: string;
    personas: Persona[];
    interviews: RealInterview[];
    studies: ResearchStudy[];
}

export function PersonaManager({ projectId, personas, interviews, studies }: Props) {
    const [isAdding, setIsAdding] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
    const [filter, setFilter] = useState<'all' | 'ai' | 'real'>('all');

    const handleDelete = async (personaId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('정말 이 페르소나를 삭제하시겠습니까?')) return;
        try {
            await deletePersonaAction(projectId, personaId);
        } catch (error) {
            console.error(error);
            alert('삭제 실패');
        }
    };

    const filteredPersonas = personas.filter(p => {
        if (filter === 'all') return true;
        if (filter === 'ai') return p.source !== 'real';
        if (filter === 'real') return p.source === 'real';
        return true;
    });

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Project Persona Pool</h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Manage and recruit AI personas for your research simulations.</p>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-brand-100 transition-all hover:scale-[1.02] active:scale-[0.98] text-sm flex items-center gap-2"
                    >
                        <span className="text-xl">+</span> Add Persona
                    </button>
                )}
            </div>

            <div className="flex justify-start">
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-6 py-3 text-sm font-black rounded-xl transition-all ${filter === 'all' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        All Personas
                    </button>
                    <button
                        onClick={() => setFilter('ai')}
                        className={`px-6 py-3 text-sm font-black rounded-xl transition-all ${filter === 'ai' ? 'bg-white text-brand-600 shadow-md' : 'text-slate-400 hover:text-brand-600'}`}
                    >
                        🤖 AI Personas
                    </button>
                    <button
                        onClick={() => setFilter('real')}
                        className={`px-6 py-3 text-sm font-black rounded-xl transition-all ${filter === 'real' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-indigo-600'}`}
                    >
                        👤 Real Interviews
                    </button>
                </div>
            </div>

            {isAdding && (
                <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-xl animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-500"></div>
                    <div className="flex gap-6 mb-8 border-b border-slate-50 pb-4">
                        <button className="font-black text-brand-600 border-b-2 border-brand-600 pb-2 text-sm uppercase tracking-widest">🤖 AI Generation</button>
                        <button className="text-slate-400 font-bold hover:text-slate-600 pb-2 text-sm uppercase tracking-widest transition" onClick={() => alert('Manual creation is coming soon!')}>✨ Manual</button>
                    </div>

                    <div className="max-w-2xl">
                        <h3 className="text-xl font-black text-slate-900 mb-2">Generate AI Personas</h3>
                        <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed">
                            AI will analyze your project context and uploaded documents to create realistic research personas.
                            Just specify the target role or job title.
                        </p>

                        <form action={async (formData) => {
                            if (isGenerating) return;
                            setIsGenerating(true);
                            try {
                                await createAIGeneratedPersonaAction(projectId, formData);
                                setIsAdding(false);
                            } catch (e) {
                                console.error(e);
                                alert("Failed to generate persona.");
                            } finally {
                                setIsGenerating(false);
                            }
                        }} className="space-y-6">
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Role / Job Title</label>
                                <input
                                    name="role"
                                    required
                                    className="w-full p-4 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 ring-brand-500 outline-none bg-slate-50/50 transition-all"
                                    placeholder="e.g. Account Manager, UX Designer, Power User..."
                                    autoFocus
                                    disabled={isGenerating}
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Reference Document (Optional)</label>
                                <input
                                    type="file"
                                    name="file"
                                    accept=".pdf,.docx,.txt"
                                    className="w-full text-sm text-slate-500 font-medium file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-[11px] file:font-black file:uppercase file:tracking-widest file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 transition-all cursor-pointer"
                                    disabled={isGenerating}
                                />
                                <p className="text-xs text-slate-400 mt-3 italic font-medium">Uploading transcripts or research papers helps AI generate more accurate personas.</p>
                            </div>
                            <div className="flex justify-end gap-4 pt-6">
                                <button type="button" onClick={() => setIsAdding(false)} disabled={isGenerating} className="px-6 py-3 text-slate-400 font-black text-sm hover:text-slate-600 transition-colors uppercase tracking-widest">Cancel</button>
                                <button type="submit" disabled={isGenerating} className={`px-8 py-3 bg-brand-600 text-white text-sm font-black rounded-2xl hover:bg-brand-700 shadow-xl shadow-brand-100 transition-all hover:scale-[1.05] flex items-center gap-2 ${isGenerating ? 'opacity-70 cursor-wait' : ''}`}>
                                    {isGenerating ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Generating...
                                        </>
                                    ) : (
                                        'Generate via AI'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {personas.length === 0 ? (
                <div className="text-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 shadow-sm">
                    <span className="text-6xl mb-6 block">🎭</span>
                    <p className="text-xl font-black text-slate-900 mb-2">No personas registered yet.</p>
                    <p className="text-slate-500 font-medium max-w-xs mx-auto mb-8">Define your target audience here before starting AI simulations.</p>
                    {!isAdding && (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black hover:bg-slate-800 transition shadow-xl"
                        >
                            Create First Persona
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredPersonas.map(p => (
                        <div
                            key={p.id}
                            onClick={() => setSelectedPersona(p)}
                            className="group relative"
                        >
                            <div className="absolute inset-0 bg-brand-600 rounded-[2.5rem] translate-y-3 opacity-0 group-hover:opacity-10 transition-all duration-300"></div>
                            <div className="relative bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 flex flex-col h-full cursor-pointer">
                                <div className="absolute top-0 left-0 w-2 h-full bg-brand-500 rounded-l-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity z-20"></div>

                                <div className="flex items-center gap-5 mb-6">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-brand-600 font-black text-xl group-hover:bg-brand-600 group-hover:text-white transition duration-300 shadow-sm">
                                        {(p.name || '?').charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-black text-slate-900 group-hover:text-brand-600 transition truncate w-40 text-lg tracking-tight">
                                            {p.name || 'Unknown Persona'}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="text-[10px] font-black text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full uppercase tracking-tighter border border-slate-100">{p.role}</div>
                                            {p.source === 'real' ? (
                                                <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-indigo-100">Real</span>
                                            ) : (
                                                <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-slate-200">AI</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <p className="text-sm font-medium text-slate-500 line-clamp-3 mb-8 leading-relaxed flex-1">
                                    {p.background}
                                </p>

                                <div className="border-t border-slate-50 pt-6 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
                                            #{p.id.slice(-4)}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md" title="Linked Interviews">
                                            🎤 {interviews.filter(i => i.participantId === p.id).length}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={(e) => handleDelete(p.id, e)}
                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                            title="Delete Persona"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                        <span className="text-[11px] font-black text-brand-600 uppercase tracking-widest translate-x-1 group-hover:translate-x-0 transition-transform">
                                            View &rarr;
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedPersona && (
                <PersonaDetail
                    persona={selectedPersona}
                    interviews={interviews.filter(i => i.participantId === selectedPersona.id)}
                    projectId={projectId}
                    studies={studies}
                    onClose={() => setSelectedPersona(null)}
                    onSave={async (updated) => {
                        await updatePersonaAction(projectId, updated);
                        setSelectedPersona(updated);
                    }}
                />
            )}
        </div>
    );
}
