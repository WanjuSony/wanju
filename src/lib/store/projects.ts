import fs from 'fs/promises';
import path from 'path';
import { Project, ProjectData, Hypothesis, DiscussionGuide } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data', 'projects');

// Ensure data directory exists
const initDir = async () => {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
};

export async function getAllProjects(): Promise<Project[]> {
    await initDir();
    const files = await fs.readdir(DATA_DIR);
    const projects: Project[] = [];

    for (const file of files) {
        if (file.endsWith('.json')) {
            try {
                const content = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
                const data = JSON.parse(content) as ProjectData;
                projects.push(data.project);
            } catch (e) {
                console.error(`Failed to parse project file ${file}`, e);
            }
        }
    }

    // Sort by order and date
    // Logic: Unordered (new) items appear at the top (order = -1), sorted by Date Desc.
    // Ordered items appear after, sorted by Order Asc.
    return projects.sort((a, b) => {
        const orderA = a.order ?? -1;
        const orderB = b.order ?? -1;

        if (orderA === -1 && orderB === -1) {
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        if (orderA === -1) return -1;
        if (orderB === -1) return 1;

        return orderA - orderB;
    });
}

export async function getProject(id: string): Promise<ProjectData | null> {
    await initDir();
    const filepath = path.join(DATA_DIR, `${id}.json`);
    try {
        const content = await fs.readFile(filepath, 'utf-8');
        return JSON.parse(content) as ProjectData;
    } catch {
        return null;
    }
}

export async function createProject(title: string, description: string, goal: string, exitCriteria: string): Promise<string> {
    await initDir();
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);

    const newProject: ProjectData = {
        project: {
            id,
            title,
            description,
            goal,
            exitCriteria,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'planning' // Default status
        },
        studies: [],
        personas: []
    };

    await saveProjectData(newProject);
    return id;
}

export async function saveProjectData(data: ProjectData): Promise<void> {
    await initDir();
    const filepath = path.join(DATA_DIR, `${data.project.id}.json`);
    data.project.updatedAt = new Date().toISOString();
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
}

export async function deleteProject(id: string): Promise<void> {
    await initDir();
    const filepath = path.join(DATA_DIR, `${id}.json`);
    try {
        await fs.unlink(filepath);
    } catch (e) {
        console.error(`Failed to delete project file ${id}`, e);
    }
}
