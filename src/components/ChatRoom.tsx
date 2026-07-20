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

const GROUP_WINDOW_MS = 3 * 60 * 1000;
const URL_RE = /(https?:\/\/\S+)/g;

/** Render plain URLs as safe clickable links (no HTML injection — pure JSX). */
function linkify(body: string) {
  const parts = body.split(URL_RE);
  if (parts.length === 1) return body;
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="ltr inline-block break-all text-accent underline"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

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
  const [reconnecting, setReconnecting] = useState(false);
  const [unseen, setUnseen] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const wasConnected = useRef(false);
  const lastMsgId = useRef<number | null>(null);

  useEffect(() => {
    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setReconnecting(false);
      wasConnected.current = true;
    });
    socket.on("disconnect", () => {
      setConnected(false);
      // only show the reconnect banner if we had a working connection before
      if (wasConnected.current) setReconnecting(true);
    });
    socket.on("chat:history", (msgs: Msg[]) => setMessages(msgs));
    socket.on("chat:new", (msg: Msg) => {
      setMessages((m) => [...m.slice(-199), msg]);
      if (!stickToBottom.current) setUnseen(true);
    });
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

  // remember the newest message id so only truly new bubbles animate
  useEffect(() => {
    if (messages.length) lastMsgId.current = messages[messages.length - 1].id;
  }, [messages]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (stickToBottom.current) setUnseen(false);
  }

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    stickToBottom.current = true;
    setUnseen(false);
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

      {/* reconnect banner */}
      {reconnecting && !connected && (
        <div className="border-b border-line bg-warn/10 px-4 py-1.5 text-center text-xs text-warn">
          اتصال قطع شد؛ در حال اتصال مجدد...
        </div>
      )}

      {/* messages */}
      <div className="relative flex min-h-0 flex-1 flex-col">
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
          {messages.map((m, i) => {
            const mine = me?.id === m.userId;
            const prev = i > 0 ? messages[i - 1] : null;
            const grouped =
              !!prev &&
              prev.userId === m.userId &&
              m.createdAt - prev.createdAt < GROUP_WINDOW_MS;
            const isNewest = i === messages.length - 1;
            const animate = isNewest && lastMsgId.current !== null && m.id !== lastMsgId.current;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-start" : "justify-end"} ${
                  grouped ? "-mt-1.5" : ""
                } ${animate ? "msg-in" : ""}`}
              >
                <div
                  className={`group max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-6 ${
                    mine ? "bg-accent/15 text-fg" : "bg-panel-2 text-fg"
                  }`}
                >
                  {!grouped && (
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
                  )}
                  <div className="whitespace-pre-wrap break-words">
                    {linkify(m.body)}
                    {grouped && me?.isAdmin && (
                      <button
                        onClick={() => deleteMsg(m.id)}
                        className="mr-2 hidden text-xs text-danger group-hover:inline"
                        title="حذف پیام"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* new messages indicator */}
        {unseen && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-line bg-panel-2 px-4 py-1.5 text-xs text-accent shadow-lg transition hover:bg-panel"
          >
            پیام‌های جدید ↓
          </button>
        )}
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
