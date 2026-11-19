import { Bot, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, errMsg } from "@/lib/api";

type ChatResource = { id: number; name: string; category: string; path: string };
type Message = { id: number; role: "assistant" | "user"; text: string; resources?: ChatResource[]; suggestions?: string[] };
type ChatResponse = { reply: string; resources?: ChatResource[]; suggestions?: string[] };

export function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      text: "Hi! I’m your campus resource assistant. Ask me to find gear or explain how the platform works.",
      suggestions: ["Find a resource", "How do bookings work?", "How do I list an item?"],
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async (text = message) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const nextId = Date.now();
    setMessages((items) => [...items, { id: nextId, role: "user", text: trimmed }]);
    setMessage("");
    setSending(true);
    try {
      const result = await api.post<ChatResponse>("/api/chat", { message: trimmed });
      setMessages((items) => [
        ...items,
        {
          id: nextId + 1,
          role: "assistant",
          text: result.reply,
          resources: result.resources,
          suggestions: result.suggestions,
        },
      ]);
    } catch (error) {
      setMessages((items) => [
        ...items,
        { id: nextId + 1, role: "assistant", text: errMsg(error) },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="Campus resource assistant"
          className="fixed bottom-20 right-4 z-[60] flex h-[min(560px,calc(100vh-112px))] w-[calc(100vw-32px)] max-w-[380px] flex-col overflow-hidden rounded-panel border border-line bg-white shadow-lift-lg sm:right-6"
        >
          <header className="on-night flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cobalt text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Campus Assistant</p>
                <p className="text-[11px] text-white/60">Resource and platform help</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Close assistant"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto bg-canvas px-3 py-4">
            <div className="space-y-3">
              {messages.map((item) => (
                <div key={item.id} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      item.role === "user"
                        ? "rounded-br-md bg-cobalt text-white"
                        : "rounded-bl-md border border-line bg-white text-ink shadow-subtle"
                    }`}
                  >
                    <p>{item.text}</p>
                    {item.resources && item.resources.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {item.resources.map((resource) => (
                          <Link
                            key={resource.id}
                            to={resource.path}
                            onClick={() => setOpen(false)}
                            className="block rounded-ctl border border-line bg-paper px-3 py-2 text-xs font-semibold text-cobalt hover:border-cobalt/30 hover:bg-cobalt-50"
                          >
                            {resource.name}
                            <span className="ml-1.5 font-normal text-ink-3">{resource.category}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                    {item.suggestions && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {item.suggestions.map((suggestion) => (
                          <button
                            type="button"
                            key={suggestion}
                            onClick={() => void send(suggestion)}
                            disabled={sending}
                            className="rounded-full border border-cobalt/20 bg-cobalt-50 px-2.5 py-1 text-[11px] font-bold text-cobalt hover:border-cobalt/40 disabled:opacity-50"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-line bg-white px-3.5 py-2.5 text-xs text-ink-3 shadow-subtle">
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
            className="border-t border-line bg-white p-3"
          >
            <div className="flex items-center gap-2">
              <label htmlFor="chat-message" className="sr-only">Message the campus assistant</label>
              <input
                id="chat-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={500}
                placeholder="Ask about resources..."
                className="h-10 min-w-0 flex-1 rounded-ctl border border-line bg-paper px-3 text-sm outline-none placeholder:text-ink-3 focus:border-cobalt"
              />
              <button
                type="submit"
                disabled={sending || !message.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ctl bg-cobalt text-white hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-4 right-4 z-[60] flex h-14 items-center gap-2 rounded-full bg-cobalt px-4 text-white shadow-lift-lg ring-4 ring-white/70 hover:bg-cobalt-700 sm:right-6"
        aria-label={open ? "Close campus assistant" : "Open campus assistant"}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
        <span className="hidden text-sm font-bold sm:inline">{open ? "Close" : "Assistant"}</span>
      </button>
    </>
  );
}
