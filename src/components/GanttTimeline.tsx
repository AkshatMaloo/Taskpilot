/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Task, Subtask } from '../types';
import { Calendar, Clock, CheckSquare, Layers, AlertCircle, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface GanttTimelineProps {
  tasks: Task[];
  subtasks: Subtask[];
  onToggleSubtask?: (subtaskId: string) => void;
}

export default function GanttTimeline({ tasks, subtasks, onToggleSubtask }: GanttTimelineProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Generate a list of days for the Gantt chart column headings
  // Centered around the system current time 2026-06-30
  const baseDate = new Date('2026-06-29');
  const ganttDays = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    return d;
  });

  const formatDateLabel = (date: Date) => {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getDayKey = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Helper to calculate position offset and width of a task bar
  const calculatePosition = (startDateStr: string, endDateStr: string) => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    
    // Clamp to timeline window
    const timelineStart = baseDate.getTime();
    const timelineEnd = baseDate.getTime() + 8 * 24 * 60 * 60 * 1000;

    const startMs = Math.max(start.getTime(), timelineStart);
    const endMs = Math.min(end.getTime(), timelineEnd);

    if (startMs > timelineEnd || endMs < timelineStart) {
      return { offsetPercent: 0, widthPercent: 0, outOfRange: true };
    }

    const totalDuration = timelineEnd - timelineStart;
    const offsetPercent = ((startMs - timelineStart) / totalDuration) * 100;
    const widthPercent = Math.max(((endMs - startMs) / totalDuration) * 100, 8); // minimum 8% width

    return { offsetPercent, widthPercent, outOfRange: false };
  };

  // Initialize selected task if none
  useEffect(() => {
    if (tasks.length > 0 && !selectedTaskId) {
      setSelectedTaskId(tasks[0].id);
    }
  }, [tasks, selectedTaskId]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded p-4 font-sans space-y-4" id="gantt_timeline_container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            AI-Generated Flight Timelines
          </h3>
          <p className="text-[11px] text-slate-500">
            Deconstructive Gantt tracking representing parent schedules and localized AI subtasks.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          <span>Parent Plan</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Subtasks</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Side: Tasks selector with mini progress meters */}
        <div className="lg:col-span-4 space-y-2 max-h-[400px] overflow-y-auto pr-1">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block">Select Active Plan:</span>
          {tasks.map((task) => {
            const taskSubs = subtasks.filter(s => s.taskId === task.id);
            const completedCount = taskSubs.filter(s => s.completed).length;
            const progressPercent = taskSubs.length > 0 ? (completedCount / taskSubs.length) * 100 : 0;
            const isSelected = selectedTaskId === task.id;

            return (
              <button
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={`w-full text-left p-3 rounded transition border text-xs cursor-pointer ${
                  isSelected 
                    ? 'bg-indigo-600/10 border-indigo-500 text-white' 
                    : 'bg-slate-950/40 border-slate-850/80 hover:border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex justify-between items-start gap-1">
                  <span className="font-semibold line-clamp-1">{task.title}</span>
                  <span className={`text-[8px] px-1 py-0.2 rounded font-mono ${
                    task.status === 'done' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {task.status === 'done' ? 'DONE' : `${task.urgency}×${task.importance}`}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>{completedCount}/{taskSubs.length} Subtasks</span>
                    <span>{Math.round(progressPercent)}%</span>
                  </div>
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Side: Interactive Gantt Grid & Subtask Checklist */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Gantt Calendar Visualization */}
          <div className="bg-slate-950 p-3 rounded border border-slate-850/80 overflow-x-auto min-w-[500px]">
            {/* Timeline Header (Days) */}
            <div className="grid grid-cols-9 text-center border-b border-slate-900 pb-2">
              <div className="text-left font-mono text-[9px] text-slate-500 pl-1 uppercase font-bold col-span-2">Task Vector</div>
              {ganttDays.map((day, i) => {
                const isToday = getDayKey(day) === '2026-06-30';
                return (
                  <div key={i} className={`font-mono text-[9px] ${isToday ? 'text-indigo-400 font-bold' : 'text-slate-500'}`}>
                    {formatDateLabel(day)}
                    {isToday && <span className="block text-[7px] text-indigo-400 tracking-tighter uppercase font-sans">Today</span>}
                  </div>
                );
              })}
            </div>

            {/* Gantt Bar rows */}
            <div className="space-y-3 pt-3">
              {tasks.map((task) => {
                const isSelected = selectedTaskId === task.id;
                // Place start date relative to base date
                const createdDate = task.createdAt ? task.createdAt.split('T')[0] : '2026-06-29';
                const pos = calculatePosition(createdDate, task.dueDate);

                return (
                  <div key={task.id} className={`grid grid-cols-9 items-center py-1.5 rounded transition ${isSelected ? 'bg-indigo-500/5' : ''}`}>
                    <div className="col-span-2 text-[11px] font-sans text-slate-300 truncate font-medium pr-2 pl-1">
                      {task.title}
                    </div>
                    
                    {/* Gantt track space */}
                    <div className="col-span-7 relative h-6 bg-slate-900/40 rounded border border-slate-900">
                      {/* Grid vertical guide lines */}
                      <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                        {Array.from({ length: 7 }).map((_, idx) => (
                          <div key={idx} className="border-r border-slate-950/60 h-full last:border-0" />
                        ))}
                      </div>

                      {/* Parent bar */}
                      {!pos.outOfRange && (
                        <motion.div
                          layoutId={`gantt-bar-${task.id}`}
                          className={`absolute h-3.5 top-1 rounded-sm flex items-center px-1.5 shadow-sm ${
                            isSelected 
                              ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white' 
                              : 'bg-slate-800 text-slate-400'
                          }`}
                          style={{
                            left: `${pos.offsetPercent}%`,
                            width: `${pos.widthPercent}%`
                          }}
                        >
                          <span className="text-[7px] font-mono uppercase font-bold truncate">
                            {task.priority.toUpperCase()}
                          </span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subtasks listing with toggles */}
          {selectedTaskId ? (
            <div className="p-3 bg-slate-950 border border-slate-850 rounded">
              <div className="flex justify-between items-center border-b border-slate-900 pb-2 mb-2">
                <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <CheckSquare className="w-3 h-3" />
                  Deconstructed Subtask Roadmap:
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  {subtasks.filter(s => s.taskId === selectedTaskId).length} AI steps
                </span>
              </div>

              {subtasks.filter(s => s.taskId === selectedTaskId).length === 0 ? (
                <div className="py-6 text-center text-[11px] text-slate-500 italic">
                  No subtasks generated yet. Type "break down task" in Companion Chat to activate!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {subtasks.filter(s => s.taskId === selectedTaskId).map((sub) => (
                    <div 
                      key={sub.id} 
                      className={`flex items-center gap-2.5 p-2 bg-slate-900/60 border border-slate-800/80 hover:border-slate-800 rounded transition text-xs ${
                        sub.completed ? 'opacity-60' : ''
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={sub.completed}
                        onChange={() => onToggleSubtask && onToggleSubtask(sub.id)}
                        className="accent-indigo-500 rounded border-slate-800 w-3.5 h-3.5 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-slate-200 truncate ${sub.completed ? 'line-through text-slate-500' : ''}`}>
                          {sub.title}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500 italic bg-slate-950 rounded border border-slate-850">
              Select a task to visualize AI subtask breakdown
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
