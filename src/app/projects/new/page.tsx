import { createNewProjectAction } from '@/app/actions';
import Link from 'next/link';

export default function NewProjectPage() {
    return (
        <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                <div className="mb-8">
                    <Link href="/" className="text-slate-500 hover:text-slate-800 text-sm mb-4 inline-block">&larr; Cancel</Link>
                    <h1 className="text-2xl font-bold text-slate-900">Create New Project</h1>
                    <p className="text-slate-500 mt-1">Start a new research initiative.</p>
                </div>

                <form action={createNewProjectAction} className="space-y-6">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-2">Project Title</label>
                        <input
                            type="text"
                            name="title"
                            id="title"
                            required
                            placeholder="e.g. Shopping Cart Usability Study"
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition"
                        />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                        <textarea
                            name="description"
                            id="description"
                            required
                            rows={2}
                            placeholder="High level description"
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition"
                        />
                    </div>

                    <div>
                        <label htmlFor="goal" className="block text-sm font-medium text-slate-700 mb-2">Project Goal (Purpose)</label>
                        <textarea
                            name="goal"
                            id="goal"
                            required
                            rows={2}
                            placeholder="What exactly are we trying to achieve?"
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition"
                        />
                    </div>

                    <div>
                        <label htmlFor="exitCriteria" className="block text-sm font-medium text-slate-700 mb-2">Exit Criteria (Definition of Done)</label>
                        <textarea
                            name="exitCriteria"
                            id="exitCriteria"
                            required
                            rows={2}
                            placeholder="When is this research finished?"
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-brand-600/20"
                    >
                        Create Project
                    </button>
                </form>
            </div>
        </div>
    );
}
