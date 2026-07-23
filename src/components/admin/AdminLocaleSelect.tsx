"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { setAdminLocaleAction } from "@/app/(admin)/admin/actions";

const OPTIONS = [
  { value: "zh_Hant", label: "繁體中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
];

export function AdminLocaleSelect({ current }: { current: string }) {
  const t = useTranslations("admin.common");
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex flex-col gap-1 text-xs text-white/50">
      {t("language")}
      <select
        value={current}
        disabled={pending}
        onChange={(e) =>
          startTransition(() => setAdminLocaleAction(e.target.value))
        }
        className="rounded border border-white/20 bg-ink px-2 py-1 text-sm text-white"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
