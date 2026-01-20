import { getProject } from '@/lib/store/projects';
import { notFound } from 'next/navigation';
import StudyPlanEditor from '@/components/StudyPlanEditor';

interface Props {
    params: Promise<{
        id: string;
        studyId: string;
    }>
}

export default async function EditPlanPage({ params }: Props) {
    const { id, studyId } = await params;
    const data = await getProject(id);

    if (!data) notFound();
    const study = data.studies.find(s => s.id === studyId);
    if (!study) notFound();

    return (
        <div className="min-h-screen bg-slate-100 p-8">
            <div className="max-w-3xl mx-auto mb-6">
                <h1 className="text-2xl font-bold text-slate-800">인터뷰 기획 수정</h1>
            </div>
            <StudyPlanEditor
                projectId={id}
                studyId={studyId}
                initialPlan={study.plan}
            />
        </div>
    );
}
