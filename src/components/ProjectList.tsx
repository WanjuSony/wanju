'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Project } from '@/lib/types';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy
} from '@dnd-kit/sortable';
import { SortableProjectCard } from './SortableProjectCard';
import { updateProjectsOrderAction } from '@/app/actions/order';

interface ProjectListProps {
    projects: Project[];
}

export default function ProjectList({ projects: initialProjects }: ProjectListProps) {
    const [projects, setProjects] = useState(initialProjects);
    const [filter, setFilter] = useState<'all' | 'planning' | 'execution' | 'completed'>('all');

    // Sync state with props if initialProjects changes (e.g. revalidation)
    useEffect(() => {
        setProjects(initialProjects);
    }, [initialProjects]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require 8px movement before drag starts (prevents click interference)
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = projects.findIndex((item) => item.id === active.id);
            const newIndex = projects.findIndex((item) => item.id === over.id);

            const newItems = arrayMove(projects, oldIndex, newIndex);

            // Optimistic update
            setProjects(newItems);

            // Trigger Server Action to save new order
            const orderedIds = newItems.map(p => p.id);
            await updateProjectsOrderAction(orderedIds);
        }
    };

    const filteredProjects = projects.filter(p => {
        if (filter === 'all') return true;
        if (filter === 'planning') return p.status === 'planning';
        if (filter === 'execution') return p.status === 'execution' || p.status === 'simulation';
        if (filter === 'completed') return p.status === 'completed';
        return true;
    });

    const counts = {
        all: projects.length,
        planning: projects.filter(p => p.status === 'planning').length,
        execution: projects.filter(p => p.status === 'execution' || p.status === 'simulation').length,
        completed: projects.filter(p => p.status === 'completed').length
    };

    return (
        <section>
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-6">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">내 프로젝트</h3>

                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition ${filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            전체 ({counts.all})
                        </button>
                        <button
                            onClick={() => setFilter('planning')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition ${filter === 'planning' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            계획 중 ({counts.planning})
                        </button>
                        <button
                            onClick={() => setFilter('execution')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition ${filter === 'execution' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            진행 중 ({counts.execution})
                        </button>
                        <button
                            onClick={() => setFilter('completed')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition ${filter === 'completed' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            완료 ({counts.completed})
                        </button>
                    </div>
                </div>
                {projects.length > 0 && (
                    <Link
                        href="/projects/new"
                        className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-brand-100 transition-all hover:scale-[1.02] active:scale-[0.98] text-sm flex items-center gap-2"
                    >
                        <span className="text-xl">+</span> 새 프로젝트
                    </Link>
                )}
            </div>

            {filteredProjects.length === 0 ? (
                <div className="text-center py-20 flex flex-col items-center">
                    <h4 className="text-xl font-bold text-slate-400 mb-2">
                        {filter === 'all' ? '아직 프로젝트가 없습니다' : '해당 상태의 프로젝트가 없습니다'}
                    </h4>
                    {filter === 'all' && (
                        <>
                            <p className="text-slate-400 mb-8 max-w-sm break-keep text-sm">
                                새로운 리서치를 시작해보세요. 모든 위대한 발견은 작은 프로젝트에서 시작됩니다!
                            </p>
                            <Link
                                href="/projects/new"
                                className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold transition hover:bg-slate-800 shadow-xl"
                            >
                                첫 프로젝트 생성하기
                            </Link>
                        </>
                    )}
                </div>
            ) : (
                filter === 'all' ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={filteredProjects.map(p => p.id)}
                            strategy={rectSortingStrategy}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {filteredProjects.map((project) => (
                                    <SortableProjectCard key={project.id} project={project} />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredProjects.map((project) => (
                            <SortableProjectCard key={project.id} project={project} />
                        ))}
                    </div>
                )
            )}
        </section>
    );
}
