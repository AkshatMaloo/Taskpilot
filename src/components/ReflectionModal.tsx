/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Task } from '../types';
import { Clock, ShieldAlert, CheckSquare, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReflectionModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (actualTime: number, notes: string) => void;
}

export default function ReflectionModal({ task, isOpen, onClose, onSave }: ReflectionModalProps) {
  const [actualTime, setActualTime] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  
  // Set default actual time when a task is loaded
  const defaultEstimate = task ? task.effortEstimate : 2;
  
  // Quick pre-set reflection tags
  const presetTags = [
    "🎯 Perfect Estimate",
    "⚡ Extremely efficient run",
    "📈 Underestimated setup complexity",
    "🚧 Delayed by external blockers",
    "🎨 Polishing/UI fine-tuning took longer"
  ];

  const handlePillClick = (tag: string) => {
    setNotes(prev => prev ? `${prev}. ${tag}` : tag);
  };

  if (!isOpen || !task) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" id="reflection_modal_overlay">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg p-5 text-slate-200 shadow-2xl relative"
        >
          {/* Decorative Top Accent */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-t-lg" />

          <div className="flex items-center gap-2 mb-3 mt-1">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-md">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-sm text-white flex items-center gap-1.5">
                Pilot Mission Completed
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              </h3>
              <p className="text-[10px] text-slate-500 font-mono">RETROSPECTIVE TELEMETRY SYNCHRONIZATION</p>
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded border border-slate-850/60 mb-4">
            <span className="text-[9px] font-mono text-slate-500 uppercase">Mission Title:</span>
            <p className="text-xs font-semibold text-white truncate mt-0.5">{task.title}</p>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2 pt-1 border-t border-slate-900">
              <span>Original Estimate:</span>
              <span className="text-indigo-400 font-bold">{task.effortEstimate} hours</span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Input 1: Actual Time Spent */}
            <div>
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1.5">
                <span>ACTUAL TIME SPENT (HOURS):</span>
                <span className="text-emerald-400 font-bold font-sans text-xs">
                  {actualTime || defaultEstimate} hrs
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="24"
                step="0.5"
                defaultValue={defaultEstimate}
                onChange={(e) => setActualTime(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-950 h-2 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1">
                <span>0.5h</span>
                <span>Estimate: {defaultEstimate}h</span>
                <span>24h</span>
              </div>
            </div>

            {/* Input 2: Retrospective Notes */}
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1.5">Reflection Insights & Learnings:</label>
              <textarea
                placeholder="What did you learn? Why did it differ from the estimate?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition h-20 resize-none"
              />
            </div>

            {/* Preset shortcuts */}
            <div>
              <span className="block text-[9px] font-mono text-slate-500 uppercase mb-1.5">Quick Telemetry Tags:</span>
              <div className="flex flex-wrap gap-1">
                {presetTags.map((tag, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePillClick(tag)}
                    className="text-[9px] text-slate-400 bg-slate-950/40 hover:bg-slate-950 hover:text-emerald-300 border border-slate-850 hover:border-emerald-500/30 px-2 py-1 rounded transition cursor-pointer font-sans"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-slate-800">
            <button
              onClick={onClose}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const finalTime = actualTime || defaultEstimate;
                onSave(finalTime, notes || "Mission logged with default telemetry.");
              }}
              className="text-xs font-semibold px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded cursor-pointer transition flex items-center gap-1.5 shadow-md shadow-emerald-500/10"
            >
              <Clock className="w-3.5 h-3.5" />
              Save Retrospective
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
