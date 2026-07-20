"use client";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import Link from "next/link";

interface Msg {
  id: number;
  userId: number;
  username: string;
  body: string;
  createdAt: number;
}

const faNum = new Intl.NumberFormat("fa-IR");
const faTime = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" });

export default function ChatRoom({
  me,
}: {
  me: { id: number; username: string; isAdmin: boolean } | null;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [online, setOnline] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("chat:history", (msgs: Msg[]) => setMessages(msgs));
    socket.on("chat:new", (msg: Msg) => setMessages((m) => [...m.slice(-199), msg]));
    socket.on("chat:deleted", (id: number) => setMessages((m) => m.filter((x) => x.id !== id)));
    socket.on("chat:online", (n: number) => setOnline(n));

    return () => {
      socket.disconnect();
    };
  }, []);

  // autoscroll only when the user is already near the bottom
  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !socketRef.current) return;
    setError("");
    socketRef.current.emit("chat:send", body, (res: { ok?: boolean; error?: string }) => {
      if (res?.error) setError(res.error);
      else setText("");
    });
  }

  function deleteMsg(id: number) {
    socketRef.current?.emit("chat:delete", id);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-card border border-line bg-panel">
      {/* header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h1 className="font-bold">گفتگوی عمومی</h1>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-ok" : "bg-danger"}`} />
          {faNum.format(online)} نفر آنلاین
        </div>
      </div>

      {/* messages */}
      <div
        ref={listRef}
        onScroll={onScroll}
        className="thin-scroll min-h-[50vh] flex-1 space-y-3 overflow-y-auto p-4"
        style={{ maxHeight: "60vh" }}
      >
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            {connected ? "هنوز پیامی نیست — اولین نفر باشید!" : "در حال اتصال..."}
          </p>
        )}
        {messages.map((m) => {
          const mine = me?.id === m.userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
              <div
                className={`group max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-6 ${
                  mine ? "bg-accent/15 text-fg" : "bg-panel-2 text-fg"
                }`}
              >
                <div className="mb-0.5 flex items-center gap-2 text-xs">
                  <span className={mine ? "text-accent" : "text-warn"}>{m.username}</span>
                  <span className="text-muted">{faTime.format(new Date(m.createdAt))}</span>
                  {me?.isAdmin && (
                    <button
                      onClick={() => deleteMsg(m.id)}
                      className="hidden text-danger group-hover:inline"
                      title="حذف پیام"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* composer */}
      <div className="border-t border-line p-3">
        {me ? (
          <form onSubmit={send} className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder="پیام خود را بنویسید..."
              className="flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-accent"
            />
            <button
              disabled={!connected || !text.trim()}
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
            >
              ارسال
            </button>
          </form>
        ) : (
          <p className="py-1 text-center text-sm text-muted">
            برای ارسال پیام{" "}
            <Link href="/login" className="text-accent hover:underline">
              وارد شوید
            </Link>
          </p>
        )}
        {error && <p className="mt-2 text-center text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}
