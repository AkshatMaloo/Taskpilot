/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Goal, Habit, HabitFrequency, GoalStatus, AuthUser } from '../types';
import { Target, Flame, Plus, Trash, Check, CheckCircle, TrendingUp, Sparkles, PlusCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface GoalsProps {
  user: AuthUser | null;
}

export default function Goals({ user }: GoalsProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states for Goals
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDesc, setGoalDesc] = useState('');
  const [targetDate, setTargetDate] = useState('2026-08-01');

  // Form states for Habits
  const [habitTitle, setHabitTitle] = useState('');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');

  useEffect(() => {
    const loadLocal = () => {
      if (!user || user.isDemo) {
        try {
          const localGoals = localStorage.getItem('taskpilot_goals');
          const localHabits = localStorage.getItem('taskpilot_habits');

          setGoals(localGoals ? JSON.parse(localGoals) : getDemoGoals());
          setHabits(localHabits ? JSON.parse(localHabits) : getDemoHabits());
        } catch {
          setGoals(getDemoGoals());
          setHabits(getDemoHabits());
        }
        setLoading(false);
      }
    };

    loadLocal();
    window.addEventListener('taskpilot_data_changed', loadLocal);

    if (!user || user.isDemo) {
      return () => {
        window.removeEventListener('taskpilot_data_changed', loadLocal);
      };
    }

    setLoading(true);

    // Subscribe Goals
    const qGoals = query(collection(db, 'goals'), where('userId', '==', user.uid));
    const unsubscribeGoals = onSnapshot(qGoals, (snapshot) => {
      const fetchedGoals: Goal[] = [];
      snapshot.forEach((doc) => {
        fetchedGoals.push({ id: doc.id, ...doc.data() } as Goal);
      });
      setGoals(fetchedGoals.length > 0 ? fetchedGoals : getDemoGoals());
    });

    // Subscribe Habits
    const qHabits = query(collection(db, 'habits'), where('userId', '==', user.uid));
    const unsubscribeHabits = onSnapshot(qHabits, (snapshot) => {
      const fetchedHabits: Habit[] = [];
      snapshot.forEach((doc) => {
        fetchedHabits.push({ id: doc.id, ...doc.data() } as Habit);
      });
      setHabits(fetchedHabits.length > 0 ? fetchedHabits : getDemoHabits());
      setLoading(false);
    });

    return () => {
      window.removeEventListener('taskpilot_data_changed', loadLocal);
      unsubscribeGoals();
      unsubscribeHabits();
    };
  }, [user]);

  function getDemoGoals(): Goal[] {
    return [
      {
        id: 'g1',
        userId: 'demo',
        title: 'Launch TaskPilot App V1',
        description: 'Deploy full-stack product and acquire initial users.',
        targetDate: '2026-08-01',
        status: 'active',
        createdAt: '2026-06-20T00:00:00.000Z'
      },
      {
        id: 'g2',
        userId: 'demo',
        title: 'Build Daily Deep Work Habits',
        description: 'Consistently log at least 4 hours of focused coding without distractions.',
        targetDate: '2026-07-15',
        status: 'active',
        createdAt: '2026-06-25T00:00:00.000Z'
      }
    ];
  }

  function getDemoHabits(): Habit[] {
    return [
      {
        id: 'h1',
        userId: 'demo',
        title: '4 Hours of Deep Focus',
        frequency: 'daily',
        streakCount: 5,
        lastCompletedDate: '2026-06-29',
        createdAt: new Date().toISOString()
      },
      {
        id: 'h2',
        userId: 'demo',
        title: 'Weekly Progress Review',
        frequency: 'weekly',
        streakCount: 2,
        lastCompletedDate: '2026-06-25',
        createdAt: new Date().toISOString()
      }
    ];
  }

  // Handle Goal addition
  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;

    const newGoal: Omit<Goal, 'id'> = {
      userId: user ? user.uid : 'demo',
      title: goalTitle,
      description: goalDesc,
      targetDate,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    if (user && !user.isDemo) {
      try {
        await addDoc(collection(db, 'goals'), newGoal);
      } catch (error) {
        console.error("Error adding goal:", error);
      }
    } else {
      const localGoal: Goal = { id: Math.random().toString(36).substr(2, 9), ...newGoal };
      setGoals(prev => {
        const next = [localGoal, ...prev];
        localStorage.setItem('taskpilot_goals', JSON.stringify(next));
        return next;
      });
    }

    setGoalTitle('');
    setGoalDesc('');
  };

  // Toggle Goal status
  const handleToggleGoal = async (goalId: string, currentStatus: GoalStatus) => {
    const newStatus: GoalStatus = currentStatus === 'active' ? 'completed' : 'active';
    if (user && !user.isDemo && goalId.length > 5) {
      try {
        await updateDoc(doc(db, 'goals', goalId), { status: newStatus });
      } catch (error) {
        console.error("Error updating goal status:", error);
      }
    } else {
      setGoals(prev => {
        const next = prev.map(g => g.id === goalId ? { ...g, status: newStatus } : g);
        localStorage.setItem('taskpilot_goals', JSON.stringify(next));
        return next;
      });
    }
    window.dispatchEvent(new Event('taskpilot_data_changed'));
  };

  // Delete Goal
  const handleDeleteGoal = async (goalId: string) => {
    if (user && !user.isDemo && goalId.length > 5) {
      try {
        await deleteDoc(doc(db, 'goals', goalId));
      } catch (error) {
        console.error("Error deleting goal:", error);
      }
    } else {
      setGoals(prev => {
        const next = prev.filter(g => g.id !== goalId);
        localStorage.setItem('taskpilot_goals', JSON.stringify(next));
        return next;
      });
    }
    window.dispatchEvent(new Event('taskpilot_data_changed'));
  };

  // Handle Habit addition
  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitTitle.trim()) return;

    const newHabit: Omit<Habit, 'id'> = {
      userId: user ? user.uid : 'demo',
      title: habitTitle,
      frequency,
      streakCount: 0,
      createdAt: new Date().toISOString()
    };

    if (user && !user.isDemo) {
      try {
        await addDoc(collection(db, 'habits'), newHabit);
      } catch (error) {
        console.error("Error adding habit:", error);
      }
    } else {
      const localHabit: Habit = { id: Math.random().toString(36).substr(2, 9), ...newHabit };
      setHabits(prev => {
        const next = [localHabit, ...prev];
        localStorage.setItem('taskpilot_habits', JSON.stringify(next));
        return next;
      });
    }

    setHabitTitle('');
  };

  // Log Habit completion (increase streak)
  const handleLogHabit = async (habitId: string, currentStreak: number) => {
    const newStreak = currentStreak + 1;
    const today = new Date().toISOString().split('T')[0];

    if (user && !user.isDemo && habitId.length > 5) {
      try {
        await updateDoc(doc(db, 'habits', habitId), {
          streakCount: newStreak,
          lastCompletedDate: today
        });
      } catch (error) {
        console.error("Error updating habit streak:", error);
      }
    } else {
      setHabits(prev => {
        const next = prev.map(h => h.id === habitId ? { ...h, streakCount: newStreak, lastCompletedDate: today } : h);
        localStorage.setItem('taskpilot_habits', JSON.stringify(next));
        return next;
      });
    }
    window.dispatchEvent(new Event('taskpilot_data_changed'));
  };

  // Delete Habit
  const handleDeleteHabit = async (habitId: string) => {
    if (user && !user.isDemo && habitId.length > 5) {
      try {
        await deleteDoc(doc(db, 'habits', habitId));
      } catch (error) {
        console.error("Error deleting habit:", error);
      }
    } else {
      setHabits(prev => {
        const next = prev.filter(h => h.id !== habitId);
        localStorage.setItem('taskpilot_habits', JSON.stringify(next));
        return next;
      });
    }
    window.dispatchEvent(new Event('taskpilot_data_changed'));
  };

  // Compute Goal milestone duration progress bar percentage
  const getGoalProgress = (goal: Goal) => {
    if (goal.status === 'completed') return 100;
    const start = new Date(goal.createdAt || '2026-06-25').getTime();
    const target = new Date(goal.targetDate).getTime();
    const today = new Date('2026-06-30').getTime();
    if (today >= target) return 95; // cap before actual completion
    const elapsed = today - start;
    const total = target - start;
    if (total <= 0) return 0;
    return Math.min(Math.max(Math.round((elapsed / total) * 100), 10), 95);
  };

  return (
    <div className="space-y-6 font-sans text-slate-200" id="goals_habits_page">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-400" />
          Vectors & Routines (Goals & Habits)
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure high-level objectives, synchronize long-term vectors, and build strong daily streaks.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Long-term Objectives with dynamic progress bars */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded p-4 shadow-sm">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5 mb-3 border-b border-slate-850 pb-2">
              <Target className="w-4 h-4 text-indigo-400" />
              Objectives (Goals Progress Tracker)
            </h2>

            {/* Form to add objective */}
            <form onSubmit={handleAddGoal} className="space-y-3 mb-4 p-3 bg-slate-950/60 rounded border border-slate-850/60">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Goal Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Master React 19"
                    required
                    value={goalTitle}
                    onChange={e => setGoalTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Target Milestone Date</label>
                  <input
                    type="date"
                    required
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Description</label>
                <input
                  type="text"
                  placeholder="What key outcomes determine success?"
                  value={goalDesc}
                  onChange={e => setGoalDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[10px] font-semibold py-1.5 rounded transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-500/15"
              >
                <Plus className="w-3.5 h-3.5" />
                Synchronize Objective
              </button>
            </form>

            {/* Objectives lists */}
            <div className="space-y-3">
              {goals.map((goal) => {
                const progress = getGoalProgress(goal);
                return (
                  <div 
                    key={goal.id} 
                    className={`p-3.5 rounded border flex flex-col gap-3 transition ${
                      goal.status === 'completed' 
                        ? 'bg-emerald-950/10 border-emerald-900/30 opacity-70' 
                        : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={() => handleToggleGoal(goal.id, goal.status)}
                          className={`mt-0.5 p-0.5 rounded border flex items-center justify-center transition cursor-pointer ${
                            goal.status === 'completed'
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                              : 'border-slate-800 hover:border-indigo-500 hover:bg-indigo-500/5 text-transparent'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <div>
                          <h3 className={`text-xs font-semibold ${goal.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                            {goal.title}
                          </h3>
                          {goal.description && <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{goal.description}</p>}
                          <span className="inline-block mt-1 text-[9px] font-mono bg-slate-900/60 border border-slate-850 text-slate-500 px-1.5 py-0.5 rounded">
                            Target: {goal.targetDate}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="text-slate-600 hover:text-rose-400 p-1 rounded hover:bg-slate-900 transition cursor-pointer"
                        title="Delete Goal"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Progress Bar for goals */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-mono text-slate-500">
                        <span>Milestone Distance</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Habits & Routines with visual streak bullet indicators */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded p-4 shadow-sm">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5 mb-3 border-b border-slate-850 pb-2">
              <Flame className="w-4 h-4 text-amber-400" />
              Daily Routines (Habit Streaks)
            </h2>

            {/* Form to add habit */}
            <form onSubmit={handleAddHabit} className="space-y-3 mb-4 p-3 bg-slate-950/60 rounded border border-slate-850/60">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Habit Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Read research paper"
                    required
                    value={habitTitle}
                    onChange={e => setHabitTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={e => setFrequency(e.target.value as HabitFrequency)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 transition"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-mono text-[10px] font-semibold py-1.5 rounded transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-amber-500/15"
              >
                <Flame className="w-3.5 h-3.5" />
                Launch Streak Tracker
              </button>
            </form>

            {/* Habits list with streak counter bars and markers */}
            <div className="space-y-3">
              {habits.map((habit) => {
                const completedToday = habit.lastCompletedDate === new Date().toISOString().split('T')[0];
                
                // Show 7 visual streak bullets
                const streakMarkers = Array.from({ length: 7 }, (_, idx) => {
                  const active = habit.streakCount > idx;
                  return (
                    <span 
                      key={idx} 
                      className={`w-1.5 h-3 rounded-sm ${
                        active 
                          ? 'bg-amber-500 shadow shadow-amber-500/20' 
                          : 'bg-slate-800'
                      }`}
                    />
                  );
                });

                return (
                  <div 
                    key={habit.id} 
                    className="p-3.5 rounded bg-slate-950/40 border border-slate-800 hover:border-slate-700 transition flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => handleLogHabit(habit.id, habit.streakCount)}
                          disabled={completedToday}
                          className={`p-1.5 rounded border flex items-center justify-center transition cursor-pointer ${
                            completedToday
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                              : 'border-slate-800 hover:border-amber-500/50 hover:bg-amber-500/5 text-slate-400 hover:text-amber-400'
                          }`}
                          title={completedToday ? 'Completed Today!' : 'Mark Completed'}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                        <div>
                          <h3 className="text-xs font-semibold text-slate-200">{habit.title}</h3>
                          <p className="text-[9px] font-mono text-slate-500 uppercase mt-0.5">{habit.frequency} Routine</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Streak counter badge */}
                        <div className="flex items-center gap-1 text-amber-400 font-mono text-[10px] bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                          <Flame className="w-3 h-3 fill-amber-400" />
                          Streak: {habit.streakCount}
                        </div>

                        <button
                          onClick={() => handleDeleteHabit(habit.id)}
                          className="text-slate-600 hover:text-rose-400 p-1 rounded hover:bg-slate-900 transition cursor-pointer"
                          title="Delete Habit"
                        >
                          <Trash className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Dotted/Bullet Streak Tracker View */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                      <span className="text-[9px] font-mono text-slate-500 uppercase">Streak Momentum (7d)</span>
                      <div className="flex gap-1">
                        {streakMarkers}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
