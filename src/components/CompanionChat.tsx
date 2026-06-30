/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { ChatMessage, AuthUser, Task, Goal, Habit } from '../types';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { 
  Send, Sparkles, Terminal, Cpu, ArrowRight, Calendar, CheckSquare, 
  BellRing, Play, RefreshCw, Clock, Mic, MicOff, AlertTriangle 
} from 'lucide-react';
import { motion } from 'motion/react';

// Extend ChatMessage local structure to support proactive companion action buttons
interface EnhancedChatMessage extends ChatMessage {
  actions?: Array<{
    label: string;
    actionType: 'start_now' | 'reschedule' | 'block_time';
    taskId: string;
  }>;
}

export default function CompanionChat() {
  const [messages, setMessages] = useState<EnhancedChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  
  // High-density lists to display in companion panels
  const [activeSubtasks, setActiveSubtasks] = useState<any[]>([]);
  const [focusSlots, setFocusSlots] = useState<any[]>([]);
  const [activeNudges, setActiveNudges] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Web Speech API states
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Sync auth state & initial widgets
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || 'Pilot',
          photoURL: currentUser.photoURL || ''
        });
      } else {
        const saved = localStorage.getItem('taskpilot_demo_user');
        if (saved) {
          setUser(JSON.parse(saved));
        } else {
          setUser(null);
        }
      }
    });

    // Load initial local widgets state
    try {
      const localSubs = localStorage.getItem('taskpilot_subtasks');
      const localSlots = localStorage.getItem('taskpilot_focus_slots');
      const localNudges = localStorage.getItem('taskpilot_nudges');
      if (localSubs) setActiveSubtasks(JSON.parse(localSubs));
      if (localSlots) setFocusSlots(JSON.parse(localSlots));
      if (localNudges) setActiveNudges(JSON.parse(localNudges));
    } catch (e) {
      console.warn("Could not load local widget data", e);
    }

    return () => unsubscribe();
  }, []);

  // Initialize welcome message
  useEffect(() => {
    setMessages([
      {
        id: 'init-1',
        sender: 'companion',
        text: "Salutations, Pilot. I am your TaskPilot AI Companion. I analyze your tasks' vectors (urgency × importance × effort remaining) and keep your flight plan optimized. Type 'prioritize' or 'break down top task' to start!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, []);

  // Set up Speech Recognition (Web Speech API)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputValue(transcript);
        }
      };

      rec.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setSpeechError("Microphone permission denied. Click 'Open in New Tab' or allow microphone access in browser settings.");
        } else {
          setSpeechError(`Voice error: ${event.error}`);
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Read latest task, goals, and habits context right before sending a message to ensure 100% accurate system context
  const getLatestContext = async (): Promise<{ tasks: Task[]; goals: Goal[]; habits: Habit[] }> => {
    if (!user || user.isDemo) {
      try {
        const localTasks = localStorage.getItem('taskpilot_tasks');
        const localGoals = localStorage.getItem('taskpilot_goals');
        const localHabits = localStorage.getItem('taskpilot_habits');

        // Fallback to sample tasks if local storage is empty
        const defaultTasks: Task[] = [
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
          }
        ];

        return {
          tasks: localTasks ? JSON.parse(localTasks) : defaultTasks,
          goals: localGoals ? JSON.parse(localGoals) : [],
          habits: localHabits ? JSON.parse(localHabits) : []
        };
      } catch {
        return { tasks: [], goals: [], habits: [] };
      }
    } else {
      try {
        const tasksSnap = await getDocs(query(collection(db, 'tasks'), where('userId', '==', user.uid)));
        const goalsSnap = await getDocs(query(collection(db, 'goals'), where('userId', '==', user.uid)));
        const habitsSnap = await getDocs(query(collection(db, 'habits'), where('userId', '==', user.uid)));
        
        const tasksArr: Task[] = [];
        tasksSnap.forEach(doc => tasksArr.push({ id: doc.id, ...doc.data() } as Task));
        const goalsArr: Goal[] = [];
        goalsSnap.forEach(doc => goalsArr.push({ id: doc.id, ...doc.data() } as Goal));
        const habitsArr: Habit[] = [];
        habitsSnap.forEach(doc => habitsArr.push({ id: doc.id, ...doc.data() } as Habit));
        
        return { tasks: tasksArr, goals: goalsArr, habits: habitsArr };
      } catch (err) {
        console.warn("Could not load latest context from Firestore:", err);
        return { tasks: [], goals: [], habits: [] };
      }
    }
  };

  // Keep a live copy of tasks in state to trigger proactive messages
  useEffect(() => {
    const syncTasks = async () => {
      const ctx = await getLatestContext();
      setTasks(ctx.tasks);
    };
    syncTasks();
    window.addEventListener('taskpilot_data_changed', syncTasks);
    return () => window.removeEventListener('taskpilot_data_changed', syncTasks);
  }, [user]);

  // Proactive message scheduler to warn the pilot about imminent risks
  useEffect(() => {
    if (tasks.length > 0) {
      // Find incomplete at-risk/critical tasks
      const highRiskTask = tasks.find(t => {
        if (t.status === 'done') return false;
        const today = new Date('2026-06-30');
        const due = new Date(t.dueDate);
        const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 1 || t.urgency > 8;
      });

      if (highRiskTask) {
        const alertedKey = `co_alert_${highRiskTask.id}`;
        if (!sessionStorage.getItem(alertedKey)) {
          sessionStorage.setItem(alertedKey, 'true');
          
          // Inject proactive alert message
          const alertMsg: EnhancedChatMessage = {
            id: `proactive-${highRiskTask.id}-${Date.now()}`,
            sender: 'companion',
            text: `🚨 CO-PILOT ALERT: Task "${highRiskTask.title}" is flagged at extreme risk. Deadline is imminent (${highRiskTask.dueDate}) with high effort remaining (${highRiskTask.effortEstimate} hrs). Let's take immediate corrective action:`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            actions: [
              { label: 'Start now', actionType: 'start_now', taskId: highRiskTask.id },
              { label: 'Reschedule', actionType: 'reschedule', taskId: highRiskTask.id },
              { label: 'Block focus slot', actionType: 'block_time', taskId: highRiskTask.id }
            ]
          };
          
          // Delay briefly for organic pacing
          setTimeout(() => {
            setMessages(prev => [...prev, alertMsg]);
          }, 3000);
        }
      }
    }
  }, [tasks]);

  // Handle proactive interactive actions
  const handleActionClick = async (actionType: 'start_now' | 'reschedule' | 'block_time', taskId: string) => {
    const matchedTask = tasks.find(t => t.id === taskId);
    if (!matchedTask) return;

    if (actionType === 'start_now') {
      if (user && !user.isDemo) {
        try {
          await updateDoc(doc(db, 'tasks', taskId), { status: 'in_progress', updatedAt: new Date().toISOString() });
        } catch (e) {
          console.error("Could not sync task status update", e);
        }
      } else {
        const localTasks = JSON.parse(localStorage.getItem('taskpilot_tasks') || '[]');
        const updated = localTasks.map((t: any) => t.id === taskId ? { ...t, status: 'in_progress', updatedAt: new Date().toISOString() } : t);
        localStorage.setItem('taskpilot_tasks', JSON.stringify(updated));
      }

      setMessages(prev => [
        ...prev,
        {
          id: `act-usr-${Date.now()}`,
          sender: 'user',
          text: `Executing command: Start working on "${matchedTask.title}".`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        {
          id: `act-comp-${Date.now()}`,
          sender: 'companion',
          text: `Mission initiated! upgraded "${matchedTask.title}" status to IN_PROGRESS. Focus flow is authorized. 🚀`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      window.dispatchEvent(new Event('taskpilot_data_changed'));

    } else if (actionType === 'reschedule') {
      const currentDue = new Date(matchedTask.dueDate);
      currentDue.setDate(currentDue.getDate() + 3);
      const newDueStr = currentDue.toISOString().split('T')[0];

      if (user && !user.isDemo) {
        try {
          await updateDoc(doc(db, 'tasks', taskId), { dueDate: newDueStr, updatedAt: new Date().toISOString() });
        } catch (e) {
          console.error("Could not sync task reschedule", e);
        }
      } else {
        const localTasks = JSON.parse(localStorage.getItem('taskpilot_tasks') || '[]');
        const updated = localTasks.map((t: any) => t.id === taskId ? { ...t, dueDate: newDueStr, updatedAt: new Date().toISOString() } : t);
        localStorage.setItem('taskpilot_tasks', JSON.stringify(updated));
      }

      setMessages(prev => [
        ...prev,
        {
          id: `act-usr-${Date.now()}`,
          sender: 'user',
          text: `Executing command: Shift deadline for "${matchedTask.title}".`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        {
          id: `act-comp-${Date.now()}`,
          sender: 'companion',
          text: `Rescheduling complete. Postponed "${matchedTask.title}" due date to ${newDueStr} (+3 days) to preserve mental bandwidth.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      window.dispatchEvent(new Event('taskpilot_data_changed'));

    } else if (actionType === 'block_time') {
      const newSlot = {
        id: `slot-${Math.random().toString(36).substr(2, 5)}`,
        taskId,
        title: `Deep focus block: ${matchedTask.title}`,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      };

      setFocusSlots(prev => {
        const next = [newSlot, ...prev];
        localStorage.setItem('taskpilot_focus_slots', JSON.stringify(next));
        return next;
      });

      setMessages(prev => [
        ...prev,
        {
          id: `act-usr-${Date.now()}`,
          sender: 'user',
          text: `Executing command: Schedule deep work block.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        {
          id: `act-comp-${Date.now()}`,
          sender: 'companion',
          text: `Secure focus slot scheduled for 2 hours! Check the Focus tracker on your calendar to start deep coding. 🧘`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      window.dispatchEvent(new Event('taskpilot_data_changed'));
    }
  };

  // Toggle voice speech recognition
  const handleToggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Could not start speech recognition", e);
      }
    }
  };

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: EnhancedChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const context = await getLatestContext();

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: textToSend,
          tasks: context.tasks,
          goals: context.goals,
          habits: context.habits
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Check and apply state modifications requested by the co-pilot (function calling mutations)
        if (user && !user.isDemo) {
          if (data.updatedTasks && data.updatedTasks.length > 0) {
            for (const task of data.updatedTasks) {
              const docRef = doc(db, 'tasks', task.id);
              await updateDoc(docRef, {
                dueDate: task.dueDate,
                urgency: task.urgency,
                importance: task.importance,
                effortEstimate: task.effortEstimate,
                status: task.status,
                priority: task.priority,
                updatedAt: new Date().toISOString()
              });
            }
          }

          if (data.createdSubtasks && data.createdSubtasks.length > 0) {
            for (const sub of data.createdSubtasks) {
              await addDoc(collection(db, 'subtasks'), {
                ...sub,
                userId: user.uid
              });
            }
            setActiveSubtasks(prev => {
              const next = [...data.createdSubtasks, ...prev];
              localStorage.setItem('taskpilot_subtasks', JSON.stringify(next));
              return next;
            });
          }

          if (data.createdCalendarSlot) {
            setFocusSlots(prev => {
              const next = [data.createdCalendarSlot, ...prev];
              localStorage.setItem('taskpilot_focus_slots', JSON.stringify(next));
              return next;
            });
          }

          if (data.createdNudge) {
            setActiveNudges(prev => {
              const next = [data.createdNudge, ...prev];
              localStorage.setItem('taskpilot_nudges', JSON.stringify(next));
              return next;
            });
          }
        } else {
          if (data.updatedTasks && data.updatedTasks.length > 0) {
            localStorage.setItem('taskpilot_tasks', JSON.stringify(data.updatedTasks));
          }

          if (data.createdSubtasks && data.createdSubtasks.length > 0) {
            setActiveSubtasks(prev => {
              const next = [...data.createdSubtasks, ...prev];
              localStorage.setItem('taskpilot_subtasks', JSON.stringify(next));
              return next;
            });
          }

          if (data.createdCalendarSlot) {
            setFocusSlots(prev => {
              const next = [data.createdCalendarSlot, ...prev];
              localStorage.setItem('taskpilot_focus_slots', JSON.stringify(next));
              return next;
            });
          }

          if (data.createdNudge) {
            setActiveNudges(prev => {
              const next = [data.createdNudge, ...prev];
              localStorage.setItem('taskpilot_nudges', JSON.stringify(next));
              return next;
            });
          }

          window.dispatchEvent(new Event('taskpilot_data_changed'));
        }

        const companionMsg: EnhancedChatMessage = {
          id: Math.random().toString(),
          sender: 'companion',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionPerformed: data.actionPerformed ? {
            name: data.actionPerformed.name,
            details: data.actionPerformed.details,
            status: data.actionPerformed.status || 'success'
          } : undefined
        };
        setMessages(prev => [...prev, companionMsg]);
      } else {
        throw new Error("API call failed");
      }
    } catch (error) {
      console.error("Co-pilot error:", error);
      const companionMsg: EnhancedChatMessage = {
        id: Math.random().toString(),
        sender: 'companion',
        text: "Error synchronizing co-pilot telemetry. Please verify network access.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, companionMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const presetPills = [
    "Prioritize tasks",
    "Break down top task",
    "Evaluate progress risk",
    "Propose tradeoff",
    "Block focus calendar slot"
  ];

  const handleToggleSubtask = (id: string) => {
    setActiveSubtasks(prev => {
      const next = prev.map(s => s.id === id ? { ...s, completed: !s.completed } : s);
      localStorage.setItem('taskpilot_subtasks', JSON.stringify(next));
      return next;
    });
  };

  const handleClearWidgets = () => {
    setActiveSubtasks([]);
    setFocusSlots([]);
    setActiveNudges([]);
    localStorage.removeItem('taskpilot_subtasks');
    localStorage.removeItem('taskpilot_focus_slots');
    localStorage.removeItem('taskpilot_nudges');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800/80 font-sans" id="companion_chat_sidebar">
      {/* Sidebar Header */}
      <div className="p-3 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded animate-pulse">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-sans font-bold text-xs tracking-tight text-white flex items-center gap-1">
              TaskPilot AI Co-Pilot
              <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1 py-0.2 rounded uppercase font-mono tracking-wider font-semibold">Active</span>
            </h2>
            <p className="text-[9px] text-slate-500 font-mono">Autonomous Reasoning System</p>
          </div>
        </div>
        {(activeSubtasks.length > 0 || focusSlots.length > 0) && (
          <button 
            onClick={handleClearWidgets}
            className="text-[8px] font-mono text-slate-500 hover:text-rose-400 cursor-pointer transition uppercase"
          >
            Clear Widgets
          </button>
        )}
      </div>

      {/* High-density visual panels / co-pilot monitors */}
      {(activeSubtasks.length > 0 || focusSlots.length > 0 || activeNudges.length > 0) && (
        <div className="bg-slate-950/50 border-b border-slate-800 p-2.5 space-y-2 shrink-0 max-h-48 overflow-y-auto">
          {/* Active Subtasks checklist panel */}
          {activeSubtasks.length > 0 && (
            <div className="space-y-1">
              <span className="text-[8px] font-mono font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                <CheckSquare className="w-2.5 h-2.5" /> Active Checklist (Planner)
              </span>
              <div className="space-y-1 pl-1 max-h-24 overflow-y-auto">
                {activeSubtasks.slice(0, 4).map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2 text-[10px] text-slate-300">
                    <input 
                      type="checkbox" 
                      checked={sub.completed}
                      onChange={() => handleToggleSubtask(sub.id)}
                      className="accent-indigo-500 rounded border-slate-800 w-3 h-3 cursor-pointer"
                    />
                    <span className={`truncate flex-1 ${sub.completed ? 'line-through text-slate-500' : ''}`}>{sub.title}</span>
                    <span className="text-[8px] text-slate-500 font-mono shrink-0">{sub.effortEstimate}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blocked focus calendar slots */}
          {focusSlots.length > 0 && (
            <div className="space-y-1 pt-1.5 border-t border-slate-900">
              <span className="text-[8px] font-mono font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" /> Scheduled Focus (Action)
              </span>
              <div className="space-y-1 pl-1">
                {focusSlots.slice(0, 2).map((slot, i) => (
                  <div key={i} className="flex justify-between items-center text-[10px] text-slate-300 bg-slate-900/40 p-1.5 rounded border border-slate-800/50">
                    <span className="font-semibold truncate max-w-[140px]">{slot.title}</span>
                    <span className="text-[8px] font-mono text-slate-500">09:00 - 11:00 AM</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active streaking notifications */}
          {activeNudges.length > 0 && (
            <div className="space-y-1 pt-1.5 border-t border-slate-900">
              <span className="text-[8px] font-mono font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
                <BellRing className="w-2.5 h-2.5" /> Streaks & Reminders (Monitor)
              </span>
              <p className="text-[10px] pl-1 text-slate-400 italic">
                "{activeNudges[0].message}"
              </p>
            </div>
          )}
        </div>
      )}

      {/* Message List */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-3"
        id="chat_messages_container"
      >
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex flex-col max-w-[90%] ${msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
          >
            <div className={`p-2.5 rounded text-xs leading-relaxed ${
              msg.sender === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none' 
                : 'bg-slate-950 text-slate-200 border border-slate-850 rounded-bl-none shadow-md'
            }`}>
              {msg.text}

              {/* Proactive Interactive Action Buttons */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-800/60 flex flex-wrap gap-1.5">
                  {msg.actions.map((act, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleActionClick(act.actionType, act.taskId)}
                      className="text-[9px] px-2 py-1 rounded font-bold cursor-pointer transition bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-1"
                    >
                      {act.actionType === 'start_now' && <Play className="w-2 h-2" />}
                      {act.actionType === 'reschedule' && <RefreshCw className="w-2 h-2" />}
                      {act.actionType === 'block_time' && <Clock className="w-2 h-2" />}
                      {act.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Display action logs / triggered function calling results */}
            {msg.actionPerformed && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-1.5 w-full p-2 rounded bg-slate-950 border border-amber-500/20 text-[10px] font-mono text-slate-300 space-y-1"
              >
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <Terminal className="w-3 h-3" />
                  <span>co-pilot_action::{msg.actionPerformed.name}()</span>
                </div>
                <p className="text-slate-400 leading-snug">{msg.actionPerformed.details}</p>
                <div className="flex items-center gap-1.5 mt-1 text-[9px]">
                  <span className="text-slate-500 font-medium">Execution:</span>
                  <span className={`px-1 py-0.2 rounded text-[8px] uppercase font-bold tracking-wider ${
                    msg.actionPerformed.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {msg.actionPerformed.status}
                  </span>
                </div>
              </motion.div>
            )}

            <span className="text-[9px] text-slate-500 font-mono mt-0.5 px-0.5">{msg.timestamp}</span>
          </div>
        ))}

        {isTyping && (
          <div className="flex flex-col items-start max-w-[90%] mr-auto">
            <div className="bg-slate-950 border border-slate-850 p-2 rounded rounded-bl-none flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[8px] text-slate-600 font-mono mt-0.5">Co-pilot computing vectors...</span>
          </div>
        )}
      </div>

      {/* Dynamic Shortcut Pills */}
      <div className="p-2.5 bg-slate-950/40 border-t border-slate-850/80 space-y-1.5">
        <p className="text-[9px] font-mono text-slate-500 px-0.5 uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 text-amber-400" />
          Quick Vectors
        </p>
        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
          {presetPills.map((pill, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(pill)}
              className="text-[9px] text-slate-400 hover:text-white bg-slate-950 border border-slate-800 hover:border-slate-700 px-2 py-1 rounded transition text-left cursor-pointer flex items-center gap-1 shrink-0"
            >
              {pill}
              <ArrowRight className="w-2 h-2 opacity-40" />
            </button>
          ))}
        </div>
      </div>

      {/* Chat Input Field with Web Speech transcription support */}
      <div className="p-3 bg-slate-950 border-t border-slate-800/80">
        {speechError && (
          <div className="mb-2 p-2 bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-300 rounded flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{speechError}</span>
              <button 
                type="button" 
                onClick={() => setSpeechError(null)} 
                className="ml-2 underline text-rose-400 hover:text-white transition cursor-pointer font-semibold"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputValue);
          }}
          className="flex gap-1.5"
        >
          {speechSupported && (
            <button
              type="button"
              onClick={handleToggleListening}
              className={`p-2 rounded border transition cursor-pointer flex items-center justify-center ${
                isListening 
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 animate-pulse' 
                  : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
              title={isListening ? 'Stop Listening' : 'Transcribe voice commands'}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          )}

          <input
            type="text"
            placeholder={isListening ? "Listening... Speak now" : "Instruct your Co-Pilot..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-850 text-xs text-white placeholder-slate-500 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 transition"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white p-2 rounded transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
