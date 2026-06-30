/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Goals from './pages/Goals';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthUser } from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('taskpilot_demo_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || 'Pilot',
          photoURL: currentUser.photoURL || ''
        });
        localStorage.removeItem('taskpilot_demo_user');
      } else {
        const saved = localStorage.getItem('taskpilot_demo_user');
        if (saved) {
          setUser(JSON.parse(saved));
        } else {
          setUser(null);
        }
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <Layout 
      currentTab={currentTab} 
      setCurrentTab={setCurrentTab}
      user={user}
      setUser={setUser}
      authLoading={authLoading}
    >
      {currentTab === 'dashboard' && <Dashboard user={user} />}
      {currentTab === 'tasks' && <Tasks user={user} />}
      {currentTab === 'goals' && <Goals user={user} />}
    </Layout>
  );
}
