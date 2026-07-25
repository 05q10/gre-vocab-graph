import { NextResponse } from 'next/server';
import { searchWords } from '../../../services/wordService';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET(request: Request) {
  try {
    const sessionUser = await getServerSession(authOptions);
    if (!sessionUser || !sessionUser.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = sessionUser.user.id;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    const words = await searchWords(query, userId);

    return NextResponse.json(words, { status: 200 });
  } catch (error) {
    console.error('Error searching words:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
