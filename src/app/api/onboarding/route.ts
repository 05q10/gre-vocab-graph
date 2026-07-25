import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { updateUser } from '../../../services/userService';

const onboardingSchema = z.object({
  gradeOrAge: z.string().min(1, 'Grade or Age is required'),
  purpose: z.string().min(1, 'Purpose is required'),
});

export async function POST(request: Request) {
  try {
    const sessionUser = await getServerSession(authOptions);
    if (!sessionUser || !sessionUser.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = sessionUser.user.id;

    const body = await request.json();
    const validatedData = onboardingSchema.parse(body);

    const updatedUser = await updateUser(userId, {
      gradeOrAge: validatedData.gradeOrAge,
      purpose: validatedData.purpose,
    });

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: (error as any).errors || (error as any).issues },
        { status: 400 }
      );
    }
    console.error('Error in onboarding:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
