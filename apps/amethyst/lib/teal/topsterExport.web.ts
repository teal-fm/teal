import type { ReleaseView } from "@teal/lexicons/src/types/fm/teal/stats/defs";

import { coverArtUrl } from "./api";

type ChartOptions = {
  releases: ReleaseView[];
  columns: 3 | 4 | 5;
  title: string;
  period: string;
};

function loadArtwork(url?: string): Promise<HTMLImageElement | undefined> {
  if (!url) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const image = new window.Image();
    const timeout = window.setTimeout(() => resolve(undefined), 10000);
    image.crossOrigin = "anonymous";
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      resolve(undefined);
    };
    image.src = url;
  });
}

function shortText(
  context: CanvasRenderingContext2D,
  value: string,
  width: number,
) {
  if (context.measureText(value).width <= width) return value;
  let shortened = value;
  while (shortened && context.measureText(`${shortened}…`).width > width) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}…`;
}

export async function downloadTopsterPng({
  releases,
  columns,
  title,
  period,
}: ChartOptions): Promise<void> {
  const rows = columns;
  const cell = 180;
  const gap = 8;
  const padding = 52;
  const gridSize = columns * cell + (columns - 1) * gap;
  const listWidth = 390;
  const canvas = document.createElement("canvas");
  canvas.width = padding * 3 + gridSize + listWidth;
  canvas.height = padding * 2 + 114 + gridSize;
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("Your browser could not create the chart image.");

  context.fillStyle = "#102621";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f3eee2";
  context.font = "bold 42px Georgia, serif";
  context.fillText(
    shortText(context, title, canvas.width - padding * 2),
    padding,
    76,
  );
  context.font = "17px monospace";
  context.fillStyle = "#a8c7b9";
  context.fillText(
    `${period.toUpperCase()}  ·  TOP ${releases.length} ALBUMS`,
    padding,
    110,
  );

  const top = 154;
  const artwork = await Promise.all(
    releases.map((release) => loadArtwork(coverArtUrl(release.mbid, 250))),
  );
  for (let index = 0; index < columns * rows; index++) {
    const x = padding + (index % columns) * (cell + gap);
    const y = top + Math.floor(index / columns) * (cell + gap);
    context.fillStyle = "#244238";
    context.fillRect(x, y, cell, cell);
    const image = artwork[index];
    if (image) {
      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
      context.drawImage(
        image,
        (image.naturalWidth - sourceSize) / 2,
        (image.naturalHeight - sourceSize) / 2,
        sourceSize,
        sourceSize,
        x,
        y,
        cell,
        cell,
      );
    } else if (index < releases.length) {
      context.fillStyle = "#b4c7b7";
      context.font = "bold 54px Georgia, serif";
      context.textAlign = "center";
      context.fillText(String(index + 1), x + cell / 2, y + cell / 2 + 18);
      context.textAlign = "left";
    }
  }

  const listX = padding * 2 + gridSize;
  const rowHeight = gridSize / Math.max(releases.length, 1);
  releases.forEach((release, index) => {
    const y = top + index * rowHeight + Math.min(rowHeight * 0.68, 19);
    context.font = "bold 15px monospace";
    context.fillStyle = "#9fc7b7";
    context.fillText(String(index + 1).padStart(2, "0"), listX, y);
    context.font = "17px sans-serif";
    context.fillStyle = "#f3eee2";
    context.fillText(
      shortText(context, release.name || "Unknown album", listWidth - 116),
      listX + 38,
      y,
    );
    context.font = "14px monospace";
    context.fillStyle = "#9fc7b7";
    context.textAlign = "right";
    context.fillText(String(release.playCount || 0), canvas.width - padding, y);
    context.textAlign = "left";
  });

  context.fillStyle = "#456156";
  context.fillRect(padding, top + gridSize + 22, canvas.width - padding * 2, 1);
  context.font = "16px monospace";
  context.fillStyle = "#9fc7b7";
  context.fillText("teal.fm", padding, top + gridSize + 49);

  const link = document.createElement("a");
  link.download = "teal-top-albums.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}
