import { getProject } from '@/lib/store/projects';
import { notFound } from 'next/navigation';
import LiveInterviewManager from '@/components/LiveInterviewManager';

interface PageProps {
    params: {
        id: string; // Project ID
        studyId: string;
    };
}

export default async function LiveInterviewPage({ params }: PageProps) {
    const { id, studyId } = await params;
    const projectData = await getProject(id);

    if (!projectData) return notFound();

    const study = projectData.studies.find(s => s.id === studyId);
    if (!study) return notFound();

    return (
        <LiveInterviewManager
            projectId={id}
            studyId={studyId}
            guideBlocks={study.discussionGuide || []}
            projectName={projectData.project.title}
            personas={projectData.personas || []}
        />
    );
}
