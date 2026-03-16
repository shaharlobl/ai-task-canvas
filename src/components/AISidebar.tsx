import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, Bot, Sparkles, X } from 'lucide-react';
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

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
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

      if (resp.status === 429) {
        toast.error('Rate limited — please try again in a moment');
        setIsStreaming(false);
        return;
      }
      if (resp.status === 402) {
        toast.error('AI credits exhausted — please add funds');
        setIsStreaming(false);
        return;
      }
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
            if (content) {
              fullContent += content;
              setStreamingContent(fullContent);
            }
            // Check for tool calls in the response
            const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
            if (toolCalls) hasToolActions = true;
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Flush remaining buffer
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
            if (content) {
              fullContent += content;
              setStreamingContent(fullContent);
            }
          } catch { /* ignore */ }
        }
      }

      if (fullContent) {
        await addMessage.mutateAsync({ role: 'assistant', content: fullContent });
      }
      setStreamingContent('');

      // If the AI performed tool actions, refresh tasks
      if (hasToolActions) {
        onTasksChanged();
      }
    } catch (e) {
      console.error('Chat error:', e);
      toast.error('Failed to get AI response');
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, tasks, addMessage, onTasksChanged]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!open) return null;

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col animate-slide-in-right h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-ai-accent/10 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-ai-accent" />
          </div>
          <span className="text-sm font-semibold">AI Agent</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => clearMessages.mutate()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {messages.length === 0 && !streamingContent && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-10 h-10 rounded-xl bg-ai-accent/10 flex items-center justify-center mb-3">
              <Bot className="h-5 w-5 text-ai-accent" />
            </div>
            <p className="text-sm font-medium mb-1">AI Board Agent</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              I can create, move, and organize your tasks. Try "Add a high priority task for API research" or "What should I focus on?"
            </p>
            <div className="mt-3 text-[10px] text-muted-foreground/60 font-mono">⌘K to focus</div>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed',
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
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
          <div className="flex justify-start">
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
              <span className="w-1.5 h-1.5 rounded-full bg-ai-accent animate-pulse-dot" />
              <span className="w-1.5 h-1.5 rounded-full bg-ai-accent animate-pulse-dot [animation-delay:0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-ai-accent animate-pulse-dot [animation-delay:0.6s]" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex items-end gap-2 bg-secondary rounded-lg p-2">
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
            className="h-6 w-6 shrink-0"
            disabled={!input.trim() || isStreaming}
            onClick={sendMessage}
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
