import { getProject } from '@/lib/store/projects';
import { notFound } from 'next/navigation';
import ProjectDetailClient from '@/components/ProjectDetailClient';

interface Props {
    params: Promise<{
        id: string;
    }>;
    searchParams: Promise<{
        tab?: string;
    }>
}

export default async function ProjectPage({ params, searchParams }: Props) {
    const { id } = await params;
    const { tab } = await searchParams; // Pre-fetch for initial state, though optional due to Client logic

    const data = await getProject(id);

    if (!data) {
        notFound();
    }

    const { project, studies, personas } = data;

    return (
        <ProjectDetailClient
            project={project}
            studies={studies}
            personas={personas}
        />
    );
}
