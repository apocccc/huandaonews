"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "editor", "author", "contributor"]),
});

export async function createUserAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin");

  const parsed = createUserSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  const baseSlug = slugify(parsed.name) || "user";
  let slug = baseSlug;
  for (let i = 2; await prisma.user.findUnique({ where: { slug } }); i++) {
    slug = `${baseSlug}-${i}`;
  }

  await prisma.user.create({
    data: {
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      passwordHash: await bcrypt.hash(parsed.password, 12),
      role: parsed.role,
      slug,
    },
  });

  revalidatePath("/admin/users");
}
