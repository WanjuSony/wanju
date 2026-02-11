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

    const persona = data.personas?.find(p => p.id === interview.participantId);

    const allInterviews = data.studies.flatMap(s => s.sessions);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <main className="flex-1 p-6 max-w-[1800px] mx-auto w-full space-y-8">
                <InterviewReport
                    interview={interview}
                    projectId={id}
                    studyId={studyId}
                    guideBlocks={study.discussionGuide || []}
                    personas={data.personas || []}
                    projectTitle={study.title}
                    studyTitle={study.title}
                    allInterviews={allInterviews}
                    researchQuestions={study.plan?.researchQuestions || []}
                />
            </main>
        </div>
    );
}
