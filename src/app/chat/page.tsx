import Navbar from "@/components/Navbar";
import { currentUser } from "@/lib/auth-server";
import ChatRoom from "@/components/ChatRoom";

export const metadata = { title: "گفتگوی عمومی" };
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await currentUser();
  return (
    <>
      <Navbar />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        <ChatRoom
          me={user ? { id: user.id, username: user.username, isAdmin: user.role === "admin" } : null}
        />
      </main>
    </>
  );
}
