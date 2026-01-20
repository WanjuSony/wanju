import { getProject } from '@/lib/store/projects';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { InterviewReport } from '@/components/InterviewReport';

interface Props {
    params: Promise<{
        id: string;
        studyId: string;
        interviewId: string;
    }>
}

export default async function InterviewPage({ params }: Props) {
    const { id, studyId, interviewId } = await params;
    const data = await getProject(id);

    if (!data) notFound();

    const study = data.studies.find(s => s.id === studyId);
    if (!study) notFound();

    const interview = study.sessions?.find(s => s.id === interviewId);
    if (!interview) notFound();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link
                        href={`/projects/${id}/studies/${studyId}`}
                        className="text-slate-500 hover:text-slate-800 text-sm font-bold flex items-center gap-1"
                    >
                        &larr; Back to Study
                    </Link>
                    <div className="w-px h-4 bg-slate-200"></div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">{interview.title}</h1>
                        <p className="text-xs text-slate-500">{new Date(interview.date).toLocaleString()}</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full">
                <InterviewReport interview={interview} />
            </main>
        </div>
    );
}
