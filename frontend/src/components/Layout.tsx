import { Outlet, Link } from 'react-router-dom';
import { Megaphone, Palette } from 'lucide-react';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
        <div className="max-w-7xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-brand-600" />
            <span className="text-lg sm:text-xl font-bold text-gray-900">Content Engine</span>
          </Link>
          <nav className="flex items-center gap-4 w-full sm:w-auto">
            <Link
              to="/"
              className="text-sm font-medium text-gray-600 hover:text-brand-600 transition"
            >
              Campañas
            </Link>
            <Link
              to="/brand-kit"
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-600 transition"
            >
              <Palette className="w-4 h-4" />
              Brand Kit
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
