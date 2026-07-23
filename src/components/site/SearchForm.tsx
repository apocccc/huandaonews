"use client";

import { useRouter } from "@/i18n/navigation";
import { useState } from "react";

export function SearchForm({
  placeholder,
  buttonLabel,
}: {
  placeholder: string;
  buttonLabel: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      role="search"
      className="hidden md:flex items-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={buttonLabel}
        className="w-44 rounded-l-full border border-line bg-bg-sub px-4 py-1.5 text-sm outline-none focus:border-primary"
      />
      <button
        type="submit"
        className="rounded-r-full border border-l-0 border-line bg-bg-sub px-3 py-1.5 text-sm text-gray hover:text-primary"
        aria-label={buttonLabel}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>
    </form>
  );
}
