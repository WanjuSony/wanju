'use client';

import { useTransition } from 'react';
import { deleteProjectAction } from '@/app/actions';

export default function DeleteProjectButton({ projectId }: { projectId: string }) {
    const [isPending, startTransition] = useTransition();

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent link navigation
        if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
            startTransition(async () => {
                await deleteProjectAction(projectId);
            });
        }
    };

    return (
        <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-slate-400 hover:text-red-600 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 transition ml-2"
        >
            {isPending ? 'Removing...' : '🗑️ Delete'}
        </button>
    );
}
