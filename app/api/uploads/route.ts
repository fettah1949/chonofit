import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { errorMessage } from "@/lib/utils";
import { saveImage } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const formData = await request.formData();
  const kind = formData.get("kind") === "logo" ? "gym" : "members";
  if (kind === "gym" && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Seul un administrateur peut modifier le logo." },
      { status: 403 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucune image reçue." }, { status: 400 });
  }

  try {
    const path = await saveImage(file, kind);
    return NextResponse.json({ path });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
