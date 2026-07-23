import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addWord } from '../../../services/wordPipeline';

export const maxDuration = 60; // Allow pipeline up to 60s on Vercel

const createWordSchema = z.object({
  word: z.string().min(1, 'Word is required').max(50, 'Word must be 50 characters or less'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = createWordSchema.parse(body);

    // Add word through pipeline
    const result = await addWord(validatedData);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: (error as any).errors || (error as any).issues },
        { status: 400 }
      );
    }
    
    // Check if duplicate word error
    if (error.message && error.message.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error('Error adding word:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
