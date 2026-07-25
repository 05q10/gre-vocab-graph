import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { driver } from '../../../lib/neo4j';

export async function GET() {
  try {
    const sessionUser = await getServerSession(authOptions);
    if (!sessionUser || !sessionUser.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = sessionUser.user.id;

    const session = driver.session();
    try {
      // 1. Total Words & Relationships
      const totalsResult = await session.run(
        `
        MATCH (w:Word {userId: $userId})
        OPTIONAL MATCH (w)-[r]->()
        RETURN count(DISTINCT w) as totalWords, count(r) as totalRelationships
        `,
        { userId }
      );
      const totalWords = totalsResult.records[0].get('totalWords').toNumber();
      const totalRelationships = totalsResult.records[0].get('totalRelationships').toNumber();

      // 2. Daily Activity (Heatmap)
      const activityResult = await session.run(
        `
        MATCH (w:Word {userId: $userId})
        WHERE w.createdAt IS NOT NULL
        WITH substring(w.createdAt, 0, 10) as date, count(w) as count
        RETURN date, count
        ORDER BY date ASC
        `,
        { userId }
      );
      
      const activity = activityResult.records.map(r => ({
        date: r.get('date'),
        count: r.get('count').toNumber()
      }));

      // Calculate Current Streak
      let currentStreak = 0;
      if (activity.length > 0) {
        const today = new Date();
        const dates = activity.map(a => a.date).reverse();
        
        // Normalize today to YYYY-MM-DD
        const todayStr = today.toISOString().substring(0, 10);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().substring(0, 10);

        let activeDate = today;
        let activeDateStr = todayStr;
        
        // If they didn't post today, check if they posted yesterday
        if (dates[0] !== todayStr && dates[0] === yesterdayStr) {
          activeDate = yesterday;
          activeDateStr = yesterdayStr;
        }

        let idx = 0;
        while (idx < dates.length) {
          if (dates[idx] === activeDateStr) {
            currentStreak++;
            activeDate.setDate(activeDate.getDate() - 1);
            activeDateStr = activeDate.toISOString().substring(0, 10);
            idx++;
          } else if (dates[idx] > activeDateStr) {
             // Skip future dates if somehow they exist
             idx++;
          } else {
            // Gap found
            break;
          }
        }
      }

      // 3. Most Connected Words Leaderboard
      const connectedResult = await session.run(
        `
        MATCH (w:Word {userId: $userId})-[r]-()
        RETURN w.word as word, count(r) as degree
        ORDER BY degree DESC
        LIMIT 5
        `,
        { userId }
      );
      
      const mostConnected = connectedResult.records.map(r => ({
        word: r.get('word'),
        degree: r.get('degree').toNumber()
      }));

      return NextResponse.json({
        totalWords,
        totalRelationships,
        currentStreak,
        activity,
        mostConnected
      }, { status: 200 });

    } finally {
      await session.close();
    }
  } catch (error: any) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
