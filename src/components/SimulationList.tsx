import Link from 'next/link';
import { deleteSimulationSessionAction, updateSimulationSessionsOrderAction } from '@/app/actions';
import { Persona, SimulationSession } from '@/lib/types';
import { useState, useEffect, useId } from 'react';
import { useRouter } from 'next/navigation';

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
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
    projectId: string;
    studyId: string;
    sessions: SimulationSession[];
    personas: Persona[];
}

export function SimulationList({ projectId, studyId, sessions: initialSessions, personas }: Props) {
    const router = useRouter();
    const [sessions, setSessions] = useState<SimulationSession[]>(initialSessions);

    useEffect(() => {
        setSessions(initialSessions);
    }, [initialSessions]);

    // Fix hydration mismatch
    const dndContextId = useId();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = sessions.findIndex(s => s.id === active.id);
            const newIndex = sessions.findIndex(s => s.id === over.id);

            const newOrder = arrayMove(sessions, oldIndex, newIndex);
            setSessions(newOrder);

            try {
                await updateSimulationSessionsOrderAction(projectId, studyId, newOrder.map(s => s.id));
            } catch (e) {
                console.error("Failed to update simulation order:", e);
                setSessions(sessions); // Rollback
            }
        }
    };

    const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('정말 이 시뮬레이션 기록을 삭제하시겠습니까?')) return;
        try {
            await deleteSimulationSessionAction(projectId, studyId, sessionId);
        } catch (e) {
            console.error(e);
        }
    };

    if (!sessions || sessions.length === 0) {
        return (
            <div className="bg-slate-50 rounded-lg p-8 text-center">
                <p className="text-slate-500 mb-6">
                    캐스팅된 AI 페르소나와 대화하며, 작성된 인터뷰 가이드를 기반으로 사전 인터뷰를 진행해보세요.
                </p>
                <Link
                    href={`/projects/${projectId}/studies/${studyId}/simulation`}
                    className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                    <span className="text-xl">🤖</span> 시뮬레이션 시작하기
                </Link>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-slate-200 bg-white">
            <DndContext
                id={dndContextId}
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 w-10"></th>
                            <th className="px-4 py-3 w-1/3 text-xs uppercase tracking-wider">Persona</th>
                            <th className="px-4 py-3 w-1/3 text-xs uppercase tracking-wider">Date</th>
                            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        <SortableContext
                            items={sessions.map(s => s.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {sessions.map((session, index) => (
                                <SimulationSortableRow
                                    key={session.id}
                                    session={session}
                                    persona={personas?.find(p => p.id === session.personaId)}
                                    projectId={projectId}
                                    studyId={studyId}
                                    handleDelete={handleDelete}
                                    router={router}
                                    index={index}
                                />
                            ))}
                        </SortableContext>
                    </tbody>
                </table>
            </DndContext>
        </div>
    );
}

interface SimulationSortableRowProps {
    session: SimulationSession;
    persona: Persona | undefined;
    projectId: string;
    studyId: string;
    handleDelete: (id: string, e: React.MouseEvent) => void;
    router: any;
    index: number;
}

function SimulationSortableRow({
    session,
    persona,
    projectId,
    studyId,
    handleDelete,
    router,
    index
}: SimulationSortableRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: session.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        position: isDragging ? 'relative' as const : undefined,
        backgroundColor: isDragging ? '#f8fafc' : undefined,
    };

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`hover:bg-slate-50 transition group cursor-pointer ${isDragging ? 'shadow-lg ring-1 ring-brand-200' : ''}`}
            onClick={() => router.push(`/projects/${projectId}/studies/${studyId}/simulation/${session.id}`)}
        >
            <td className="px-4 py-2 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
                <div className="text-slate-300 group-hover:text-slate-400 flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zm-6 4h2v2H8v-2zm6 0h2v2h-2v-2zm-6 4h2v2H8v-2zm6 0h2v2h-2v-2zm-6 4h2v2H8v-2zm6 0h2v2h-2v-2z" />
                    </svg>
                    <span className="font-bold text-xs w-4 text-center text-slate-400">{index + 1}</span>
                </div>
            </td>
            <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-xs">
                        {persona?.name.charAt(0) || '?'}
                    </div>
                    <div>
                        <span className="font-bold text-slate-900 block gap-2">{persona?.name || 'Unknown'}</span>
                        <span className="text-xs text-slate-400">{persona?.role}</span>
                    </div>
                </div>
            </td>
            <td className="px-4 py-2 text-slate-500">
                {(() => {
                    const d = new Date(session.createdAt);
                    const dateStr = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
                    const hours = d.getHours();
                    const ampm = hours >= 12 ? '오후' : '오전';
                    const h = hours % 12 || 12;
                    const timeStr = `${ampm} ${h}:${String(d.getMinutes()).padStart(2, '0')}`;
                    return (
                        <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-700 block">{dateStr}</span>
                            <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                                🕒 {timeStr}
                            </span>
                        </div>
                    );
                })()}
            </td>
            <td className="px-4 py-2 text-left whitespace-nowrap">
                <div className="flex gap-2 justify-start items-center" onClick={e => e.stopPropagation()}>
                    <Link
                        href={`/projects/${projectId}/studies/${studyId}/simulation/${session.id}`}
                        className="text-xs text-brand-600 font-bold hover:underline bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition"
                    >
                        결과 보기
                    </Link>
                    <button
                        onClick={(e) => handleDelete(session.id, e)}
                        className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition"
                        title="Delete Simulation"
                    >
                        🗑️
                    </button>
                </div>
            </td>
        </tr>
    );
}
