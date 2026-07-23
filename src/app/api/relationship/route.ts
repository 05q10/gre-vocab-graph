import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createRelationship, deleteRelationship } from '../../../services/relationshipService';
import { RELATIONSHIP_TYPES } from '../../../types/relationship';

const createRelationshipSchema = z.object({
  sourceWord: z.string().min(1, 'Source word is required'),
  targetWord: z.string().min(1, 'Target word is required'),
  type: z.enum(RELATIONSHIP_TYPES),
  confidence: z.number().min(0).max(1).default(1.0), // Manual relationships have full confidence by default
});

const deleteRelationshipSchema = z.object({
  sourceWord: z.string().min(1, 'Source word is required'),
  targetWord: z.string().min(1, 'Target word is required'),
  type: z.enum(RELATIONSHIP_TYPES).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = createRelationshipSchema.parse(body);

    const success = await createRelationship(
      validatedData.sourceWord,
      validatedData.targetWord,
      validatedData.type,
      validatedData.confidence
    );

    if (success) {
      return NextResponse.json({ success: true }, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Failed to create relationship' }, { status: 500 });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: (error as any).errors || (error as any).issues },
        { status: 400 }
      );
    }
    console.error('Error creating relationship:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const validatedData = deleteRelationshipSchema.parse(body);

    const success = await deleteRelationship(
      validatedData.sourceWord,
      validatedData.targetWord,
      validatedData.type
    );

    if (success) {
      return NextResponse.json({ success: true }, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Relationship not found or could not be deleted' }, { status: 404 });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: (error as any).errors || (error as any).issues },
        { status: 400 }
      );
    }
    console.error('Error deleting relationship:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
