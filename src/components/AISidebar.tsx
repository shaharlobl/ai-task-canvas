import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, Bot, Sparkles, X, MessageSquare, ListTodo, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useChatMessages } from '@/hooks/useChatMessages';
import { Task } from '@/types/kanban';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

interface AISidebarProps {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  onTasksChanged: () => void;
}

const SUGGESTIONS = [
  { icon: MessageSquare, label: 'Summarize board', message: 'Summarize my current board status' },
  { icon: ListTodo, label: 'Add a task', message: 'Create a new task for me' },
  { icon: Brain, label: 'What to focus on?', message: 'What should I focus on next?' },
];

export function AISidebar({ open, onClose, tasks, onTasksChanged }: AISidebarProps) {
  const { messages, addMessage, clearMessages } = useChatMessages();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || isStreaming) return;
    if (!overrideText) setInput('');
    setIsStreaming(true);
    setStreamingContent('');

    await addMessage.mutateAsync({ role: 'user', content: text });

    const allMessages = [
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: text },
    ];

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, tasks }),
      });

      if (resp.status === 429) { toast.error('Rate limited — please try again in a moment'); setIsStreaming(false); return; }
      if (resp.status === 402) { toast.error('AI credits exhausted — please add funds'); setIsStreaming(false); return; }
      if (!resp.ok || !resp.body) throw new Error('Stream failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullContent = '';
      let streamDone = false;
      let hasToolActions = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) { fullContent += content; setStreamingContent(fullContent); }
            const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
            if (toolCalls) hasToolActions = true;
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) { fullContent += content; setStreamingContent(fullContent); }
          } catch { /* ignore */ }
        }
      }

      if (fullContent) {
        await addMessage.mutateAsync({ role: 'assistant', content: fullContent });
      }
      setStreamingContent('');
      if (hasToolActions) onTasksChanged();
    } catch (e) {
      console.error('Chat error:', e);
      toast.error('Failed to get AI response');
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, tasks, addMessage, onTasksChanged]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!open) return null;

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col animate-slide-in-right h-full">
      {/* Gradient Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-accent to-purple-500">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">AI Agent</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10" onClick={() => clearMessages.mutate()}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {messages.length === 0 && !streamingContent && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center mb-3">
              <Bot className="h-6 w-6 text-accent" />
            </div>
            <p className="text-sm font-medium mb-1">AI Board Agent</p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              I can create, move, and organize your tasks. Try asking me anything!
            </p>
            <div className="flex flex-col gap-2 w-full">
              {SUGGESTIONS.map(s => (
                <button
                  key={s.label}
                  onClick={() => sendMessage(s.message)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-accent/10 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                >
                  <s.icon className="h-3.5 w-3.5 text-accent shrink-0" />
                  {s.label}
                </button>
              ))}
            </div>
            <div className="mt-4 text-[10px] text-muted-foreground/60 font-mono">⌘K to focus</div>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex animate-fade-in', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed',
              msg.role === 'user'
                ? 'bg-gradient-to-r from-accent to-purple-500 text-white'
                : 'bg-ai-surface text-foreground'
            )}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-xs prose-zinc dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : msg.content}
            </div>
          </div>
        ))}
        {streamingContent && (
          <div className="flex justify-start animate-fade-in">
            <div className="max-w-[90%] rounded-lg px-3 py-2 text-xs bg-ai-surface text-foreground leading-relaxed">
              <div className="prose prose-xs prose-zinc dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <ReactMarkdown>{streamingContent}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
        {isStreaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 bg-ai-surface flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse-dot [animation-delay:0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot [animation-delay:0.6s]" />
            </div>
          </div>
        )}
      </div>

      {/* Input with gradient border */}
      <div className="p-3 border-t border-border">
        <div className="gradient-border-focus flex items-end gap-2 bg-secondary rounded-lg p-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything or give a command..."
            rows={1}
            className="flex-1 bg-transparent text-xs resize-none outline-none placeholder:text-muted-foreground min-h-[20px] max-h-[80px]"
          />
          <Button
            size="icon"
            className="h-6 w-6 shrink-0 bg-gradient-to-r from-accent to-purple-500 hover:opacity-90 border-0"
            disabled={!input.trim() || isStreaming}
            onClick={() => sendMessage()}
          >
            <Send className="h-3 w-3 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
}
