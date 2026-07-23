import Link from 'next/link';
import { HomeIcon, ShareIcon, ChartBarIcon } from '@heroicons/react/24/outline';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-surface-elevated/80 backdrop-blur">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ShareIcon className="h-6 w-6 text-accent" />
          <span className="text-lg font-semibold tracking-tight">VocabGraph</span>
        </div>
        
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-1 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors">
            <HomeIcon className="h-4 w-4" />
            <span>Home</span>
          </Link>
          <Link href="/graph" className="flex items-center space-x-1 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors">
            <ShareIcon className="h-4 w-4" />
            <span>Graph</span>
          </Link>
          <Link href="/statistics" className="flex items-center space-x-1 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors">
            <ChartBarIcon className="h-4 w-4" />
            <span>Statistics</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
