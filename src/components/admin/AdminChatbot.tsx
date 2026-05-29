import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MessageSquare, Send, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg px-3 py-2 w-fit">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
    </div>
  );
}

function AssistantBubble({ content }: { content: string }) {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    // not JSON
  }

  if (Array.isArray(parsed)) {
    return (
      <div className="bg-muted rounded-lg px-3 py-2 space-y-1">
        {(parsed as Record<string, unknown>[]).map((row, i) => (
          <div key={i} className="rounded border border-border px-2 py-1 space-y-0.5">
            {Object.entries(row).map(([k, v]) => (
              <div key={k} className="flex gap-1 text-xs">
                <span className="shrink-0 text-muted-foreground">{k}:</span>
                <span className="text-foreground">{String(v)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-muted rounded-lg px-3 py-2 text-sm whitespace-pre-wrap">
      {content}
    </div>
  );
}

export default function AdminChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) setMessages([]);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-chat', {
        body: { messages: next },
      });
      if (error) throw error;
      setMessages([...next, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="flex flex-col p-0 sm:max-w-md">
          <SheetHeader className="shrink-0 border-b border-border px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4" />
              Admin Assistant
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 px-4 py-3">
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="max-w-[85%]">
                      <AssistantBubble content={msg.content} />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <TypingIndicator />
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="flex shrink-0 gap-2 border-t border-border px-4 py-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about platform data..."
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
