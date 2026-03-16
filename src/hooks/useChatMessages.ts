import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/types/kanban';

export function useChatMessages() {
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ['chat_messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ChatMessage[];
    },
  });

  const addMessage = useMutation({
    mutationFn: async (msg: { role: 'user' | 'assistant'; content: string }) => {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert(msg)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat_messages'] }),
  });

  const clearMessages = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat_messages'] }),
  });

  return { messages, addMessage, clearMessages };
}
