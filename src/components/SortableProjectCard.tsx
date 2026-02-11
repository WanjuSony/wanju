'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DeleteProjectButton from '@/components/DeleteProjectButton';
import Link from 'next/link';
import { Project } from '@/lib/types';
import { ProjectStatusBadge } from '@/components/ProjectStatusBadge'; // Assuming we use Badge or manual logic? Manual logic was used in ProjectList.
import { formatDate } from '@/lib/date-utils';

interface Props {
    project: Project;
}

export function SortableProjectCard({ project }: Props) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: project.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1
    };

    return (
        <div ref={setNodeRef} style={style} className="group relative h-full" {...attributes} {...listeners}>
            <div className="absolute inset-0 bg-brand-600 rounded-[2.5rem] translate-y-3 opacity-0 group-hover:opacity-10 transition-all duration-300"></div>
            <div
                className="relative bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 flex flex-col h-80 cursor-grab active:cursor-grabbing"
            >

                <div className="flex justify-between items-start mb-6">
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${(project.status === 'planning' || !project.status) ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        (project.status === 'simulation' || project.status === 'execution') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            project.status === 'completed' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                                'bg-slate-50 text-slate-500 border border-slate-200'
                        }`}>
                        {!project.status || project.status === 'planning' ? '계획 중' :
                            (project.status === 'simulation' || project.status === 'execution') ? '진행 중' :
                                project.status === 'completed' ? '완료' : project.status}
                    </div>
                    <DeleteProjectButton projectId={project.id} />
                </div>

                <Link href={`/projects/${project.id}`} className="flex-1">
                    <h4 className="text-2xl font-black text-slate-900 leading-tight mb-4 group-hover:text-brand-600 transition duration-300 pr-8">
                        {project.title}
                    </h4>
                    <p className="text-slate-500 text-sm line-clamp-3 leading-relaxed break-keep">
                        {project.description}
                    </p>
                </Link>

                <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">{formatDate(project.updatedAt)}</span>
                    <Link href={`/projects/${project.id}`} className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-all duration-300">
                        <span className="text-lg font-bold leading-none">&rarr;</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
