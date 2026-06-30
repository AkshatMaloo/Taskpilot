/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, limit, doc, updateDoc, addDoc } from 'firebase/firestore';
import { Task, Goal, Habit, AuthUser, Subtask } from '../types';
import { 
  CheckSquare, Flame, Target, Sparkles, TrendingUp, AlertCircle, Clock, 
  Play, CheckCircle2, Award, Calendar, Zap, ListTodo 
} from 'lucide-react';
import { motion } from 'motion/react';
import GanttTimeline from '../components/GanttTimeline';
import ReflectionModal from '../components/ReflectionModal';

interface DashboardProps {
  user: AuthUser | null;
}

export default function Dashboard({ user }: DashboardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUsingDemo, setIsUsingDemo] = useState(false);
  const [reflectionTask, setReflectionTask] = useState<Task | null>(null);

  // Load state
  useEffect(() => {
    const loadLocal = () => {
      if (!user || user.isDemo) {
        try {
          const localTasks = localStorage.getItem('taskpilot_tasks');
          const localGoals = localStorage.getItem('taskpilot_goals');
          const localHabits = localStorage.getItem('taskpilot_habits');
          const localSubs = localStorage.getItem('taskpilot_subtasks');

          setTasks(localTasks ? JSON.parse(localTasks) : getSampleTasks());
          setGoals(localGoals ? JSON.parse(localGoals) : getSampleGoals());
          setHabits(localHabits ? JSON.parse(localHabits) : getSampleHabits());
          setSubtasks(localSubs ? JSON.parse(localSubs) : getSampleSubtasks());
        } catch {
          setDemoData();
        }
        setIsUsingDemo(true);
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
    setIsUsingDemo(false);

    // Fetch tasks
    const qTasks = query(collection(db, 'tasks'), where('userId', '==', user.uid));
    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      const fetchedTasks: Task[] = [];
      snapshot.forEach((doc) => {
        fetchedTasks.push({ id: doc.id, ...doc.data() } as Task);
      });
      
      if (fetchedTasks.length > 0) {
        setTasks(fetchedTasks);
      } else {
        setTasks(getSampleTasks());
        setIsUsingDemo(true);
      }
    }, (error) => {
      console.error("Error subscribing to tasks:", error);
      setTasks(getSampleTasks());
      setIsUsingDemo(true);
    });

    // Fetch goals
    const qGoals = query(collection(db, 'goals'), where('userId', '==', user.uid), limit(5));
    const unsubscribeGoals = onSnapshot(qGoals, (snapshot) => {
      const fetchedGoals: Goal[] = [];
      snapshot.forEach((doc) => {
        fetchedGoals.push({ id: doc.id, ...doc.data() } as Goal);
      });
      if (fetchedGoals.length > 0) setGoals(fetchedGoals);
      else setGoals(getSampleGoals());
    });

    // Fetch habits
    const qHabits = query(collection(db, 'habits'), where('userId', '==', user.uid), limit(5));
    const unsubscribeHabits = onSnapshot(qHabits, (snapshot) => {
      const fetchedHabits: Habit[] = [];
      snapshot.forEach((doc) => {
        fetchedHabits.push({ id: doc.id, ...doc.data() } as Habit);
      });
      if (fetchedHabits.length > 0) setHabits(fetchedHabits);
      else setHabits(getSampleHabits());
    });

    // Fetch subtasks
    const qSubs = query(collection(db, 'subtasks'), where('userId', '==', user.uid));
    const unsubscribeSubs = onSnapshot(qSubs, (snapshot) => {
      const fetchedSubs: Subtask[] = [];
      snapshot.forEach((doc) => {
        fetchedSubs.push({ id: doc.id, ...doc.data() } as Subtask);
      });
      if (fetchedSubs.length > 0) setSubtasks(fetchedSubs);
      else {
        // Fallback to local storage or defaults
        const localSubs = localStorage.getItem('taskpilot_subtasks');
        setSubtasks(localSubs ? JSON.parse(localSubs) : getSampleSubtasks());
      }
      setLoading(false);
    });

    return () => {
      window.removeEventListener('taskpilot_data_changed', loadLocal);
      unsubscribeTasks();
      unsubscribeGoals();
      unsubscribeHabits();
      unsubscribeSubs();
    };
  }, [user]);

  function setDemoData() {
    setTasks(getSampleTasks());
    setGoals(getSampleGoals());
    setHabits(getSampleHabits());
    setSubtasks(getSampleSubtasks());
    setIsUsingDemo(true);
  }

  function getSampleTasks(): Task[] {
    return [
      {
        id: '1',
        userId: 'demo',
        title: 'Review production migration plan',
        description: 'Ensure Spanner backups and Firestore rule sets are strictly validated.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-07-02',
        urgency: 9,
        importance: 8,
        effortEstimate: 2.5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '2',
        userId: 'demo',
        title: 'Draft presentation slides for kickoff',
        description: 'Focus on scaling strategies and TaskPilot agentic architecture.',
        status: 'todo',
        priority: 'medium',
        dueDate: '2026-07-05',
        urgency: 6,
        importance: 7,
        effortEstimate: 4.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '3',
        userId: 'demo',
        title: 'Audit application telemetry configurations',
        description: 'Check metrics reporting logs and clean up any console warnings.',
        status: 'done',
        priority: 'low',
        dueDate: '2026-06-29',
        urgency: 3,
        importance: 5,
        effortEstimate: 1.5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  function getSampleGoals(): Goal[] {
    return [
      {
        id: 'g1',
        userId: 'demo',
        title: 'Launch TaskPilot App V1',
        description: 'Deploy full-stack product and acquire initial users.',
        targetDate: '2026-08-01',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: 'g2',
        userId: 'demo',
        title: 'Build Daily Deep Work Habits',
        description: 'Consistently log at least 4 hours of focused coding without distractions.',
        targetDate: '2026-07-15',
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ];
  }

  function getSampleHabits(): Habit[] {
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

  function getSampleSubtasks(): Subtask[] {
    return [
      {
        id: 's-sub1',
        taskId: '1',
        title: 'Verify Firestore rules against blueprint configurations',
        completed: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 's-sub2',
        taskId: '1',
        title: 'Trigger Spanner dry-run backup scripts',
        completed: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 's-sub3',
        taskId: '2',
        title: 'Design bento layouts for slide 3 & 4',
        completed: false,
        createdAt: new Date().toISOString()
      }
    ];
  }

  const calculatePriorityScore = (task: Task) => {
    return task.urgency * task.importance * task.effortEstimate;
  };

  // Toggle subtask completion
  const handleToggleSubtask = async (subId: string) => {
    const updated = subtasks.map(s => s.id === subId ? { ...s, completed: !s.completed } : s);
    setSubtasks(updated);
    
    if (user && !user.isDemo) {
      try {
        await updateDoc(doc(db, 'subtasks', subId), {
          completed: !subtasks.find(s => s.id === subId)?.completed
        });
      } catch (err) {
        console.error("Could not sync subtask toggle", err);
      }
    } else {
      localStorage.setItem('taskpilot_subtasks', JSON.stringify(updated));
      window.dispatchEvent(new Event('taskpilot_data_changed'));
    }
  };

  // Update task status (e.g., done or in progress)
  const handleUpdateTaskStatus = async (taskId: string, newStatus: 'todo' | 'in_progress' | 'done') => {
    const updated = tasks.map(t => t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t);
    setTasks(updated);

    if (user && !user.isDemo) {
      try {
        await updateDoc(doc(db, 'tasks', taskId), {
          status: newStatus,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Could not sync task status update", err);
      }
    } else {
      localStorage.setItem('taskpilot_tasks', JSON.stringify(updated));
      window.dispatchEvent(new Event('taskpilot_data_changed'));
    }
  };

  const handleSaveReflection = async (actualTime: number, notes: string) => {
    if (!reflectionTask) return;
    const taskId = reflectionTask.id;
    
    const updated = tasks.map(t => t.id === taskId ? { 
      ...t, 
      status: 'done' as 'done', 
      actualTimeSpent: actualTime,
      reflectionNotes: notes,
      updatedAt: new Date().toISOString() 
    } : t);
    setTasks(updated);

    if (user && !user.isDemo) {
      try {
        await updateDoc(doc(db, 'tasks', taskId), {
          status: 'done',
          actualTimeSpent: actualTime,
          reflectionNotes: notes,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Could not sync task reflection update", err);
      }
    } else {
      localStorage.setItem('taskpilot_tasks', JSON.stringify(updated));
    }
    setReflectionTask(null);
    window.dispatchEvent(new Event('taskpilot_data_changed'));
  };

  // Evaluate Risk Level for Today's Focus Cards
  const getTaskRisk = (task: Task) => {
    if (task.status === 'done') {
      return { level: 'on-track', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'On Track (Landed)' };
    }
    
    // Calculate days remaining from consistent benchmark date 2026-06-30
    const today = new Date('2026-06-30');
    const due = new Date(task.dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { level: 'critical', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', label: 'Overdue' };
    } else if (diffDays <= 1) {
      if (task.effortEstimate > 4) {
        return { level: 'critical', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', label: 'Critical Risk (Due Soon, High Effort)' };
      }
      return { level: 'at-risk', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'At Risk (Due Soon)' };
    } else if (diffDays <= 3) {
      if (task.effortEstimate > 8) {
        return { level: 'at-risk', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'At Risk (Tight Timeline)' };
      }
      return { level: 'on-track', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'On Track' };
    }
    return { level: 'on-track', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Comfortable' };
  };

  // Filter out completed tasks first for "Today's Focus", or keep if less than 3
  const activeFocusTasks = [...tasks]
    .filter(t => t.status !== 'done')
    .sort((a, b) => calculatePriorityScore(b) - calculatePriorityScore(a))
    .slice(0, 3);

  // If there are less than 3 active focus tasks, supplement with completed ones for visual layout completeness
  if (activeFocusTasks.length < 3) {
    const completedTasks = tasks
      .filter(t => t.status === 'done')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    
    for (const t of completedTasks) {
      if (activeFocusTasks.length < 3 && !activeFocusTasks.find(x => x.id === t.id)) {
        activeFocusTasks.push(t);
      }
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 font-sans text-slate-200" id="dashboard_loading_skeleton">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-2">
            <div className="h-6 w-64 bg-slate-800 rounded animate-pulse" />
            <div className="h-3.5 w-96 bg-slate-800 rounded animate-pulse" />
          </div>
          <div className="h-8 w-40 bg-slate-800 rounded animate-pulse" />
        </div>

        {/* Metric Cards Skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="p-4 bg-slate-900 border border-slate-800 rounded h-24 space-y-2 animate-pulse">
              <div className="h-3 w-1/3 bg-slate-800 rounded" />
              <div className="h-7 w-1/2 bg-slate-800 rounded" />
              <div className="h-3.5 w-2/3 bg-slate-800 rounded" />
            </div>
          ))}
        </div>

        {/* Focus Plan Header Skeleton */}
        <div className="space-y-3">
          <div className="h-5 w-80 bg-slate-800 rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 rounded p-4 h-64 flex flex-col justify-between space-y-4 animate-pulse">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <div className="h-4 w-1/3 bg-slate-800 rounded" />
                    <div className="h-4 w-12 bg-slate-800 rounded" />
                  </div>
                  <div className="h-5 w-2/3 bg-slate-800 rounded" />
                  <div className="h-3.5 w-full bg-slate-800 rounded" />
                  <div className="h-8 w-full bg-slate-950/40 border border-slate-850 rounded" />
                </div>
                <div className="h-8 bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans text-slate-200" id="dashboard_page">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            TaskPilot Command Center <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {user ? `Welcome back, ${user.displayName || 'Pilot'}. Your flight telemetry is fully synchronized.` : 'Welcome, Guest. Sign in with Google to enable persistent AI-powered scheduling.'}
          </p>
        </div>
        {isUsingDemo && (
          <div className="flex items-center gap-2 bg-slate-900 border border-amber-500/30 text-amber-300 px-3 py-1.5 rounded text-[10px] font-mono">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            DEMO SANDBOX ACTIVE
          </div>
        )}
      </div>

      {/* Metric Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded relative overflow-hidden">
          <span className="text-[10px] text-slate-500 font-mono block">ACTIVE IN-FLIGHT PLAN:</span>
          <p className="text-2xl font-bold text-white mt-1">
            {tasks.filter(t => t.status !== 'done').length} <span className="text-xs text-slate-500 font-normal">tasks</span>
          </p>
          <div className="text-[10px] text-indigo-400 font-mono mt-1">Ready for vector adjustments</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded relative overflow-hidden">
          <span className="text-[10px] text-slate-500 font-mono block">STREAK VELOCITY:</span>
          <p className="text-2xl font-bold text-white mt-1">
            {habits.reduce((acc, h) => acc + h.streakCount, 0)} <span className="text-xs text-slate-500 font-normal">days total</span>
          </p>
          <div className="text-[10px] text-emerald-400 font-mono mt-1">Active routines on track</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded relative overflow-hidden">
          <span className="text-[10px] text-slate-500 font-mono block">PILOT CO-PILOT SYNC:</span>
          <p className="text-2xl font-bold text-indigo-400 mt-1 flex items-center gap-1.5">
            <Zap className="w-4 h-4 fill-indigo-500 animate-pulse" />
            100% SECURE
          </p>
          <div className="text-[10px] text-slate-500 font-mono mt-1">Connected to us-central1</div>
        </div>
      </div>

      {/* Today's Focus Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-400" />
            TODAY'S AI-SELECTED FOCUS PLAN (TOP 3 ACTIONS)
          </h2>
          <span className="text-[10px] text-slate-500 font-mono">Sorted by calculated priority vector</span>
        </div>

        {activeFocusTasks.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-800 rounded text-slate-500 text-xs font-mono">
            No focus tasks found. Use the Co-Pilot panel to prioritize or create tasks!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="todays_focus_dashboard">
            {activeFocusTasks.map((task, idx) => {
              const risk = getTaskRisk(task);
              const score = calculatePriorityScore(task);
              const taskSubs = subtasks.filter(s => s.taskId === task.id);
              const completedSubs = taskSubs.filter(s => s.completed).length;
              const subPercent = taskSubs.length > 0 ? Math.round((completedSubs / taskSubs.length) * 100) : 0;

              return (
                <motion.div
                  key={task.id}
                  whileHover={{ y: -2 }}
                  className="bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 rounded p-4 flex flex-col justify-between shadow-md relative overflow-hidden"
                >
                  {/* Badge Number Indicator */}
                  <div className="absolute top-2 right-2 text-[20px] font-mono font-black text-slate-800 select-none pointer-events-none">
                    0{idx + 1}
                  </div>

                  <div className="space-y-3">
                    {/* Risk Indicator pill */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] px-2 py-0.5 rounded border font-mono font-bold uppercase tracking-wider ${risk.color}`}>
                        {risk.label}
                      </span>
                      <span className="text-[10px] text-indigo-400 font-mono font-bold bg-indigo-500/5 border border-indigo-500/10 px-1.5 py-0.2 rounded">
                        {score.toFixed(0)} Pts
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight line-clamp-1">{task.title}</h3>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed h-8">
                        {task.description || "No supplemental coordinates provided."}
                      </p>
                    </div>

                    {/* Meta values */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-950/50 p-2 rounded border border-slate-850/60 text-[10px] font-mono">
                      <div>
                        <span className="text-slate-500 block">DUE_DATE:</span>
                        <span className="text-slate-300 font-bold">{task.dueDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">EFFORT_LEFT:</span>
                        <span className="text-slate-300 font-bold">{task.effortEstimate} Hours</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-mono text-slate-500">
                        <span>Roadmap Execution</span>
                        <span>{subPercent}% ({completedSubs}/{taskSubs.length})</span>
                      </div>
                      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${subPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Performance Retrospective comparison summary for Landed/Done Tasks */}
                  {task.status === 'done' && (
                    <div className="mt-2.5 p-2 bg-slate-950/60 border border-slate-850/80 rounded space-y-1.5 text-slate-300 text-[11px]">
                      <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 uppercase">
                        <span>Retrospective Metrics:</span>
                        <span className={`px-1 rounded text-[8px] font-bold ${
                          !task.actualTimeSpent ? 'text-slate-400 bg-slate-800' :
                          task.actualTimeSpent < task.effortEstimate ? 'text-emerald-400 bg-emerald-500/10' :
                          task.actualTimeSpent === task.effortEstimate ? 'text-indigo-400 bg-indigo-500/10' :
                          'text-amber-400 bg-amber-500/10'
                        }`}>
                          {!task.actualTimeSpent ? 'Telemetry Complete' :
                           task.actualTimeSpent < task.effortEstimate ? `Ahead by ${Math.round((1 - task.actualTimeSpent / task.effortEstimate) * 100)}%` :
                           task.actualTimeSpent === task.effortEstimate ? 'Exact Accuracy' :
                           `Over by ${Math.round((task.actualTimeSpent / task.effortEstimate - 1) * 100)}%`
                          }
                        </span>
                      </div>
                      <div className="flex justify-between font-mono text-[10px]">
                        <span className="text-slate-500">ESTIMATE VS SPENT:</span>
                        <span className="text-emerald-400 font-bold">{task.effortEstimate}h vs {task.actualTimeSpent || task.effortEstimate}h</span>
                      </div>
                      {task.reflectionNotes && (
                        <p className="text-[10px] text-slate-400 italic bg-slate-900/40 p-1 rounded border border-slate-850/20 leading-snug truncate">
                          &ldquo;{task.reflectionNotes}&rdquo;
                        </p>
                      )}
                    </div>
                  )}

                  {/* Immediate Action Buttons */}
                  <div className="mt-4 pt-3 border-t border-slate-800/50 flex gap-2">
                    {task.status !== 'done' ? (
                      <>
                        {task.status === 'todo' ? (
                          <button
                            onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
                            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 rounded transition cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            Launch Mission
                          </button>
                        ) : (
                          <button
                            onClick={() => setReflectionTask(task)}
                            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/20 py-1.5 rounded transition cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Complete Mission
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="flex-1 text-center py-1.5 text-[10px] font-mono text-emerald-500 bg-emerald-500/5 rounded border border-emerald-500/10 flex items-center justify-center gap-1">
                        <Award className="w-3.5 h-3.5" />
                        MISSION ACCOMPLISHED
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Gantt Flight Timeline Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <GanttTimeline 
            tasks={tasks} 
            subtasks={subtasks} 
            onToggleSubtask={handleToggleSubtask} 
          />
        </div>

        {/* Right Column: Mini Objectives & Routine Streaks */}
        <div className="lg:col-span-4 space-y-4">
          {/* Habits overview */}
          <section className="bg-slate-900 rounded border border-slate-800 p-4">
            <h3 className="text-xs text-slate-500 font-bold mb-3 uppercase tracking-tighter flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              Routines (Habits)
            </h3>
            {habits.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic py-4">No routines currently tracking.</p>
            ) : (
              <div className="space-y-3">
                {habits.slice(0, 3).map((habit) => (
                  <div key={habit.id} className="p-2.5 bg-slate-950/40 border border-slate-850 rounded">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-300">{habit.title}</span>
                      <span className="flex items-center gap-1 text-orange-400 font-mono font-bold text-[10px]">
                        <Flame className="w-3 h-3 fill-orange-400" />
                        {habit.streakCount}d streak
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2 text-[9px] font-mono text-slate-500">
                      <span>Frequency: {habit.frequency}</span>
                      <span>Last: {habit.lastCompletedDate || 'Never'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Goals overview */}
          <div className="bg-slate-900 border border-slate-800 rounded p-4">
            <h3 className="text-xs text-slate-500 font-bold mb-3 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-400" />
              Objectives (Goals)
            </h3>
            <div className="space-y-2">
              {goals.slice(0, 3).map((goal) => (
                <div key={goal.id} className="p-2.5 rounded bg-slate-950/40 border border-slate-800/80">
                  <h4 className="text-xs font-semibold text-slate-200 leading-snug">{goal.title}</h4>
                  <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono">
                    <span className="text-slate-500">Target: {goal.targetDate}</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] uppercase">
                      {goal.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ReflectionModal
        task={reflectionTask}
        isOpen={!!reflectionTask}
        onClose={() => setReflectionTask(null)}
        onSave={handleSaveReflection}
      />
    </div>
  );
}
