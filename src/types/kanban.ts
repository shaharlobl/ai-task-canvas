export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  category: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export const COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'todo', title: 'To Do', color: 'column-todo' },
  { id: 'in_progress', title: 'In Progress', color: 'column-progress' },
  { id: 'completed', title: 'Completed', color: 'column-done' },
];

export const CATEGORY_COLORS: Record<string, string> = {
  design: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  dev: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  research: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  marketing: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  bug: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  feature: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  default: 'bg-secondary text-secondary-foreground',
};

export function getCategoryColor(category: string): string {
  const key = category.toLowerCase().trim();
  return CATEGORY_COLORS[key] || CATEGORY_COLORS.default;
}
