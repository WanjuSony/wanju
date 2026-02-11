import { getProject } from '@/lib/store/projects';
import { notFound } from 'next/navigation';
import { SimulationChat } from '@/components/SimulationChat';
import Link from 'next/link';

interface Props {
    params: Promise<{
        id: string; // Project ID
        studyId: string;
        sessionId: string;
    }>
}

export default async function ResumeSimulationPage({ params }: Props) {
    const { id, studyId, sessionId } = await params;
    const data = await getProject(id);

    if (!data) notFound();
    const study = data.studies.find(s => s.id === studyId);
    if (!study) notFound();

    const session = study.simulationSessions?.find(s => s.id === sessionId);
    if (!session) notFound();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Link href={`/projects/${id}/studies/${studyId}?tab=execution`} className="text-slate-500 hover:text-slate-800 text-sm font-bold">
                        &larr; Exit
                    </Link>
                    <h1 className="text-sm font-bold text-slate-900 border-l border-slate-200 pl-4">
                        Simulation Session <span className="text-slate-400 font-normal">#{sessionId.slice(-4)}</span>
                    </h1>
                </div>
                <div className="text-xs text-slate-400">
                    {new Date(session.createdAt).toLocaleString()}
                </div>
            </header>
            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
                <SimulationChat
                    projectId={id}
                    studyId={studyId}
                    personas={data.personas || []}
                    guide={study.discussionGuide || []}
                    initialSession={session}
                />
            </main>
        </div>
    );
}
