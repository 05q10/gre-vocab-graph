import { NextResponse } from 'next/server';
import { searchWords } from '../../../services/wordService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    const words = await searchWords(query);

    return NextResponse.json(words, { status: 200 });
  } catch (error) {
    console.error('Error searching words:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
