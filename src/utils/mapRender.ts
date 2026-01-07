import type { MapChunk, RawTileLayer, RawTilesetRef } from "../types/tmj";
import type { TilesetState } from "../types/tileset";
import { basename } from "./pathUtils";

/**
 * Find the tileset definition for a given GID within a map.
 * Chooses the tileset with the highest firstgid that is <= gid.
 */
function findTilesetForGid(
  gid: number,
  tilesets: RawTilesetRef[]
): RawTilesetRef | undefined {
  let chosen: RawTilesetRef | undefined;
  for (const ts of tilesets) {
    if (gid >= ts.firstgid && (!chosen || ts.firstgid > chosen.firstgid)) {
      chosen = ts;
    }
  }
  return chosen;
}

function findTilesetStateForRef(
  tsRef: RawTilesetRef,
  tilesetStates: TilesetState[]
): TilesetState | undefined {
  const imgBase = tsRef.image ? basename(tsRef.image) : undefined;

  if (imgBase) {
    const byImage = tilesetStates.find(
      (t) => t.imageFileName.toLowerCase() === imgBase.toLowerCase()
    );
    if (byImage) return byImage;
  }

  if (tsRef.name) {
    const byName = tilesetStates.find((t) => t.name === tsRef.name);
    if (byName) return byName;
  }

  return undefined;
}

/**
 * Render a TMJ map chunk into an off-screen canvas using the provided tilesets.
 * Returns the canvas, or null if rendering failed.
 */
export function renderMapChunkToCanvas(
  chunk: MapChunk,
  tilesets: TilesetState[]
): HTMLCanvasElement | null {
  const tmj = chunk.tmj;
  const tilewidth = tmj.tilewidth;
  const tileheight = tmj.tileheight;

  const canvas = document.createElement("canvas");
  canvas.width = tmj.width * tilewidth;
  canvas.height = tmj.height * tileheight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const imageCache = new Map<RawTilesetRef, HTMLCanvasElement>();

  for (const layer of tmj.layers) {
    if (layer.type !== "tilelayer") continue;
    const tileLayer = layer as RawTileLayer;
    const { data, width, height } = tileLayer;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const gid = data[idx];
        if (!gid) continue;

        const tsRef = findTilesetForGid(gid, tmj.tilesets);
        if (!tsRef) continue;

        const tw = tsRef.tilewidth ?? tilewidth;
        const th = tsRef.tileheight ?? tileheight;
        const cols = tsRef.columns;
        if (!cols || !tw || !th) continue;

        let tilesetCanvas = imageCache.get(tsRef);
        if (!tilesetCanvas) {
          const tsState = findTilesetStateForRef(tsRef, tilesets);
          const sourceImageData =
            tsState?.currentImageData ?? tsState?.baseImageData;
          const sourceImgElement = tsState?.imageElement;

          if (sourceImageData) {
            tilesetCanvas = document.createElement("canvas");
            tilesetCanvas.width = sourceImageData.width;
            tilesetCanvas.height = sourceImageData.height;
            const tctx = tilesetCanvas.getContext("2d");
            if (!tctx) continue;
            tctx.putImageData(sourceImageData, 0, 0);
          } else if (sourceImgElement) {
            tilesetCanvas = document.createElement("canvas");
            tilesetCanvas.width = sourceImgElement.width;
            tilesetCanvas.height = sourceImgElement.height;
            const tctx = tilesetCanvas.getContext("2d");
            if (!tctx) continue;
            tctx.drawImage(sourceImgElement, 0, 0);
          } else {
            continue;
          }

          imageCache.set(tsRef, tilesetCanvas);
        }

        const localIndex = gid - tsRef.firstgid;
        const sx = (localIndex % cols) * tw;
        const sy = Math.floor(localIndex / cols) * th;

        const dx = x * tilewidth;
        const dy = y * tileheight;

        ctx.drawImage(tilesetCanvas, sx, sy, tw, th, dx, dy, tilewidth, tileheight);
      }
    }
  }

  return canvas;
}