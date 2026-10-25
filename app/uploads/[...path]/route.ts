import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = path.resolve(process.cwd(), "public", "uploads");

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse(null, { status: 401 });
  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, role: true, sessionVersion: true },
  });
  if (!account?.active || account.role !== session.user.role || account.sessionVersion !== session.user.sessionVersion) {
    return new NextResponse(null, { status: 401 });
  }

  const { path: segments } = await context.params;
  if (segments.length !== 2) return new NextResponse(null, { status: 404 });

  const [folder, filename] = segments;
  if ((folder !== "members" && folder !== "gym") || !/^[\w.-]+$/.test(filename) || filename.startsWith(".")) {
    return new NextResponse(null, { status: 404 });
  }

  const full = path.resolve(ROOT, folder, filename);
  if (path.relative(path.resolve(ROOT, folder), full).startsWith("..")) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const data = await readFile(full);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
