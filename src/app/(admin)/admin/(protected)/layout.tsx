import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { logoutAction } from "../actions";
import { AdminLocaleSelect } from "@/components/admin/AdminLocaleSelect";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const t = await getTranslations("admin");
  const isAdmin = session.user.role === "admin";
  const canManageTaxonomy =
    session.user.role === "admin" || session.user.role === "editor";

  const nav = [
    { href: "/admin", label: t("nav.dashboard") },
    { href: "/admin/articles", label: t("nav.articles") },
    ...(canManageTaxonomy
      ? [
          { href: "/admin/rss", label: t("nav.rss") },
          { href: "/admin/categories", label: t("nav.categories") },
        ]
      : []),
    ...(isAdmin ? [{ href: "/admin/users", label: t("nav.users") }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="w-full border-b border-line bg-ink text-white md:w-56 md:shrink-0 md:border-b-0">
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <Link href="/admin" className="text-lg font-black text-white">
            環島新聞網{" "}
            <span className="text-xs font-medium text-white/60">Admin</span>
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:pb-0">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-2 text-sm font-medium text-white/80 whitespace-nowrap hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:block px-4 py-6 mt-auto">
          <p className="text-xs text-white/50">{session.user.name}</p>
          <div className="mt-2">
            <AdminLocaleSelect current={session.user.adminLocale} />
          </div>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/" className="text-white/70 hover:text-white">
              {t("nav.viewSite")}
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-white/70 hover:text-white"
              >
                {t("nav.signOut")}
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
