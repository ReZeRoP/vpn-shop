import Navbar from "@/components/Navbar";
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "ورود" };

export default function LoginPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <AuthForm mode="login" />
      </main>
    </>
  );
}
