"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Youtube from "@tiptap/extension-youtube";
import type { ArticleStatus } from "@prisma/client";
import {
  changeStatusAction,
  deleteArticleAction,
  restoreRevisionAction,
  saveArticleAction,
} from "@/app/(admin)/admin/actions";

type EditorArticle = {
  id: string;
  title: string;
  lead: string;
  slug: string;
  body: unknown;
  status: ArticleStatus;
  categoryId: string;
  categorySlug: string;
  tags: string;
  isBreaking: boolean;
  isPinned: boolean;
  prSourceName: string | null;
  heroImageId: string | null;
  heroImageUrl: string | null;
  publishAt: string | null;
};

type CategoryOption = { id: string; slug: string; nameZh: string };
type RevisionItem = { id: string; createdAt: string; editorName: string };

export function ArticleEditor({
  article,
  categories,
  revisions,
  canPublish,
  previewToken,
}: {
  article: EditorArticle;
  categories: CategoryOption[];
  revisions: RevisionItem[];
  canPublish: boolean;
  previewToken: string;
}) {
  const t = useTranslations("admin.editor");
  const ts = useTranslations("admin.status");
  const [title, setTitle] = useState(article.title);
  const [lead, setLead] = useState(article.lead);
  const [slug, setSlug] = useState(article.slug);
  const [categoryId, setCategoryId] = useState(article.categoryId);
  const [tags, setTags] = useState(article.tags);
  const [isBreaking, setIsBreaking] = useState(article.isBreaking);
  const [isPinned, setIsPinned] = useState(article.isPinned);
  const [prSourceName, setPrSourceName] = useState(article.prSourceName ?? "");
  const [heroImageId, setHeroImageId] = useState(article.heroImageId);
  const [heroImageUrl, setHeroImageUrl] = useState(article.heroImageUrl);
  const [publishAt, setPublishAt] = useState(
    article.publishAt ? article.publishAt.slice(0, 16) : ""
  );
  const [status, setStatus] = useState<ArticleStatus>(article.status);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [charCount, setCharCount] = useState(0);
  const [pendingStatus, startStatusTransition] = useTransition();
  const dirtyRef = useRef(false);

  const isPublished = status === "published";
  const isPressRelease =
    categories.find((c) => c.id === categoryId)?.slug === "press-release";

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: t("bodyPlaceholder") }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Youtube.configure({ nocookie: true }),
    ],
    content: (article.body as object) ?? undefined,
    onCreate({ editor }) {
      setCharCount(editor.state.doc.textContent.length);
    },
    onUpdate({ editor }) {
      dirtyRef.current = true;
      setCharCount(editor.state.doc.textContent.length);
    },
  });

  const save = useCallback(async () => {
    if (!editor) return;
    setSaveState("saving");
    try {
      const result = await saveArticleAction({
        id: article.id,
        title,
        lead,
        slug,
        body: editor.getJSON(),
        categoryId,
        tags,
        isBreaking,
        isPinned,
        prSourceName: prSourceName || null,
        heroImageId,
        publishAt: publishAt ? new Date(publishAt).toISOString() : null,
      });
      if (result.slug !== slug) setSlug(result.slug);
      dirtyRef.current = false;
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("idle");
    }
  }, [
    editor,
    article.id,
    title,
    lead,
    slug,
    categoryId,
    tags,
    isBreaking,
    isPinned,
    prSourceName,
    heroImageId,
    publishAt,
  ]);

  const saveRef = useRef(save);
  saveRef.current = save;

  // 30秒ごとの自動保存 + Cmd/Ctrl+S
  useEffect(() => {
    const interval = setInterval(() => {
      if (dirtyRef.current) saveRef.current();
    }, 30_000);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(interval);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const markDirty = () => {
    dirtyRef.current = true;
  };

  const changeStatus = (next: ArticleStatus) => {
    startStatusTransition(async () => {
      await saveRef.current();
      const result = await changeStatusAction(article.id, next);
      setStatus(result.status);
    });
  };

  const uploadImage = async (file: File): Promise<{ id: string; url: string } | null> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("alt", file.name.replace(/\.[a-z0-9]+$/i, ""));
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    if (!res.ok) return null;
    return res.json();
  };

  const insertImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const media = await uploadImage(file);
    if (media) {
      editor.chain().focus().setImage({ src: media.url }).run();
    }
    e.target.value = "";
  };

  const setHero = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const media = await uploadImage(file);
    if (media) {
      setHeroImageId(media.id);
      setHeroImageUrl(media.url);
      markDirty();
    }
    e.target.value = "";
  };

  const btn = (active: boolean) =>
    `rounded px-2 py-1 text-sm font-medium ${
      active ? "bg-primary text-white" : "hover:bg-bg-sub"
    }`;

  return (
    <div className="mx-auto max-w-5xl">
      {/* 上部バー */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-bg px-3 py-1 font-medium border border-line">
            {ts(status)}
          </span>
          <span className="text-xs text-gray">
            {saveState === "saving"
              ? t("saving")
              : saveState === "saved"
                ? t("saved")
                : t("autosaveOn")}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/preview/${article.id}?token=${previewToken}`}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-line bg-bg px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-primary"
          >
            {t("preview")}
          </a>
          <button
            type="button"
            onClick={() => save()}
            className="rounded border border-line bg-bg px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-primary"
          >
            {t("save")}
          </button>
          {status === "draft" || status === "review" ? (
            canPublish ? (
              <button
                type="button"
                disabled={pendingStatus}
                onClick={() => changeStatus("published")}
                className="rounded bg-primary px-4 py-1.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {t("publish")}
              </button>
            ) : status === "draft" ? (
              <button
                type="button"
                disabled={pendingStatus}
                onClick={() => changeStatus("review")}
                className="rounded bg-primary px-4 py-1.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {t("submitReview")}
              </button>
            ) : null
          ) : null}
          {status === "review" && canPublish ? (
            <button
              type="button"
              disabled={pendingStatus}
              onClick={() => changeStatus("draft")}
              className="rounded border border-line bg-bg px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-primary"
            >
              {t("backToDraft")}
            </button>
          ) : null}
          {isPublished && canPublish ? (
            <button
              type="button"
              disabled={pendingStatus}
              onClick={() => changeStatus("archived")}
              className="rounded border border-line bg-bg px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-primary"
            >
              {t("unpublish")}
            </button>
          ) : null}
          {status === "archived" && canPublish ? (
            <button
              type="button"
              disabled={pendingStatus}
              onClick={() => changeStatus("published")}
              className="rounded bg-primary px-4 py-1.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {t("publish")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* メインカラム */}
        <div className="min-w-0">
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
            placeholder={t("titlePlaceholder")}
            className="w-full rounded-lg border border-line bg-bg px-4 py-3 text-2xl font-black outline-none focus:border-primary"
          />
          <textarea
            value={lead}
            onChange={(e) => {
              setLead(e.target.value);
              markDirty();
            }}
            placeholder={t("leadPlaceholder")}
            rows={2}
            className="mt-3 w-full rounded-lg border border-line bg-bg px-4 py-3 text-[15px] outline-none focus:border-primary"
          />
          <p className="mt-1 text-right text-xs text-gray">
            {t("leadLabel")} — {lead.length}
          </p>

          {/* ツールバー */}
          {editor ? (
            <div className="sticky top-0 z-10 mt-2 flex flex-wrap items-center gap-1 rounded-t-lg border border-line bg-bg px-2 py-1.5">
              <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))}>
                H2
              </button>
              <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btn(editor.isActive("heading", { level: 3 }))}>
                H3
              </button>
              <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}>
                <strong>B</strong>
              </button>
              <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}>
                <em>I</em>
              </button>
              <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>
                ••
              </button>
              <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>
                1.
              </button>
              <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive("blockquote"))}>
                ❝
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = window.prompt("URL");
                  if (url) editor.chain().focus().setLink({ href: url }).run();
                  else editor.chain().focus().unsetLink().run();
                }}
                className={btn(editor.isActive("link"))}
              >
                🔗
              </button>
              <button
                type="button"
                onClick={() =>
                  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                }
                className={btn(false)}
              >
                ⊞
              </button>
              <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btn(false)}>
                —
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = window.prompt("YouTube URL");
                  if (url) editor.commands.setYoutubeVideo({ src: url });
                }}
                className={btn(false)}
              >
                ▶
              </button>
              <label className={`${btn(false)} cursor-pointer`}>
                🖼
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={insertImage}
                  aria-label={t("uploadImage")}
                />
              </label>
              <span className="ml-auto text-xs text-gray">
                {t("wordCount", { count: charCount })}
              </span>
            </div>
          ) : null}

          <div className="tiptap-editor rounded-b-lg border border-t-0 border-line bg-bg px-4 py-3">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* サイドバー */}
        <aside className="flex flex-col gap-4">
          <Field label={t("slugLabel")}>
            <input
              type="text"
              value={slug}
              disabled={isPublished}
              onChange={(e) => {
                setSlug(e.target.value);
                markDirty();
              }}
              className="w-full rounded border border-line bg-bg px-2 py-1.5 font-mono text-xs outline-none focus:border-primary disabled:bg-bg-sub disabled:text-gray"
            />
            {isPublished ? (
              <p className="mt-1 text-[11px] text-gray">{t("slugLocked")}</p>
            ) : null}
          </Field>

          <Field label={t("category")}>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                markDirty();
              }}
              className="w-full rounded border border-line bg-bg px-2 py-1.5 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameZh}
                </option>
              ))}
            </select>
          </Field>

          {isPressRelease ? (
            <Field label={t("prSourceName")}>
              <input
                type="text"
                value={prSourceName}
                onChange={(e) => {
                  setPrSourceName(e.target.value);
                  markDirty();
                }}
                className="w-full rounded border border-line bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
            </Field>
          ) : null}

          <Field label={t("tagsLabel")}>
            <input
              type="text"
              value={tags}
              onChange={(e) => {
                setTags(e.target.value);
                markDirty();
              }}
              className="w-full rounded border border-line bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
          </Field>

          <Field label={t("heroImage")}>
            {heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImageUrl}
                alt=""
                className="mb-2 aspect-video w-full rounded object-cover"
              />
            ) : null}
            <input type="file" accept="image/*" onChange={setHero} className="text-xs" />
          </Field>

          <div className="flex gap-4 rounded-lg border border-line bg-bg p-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={isBreaking}
                onChange={(e) => {
                  setIsBreaking(e.target.checked);
                  markDirty();
                }}
              />
              {t("isBreaking")}
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => {
                  setIsPinned(e.target.checked);
                  markDirty();
                }}
              />
              {t("isPinned")}
            </label>
          </div>

          {!isPublished ? (
            <Field label={t("publishAt")}>
              <input
                type="datetime-local"
                value={publishAt}
                onChange={(e) => {
                  setPublishAt(e.target.value);
                  markDirty();
                }}
                className="w-full rounded border border-line bg-bg px-2 py-1.5 text-sm"
              />
              {publishAt && status !== "scheduled" && canPublish ? (
                <button
                  type="button"
                  onClick={() => changeStatus("scheduled")}
                  className="mt-2 w-full rounded border border-primary px-2 py-1.5 text-sm font-medium text-primary hover:bg-primary-light"
                >
                  {ts("scheduled")}
                </button>
              ) : null}
            </Field>
          ) : null}

          {revisions.length > 0 ? (
            <Field label={t("revisions")}>
              <ul className="flex flex-col gap-1.5 text-xs">
                {revisions.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="text-gray">
                      {new Date(r.createdAt).toLocaleString("zh-TW", {
                        timeZone: "Asia/Taipei",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {r.editorName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        restoreRevisionAction(r.id).then(() =>
                          window.location.reload()
                        );
                      }}
                      className="shrink-0 text-primary hover:underline"
                    >
                      {t("restore")}
                    </button>
                  </li>
                ))}
              </ul>
            </Field>
          ) : null}

          <button
            type="button"
            onClick={() => {
              if (window.confirm(t("deleteConfirm"))) {
                deleteArticleAction(article.id);
              }
            }}
            className="rounded border border-line px-3 py-2 text-sm text-gray hover:border-breaking hover:text-breaking"
          >
            {t("delete")}
          </button>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-bg p-3">
      <p className="mb-1.5 text-xs font-bold text-gray">{label}</p>
      {children}
    </div>
  );
}
