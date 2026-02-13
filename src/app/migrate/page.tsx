import { promises as fs } from 'fs';
import path from 'path';
import MigrationClient from './MigrationClient';
import { ProjectData } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function MigrationPage() {
    const dataDir = path.join(process.cwd(), 'data/projects');

    // Check if dir exists
    try {
        await fs.access(dataDir);
    } catch {
        return <div className="p-8">data/projects directory not found</div>;
    }

    const files = await fs.readdir(dataDir);
    const projects: ProjectData[] = [];

    for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
            const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
            const json = JSON.parse(content);

            // Extract studies and personas from the mixed 'studies' array
            const rawStudies = Array.isArray(json.studies) ? json.studies : [];

            // Heuristic: Studies have 'plan' or 'sessions'. Personas have 'name' and 'role' but NO 'plan'.
            const studies = rawStudies.filter((item: any) => item.plan || item.sessions || item.participantIds);
            const personasInStudies = rawStudies.filter((item: any) => !item.plan && !item.sessions && item.name && item.role);

            // Also check top-level personas just in case
            const topLevelPersonas = Array.isArray(json.personas) ? json.personas : [];

            const personas = [...personasInStudies, ...topLevelPersonas];

            // Clean up: Ensure IDs are strings
            studies.forEach((s: any) => s.id = String(s.id));
            personas.forEach((p: any) => p.id = String(p.id));
            if (json.project) json.project.id = String(json.project.id);

            projects.push({
                project: json.project,
                studies: studies,
                personas: personas
            });
        } catch (e) {
            console.error(`Failed to parse ${file}`, e);
        }
    }

    return <MigrationClient projects={projects} />;
}
