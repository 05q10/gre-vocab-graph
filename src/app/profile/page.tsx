"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      router.push("/");
    },
  });
  
  const [name, setName] = useState("");
  const [gradeOrAge, setGradeOrAge] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/profile")
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
          } else {
            setName(data.name || session?.user?.name || "");
            setGradeOrAge(data.gradeOrAge || "");
            setPurpose(data.purpose || "");
          }
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [status, session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradeOrAge, purpose }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update profile");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="animate-pulse text-foreground-muted">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-border p-8 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold mb-6">Your Profile</h1>

        {error && (
          <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-sm mb-6 border border-red-500/20">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 text-green-500 p-3 rounded-lg text-sm mb-6 border border-green-500/20">
            Profile updated successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input 
              type="text" 
              disabled 
              value={name}
              className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground-muted cursor-not-allowed"
            />
            <p className="text-xs text-foreground-muted mt-1">Name is linked to your Google account.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Grade or Age <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              required
              value={gradeOrAge}
              onChange={(e) => setGradeOrAge(e.target.value)}
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
              className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <button 
            type="submit" 
            disabled={saving}
            className="w-full bg-primary text-primary-foreground font-medium py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 mt-4"
          >
            {saving ? "Saving..." : "Update Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}
