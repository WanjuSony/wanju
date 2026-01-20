import { Persona } from '@/lib/types';

export function PersonaCard({ persona }: { persona: Persona }) {
    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-6">
                <h2 className="text-2xl font-bold">{persona.name}</h2>
                <p className="opacity-80 text-sm">{persona.role} @ {persona.company || 'Unknown'}</p>
            </div>

            <div className="p-6 space-y-6">
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Background</h3>
                    <p className="text-slate-700 leading-relaxed text-sm">{persona.background}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Psychographics</h3>
                        <ul className="space-y-2">
                            <li className="text-sm"><span className="font-semibold text-slate-700">Values:</span> {persona.psychographics.values.join(", ")}</li>
                            <li className="text-sm"><span className="font-semibold text-slate-700">Motivations:</span> {persona.psychographics.motivations.join(", ")}</li>
                            <li className="text-sm"><span className="font-semibold text-slate-700">Pain Points:</span> {persona.psychographics.painPoints.join(", ")}</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Behavioral</h3>
                        <ul className="space-y-2">
                            <li className="text-sm"><span className="font-semibold text-slate-700">Style:</span> {persona.behavioral.communicationStyle}</li>
                            <li className="text-sm"><span className="font-semibold text-slate-700">Decision Making:</span> {persona.behavioral.decisionMakingProcess}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
