/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Task, TaskStatus, TaskPriority, AuthUser } from '../types';
import { Plus, Trash, CheckCircle2, Clock, AlertTriangle, ListTodo, Sliders, Play, Check, Filter } from 'lucide-react';
import { motion } from 'motion/react';
import ReflectionModal from '../components/ReflectionModal';

interface TasksProps {
  user: AuthUser | null;
}

export default function Tasks({ user }: TasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [reflectionTask, setReflectionTask] = useState<Task | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('2026-07-05');
  const [urgency, setUrgency] = useState(5);
  const [importance, setImportance] = useState(5);
  const [effortEstimate, setEffortEstimate] = useState(2);

  // Filters state
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');

  // Initial fetch
  useEffect(() => {
    const loadLocal = () => {
      if (!user || user.isDemo) {
        try {
          const localTasks = localStorage.getItem('taskpilot_tasks');
          setTasks(localTasks ? JSON.parse(localTasks) : getDemoTasks());
        } catch {
          setTasks(getDemoTasks());
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
    const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTasks: Task[] = [];
      snapshot.forEach((doc) => {
        fetchedTasks.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(fetchedTasks.length > 0 ? fetchedTasks : getDemoTasks());
      setLoading(false);
    }, (error) => {
      console.error("Error reading tasks:", error);
      setTasks(getDemoTasks());
      setLoading(false);
    });

    return () => {
      window.removeEventListener('taskpilot_data_changed', loadLocal);
      unsubscribe();
    };
  }, [user]);

  function getDemoTasks(): Task[] {
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

  // Handle addition
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask: Omit<Task, 'id'> = {
      userId: user ? user.uid : 'demo',
      title,
      description,
      status: 'todo',
      priority,
      dueDate,
      urgency,
      importance,
      effortEstimate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (user && !user.isDemo) {
      try {
        await addDoc(collection(db, 'tasks'), newTask);
      } catch (error) {
        console.error("Error adding task:", error);
      }
    } else {
      // Offline/demo mode
      const localTask: Task = {
        id: Math.random().toString(36).substr(2, 9),
        ...newTask
      };
      setTasks(prev => {
        const next = [localTask, ...prev];
        localStorage.setItem('taskpilot_tasks', JSON.stringify(next));
        return next;
      });
    }

    // Reset Form
    setTitle('');
    setDescription('');
    setPriority('medium');
    setUrgency(5);
    setImportance(5);
    setEffortEstimate(2);
    setShowAddForm(false);
  };

  // Toggle status
  const handleUpdateStatus = async (taskId: string, newStatus: TaskStatus) => {
    if (user && !user.isDemo && taskId.length > 5) {
      try {
        await updateDoc(doc(db, 'tasks', taskId), {
          status: newStatus,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error("Error updating status:", error);
      }
    } else {
      setTasks(prev => {
        const next = prev.map(t => t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t);
        localStorage.setItem('taskpilot_tasks', JSON.stringify(next));
        return next;
      });
    }
    window.dispatchEvent(new Event('taskpilot_data_changed'));
  };

  const handleSaveReflection = async (actualTime: number, notes: string) => {
    if (!reflectionTask) return;
    const taskId = reflectionTask.id;
    if (user && !user.isDemo && taskId.length > 5) {
      try {
        await updateDoc(doc(db, 'tasks', taskId), {
          status: 'done',
          actualTimeSpent: actualTime,
          reflectionNotes: notes,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error("Error saving retrospective:", error);
      }
    } else {
      setTasks(prev => {
        const next = prev.map(t => t.id === taskId ? { 
          ...t, 
          status: 'done' as TaskStatus, 
          actualTimeSpent: actualTime,
          reflectionNotes: notes,
          updatedAt: new Date().toISOString() 
        } : t);
        localStorage.setItem('taskpilot_tasks', JSON.stringify(next));
        return next;
      });
    }
    setReflectionTask(null);
    window.dispatchEvent(new Event('taskpilot_data_changed'));
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    if (user && !user.isDemo && taskId.length > 5) {
      try {
        await deleteDoc(doc(db, 'tasks', taskId));
      } catch (error) {
        console.error("Error deleting task:", error);
      }
    } else {
      setTasks(prev => {
        const next = prev.filter(t => t.id !== taskId);
        localStorage.setItem('taskpilot_tasks', JSON.stringify(next));
        return next;
      });
    }
  };

  const calculatePriorityScore = (task: Task) => {
    return task.urgency * task.importance * task.effortEstimate;
  };

  if (loading) {
    return (
      <div className="space-y-6 font-sans text-slate-200" id="tasks_loading_skeleton">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-slate-800 rounded animate-pulse" />
            <div className="h-3 w-64 bg-slate-800 rounded animate-pulse" />
          </div>
          <div className="h-8 w-24 bg-slate-800 rounded animate-pulse" />
        </div>
        
        {/* Skeleton Filters */}
        <div className="h-14 bg-slate-900/60 border border-slate-800/80 rounded animate-pulse flex items-center justify-between px-4">
          <div className="h-4 w-32 bg-slate-800 rounded" />
          <div className="h-4 w-48 bg-slate-800 rounded" />
        </div>

        {/* Skeleton Kanban Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((col) => (
            <div key={col} className="bg-slate-900 border border-slate-800 rounded p-4 h-[450px] space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-800 animate-ping" />
                  <div className="h-4 w-24 bg-slate-800 rounded" />
                </div>
                <div className="h-4 w-6 bg-slate-800 rounded" />
              </div>
              
              <div className="space-y-3">
                {[1, 2].map((card) => (
                  <div key={card} className="p-4 bg-slate-950/60 border border-slate-850 rounded space-y-3">
                    <div className="flex justify-between">
                      <div className="h-4 w-2/3 bg-slate-800 rounded" />
                      <div className="h-4 w-10 bg-slate-800 rounded" />
                    </div>
                    <div className="h-3 w-full bg-slate-800 rounded" />
                    <div className="h-3 w-5/6 bg-slate-800 rounded" />
                    <div className="flex justify-between items-center pt-2 border-t border-slate-900">
                      <div className="h-3 w-16 bg-slate-800 rounded" />
                      <div className="h-3 w-10 bg-slate-800 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans" id="tasks_page">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-indigo-400" />
            Flight Plans (Tasks)
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Map out items, configure vectors, and execute with co-pilot recommendations.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded transition cursor-pointer shadow-sm shadow-indigo-500/15"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-3.5 bg-slate-900 border border-slate-800 rounded" id="tasks_filters_bar">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <Filter className="w-3.5 h-3.5 text-indigo-400" />
          <span>PILOT VECTOR FILTER:</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
            <span className="text-slate-500 font-mono text-[9px]">STATUS:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-850 hover:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition cursor-pointer w-full sm:w-36"
              id="status_filter_select"
            >
              <option value="all">All Statuses</option>
              <option value="todo">Pending (Pre-Flight)</option>
              <option value="in_progress">In Progress (In Flight)</option>
              <option value="done">Completed (Landed)</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
            <span className="text-slate-500 font-mono text-[9px]">PRIORITY:</span>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-850 hover:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition cursor-pointer w-full sm:w-36"
              id="priority_filter_select"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {(statusFilter !== 'all' || priorityFilter !== 'all') && (
            <button
              onClick={() => { setStatusFilter('all'); setPriorityFilter('all'); }}
              className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 transition underline cursor-pointer shrink-0 ml-1"
              id="reset_filters_btn"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Slide-out or modal form overlay */}
      {showAddForm && (
        <motion.div 
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border border-slate-800 rounded p-4 space-y-4 shadow-xl"
        >
          <h3 className="text-sm font-bold text-white">Create New Pilot Task</h3>
          <form onSubmit={handleAddTask} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Clean up build scripts"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Description</label>
                <textarea
                  placeholder="What is this task about?"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as TaskPriority)}
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 bg-slate-950/40 p-4 rounded border border-slate-850">
              <h4 className="text-[10px] font-mono uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                Companion Scoring Calibration
              </h4>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                  <span>Urgency (1-10)</span>
                  <span className="text-amber-400">{urgency}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={urgency}
                  onChange={e => setUrgency(Number(e.target.value))}
                  className="w-full accent-indigo-500 bg-slate-900"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                  <span>Importance (1-10)</span>
                  <span className="text-emerald-400">{importance}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={importance}
                  onChange={e => setImportance(Number(e.target.value))}
                  className="w-full accent-indigo-500 bg-slate-900"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                  <span>Effort (Hours)</span>
                  <span className="text-rose-400">{effortEstimate} hrs</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={effortEstimate}
                  onChange={e => setEffortEstimate(Number(e.target.value))}
                  className="w-full accent-indigo-500 bg-slate-900"
                />
              </div>

              <div className="bg-slate-900/60 p-2 rounded border border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                <span>Priority Vector Index:</span>
                <span className="text-amber-400 font-bold">{(urgency * importance * effortEstimate).toFixed(1)}</span>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3.5 py-1.5 rounded transition cursor-pointer"
              >
                Launch Task
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Task column categories: Todo, In Progress, Done */}
      <div className={`grid grid-cols-1 ${statusFilter === 'all' ? 'lg:grid-cols-3' : 'lg:grid-cols-1 max-w-2xl mx-auto'} gap-4`}>
        {(['todo', 'in_progress', 'done'] as TaskStatus[]).map(colStatus => {
          if (statusFilter !== 'all' && statusFilter !== colStatus) {
            return null;
          }
          const colTasks = tasks.filter(t => t.status === colStatus && (priorityFilter === 'all' || t.priority === priorityFilter));
          return (
            <div key={colStatus} className="bg-slate-900 border border-slate-800 rounded p-4 flex flex-col h-[560px]">
              <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${
                    colStatus === 'todo' ? 'bg-amber-400' :
                    colStatus === 'in_progress' ? 'bg-indigo-400' : 'bg-emerald-400'
                  }`} />
                  <h3 className="font-sans font-bold text-white capitalize text-xs tracking-wider">
                    {colStatus === 'in_progress' ? 'In Flight' : colStatus === 'todo' ? 'Pre-Flight' : 'Landed'}
                  </h3>
                </div>
                <span className="bg-slate-950 border border-slate-850 text-slate-400 font-mono text-[10px] px-1.5 py-0.5 rounded">
                  {colTasks.length}
                </span>
              </div>

              {/* Task Cards stack */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {colTasks.map(task => {
                  const score = calculatePriorityScore(task);
                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      key={task.id}
                      className="p-3 rounded bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition space-y-2.5 group relative"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-1.5">
                          <h4 className={`font-semibold text-xs text-slate-200 group-hover:text-white transition leading-snug ${task.status === 'done' ? 'line-through text-slate-500' : ''}`}>
                            {task.title}
                          </h4>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase border shrink-0 ${
                            task.priority === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            task.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          }`}>
                            {task.priority}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
                      </div>

                      {/* Score metrics */}
                      <div className="bg-slate-900/40 p-1.5 rounded border border-slate-850 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-slate-500">Telemetry Index:</span>
                        <span className="text-amber-400 font-bold">{score.toFixed(1)}</span>
                      </div>

                      {/* Performance Metric reflection summary visualizer for Landed Tasks */}
                      {task.status === 'done' && (
                        <div className="mt-2.5 p-2 bg-slate-900 border border-slate-850/80 rounded space-y-2 text-slate-300">
                          <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 uppercase">
                            <span>Retrospective Sync</span>
                            <span className={`px-1 rounded text-[8px] font-bold ${
                              !task.actualTimeSpent ? 'text-slate-400 bg-slate-800' :
                              task.actualTimeSpent < task.effortEstimate ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' :
                              task.actualTimeSpent === task.effortEstimate ? 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20' :
                              'text-amber-400 bg-amber-500/10 border border-amber-400/20'
                            }`}>
                              {!task.actualTimeSpent ? 'Telemetry Complete' :
                               task.actualTimeSpent < task.effortEstimate ? `Ahead by ${Math.round((1 - task.actualTimeSpent / task.effortEstimate) * 100)}%` :
                               task.actualTimeSpent === task.effortEstimate ? 'Perfect Accuracy' :
                               `Over by ${Math.round((task.actualTimeSpent / task.effortEstimate - 1) * 100)}%`
                              }
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950/40 p-1.5 rounded border border-slate-850/40">
                            <div>
                              <span className="block text-[8px] text-slate-500 font-mono uppercase">ESTIMATE</span>
                              <span className="font-semibold text-slate-400">{task.effortEstimate}h</span>
                            </div>
                            <div>
                              <span className="block text-[8px] text-slate-500 font-mono uppercase">ACTUAL</span>
                              <span className="font-semibold text-emerald-400">{task.actualTimeSpent || task.effortEstimate}h</span>
                            </div>
                          </div>
                          
                          {task.reflectionNotes && (
                            <p className="text-[10px] text-slate-400 italic bg-slate-950/10 p-1 rounded border border-slate-850/20 leading-snug">
                              &ldquo;{task.reflectionNotes}&rdquo;
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-900">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {task.effortEstimate}h left
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          {/* Navigation buttons to toggle status */}
                          {colStatus !== 'done' && (
                            <button
                              onClick={() => {
                                if (colStatus === 'todo') {
                                  handleUpdateStatus(task.id, 'in_progress');
                                } else if (colStatus === 'in_progress') {
                                  setReflectionTask(task);
                                }
                              }}
                              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                              title={colStatus === 'todo' ? 'Start Task' : 'Complete Task'}
                            >
                              {colStatus === 'todo' ? <Play className="w-3 h-3 text-indigo-400" /> : <Check className="w-3 h-3 text-emerald-400" />}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-slate-600 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                            title="Delete Task"
                          >
                            <Trash className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {colTasks.length === 0 && (
                  <div className="h-20 border border-dashed border-slate-800 rounded flex items-center justify-center text-[10px] text-slate-600 font-mono">
                    Vector queue empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Retro Reflection Telemetry Modal */}
      <ReflectionModal
        task={reflectionTask}
        isOpen={!!reflectionTask}
        onClose={() => setReflectionTask(null)}
        onSave={handleSaveReflection}
      />
    </div>
  );
}
