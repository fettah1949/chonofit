export type ReceiptImageInput = {
  address: string | null;
  gymPhone: string | null;
  receiptNumber: string;
  paidAt: string;
  memberName: string;
  memberPhone: string;
  photoUrl: string | null;
  initials: string;
  planName: string;
  method: string;
  amount: string;
  endDate: string | null;
  note: string | null;
};

const WIDTH = 1080;
const PAD = 72;

function fontFamily(variable: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function fillSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
) {
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + spacing;
  }
}

function drawStopwatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  color: string,
) {
  const scale = height / 72;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.roundRect(26.5, 1.5, 11, 8, 1.6);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(21, 7.5, 22, 5.2, 1.6);
  ctx.fill();
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.arc(32, 42, 22.5, 0, Math.PI * 2);
  ctx.stroke();
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
    const major = index % 3 === 0;
    const inner = major ? 13.5 : 16;
    const outer = 19.2;
    ctx.lineWidth = major ? 2.1 : 1.25;
    ctx.beginPath();
    ctx.moveTo(32 + Math.cos(angle) * inner, 42 + Math.sin(angle) * inner);
    ctx.lineTo(32 + Math.cos(angle) * outer, 42 + Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.strokeStyle = "#e10600";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(32, 42);
  ctx.lineTo(41.5, 26.5);
  ctx.stroke();
  ctx.fillStyle = "#e10600";
  ctx.beginPath();
  ctx.arc(32, 42, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  input: ReceiptImageInput,
  display: string,
  sans: string,
) {
  const headerH = 390;
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, WIDTH, headerH);

  ctx.font = `italic 800 96px ${display}`;
  ctx.textBaseline = "alphabetic";
  const chrW = ctx.measureText("CHR").width;
  const noW = ctx.measureText("NO").width;
  const watchH = 104;
  const watchW = watchH * (64 / 72);
  const total = chrW + watchW + noW - 12;
  const x = (WIDTH - total) / 2;
  const baseline = 168;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("CHR", x, baseline);
  drawStopwatch(ctx, x + chrW - 8, baseline - watchH + 16, watchH, "#ffffff");
  ctx.fillText("NO", x + chrW + watchW - 8, baseline);

  ctx.font = `italic 800 42px ${display}`;
  const fitnessW = ctx.measureText("FITNESS").width;
  const spearW = 86;
  const rowW = spearW + 18 + fitnessW;
  const rowX = (WIDTH - rowW) / 2;
  const rowY = 210;
  ctx.fillStyle = "#e10600";
  ctx.beginPath();
  ctx.moveTo(rowX, rowY + 6);
  ctx.lineTo(rowX + spearW, rowY + 18);
  ctx.lineTo(rowX, rowY + 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText("FITNESS", rowX + spearW + 18, rowY + 36);

  const contact = [input.address, input.gymPhone].filter(Boolean).join("   ·   ");
  if (contact) {
    ctx.font = `500 26px ${sans}`;
    ctx.fillStyle = "#d0d0d0";
    ctx.textAlign = "center";
    const lines = wrap(ctx, contact, WIDTH - PAD * 2);
    lines.forEach((line, index) => {
      ctx.fillText(line, WIDTH / 2, 318 + index * 34);
    });
    ctx.textAlign = "left";
  }

  return headerH;
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  lines: string[],
  sans: string,
  maxWidth: number,
) {
  ctx.fillStyle = "#737373";
  ctx.font = `600 22px ${sans}`;
  fillSpaced(ctx, label, x, y, 3);
  let cursor = y + 52;
  lines.forEach((line, index) => {
    ctx.fillStyle = index === 0 ? "#141414" : "#404040";
    ctx.font = index === 0 ? `600 36px ${sans}` : `500 28px ${sans}`;
    for (const part of wrap(ctx, line, maxWidth)) {
      ctx.fillText(part, x, cursor);
      cursor += index === 0 ? 46 : 38;
    }
  });
  return cursor;
}

function drawMemberPhoto(
  ctx: CanvasRenderingContext2D,
  photo: HTMLImageElement | null,
  input: ReceiptImageInput,
  x: number,
  y: number,
  size: number,
  sans: string,
) {
  const radius = 28;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, radius);
  ctx.clip();
  ctx.fillStyle = "#f4f4f4";
  ctx.fillRect(x, y, size, size);
  if (photo && photo.width > 0 && photo.height > 0) {
    const scale = Math.min(size / photo.width, size / photo.height);
    const width = photo.width * scale;
    const height = photo.height * scale;
    ctx.drawImage(photo, x + (size - width) / 2, y + (size - height) / 2, width, height);
  } else {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 42px ${sans}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(input.initials, x + size / 2, y + size / 2 + 2);
  }
  ctx.restore();
}

function paint(
  ctx: CanvasRenderingContext2D,
  input: ReceiptImageInput,
  photo: HTMLImageElement | null,
  display: string,
  sans: string,
) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, ctx.canvas.height);

  const headerH = drawHeader(ctx, input, display, sans);
  let y = headerH + 72;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#737373";
  ctx.font = `600 22px ${sans}`;
  fillSpaced(ctx, "REÇU", PAD, y, 5);

  ctx.textAlign = "right";
  ctx.fillStyle = "#525252";
  ctx.font = `500 28px ${sans}`;
  ctx.fillText(input.paidAt, WIDTH - PAD, y);
  ctx.textAlign = "left";

  y += 70;
  ctx.fillStyle = "#141414";
  ctx.font = `700 62px ${display}`;
  ctx.fillText(input.receiptNumber, PAD, y);

  y += 36;
  ctx.strokeStyle = "#e6e6e6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(WIDTH - PAD, y);
  ctx.stroke();

  y += 64;
  const colW = (WIDTH - PAD * 2 - 48) / 2;
  const planLines = [input.planName, input.method];
  if (input.endDate) planLines.push(`Jusqu'au ${input.endDate}`);
  const photoSize = 188;
  ctx.fillStyle = "#737373";
  ctx.font = `600 22px ${sans}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  fillSpaced(ctx, "ADHÉRENT", PAD, y, 3);
  const photoY = y + 28;
  drawMemberPhoto(ctx, photo, input, PAD, photoY, photoSize, sans);
  const textX = PAD + photoSize + 28;
  const nameMax = colW - photoSize - 28;
  ctx.font = `600 36px ${sans}`;
  const nameLines = wrap(ctx, input.memberName, Math.max(nameMax, 160));
  ctx.font = `500 28px ${sans}`;
  const phoneLines = wrap(ctx, input.memberPhone, Math.max(nameMax, 160));
  const textHeight = nameLines.length * 46 + phoneLines.length * 38;
  let textY = photoY + Math.max(18, (photoSize - textHeight) / 2) + 32;
  ctx.fillStyle = "#141414";
  ctx.font = `600 36px ${sans}`;
  ctx.textBaseline = "alphabetic";
  for (const line of nameLines) {
    ctx.fillText(line, textX, textY);
    textY += 46;
  }
  ctx.fillStyle = "#404040";
  ctx.font = `500 28px ${sans}`;
  for (const line of phoneLines) {
    ctx.fillText(line, textX, textY);
    textY += 38;
  }
  const leftBottom = Math.max(photoY + photoSize, textY) + 8;
  const rightBottom = drawBlock(
    ctx,
    PAD + colW + 48,
    y,
    "ABONNEMENT",
    planLines,
    sans,
    colW,
  );
  y = Math.max(leftBottom, rightBottom) + 36;

  const boxH = 188;
  ctx.fillStyle = "#f4f4f4";
  ctx.beginPath();
  ctx.roundRect(PAD, y, WIDTH - PAD * 2, boxH, 28);
  ctx.fill();
  ctx.fillStyle = "#525252";
  ctx.font = `500 26px ${sans}`;
  ctx.fillText("Montant encaissé", PAD + 40, y + 72);
  ctx.fillStyle = "#e10600";
  ctx.font = `700 68px ${display}`;
  ctx.textAlign = "right";
  ctx.fillText(input.amount, WIDTH - PAD - 40, y + 132);
  ctx.textAlign = "left";
  y += boxH + 48;

  if (input.note) {
    ctx.fillStyle = "#404040";
    ctx.font = `500 28px ${sans}`;
    for (const line of wrap(ctx, `Note : ${input.note}`, WIDTH - PAD * 2)) {
      ctx.fillText(line, PAD, y);
      y += 40;
    }
    y += 20;
  }

  ctx.fillStyle = "#737373";
  ctx.font = `500 28px ${sans}`;
  ctx.fillText("Merci de votre confiance.", PAD, y);
  y += 72;

  ctx.fillStyle = "#e10600";
  ctx.fillRect(0, y, WIDTH, 16);
  return y + 16;
}

function loadPhoto(url: string | null) {
  if (!url) return Promise.resolve(null);
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

export async function renderReceiptImage(input: ReceiptImageInput) {
  const display = fontFamily("--font-heading", "Arial");
  const sans = fontFamily("--font-body", "Arial");
  await document.fonts.ready;
  await Promise.all([
    document.fonts.load(`italic 800 96px ${display}`),
    document.fonts.load(`700 68px ${display}`),
    document.fonts.load(`600 36px ${sans}`),
  ]).catch(() => undefined);

  const draft = document.createElement("canvas");
  draft.width = WIDTH;
  draft.height = 2200;
  const draftCtx = draft.getContext("2d");
  if (!draftCtx) throw new Error("canvas");
  const photo = await loadPhoto(input.photoUrl);
  const height = paint(draftCtx, input, photo, display, sans);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(draft, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("png");
  return blob;
}
