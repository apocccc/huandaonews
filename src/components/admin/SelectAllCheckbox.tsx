"use client";

/** 同一フォーム内の name="ids" チェックボックスを一括ON/OFFする */
export function SelectAllCheckbox({ label }: { label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      onChange={(e) => {
        const form = e.currentTarget.closest("form");
        if (!form) return;
        form
          .querySelectorAll<HTMLInputElement>('input[name="ids"]')
          .forEach((box) => {
            box.checked = e.currentTarget.checked;
          });
      }}
    />
  );
}
