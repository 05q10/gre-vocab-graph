import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";
import AddWordForm from "../components/AddWordForm";
import LoginButton from "../components/LoginButton";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
             Vocabulary Graph
            </h1>
            <p className="text-lg text-foreground-muted max-w-2xl mx-auto">
              Build your own personal, intelligent semantic network of vocabulary words.
              Sign in to start creating your graph!
            </p>
            <div className="pt-4">
              <LoginButton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session.user.onboardingComplete) {
    redirect("/onboarding");
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-4xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Your Vocabulary Graph
          </h1>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto">
            Welcome back, {session.user.name?.split(' ')[0]}! Add a word, and our AI pipeline will automatically detect and create relationships with existing words in your personal graph.
          </p>
        </div>
        
        <AddWordForm />
      </div>
    </div>
  );
}
