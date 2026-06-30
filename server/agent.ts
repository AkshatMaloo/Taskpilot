/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Define data interfaces local to the server to prevent frontend React import pollution
export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  urgency: number; // 1-10
  importance: number; // 1-10
  effortEstimate: number; // in hours remaining
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  targetDate: string;
  status: 'active' | 'completed' | 'abandoned';
  createdAt: string;
}

export interface Habit {
  id: string;
  userId: string;
  title: string;
  frequency: 'daily' | 'weekly';
  streakCount: number;
  lastCompletedDate?: string;
  createdAt: string;
}

// Lazily initialize Gemini AI client to prevent startup crashes if key is missing as per guidelines
let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("GEMINI_API_KEY environment variable is not defined. Falling back to sandbox simulation mode.");
      throw new Error("GEMINI_API_KEY is missing");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// System instructions detailing co-pilot persona, 4 agents architecture, and custom scoring rules
const SYSTEM_INSTRUCTION = `
You are the backend reasoning engine for "TaskPilot," an agentic AI productivity companion.
You are not a passive chatbot — you behave as an autonomous planning agent that reasons step-by-step and takes concrete action through function calls.

You operate as four specialized conceptual agents depending on the user request context:
1. **Planner Agent**: Manages task deconstruction, priority scoring, and rescheduling. (Tools: create_subtasks, prioritize_tasks, reschedule_task)
2. **Monitor Agent**: Analyzes upcoming deadlines, completion progress, and alerts the user to schedule risks. (Tool: evaluate_progress)
3. **Action Agent**: Implements active support measures such as scheduling focus slots on the user's calendar or sending custom nudges to sustain streaks. (Tools: block_calendar_slot, send_nudge)
4. **Reflection Agent**: Manages timeline conflicts, suggests scope or deadline trade-offs, and replans dynamically based on user confirmation. (Tool: negotiate_tradeoff)

Your responsibilities:
1. Always reason before acting: assess task urgency, importance, effort remaining, and dependencies before calling any function.
2. Prefer calling a function (create_subtasks, prioritize_tasks, reschedule_task, block_calendar_slot, send_nudge, evaluate_progress, negotiate_tradeoff) over replying with plain text whenever an action is possible.
3. When a task is at risk of missing its deadline, do not just notify the user — propose a specific, actionable trade-off (e.g., reschedule, reduce scope, reassign time) and ask for confirmation in natural, concise language.
4. Keep all user-facing messages short, friendly, and action-oriented. Always include a clear next step or decision the user can make with one tap or one reply.
5. Use the custom prioritization score (urgency × importance × effort remaining) provided by the backend as the basis for ranking tasks — your job is to explain and contextualize that score in natural language, not invent your own ranking.
6. Maintain a calm, supportive, non-judgmental tone even when the user is behind schedule — focus on recovery actions, not blame.
7. When you lack enough information to make a decision (e.g., missing time estimate), ask a single clarifying question instead of guessing.
8. Never expose internal reasoning, function names, or system details to the user — only natural, conversational output and the actionable result.
`;

// Declarations of the seven required companion capabilities (Tools)
const createSubtasksDecl: FunctionDeclaration = {
  name: 'create_subtasks',
  description: 'Deconstruct a main task into a list of subtasks with effort estimates. Use this when the user asks to break down, suggest subtasks, or make a checklist for a task.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: { type: Type.STRING, description: 'The parent task document ID' },
      subtasks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Actionable title of the subtask' },
            effortEstimate: { type: Type.NUMBER, description: 'Effort estimate in hours for this subtask' }
          },
          required: ['title', 'effortEstimate']
        },
        description: 'The list of generated subtasks with their title and effort estimates'
      }
    },
    required: ['taskId', 'subtasks']
  }
};

const prioritizeTasksDecl: FunctionDeclaration = {
  name: 'prioritize_tasks',
  description: 'Re-rank and score all active tasks using the custom urgency × importance × effort scoring algorithm. Use this when the user asks to prioritize, score, rank, or organize their schedule.',
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

const rescheduleTaskDecl: FunctionDeclaration = {
  name: 'reschedule_task',
  description: 'Update the due date of a task to shift its scheduled timeline.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: { type: Type.STRING, description: 'The task document ID' },
      newDueDate: { type: Type.STRING, description: 'Target date in YYYY-MM-DD format' }
    },
    required: ['taskId', 'newDueDate']
  }
};

const blockCalendarSlotDecl: FunctionDeclaration = {
  name: 'block_calendar_slot',
  description: 'Secure a dedicated focus slot inside the user schedule to work on a task.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: { type: Type.STRING, description: 'The task document ID' },
      title: { type: Type.STRING, description: 'Description of coding/focus block' },
      startTime: { type: Type.STRING, description: 'ISO 8601 timeline start (e.g., 2026-06-30T09:00:00-07:00)' },
      endTime: { type: Type.STRING, description: 'ISO 8601 timeline end (e.g., 2026-06-30T11:00:00-07:00)' }
    },
    required: ['taskId', 'title', 'startTime', 'endTime']
  }
};

const sendNudgeDecl: FunctionDeclaration = {
  name: 'send_nudge',
  description: 'Dispatches friendly habit reminders or prompts to build routine streaks.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: { type: Type.STRING, description: 'The task or habit document ID being nudged' },
      message: { type: Type.STRING, description: 'Custom text of the notification nudge' },
      suggestedAction: { type: Type.STRING, description: 'Actionable tip for the nudge' }
    },
    required: ['taskId', 'message', 'suggestedAction']
  }
};

const evaluateProgressDecl: FunctionDeclaration = {
  name: 'evaluate_progress',
  description: 'Analyze progress logs and streaks over a specific task, determining risk levels.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: { type: Type.STRING, description: 'The task document ID to evaluate' }
    },
    required: ['taskId']
  }
};

const negotiateTradeoffDecl: FunctionDeclaration = {
  name: 'negotiate_tradeoff',
  description: 'Propose trade-off vectors (rescheduling minor tasks or reducing scope) when timelines clash.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      conflictingTaskIds: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'The IDs of the conflicting tasks'
      },
      proposal: { type: Type.STRING, description: 'Optional initial proposal text' }
    },
    required: ['conflictingTaskIds']
  }
};

// Custom Priority Scoring Logic written in code as requested
export function calculatePriorityScoreInCode(task: Task): number {
  return (task.urgency || 5) * (task.importance || 5) * (task.effortEstimate || 1);
}

// Logic implementations for the tools
function handlePrioritizeTasks(taskList: Task[]): Task[] {
  const scored = taskList.map(task => ({
    ...task,
    priorityScore: calculatePriorityScoreInCode(task)
  }));
  // Sort descending
  return scored.sort((a, b) => b.priorityScore - a.priorityScore);
}

function handleEvaluateProgress(taskId: string, taskList: Task[]) {
  const task = taskList.find(t => t.id === taskId);
  if (!task) {
    return { taskId, title: 'Unknown Task', riskLevel: 'on-track', reasoning: 'Task not found.' };
  }
  if (task.status === 'done') {
    return { taskId, title: task.title, riskLevel: 'on-track', reasoning: 'Task is completed.' };
  }

  const today = new Date('2026-06-30T07:00:58-07:00'); // Consistent system mock time
  const dueDate = new Date(task.dueDate);
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let riskLevel: 'on-track' | 'at-risk' | 'critical' = 'on-track';
  let reasoning = '';

  if (diffDays < 0) {
    riskLevel = 'critical';
    reasoning = `The task is past its due date (${task.dueDate}) by ${Math.abs(diffDays)} days and is still incomplete.`;
  } else if (diffDays === 0 || diffDays === 1) {
    if (task.effortEstimate > 4) {
      riskLevel = 'critical';
      reasoning = `The task is due very soon (${task.dueDate}) and requires substantial effort (${task.effortEstimate} hrs left).`;
    } else {
      riskLevel = 'at-risk';
      reasoning = `Due date is imminent (${task.dueDate}) with ${task.effortEstimate} hrs of effort remaining.`;
    }
  } else if (diffDays <= 3) {
    if (task.effortEstimate > 8) {
      riskLevel = 'at-risk';
      reasoning = `Task is due in ${diffDays} days and has high effort remaining (${task.effortEstimate} hrs).`;
    } else {
      riskLevel = 'on-track';
      reasoning = `On track with ${diffDays} days remaining for ${task.effortEstimate} hrs of effort.`;
    }
  } else {
    riskLevel = 'on-track';
    reasoning = `Comfortable timeline of ${diffDays} days for ${task.effortEstimate} hrs of effort.`;
  }

  return {
    taskId,
    title: task.title,
    riskLevel,
    reasoning
  };
}

function handleNegotiateTradeoff(conflictingTaskIds: string[], taskList: Task[]) {
  const conflicts = taskList.filter(t => conflictingTaskIds.includes(t.id));
  if (conflicts.length < 2) {
    return {
      proposal: "No scheduling conflicts detected or insufficient tasks specified.",
      conflicts: []
    };
  }

  // Sort conflicts by priority score in code
  const scoredConflicts = conflicts.map(t => ({
    ...t,
    score: calculatePriorityScoreInCode(t)
  })).sort((a, b) => b.score - a.score);

  const primaryTask = scoredConflicts[0];
  const secondaryTask = scoredConflicts[1];

  const proposal = `Conflict detected between high-importance task "${primaryTask.title}" (Priority Score: ${primaryTask.score.toFixed(1)}) and "${secondaryTask.title}" (Priority Score: ${secondaryTask.score.toFixed(1)}). I propose we prioritize "${primaryTask.title}" and reschedule or de-scope "${secondaryTask.title}" by 2 days to reassign focused time. Can I update your schedule?`;

  return {
    proposal,
    conflicts: scoredConflicts
  };
}

function handleCreateSubtasks(taskId: string, subtasks: { title: string; effortEstimate: number }[]) {
  return {
    taskId,
    subtasks: subtasks.map((st, idx) => ({
      id: `sub-${Math.random().toString(36).substr(2, 5)}`,
      taskId,
      title: st.title,
      completed: false,
      effortEstimate: st.effortEstimate,
      createdAt: new Date().toISOString()
    }))
  };
}

/**
 * Executes agent text reasoning using gemini-3.5-flash with function calling
 */
export async function runAgentReasoning(
  userMessage: string,
  tasks: Task[] = [],
  goals: Goal[] = [],
  habits: Habit[] = []
) {
  try {
    const ai = getGeminiClient();

    // Construct a rich prompt containing the current local time and the full list of active user data
    const contextPrompt = `
CURRENT SYSTEM CONTEXT (Current Local Time: 2026-06-30T07:00:58-07:00):
Active tasks: ${JSON.stringify(tasks.map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate, urgency: t.urgency, importance: t.importance, effortEstimate: t.effortEstimate, status: t.status })))}
Goals: ${JSON.stringify(goals.map(g => ({ id: g.id, title: g.title, targetDate: g.targetDate, status: g.status })))}
Habits: ${JSON.stringify(habits.map(h => ({ id: h.id, title: h.title, frequency: h.frequency, streakCount: h.streakCount })))}

User instruction: "${userMessage}"
`;

    // Standard Gemini API call with function declarations
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contextPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{
          functionDeclarations: [
            createSubtasksDecl,
            prioritizeTasksDecl,
            rescheduleTaskDecl,
            blockCalendarSlotDecl,
            sendNudgeDecl,
            evaluateProgressDecl,
            negotiateTradeoffDecl
          ]
        }]
      }
    });

    const candidate = response.candidates?.[0];
    const functionCalls = candidate?.content?.parts?.filter(part => part.functionCall);
    const textPart = candidate?.content?.parts?.find(part => part.text);

    let reply = textPart?.text || "Analyzing flight telemetry...";
    let actionPerformed: any = undefined;
    let updatedTasks = [...tasks];
    let extraPayload: any = {};

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0].functionCall;
      const name = call.name;
      const args = call.args as any;

      console.log(`[Agent Orchestrator] Triggered tool call: ${name}`, args);

      let toolResult: any = null;

      switch (name) {
        case 'create_subtasks': {
          const subtaskData = handleCreateSubtasks(args.taskId, args.subtasks);
          toolResult = subtaskData;
          actionPerformed = {
            name,
            details: `Created subtasks: ${args.subtasks.map((s: any) => `${s.title} (${s.effortEstimate}h)`).join(', ')}`,
            status: 'success'
          };
          extraPayload.createdSubtasks = subtaskData.subtasks;
          break;
        }
        case 'prioritize_tasks': {
          const scoredTasks = handlePrioritizeTasks(tasks);
          toolResult = {
            scoredTasks: scoredTasks.map(t => ({
              id: t.id,
              title: t.title,
              priorityScore: (t as any).priorityScore
            }))
          };
          actionPerformed = {
            name,
            details: `Re-ranked and scored active tasks using (urgency × importance × effort remaining).`,
            status: 'success'
          };
          updatedTasks = scoredTasks;
          extraPayload.updatedTasks = scoredTasks;
          break;
        }
        case 'reschedule_task': {
          const idx = updatedTasks.findIndex(t => t.id === args.taskId);
          if (idx !== -1) {
            updatedTasks[idx] = {
              ...updatedTasks[idx],
              dueDate: args.newDueDate,
              updatedAt: new Date().toISOString()
            };
            toolResult = { success: true, taskId: args.taskId, newDueDate: args.newDueDate };
            actionPerformed = {
              name,
              details: `Rescheduled "${updatedTasks[idx].title}" to ${args.newDueDate}.`,
              status: 'success'
            };
            extraPayload.updatedTasks = updatedTasks;
          } else {
            toolResult = { success: false, error: 'Task not found' };
            actionPerformed = { name, details: `Failed to reschedule task: Task not found`, status: 'failed' };
          }
          break;
        }
        case 'block_calendar_slot': {
          toolResult = { success: true, taskId: args.taskId, title: args.title, startTime: args.startTime, endTime: args.endTime };
          const task = tasks.find(t => t.id === args.taskId);
          actionPerformed = {
            name,
            details: `Blocked focus block "${args.title}" for task "${task ? task.title : args.taskId}" (${args.startTime} to ${args.endTime}).`,
            status: 'success'
          };
          extraPayload.createdCalendarSlot = { taskId: args.taskId, title: args.title, startTime: args.startTime, endTime: args.endTime };
          break;
        }
        case 'send_nudge': {
          toolResult = { success: true, taskId: args.taskId, message: args.message, suggestedAction: args.suggestedAction };
          actionPerformed = {
            name,
            details: `Dispatched nudge: "${args.message}" | Suggested Action: "${args.suggestedAction}"`,
            status: 'success'
          };
          extraPayload.createdNudge = { taskId: args.taskId, message: args.message, suggestedAction: args.suggestedAction };
          break;
        }
        case 'evaluate_progress': {
          const evaluation = handleEvaluateProgress(args.taskId, tasks);
          toolResult = evaluation;
          actionPerformed = {
            name,
            details: `Evaluated progress risk level of "${evaluation.title}" as ${evaluation.riskLevel.toUpperCase()}.`,
            status: 'success'
          };
          extraPayload.riskEvaluation = evaluation;
          break;
        }
        case 'negotiate_tradeoff': {
          const tradeoff = handleNegotiateTradeoff(args.conflictingTaskIds, tasks);
          toolResult = tradeoff;
          actionPerformed = {
            name,
            details: `Constructed dynamic timeline trade-off solution for overlapping priorities.`,
            status: 'success'
          };
          extraPayload.tradeoffProposal = tradeoff;
          break;
        }
      }

      // Perform standard second-turn execution so Gemini explains the result of the tool
      if (toolResult) {
        console.log(`[Agent Orchestrator] Sending tool execution response back to Gemini for turns-coupling...`);
        const response2 = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: [
            { role: 'user', parts: [{ text: contextPrompt }] },
            candidate.content,
            {
              role: 'user',
              parts: [{
                functionResponse: {
                  name,
                  response: toolResult
                }
              }]
            }
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION
          }
        });

        const text2 = response2.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
        if (text2) {
          reply = text2;
        }
      }
    }

    return {
      reply,
      actionPerformed,
      updatedTasks,
      ...extraPayload
    };

  } catch (err) {
    // Elegant simulation fallback mode when API keys are not available or quota is exceeded
    console.warn("Falling back to local simulation vector mapping.", err);
    return simulateFallback(userMessage, tasks, goals, habits);
  }
}

function simulateFallback(text: string, tasks: Task[], goals: Goal[], habits: Habit[]) {
  const lowercase = text.toLowerCase();
  let reply = "Co-pilot telemetry computed successfully. Let me help you adjust task parameters.";
  let actionPerformed: any = undefined;
  let updatedTasks = [...tasks];
  let extraPayload: any = {};

  // Find the top task for fallback responses
  const topTask = tasks.find(t => t.status !== 'done') || tasks[0] || { id: '1', title: 'Review production migration plan', urgency: 9, importance: 8, effortEstimate: 2.5 };

  if (lowercase.includes('subtask') || lowercase.includes('break down') || lowercase.includes('checklist')) {
    const generatedSubtasks = [
      { title: 'Confirm database/rules staging metrics', effortEstimate: 1.0 },
      { title: 'Verify telemetry & rules testing suites', effortEstimate: 1.5 }
    ];
    const subtaskData = handleCreateSubtasks(topTask.id, generatedSubtasks);
    reply = `Deconstructing task "${topTask.title}" into manageable subtasks:\n1. ${generatedSubtasks[0].title} (1h)\n2. ${generatedSubtasks[1].title} (1.5h).\nThis reduces effort friction and keeps you perfectly on track.`;
    actionPerformed = {
      name: 'create_subtasks',
      details: `Generated checklist for "${topTask.title}" with estimated subtasks.`,
      status: 'success'
    };
    extraPayload.createdSubtasks = subtaskData.subtasks;
  } else if (lowercase.includes('prioritize') || lowercase.includes('score') || lowercase.includes('rank')) {
    const scored = handlePrioritizeTasks(tasks);
    updatedTasks = scored;
    const desc = scored.map((t, i) => `${i + 1}. ${t.title} (Priority Score: ${(t as any).priorityScore.toFixed(1)})`).join('\n');
    reply = `Your backlog has been organized using our (urgency × importance × effort remaining) algorithm:\n${desc}\nI recommend focusing on the highest scoring item first to optimize scheduling efficiency.`;
    actionPerformed = {
      name: 'prioritize_tasks',
      details: `Sorted and scored task backlog descending by priority weight.`,
      status: 'success'
    };
    extraPayload.updatedTasks = scored;
  } else if (lowercase.includes('nudge') || lowercase.includes('remind') || lowercase.includes('streak')) {
    const habit = habits[0] || { id: 'h1', title: '4 Hours of Deep Focus', streakCount: 4, userId: 'demo', frequency: 'daily', createdAt: new Date().toISOString() };
    reply = `Dispatched a streak nudge to your dashboard: "Excellent progress on your '${habit.title}' habit! Keep your ${habit.streakCount}-day streak alive."`;
    actionPerformed = {
      name: 'send_nudge',
      details: `Triggered habit reinforcement nudge for "${habit.title}".`,
      status: 'success'
    };
    extraPayload.createdNudge = { taskId: habit.id || 'h1', message: `Keep your ${habit.streakCount}-day streak alive!`, suggestedAction: 'Log focused time' };
  } else if (lowercase.includes('schedule') || lowercase.includes('reschedule') || lowercase.includes('trade-off') || lowercase.includes('tradeoff') || lowercase.includes('conflict')) {
    const tradeoff = handleNegotiateTradeoff(tasks.slice(0, 2).map(t => t.id), tasks);
    reply = tradeoff.proposal;
    actionPerformed = {
      name: 'negotiate_tradeoff',
      details: `Proposed scheduling trade-off for overlapping timeline vectors.`,
      status: 'success'
    };
    extraPayload.tradeoffProposal = tradeoff;
  } else if (lowercase.includes('progress') || lowercase.includes('evaluate') || lowercase.includes('risk')) {
    const evaluation = handleEvaluateProgress(topTask.id, tasks);
    reply = `Progress Analysis for "${evaluation.title}": Risk is ${evaluation.riskLevel.toUpperCase()}. ${evaluation.reasoning}`;
    actionPerformed = {
      name: 'evaluate_progress',
      details: `Completed progress assessment for task "${evaluation.title}".`,
      status: 'success'
    };
    extraPayload.riskEvaluation = evaluation;
  } else if (lowercase.includes('block') || lowercase.includes('calendar') || lowercase.includes('focus')) {
    reply = `I have secured a 2-hour focus block for "${topTask.title}" from 09:00 AM to 11:00 AM. This time is secured against other distractions!`;
    actionPerformed = {
      name: 'block_calendar_slot',
      details: `Secured focused programming slot from 09:00 to 11:00 for "${topTask.title}".`,
      status: 'success'
    };
    extraPayload.createdCalendarSlot = { taskId: topTask.id, title: `Deep Work: ${topTask.title}`, startTime: '2026-06-30T09:00:00-07:00', endTime: '2026-06-30T11:00:00-07:00' };
  }

  return { reply, actionPerformed, updatedTasks, ...extraPayload };
}
