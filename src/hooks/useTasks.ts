import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, TaskStatus, TaskPriority } from '@/types/kanban';
import { toast } from 'sonner';

export function useTasks() {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('position', { ascending: true });
      if (error) throw error;
      return data as Task[];
    },
  });

  const createTask = useMutation({
    mutationFn: async (task: {
      title: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      due_date?: string;
      category?: string;
    }) => {
      const maxPos = tasks
        .filter(t => t.status === (task.status || 'todo'))
        .reduce((max, t) => Math.max(max, t.position), -1);
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: task.title,
          description: task.description || '',
          status: task.status || 'todo',
          priority: task.priority || 'medium',
          due_date: task.due_date || null,
          category: task.category || '',
          position: maxPos + 1,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created');
    },
    onError: (e) => toast.error('Failed to create task: ' + e.message),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (e) => toast.error('Failed to update: ' + e.message),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
    },
    onError: (e) => toast.error('Failed to delete: ' + e.message),
  });

  const moveTask = useMutation({
    mutationFn: async ({ id, status, position }: { id: string; status: TaskStatus; position: number }) => {
      const { error } = await supabase.from('tasks').update({ status, position }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  return { tasks, isLoading, createTask, updateTask, deleteTask, moveTask };
}
