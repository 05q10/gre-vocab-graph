'use client';

import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { ChartBarIcon, FireIcon, LinkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

interface Activity {
  date: string;
  count: number;
}

interface MostConnected {
  word: string;
  degree: number;
}

interface StatsData {
  totalWords: number;
  totalRelationships: number;
  currentStreak: number;
  activity: Activity[];
  mostConnected: MostConnected[];
}

// Generate last N days
function generateHeatmap(activity: Activity[], days = 140) { // 20 weeks * 7 days
  const map = new Map(activity.map(a => [a.date, a.count]));
  const heatmap = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().substring(0, 10);
    heatmap.push({
      date: dateStr,
      count: map.get(dateStr) || 0
    });
  }
  return heatmap;
}

const getHeatmapColor = (count: number) => {
  if (count === 0) return 'bg-surface border-border border';
  if (count <= 1) return 'bg-accent/40 border-accent/50 border';
  if (count <= 3) return 'bg-accent/70 border-accent/80 border';
  return 'bg-accent border-accent border';
};

export default function StatisticsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/statistics');
        if (!res.ok) throw new Error('Failed to fetch statistics');
        const data = await res.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] text-antonym">
        {error || 'Failed to load'}
      </div>
    );
  }

  // Use 140 days (20 weeks) to make it look like a nice grid that fits most screens
  const heatmapData = generateHeatmap(stats.activity, 140);

  return (
    <div className="text-foreground">
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-3xl font-bold mb-8">Your Knowledge Statistics</h1>
        
        {/* Top level metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-surface-elevated p-6 rounded-2xl border border-border shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-accent/10 text-accent rounded-xl">
              <ChartBarIcon className="w-8 h-8" />
            </div>
            <div>
              <div className="text-sm text-foreground-muted font-medium uppercase tracking-wider">Total Words</div>
              <div className="text-3xl font-bold">{stats.totalWords}</div>
            </div>
          </div>
          
          <div className="bg-surface-elevated p-6 rounded-2xl border border-border shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-synonym/10 text-synonym rounded-xl">
              <LinkIcon className="w-8 h-8" />
            </div>
            <div>
              <div className="text-sm text-foreground-muted font-medium uppercase tracking-wider">Relationships</div>
              <div className="text-3xl font-bold">{stats.totalRelationships}</div>
            </div>
          </div>

          <div className="bg-surface-elevated p-6 rounded-2xl border border-border shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-related/10 text-related rounded-xl">
              <FireIcon className="w-8 h-8" />
            </div>
            <div>
              <div className="text-sm text-foreground-muted font-medium uppercase tracking-wider">Current Streak</div>
              <div className="text-3xl font-bold">{stats.currentStreak} <span className="text-lg font-normal text-foreground-muted">days</span></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Heatmap Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface-elevated p-6 rounded-2xl border border-border shadow-sm">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h2 className="text-xl font-bold">Activity</h2>
                  <p className="text-sm text-foreground-muted">Words added over the last 140 days.</p>
                </div>
              </div>
              
              {/* Heatmap Grid */}
              <div className="overflow-x-auto pb-4">
                <div 
                  className="grid grid-rows-7 gap-1.5" 
                  style={{ gridAutoFlow: 'column', gridAutoColumns: '14px' }}
                >
                  {heatmapData.map((day, idx) => (
                    <div
                      key={idx}
                      title={`${day.count} words on ${day.date}`}
                      className={`w-3.5 h-3.5 rounded-sm ${getHeatmapColor(day.count)} transition-all hover:scale-125 cursor-pointer`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end text-xs text-foreground-muted mt-2 space-x-2">
                <span>Less</span>
                <div className="w-3.5 h-3.5 rounded-sm bg-surface border border-border" />
                <div className="w-3.5 h-3.5 rounded-sm bg-accent/40 border border-accent/50" />
                <div className="w-3.5 h-3.5 rounded-sm bg-accent/70 border border-accent/80" />
                <div className="w-3.5 h-3.5 rounded-sm bg-accent border border-accent" />
                <span>More</span>
              </div>
            </div>
          </div>

          {/* Most Connected Leaderboard */}
          <div className="space-y-6">
            <div className="bg-surface-elevated p-6 rounded-2xl border border-border shadow-sm">
              <h2 className="text-xl font-bold mb-2">Most Connected</h2>
              <p className="text-sm text-foreground-muted mb-6">Core nodes in your graph.</p>
              
              {stats.mostConnected.length === 0 ? (
                <div className="text-center text-foreground-muted py-8 text-sm">
                  No relationships built yet.
                </div>
              ) : (
                <ul className="space-y-4">
                  {stats.mostConnected.map((node, idx) => (
                    <li key={idx} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg font-bold text-foreground-muted w-4 text-right">{idx + 1}</span>
                        <Link href={`/graph`} className="font-semibold text-foreground hover:text-accent transition-colors">
                          {node.word}
                        </Link>
                      </div>
                      <div className="text-sm font-medium bg-surface px-2 py-1 rounded-md border border-border">
                        {node.degree} links
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
