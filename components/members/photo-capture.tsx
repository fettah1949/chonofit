"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, SwitchCamera, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/members/member-avatar";

export function PhotoCapture({
  value,
  onChange,
  kind = "member",
  firstName = "A",
  lastName = "B",
}: {
  value: string;
  onChange: (path: string) => void;
  kind?: "member" | "logo";
  firstName?: string;
  lastName?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [uploading, setUploading] = useState(false);

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => () => stop(), []);

  async function start(mode: "user" | "environment") {
    stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Cet appareil ne permet pas la capture. Choisissez une image dans la galerie.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setFacing(mode);
      setCameraOn(true);
    } catch {
      toast.error(
        "Caméra indisponible. Autorisez l'accès, ou choisissez une photo. À distance, le navigateur exige une adresse HTTPS.",
      );
    }
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("kind", kind === "logo" ? "logo" : "member");
      const response = await fetch("/api/uploads", { method: "POST", body });
      const data = (await response.json()) as { path?: string; error?: string };
      if (!response.ok || !data.path) throw new Error(data.error || "Envoi impossible.");
      onChange(data.path);
      toast.success(kind === "logo" ? "Logo enregistré." : "Photo enregistrée.");
      stop();
      setCameraOn(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Envoi impossible.");
    } finally {
      setUploading(false);
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    const sourceWidth = video.videoWidth || 800;
    const sourceHeight = video.videoHeight || 800;
    const width = Math.min(sourceWidth, 800);
    const height = Math.round((sourceHeight / sourceWidth) * width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) {
      toast.error("La capture a échoué.");
      return;
    }
    await upload(new File([blob], "photo.jpg", { type: "image/jpeg" }));
  }

  const fileInput = (
    <input
      type="file"
      accept="image/jpeg,image/png"
      className="sr-only"
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void upload(file);
        event.target.value = "";
      }}
    />
  );

  if (cameraOn) {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} playsInline muted autoPlay className="aspect-[3/4] max-h-80 w-full object-cover" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" className="col-span-2" onClick={capture} disabled={uploading}>
            <Camera className="h-4 w-4" />
            {uploading ? "Envoi…" : "Capturer"}
          </Button>
          <Button type="button" variant="outline" onClick={() => start(facing === "user" ? "environment" : "user")}>
            <SwitchCamera className="h-4 w-4" />
            Tourner
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              stop();
              setCameraOn(false);
            }}
          >
            Fermer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-4 @min-[24rem]:flex-row @min-[24rem]:items-center">
        <div className="relative w-36 shrink-0 @min-[24rem]:w-40">
          <div className="overflow-hidden rounded-2xl border bg-secondary/60 shadow-inner">
            {value ? (
              <img src={value} alt="" className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex aspect-square items-center justify-center bg-[radial-gradient(circle_at_50%_35%,white,transparent_70%)]">
                <MemberAvatar firstName={firstName} lastName={lastName} className="h-20 w-20 rounded-2xl text-2xl shadow-sm" />
              </div>
            )}
          </div>
          {value ? (
            <button
              type="button"
              aria-label="Retirer la photo"
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm"
              onClick={() => onChange("")}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
          <div className="text-center @min-[24rem]:text-left">
            <p className="font-display text-lg font-semibold">{kind === "logo" ? "Logo" : "Photo"}</p>
            <p className="text-sm text-muted-foreground">JPG ou PNG, réduit à 800 px.</p>
          </div>
          <Button type="button" className="w-full" onClick={() => start(facing)} disabled={uploading}>
            <Camera className="h-4 w-4" />
            Prendre une photo
          </Button>
          <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-medium hover:bg-secondary">
            <ImagePlus className="h-4 w-4" />
            {uploading ? "Envoi…" : "Galerie"}
            {fileInput}
          </label>
        </div>
      </div>
    </div>
  );
}
