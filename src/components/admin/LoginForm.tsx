"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction } from "@/app/(admin)/admin/actions";

export function LoginForm() {
  const t = useTranslations("admin.login");
  const [state, action, pending] = useActionState(loginAction, {
    error: false,
  });

  return (
    <form action={action} className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">{t("title")}</h1>
      {state.error ? (
        <p className="rounded bg-primary-light px-3 py-2 text-sm text-primary-dark">
          {t("error")}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("email")}
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded border border-line px-3 py-2 outline-none focus:border-primary"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("password")}
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded border border-line px-3 py-2 outline-none focus:border-primary"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-primary px-4 py-2.5 font-bold text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {t("submit")}
      </button>
    </form>
  );
}
