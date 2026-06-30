/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, signInWithGoogle, logoutUser, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { LayoutDashboard, ListTodo, Target, MessageSquareCode, LogIn, LogOut, ChevronLeft, ChevronRight, User as UserIcon } from 'lucide-react';
import CompanionChat from './CompanionChat';
import { AuthUser } from '../types';

interface LayoutProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  authLoading: boolean;
  children: React.ReactNode;
}

export default function Layout({ currentTab, setCurrentTab, user, setUser, authLoading, children }: LayoutProps) {
  const [chatOpen, setChatOpen] = useState(true);
  const [signInError, setSignInError] = useState<string | null>(null);

  // Authenticate & Sync User Profile with Firestore
  useEffect(() => {
    if (user && !user.isDemo) {
      // Automatically ensure the user profile is written to Firestore as per data models
      const userRef = doc(db, 'users', user.uid);
      setDoc(userRef, {
        uid: user.uid,
        email: user.email || 'demo.pilot@taskpilot.ai',
        displayName: user.displayName || 'Demo Pilot',
        photoURL: user.photoURL || '',
        createdAt: new Date().toISOString()
      }, { merge: true }).catch((error) => {
        console.warn("Could not sync user profile to Firestore (could be offline/demo database):", error);
      });
    }
  }, [user]);

  const handleSignIn = async () => {
    setSignInError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Google sign-in error", err);
      if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed-by-user')) {
        setSignInError("Google login popup was blocked/closed by your browser or iframe security rules. Use 'Demo Pilot' login below to bypass!");
      } else {
        setSignInError("Google login is restricted in this preview. Use 'Demo Pilot' login below!");
      }
    }
  };

  const handleDemoSignIn = () => {
    setSignInError(null);
    const demoUser: AuthUser = {
      uid: 'demo-pilot-user',
      email: 'demo.pilot@taskpilot.ai',
      displayName: 'Demo Pilot',
      photoURL: '',
      isDemo: true
    };
    try {
      localStorage.setItem('taskpilot_demo_user', JSON.stringify(demoUser));
      setUser(demoUser);
    } catch (err) {
      console.error("Demo sign-in error", err);
      setSignInError("Failed to sign in as Demo Pilot. Please try again.");
    }
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('taskpilot_demo_user');
      await logoutUser();
      setUser(null);
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
    { id: 'tasks', label: 'Flight Plan (Tasks)', icon: ListTodo },
    { id: 'goals', label: 'Vectors & Routines', icon: Target }
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans" id="app_layout">
      
      {/* Side rail panel */}
      <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0" id="layout_siderail">
        {/* Logo Section */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            TP
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">TaskPilot</h1>
            <span className="block text-[9px] font-mono text-indigo-400 uppercase tracking-widest mt-0.5">v1.0.0-beta</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-mono font-medium transition cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white border border-indigo-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-500'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Project Scaffold */}
        <div className="flex-1 px-3 py-2 overflow-y-auto border-t border-slate-800">
          <div className="mb-4">
            <h2 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 px-2">Project Scaffold</h2>
            <ul className="space-y-1 font-mono text-[10px] text-slate-400">
              <li className="flex items-center gap-2 px-2 py-0.5 bg-slate-800/50 rounded text-slate-200 border-l-2 border-indigo-500">
                <span className="opacity-50">📂</span> src/
              </li>
              <li className="flex items-center gap-2 px-4 py-0.5"><span className="opacity-50">📂</span> server/agent.ts</li>
              <li className="flex items-center gap-2 px-4 py-0.5"><span className="opacity-50">📂</span> firebase.ts</li>
              <li className="flex items-center gap-2 px-4 py-0.5"><span className="opacity-50">📂</span> components/</li>
              <li className="flex items-center gap-2 px-4 py-0.5"><span className="opacity-50">📂</span> pages/</li>
              <li className="flex items-center gap-2 px-4 py-0.5"><span className="opacity-50">📄</span> App.tsx</li>
            </ul>
          </div>
        </div>

        {/* Firestore Usage Block */}
        <div className="mt-auto p-3 bg-slate-950/40 border-t border-slate-800 space-y-3">
          <div className="p-2.5 rounded bg-slate-800/40 border border-slate-700/50">
            <div className="text-[9px] text-slate-500 mb-1 font-bold">FIRESTORE USAGE</div>
            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
              <div className="w-[12%] h-full bg-indigo-500"></div>
            </div>
            <div className="flex justify-between mt-1 text-[9px] font-mono">
              <span>0.12 GB</span>
              <span>50 GB</span>
            </div>
          </div>

          {/* User Auth Info */}
          <div className="pt-1">
            {authLoading ? (
              <div className="text-center py-1 text-xs font-mono text-slate-600 animate-pulse">Syncing...</div>
            ) : user ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-slate-850 p-1.5 rounded border border-slate-800">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'User'} referrerPolicy="no-referrer" className="w-6 h-6 rounded border border-slate-700 shadow-sm" />
                  ) : (
                    <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                      <UserIcon className="w-3 h-3" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-200 truncate leading-none">{user.displayName || 'Demo Pilot'}</p>
                    <p className="text-[9px] text-slate-500 font-mono truncate mt-0.5">{user.email || 'demo.pilot@taskpilot.ai'}</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-mono text-[9px] py-1.5 rounded transition cursor-pointer border border-slate-800"
                >
                  <LogOut className="w-3 h-3" />
                  Dismount
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <button
                  onClick={handleSignIn}
                  className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[9px] font-semibold py-2 rounded transition cursor-pointer shadow-md shadow-indigo-500/10"
                >
                  <LogIn className="w-3 h-3" />
                  Google Sign-In
                </button>
                <button
                  onClick={handleDemoSignIn}
                  className="w-full flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 font-mono text-[9px] font-semibold py-2 rounded transition cursor-pointer border border-slate-700/50"
                >
                  <UserIcon className="w-3 h-3 text-emerald-400" />
                  Sign In as Demo Pilot
                </button>
                {signInError && (
                  <p className="text-[8px] text-amber-400 leading-tight bg-slate-950/80 p-1.5 rounded border border-amber-500/20 font-mono">
                    {signInError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Body Frame */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Upper Header */}
        <header className="h-14 bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 px-6 flex justify-between items-center shrink-0 z-20 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-400">Gemini Engine: READY</span>
          </div>

          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded transition cursor-pointer"
          >
            <MessageSquareCode className="w-3.5 h-3.5 text-indigo-400" />
            {chatOpen ? 'Hide Co-Pilot' : 'Show Co-Pilot'}
          </button>
        </header>

        {/* Content Box */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950 relative">
          {children}
        </main>

        {/* Diagnostic Footer */}
        <footer className="h-8 border-t border-slate-800 bg-slate-900 flex items-center px-4 justify-between text-[10px] text-slate-500 font-mono shrink-0">
          <div className="flex items-center gap-4">
            <span>STATUS: STABLE</span>
            <span className="text-slate-700">//</span>
            <span>REGION: us-central1</span>
            <span className="text-slate-700">//</span>
            <span>AUTH: GOOGLE_OIDC</span>
          </div>
          <div className="truncate max-w-xs md:max-w-md">
            LOG: [{new Date().toLocaleTimeString()}] Telemetry updated successfully.
          </div>
        </footer>
      </div>

      {/* Right companion chat panel */}
      {chatOpen && (
        <div className="w-96 shrink-0 h-full">
          <CompanionChat />
        </div>
      )}
    </div>
  );
}
