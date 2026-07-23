import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createUserAction } from "../../users-actions";

export const dynamic = "force-dynamic";

const ROLES = ["admin", "editor", "author", "contributor"] as const;

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin");
  const t = await getTranslations("admin.users");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, slug: true },
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-black">{t("title")}</h1>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-bg">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-line bg-bg-sub text-left text-xs text-gray">
              <th className="px-4 py-2.5 font-medium">{t("name")}</th>
              <th className="px-4 py-2.5 font-medium">{t("email")}</th>
              <th className="px-4 py-2.5 font-medium">{t("role")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5 font-medium">{u.name}</td>
                <td className="px-4 py-2.5 text-gray">{u.email}</td>
                <td className="px-4 py-2.5 text-gray">{u.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-lg font-bold">{t("add")}</h2>
      <form
        action={createUserAction}
        className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg p-3 text-sm"
      >
        <input
          name="name"
          placeholder={t("name")}
          required
          className="w-32 rounded border border-line px-2 py-1.5"
        />
        <input
          name="email"
          type="email"
          placeholder={t("email")}
          required
          className="w-48 rounded border border-line px-2 py-1.5"
        />
        <input
          name="password"
          type="password"
          placeholder={t("password")}
          required
          minLength={8}
          className="w-36 rounded border border-line px-2 py-1.5"
        />
        <select name="role" className="rounded border border-line px-2 py-1.5">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="ml-auto rounded bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark"
        >
          {t("add")}
        </button>
      </form>
    </div>
  );
}
