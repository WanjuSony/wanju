import { getAllProjects } from '@/lib/store/projects';
import Link from 'next/link';
import DeleteProjectButton from '@/components/DeleteProjectButton';

export default async function Home() {
  const projects = await getAllProjects();

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <header className="mb-12 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">UX Research System</h1>
          <p className="text-slate-600 mt-2">Manage your research projects, hypotheses, and insights.</p>
        </div>
        <Link
          href="/projects/new"
          className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl font-medium shadow-md transition"
        >
          + New Project
        </Link>
      </header>

      <section>
        <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          Recent Projects
        </h2>

        {projects.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <p className="text-slate-500">No projects yet. Start by creating one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition border border-slate-100 flex flex-col justify-between h-56 group relative">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-2 items-center">
                        <span className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded ${project.status === 'planning' ? 'bg-yellow-100 text-yellow-700' :
                          project.status === 'simulation' ? 'bg-purple-100 text-purple-700' :
                            project.status === 'execution' ? 'bg-green-100 text-green-700' :
                              'bg-slate-100 text-slate-700'
                          }`}>
                          {project.status}
                        </span>
                        <DeleteProjectButton projectId={project.id} />
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 group-hover:text-brand-600 transition mb-2">
                      {project.title}
                    </h3>
                    <p className="text-slate-600 text-sm line-clamp-3">
                      {project.description}
                    </p>
                  </div>
                  <div className="text-brand-600 text-sm font-medium mt-auto pt-4 flex items-center">
                    Open Dashboard &rarr;
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-20 pt-10 border-t border-slate-200">
        <h2 className="text-lg font-semibold text-slate-400 mb-4">Resources</h2>
        <div className="flex gap-4">
          <Link href="/archive/transcripts" className="text-slate-600 hover:text-slate-900 underline underline-offset-4">
            Browse Podcast Data Archive
          </Link>
        </div>
      </section>
    </main>
  );
}
