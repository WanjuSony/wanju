'use client';

import { useState } from 'react';
import { ProjectData } from '@/lib/types';
import { saveProjectData } from '@/lib/store/projects';

interface Props {
    projects: ProjectData[];
}

export default function MigrationClient({ projects }: Props) {
    const [status, setStatus] = useState<string[]>([]);
    const [isMigrating, setIsMigrating] = useState(false);

    const runMigration = async () => {
        setIsMigrating(true);
        setStatus(prev => [...prev, 'Starting re-migration with proper field mapping...']);

        for (const projectData of projects) {
            try {
                setStatus(prev => [...prev, `Migrating project: ${projectData.project.title} (${projectData.project.id})...`]);

                await saveProjectData(projectData);

                setStatus(prev => [...prev, `✅ Success: ${projectData.project.title}`]);
            } catch (e: any) {
                console.error(e);
                setStatus(prev => [...prev, `❌ Failed: ${projectData.project.title} - ${e.message}`]);
            }
        }

        setStatus(prev => [...prev, 'Migration completed! Please check if insights and personas are visible now.']);
        setIsMigrating(false);
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Local Data Migration (Fix)</h1>

            <div className="bg-white p-6 rounded-lg shadow mb-6 border">
                <h2 className="font-semibold mb-4">Found {projects.length} Projects</h2>
                <ul className="list-disc pl-5 mb-6 text-sm text-slate-600">
                    {projects.map(p => (
                        <li key={p.project.id}>
                            {p.project.title}
                            <span className="text-slate-400 ml-2">
                                (Studies: {p.studies.length}, Personas: {p.personas.length})
                            </span>
                        </li>
                    ))}
                </ul>

                <button
                    onClick={runMigration}
                    disabled={isMigrating}
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                    {isMigrating ? 'Migrating...' : 'Start Re-Migration'}
                </button>
            </div>

            <div className="bg-slate-900 text-slate-200 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
                {status.length === 0 ? (
                    <div className="text-slate-500 italic">Ready to start...</div>
                ) : (
                    status.map((line, i) => <div key={i}>{line}</div>)
                )}
            </div>
        </div>
    );
}
