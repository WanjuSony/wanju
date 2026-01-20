'use client';

import { useState } from 'react';
import { createPersonaAction } from '@/app/actions';
import { Persona } from '@/lib/types';
import { PersonaCard } from '@/components/PersonaCard';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function GeneratePersonaPage() {
    const params = useParams();
    // Decode safely handling array or string
    const filenameStr = Array.isArray(params.filename) ? params.filename[0] : params.filename;
    const filename = decodeURIComponent(filenameStr || '');

    const [loading, setLoading] = useState(false);
    const [persona, setPersona] = useState<Persona | null>(null);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const result = await createPersonaAction(filename);
            setPersona(result);
        } catch (e) {
            console.error(e);
            alert("Failed to generate persona");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <Link href="/" className="text-slate-500 hover:text-slate-800 text-sm">
                        &larr; Back via Dashboard
                    </Link>
                    <h1 className="text-xl font-bold text-slate-800 truncate max-w-lg">
                        Persona Lab: {filename.replace('.txt', '')}
                    </h1>
                </div>

                {!persona && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                        <div className="mb-6 text-slate-400">
                            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h2 className="text-xl font-medium text-slate-700 mb-2">Ready to Synthesize</h2>
                            <p className="max-w-md mx-auto">
                                Extract insights, personality traits, and mental models from this transcript to create an AI Persona.
                            </p>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-full font-medium transition disabled:brightness-50 disabled:cursor-wait"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing Transcript...
                                </>
                            ) : (
                                "Generate AI Persona"
                            )}
                        </button>
                    </div>
                )}

                {persona && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <PersonaCard persona={persona} />

                        <div className="mt-8 flex justify-end gap-4">
                            <button className="text-slate-600 hover:text-slate-900 px-4 py-2 text-sm font-medium">
                                Discard
                            </button>
                            <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black">
                                Save to Project
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
