'use server';

import { getProject, saveProjectData } from '@/lib/store/projects';
import { revalidatePath } from 'next/cache';

export async function updateProjectsOrderAction(orderedIds: string[]) {
    // We need to update ALL projects that are in the list to have the new order.
    // To avoid reading/writing huge number of files inefficiently, we can do it in parallel or optimized.
    // Given the scale is likely small (dozens of projects), reading/writing is fine.

    // We iterate through the orderedIds, which represents the new sequence (0, 1, 2...).
    // We update each project's order field.

    // Optimization: Only update if order changed?
    // But we don't know the old order easily without reading.

    const promises = orderedIds.map(async (id, index) => {
        const data = await getProject(id);
        if (data) {
            if (data.project.order !== index) {
                data.project.order = index;
                await saveProjectData(data);
            }
        }
    });

    await Promise.all(promises);
    revalidatePath('/');
}
