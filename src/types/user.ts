export interface User {
  id: string; // The email or Google ID
  name: string;
  email: string;
  gradeOrAge: string | null;
  purpose: string | null;
  createdAt: string;
}

export interface CreateUserInput {
  id: string;
  name: string;
  email: string;
  gradeOrAge?: string;
  purpose?: string;
}

export interface UpdateUserInput {
  gradeOrAge?: string;
  purpose?: string;
}
