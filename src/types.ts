/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: string;
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  isDemo?: boolean;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  urgency: number; // 1-10
  importance: number; // 1-10
  effortEstimate: number; // in hours remaining
  actualTimeSpent?: number; // actual hours spent upon completion
  reflectionNotes?: string; // post-completion retrospective notes
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export type GoalStatus = 'active' | 'completed' | 'abandoned';

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  targetDate: string;
  status: GoalStatus;
  createdAt: string;
}

export type HabitFrequency = 'daily' | 'weekly';

export interface Habit {
  id: string;
  userId: string;
  title: string;
  frequency: HabitFrequency;
  streakCount: number;
  lastCompletedDate?: string;
  createdAt: string;
}

export type ProgressLogType = 'task_completed' | 'goal_achieved' | 'habit_streak' | 'daily_recap';

export interface ProgressLog {
  id: string;
  userId: string;
  entityId: string; // ID of task, goal, or habit
  type: ProgressLogType;
  timestamp: string;
  notes: string;
}

export type NudgeStatus = 'pending' | 'sent' | 'dismissed';

export interface Nudge {
  id: string;
  userId: string;
  title: string;
  message: string;
  status: NudgeStatus;
  scheduledFor: string;
  sentAt?: string;
}

// Chat-related types for the Companion Chat panel
export interface ChatMessage {
  id: string;
  sender: 'user' | 'companion';
  text: string;
  timestamp: string;
  // If the companion performed an action/called a function
  actionPerformed?: {
    name: string;
    details: string;
    status: 'success' | 'failed' | 'pending';
  };
}
