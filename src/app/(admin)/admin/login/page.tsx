import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="text-center text-2xl font-black text-primary">
          環島新聞網
        </p>
        <div className="mt-6 rounded-lg border border-line bg-bg p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
