import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getUserById, updateUser } from '../../../services/userService';

const profileSchema = z.object({
  name: z.string().optional(),
  gradeOrAge: z.string().min(1, 'Grade or Age is required'),
  purpose: z.string().min(1, 'Purpose is required'),
});

export async function GET() {
  try {
    const sessionUser = await getServerSession(authOptions);
    if (!sessionUser || !sessionUser.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = sessionUser.user.id;

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const sessionUser = await getServerSession(authOptions);
    if (!sessionUser || !sessionUser.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = sessionUser.user.id;

    const body = await request.json();
    const validatedData = profileSchema.parse(body);

    const updatedUser = await updateUser(userId, {
      gradeOrAge: validatedData.gradeOrAge,
      purpose: validatedData.purpose,
    });
    
    // Note: If we also wanted to allow changing name, we would need to update the Neo4j user query
    // and potentially the JWT session. For now, name is pulled from Google and Neo4j is updated with grade/purpose.

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: (error as any).errors || (error as any).issues },
        { status: 400 }
      );
    }
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
