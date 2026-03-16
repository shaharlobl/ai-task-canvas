import { Task } from '@/types/kanban';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, GripVertical, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

const priorityColors: Record<string, string> = {
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
};

export function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative bg-card border border-border rounded-lg p-3 cursor-default',
        'transition-all duration-200 ease-out',
        'hover:shadow-md hover:-translate-y-0.5 hover:border-accent/30',
        isDragging && 'opacity-50 shadow-lg rotate-1 scale-105 z-50'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className={cn(
            'mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-opacity',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('w-2 h-2 rounded-full shrink-0', priorityColors[task.priority])} />
            <h4 className="text-sm font-medium text-card-foreground truncate">{task.title}</h4>
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 ml-4 mb-2">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-1.5 ml-4 flex-wrap">
            {task.category && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                {task.category}
              </Badge>
            )}
            {task.due_date && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Calendar className="h-2.5 w-2.5" />
                {format(new Date(task.due_date), 'MMM d')}
              </span>
            )}
          </div>
        </div>
        <div className={cn(
          'flex items-center gap-0.5 transition-opacity',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}>
          <button
            onClick={() => onEdit(task)}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
