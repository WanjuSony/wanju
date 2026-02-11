import { getAllProjects } from '@/lib/store/projects';
import Link from 'next/link';
import DeleteProjectButton from '@/components/DeleteProjectButton';
import ProjectList from '@/components/ProjectList';

export default async function Home() {
  const projects = await getAllProjects();

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      {/* Header / Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-brand-200">
              I
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              INVAIZ <span className="text-brand-600">UX Research</span>
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-1">
              <Link href="/" className="px-4 py-2 text-brand-600 bg-brand-50 rounded-lg font-bold text-sm">
                Projects
              </Link>
              <Link href="/archive/transcripts" className="px-4 py-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg font-medium text-sm transition">
                Archive
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto p-8 md:p-12">
        {/* Hero Section */}
        <header className="mb-16">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">더 빠르고 정확하게 검증하세요</span>
          </h2>
          <p className="text-slate-500 mt-4 text-lg max-w-2xl leading-relaxed break-keep">
            연구 설계부터 페르소나 시뮬레이션, 인사이트 분석까지.<br className="hidden md:block" />
            AI와 함께 리서치 업무의 효율을 높이고 의미 있는 발견에 집중하세요.
          </p>
        </header>

        {/* Projects Section */}
        <ProjectList projects={projects} />
      </main>
    </div>
  );
}
