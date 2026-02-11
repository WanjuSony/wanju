import { getProject } from '@/lib/store/projects';
import { notFound } from 'next/navigation';
import DiscussionGuideBuilder from '@/components/DiscussionGuideBuilder';
import { StudyDetailTabs } from '@/components/StudyDetailTabs';
import { StudyHeader } from '@/components/StudyHeader';

export const maxDuration = 300; // Allow 5 minutes for long server actions on this page

interface Props {
    params: Promise<{
        id: string;
        studyId: string;
    }>
}

export default async function StudyPage({ params }: Props) {
    const { id, studyId } = await params;
    const data = await getProject(id);


    if (!data) {
        notFound();
    }

    const study = data.studies.find(s => s.id === studyId);
    if (!study) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <StudyHeader projectTitle={data.project.title} study={study} />

            <main className="flex-1 p-8 max-w-7xl mx-auto w-full flex flex-col gap-8">
                {/* Tabs Area (Full Width) */}
                <StudyDetailTabs
                    study={study}
                    projectData={data}
                    projectId={id}
                    studyId={studyId}
                />
            </main>
        </div>
    );
}
