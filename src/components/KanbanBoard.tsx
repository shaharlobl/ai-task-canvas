import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { useTasks } from '@/hooks/useTasks';
import { Task, TaskStatus, COLUMNS } from '@/types/kanban';
import { KanbanColumn } from './KanbanColumn';
import { TaskDialog } from './TaskDialog';
import { TaskCard } from './TaskCard';
import { AISidebar } from './AISidebar';
import { Plus, Sparkles, Layout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';

export function KanbanBoard() {
  const { tasks, isLoading, createTask, updateTask, deleteTask, moveTask } = useTasks();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('todo');
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], completed: [] };
    tasks.forEach(t => map[t.status as TaskStatus]?.push(t));
    Object.values(map).forEach(arr => arr.sort((a, b) => a.position - b.position));
    return map;
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Determine target status: could be a column ID or another task's ID
    let targetStatus: TaskStatus;
    const overTask = tasks.find(t => t.id === over.id);
    if (overTask) {
      targetStatus = overTask.status as TaskStatus;
    } else {
      targetStatus = over.id as TaskStatus;
    }

    const targetTasks = tasksByStatus[targetStatus].filter(t => t.id !== taskId);
    let position = targetTasks.length;

    if (overTask) {
      const overIndex = targetTasks.findIndex(t => t.id === overTask.id);
      position = overIndex >= 0 ? overIndex : targetTasks.length;
    }

    moveTask.mutate({ id: taskId, status: targetStatus, position });
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Could add preview logic here
  };

  const handleSave = (data: any) => {
    if (editingTask) {
      updateTask.mutate({ id: editingTask.id, ...data });
    } else {
      createTask.mutate(data);
    }
    setEditingTask(null);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleAddTask = (status: TaskStatus) => {
    setEditingTask(null);
    setDefaultStatus(status);
    setDialogOpen(true);
  };

  const totalTasks = tasks.length;
  const completedTasks = tasksByStatus.completed.length;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Layout className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Kanban Board</h1>
              <p className="text-[10px] text-muted-foreground font-mono">
                {completedTasks}/{totalTasks} completed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => handleAddTask('todo')}>
              <Plus className="h-3 w-3" /> Add Task
            </Button>
            <Button
              size="sm"
              variant={aiOpen ? 'default' : 'outline'}
              className="h-7 text-xs gap-1.5"
              onClick={() => setAiOpen(!aiOpen)}
            >
              <Sparkles className="h-3 w-3" /> AI Agent
            </Button>
          </div>
        </header>

        {/* Board */}
        <div className="flex-1 overflow-x-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading...</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
            >
              <div className="grid grid-cols-3 gap-6 h-full">
                {COLUMNS.map(col => (
                  <KanbanColumn
                    key={col.id}
                    id={col.id}
                    title={col.title}
                    tasks={tasksByStatus[col.id]}
                    onEdit={handleEdit}
                    onDelete={(id) => deleteTask.mutate(id)}
                    onAddTask={handleAddTask}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeTask && (
                  <TaskCard task={activeTask} onEdit={() => {}} onDelete={() => {}} />
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>

      {/* AI Sidebar */}
      <AISidebar
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        tasks={tasks}
        onTasksChanged={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}
      />

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        defaultStatus={defaultStatus}
        onSave={handleSave}
      />
    </div>
  );
}
