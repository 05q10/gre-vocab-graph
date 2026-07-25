"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  
  const [gradeOrAge, setGradeOrAge] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradeOrAge, purpose }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update profile");
      }

      // Update the NextAuth session so it knows onboarding is complete
      await update({ onboardingComplete: true });
      
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-border p-8 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold mb-2">Welcome to GRE Vocab Graph!</h1>
        <p className="text-foreground-muted mb-6">Let's set up your profile before you start building your personal graph.</p>

        {error && (
          <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-sm mb-6 border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input 
              type="text" 
              disabled 
              value={session?.user?.name || ""}
              className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground-muted cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Grade or Age <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              required
              value={gradeOrAge}
              onChange={(e) => setGradeOrAge(e.target.value)}
              placeholder="e.g. 11th Grade, 21 years old"
              className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Purpose of use <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Studying for GRE, general vocabulary"
              className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-medium py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Saving..." : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  );
}
