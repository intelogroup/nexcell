import { LazyCanvasDemo } from '@/components/canvas/LazyCanvasDemo';

export default function LazyLoadingDemo() {
  return (
    <div className="h-screen flex flex-col">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-2xl font-bold">Lazy Loading Demo</h1>
        <p className="text-blue-100">Testing CanvasRenderer with 10,000 × 1,000 grid</p>
      </header>
      
      <main className="flex-1 overflow-hidden">
        <LazyCanvasDemo />
      </main>
    </div>
  );
}