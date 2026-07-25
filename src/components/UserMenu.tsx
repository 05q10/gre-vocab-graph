"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { UserCircleIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function UserMenu() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!session?.user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 focus:outline-none hover:bg-surface-elevated p-1 rounded-full transition-colors border border-transparent hover:border-border"
      >
        {session.user.image ? (
          <img src={session.user.image} alt="Profile" className="w-8 h-8 rounded-full border border-border" />
        ) : (
          <UserCircleIcon className="w-8 h-8 text-foreground-muted" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-surface-elevated border border-border rounded-xl shadow-xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium text-foreground truncate">{session.user.name}</p>
            <p className="text-xs text-foreground-muted truncate">{session.user.email}</p>
          </div>
          <div className="p-2 space-y-1">
            <Link 
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-foreground hover:bg-surface rounded-lg transition-colors"
            >
              <UserCircleIcon className="w-4 h-4" />
              <span>Profile settings</span>
            </Link>
            <button 
              onClick={() => signOut({ callbackUrl: '/' })}
              className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
