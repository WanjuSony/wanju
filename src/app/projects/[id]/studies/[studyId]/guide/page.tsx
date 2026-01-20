import { getProject } from '@/lib/store/projects';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import DiscussionGuideBuilder from '@/components/DiscussionGuideBuilder';

interface Props {
    params: Promise<{
        id: string;
        studyId: string;
    }>
}

export default async function GuidePage({ params }: Props) {
    const { id, studyId } = await params;
    const data = await getProject(id);

    if (!data) notFound();
    const study = data.studies.find(s => s.id === studyId);
    if (!study) notFound();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <Link href={`/projects/${id}/studies/${studyId}`} className="text-slate-500 hover:text-slate-800 text-sm">
                        &larr; 돌아가기
                    </Link>
                    <div className="h-4 w-px bg-slate-300"></div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">인터뷰 디스커션 가이드 작성</h1>
                        <p className="text-xs text-slate-500">{study.title} ({study.plan.methodology.type})</p>
                    </div>
                </div>
                {/* Actions handled inside Builder component */}
            </header>

            <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
                <DiscussionGuideBuilder
                    projectId={id}
                    studyId={studyId}
                    initialBlocks={study.discussionGuide || []}
                    researchQuestions={study.plan.researchQuestions}
                    isFullPage={true}
                />
            </main>
        </div>
    );
}
