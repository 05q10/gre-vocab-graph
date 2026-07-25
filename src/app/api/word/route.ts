import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addWord } from '../../../services/wordPipeline';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export const maxDuration = 60; // Allow pipeline up to 60s on Vercel

const createWordSchema = z.object({
  word: z.string().min(1, 'Word is required').max(50, 'Word must be 50 characters or less'),
});

export async function POST(request: Request) {
  try {
    const sessionUser = await getServerSession(authOptions);
    if (!sessionUser || !sessionUser.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = sessionUser.user.id;
    const body = await request.json();
    
    // Validate request body
    const validatedData = createWordSchema.parse(body);

    // Add word through pipeline
    const result = await addWord({ ...validatedData, userId });

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

const updateWordSchema = z.object({
  word: z.string().min(1),
  remarks: z.string().optional(),
});

export async function PATCH(request: Request) {
  try {
    const sessionUser = await getServerSession(authOptions);
    if (!sessionUser || !sessionUser.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = sessionUser.user.id;
    const body = await request.json();
    
    const validatedData = updateWordSchema.parse(body);

    const { updateWord } = await import('../../../services/wordService');
    const updated = await updateWord(validatedData.word, userId, { remarks: validatedData.remarks });
    
    if (!updated) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 });
    }
    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: (error as any).errors || (error as any).issues },
        { status: 400 }
      );
    }
    console.error('Error updating word:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const sessionUser = await getServerSession(authOptions);
    if (!sessionUser || !sessionUser.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = sessionUser.user.id;
    const body = await request.json();
    
    if (!body.word) {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 });
    }

    const { deleteWord } = await import('../../../services/wordService');
    const deleted = await deleteWord(body.word, userId);
    
    if (!deleted) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting word:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
