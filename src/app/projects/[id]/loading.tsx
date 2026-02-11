
export default function Loading() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
            {/* Header Skeleton */}
            <header className="bg-white border-b border-slate-200 h-16 flex items-center px-6">
                <div className="h-6 w-32 bg-slate-200 rounded animate-pulse"></div>
            </header>

            <main className="flex-1 max-w-[1600px] mx-auto w-full p-6 flex gap-6">
                {/* Sidebar Skeleton */}
                <div className="w-64 hidden lg:block space-y-4">
                    <div className="h-8 w-full bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse"></div>
                    <div className="h-4 w-1/2 bg-slate-200 rounded animate-pulse"></div>
                    <div className="pt-8 space-y-2">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-10 w-full bg-slate-200 rounded animate-pulse"></div>
                        ))}
                    </div>
                </div>

                {/* Main Content Skeleton */}
                <div className="flex-1 space-y-6">
                    <div className="h-12 w-1/3 bg-slate-200 rounded animate-pulse"></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-32 bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                                <div className="h-6 w-1/2 bg-slate-200 rounded animate-pulse"></div>
                                <div className="h-4 w-full bg-slate-200 rounded animate-pulse"></div>
                                <div className="h-4 w-2/3 bg-slate-200 rounded animate-pulse"></div>
                            </div>
                        ))}
                    </div>
                    <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse"></div>
                </div>
            </main>
        </div>
    );
}
