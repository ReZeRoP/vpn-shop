import Navbar from "@/components/Navbar";
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "ثبت‌نام" };

export default function RegisterPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <AuthForm mode="register" />
      </main>
    </>
  );
}
