import StudyWizard from '@/components/StudyWizard';
import Link from 'next/link';
import { getProject } from '@/lib/store/projects';
import { notFound } from 'next/navigation';

export default async function NewStudyPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const project = await getProject(id);

    if (!project) notFound();

    return (
        <div className="min-h-screen bg-slate-100 p-8 flex flex-col items-center justify-center">
            <div className="w-full max-w-3xl mb-6 flex justify-between items-center">
                <Link href={`/projects/${id}`} className="text-slate-500 hover:text-slate-800 text-sm">
                    &larr; Back to Project
                </Link>
                <h1 className="text-slate-400 font-bold uppercase tracking-widest text-xs">Research Planning Phase</h1>
            </div>
            <StudyWizard projectId={id} availablePersonas={project.personas || []} />
        </div>
    );
}
