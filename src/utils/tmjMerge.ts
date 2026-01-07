import {
  GidRemap,
  MapChunk,
  RawObject,
  RawObjectGroup,
  RawTileLayer,
  RawTilesetRef,
  RawTmj,
} from "../types/tmj";

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export function computeBounds(chunks: MapChunk[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const chunk of chunks) {
    const w = chunk.tmj.width;
    const h = chunk.tmj.height;
    const x0 = chunk.offsetX;
    const y0 = chunk.offsetY;
    const x1 = x0 + w;
    const y1 = y0 + h;

    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

interface MergeTilesetsResult {
  globalTilesets: RawTilesetRef[];
  gidRemaps: GidRemap[];
}

export function mergeTilesets(chunks: MapChunk[]): MergeTilesetsResult {
  const globalTilesets: RawTilesetRef[] = [];
  const gidRemaps: GidRemap[] = chunks.map(() => ({}));

  type TilesetKey = string;
  const tilesetKeyToGlobalIndex = new Map<TilesetKey, number>();

  let nextFirstGid = 1;

  chunks.forEach((chunk, mapIndex) => {
    for (const ts of chunk.tmj.tilesets) {
      const key = JSON.stringify({
        source: ts.source || null,
        name: ts.name || null,
        image: ts.image || null,
        tilewidth: ts.tilewidth,
        tileheight: ts.tileheight,
        tilecount: ts.tilecount,
        columns: ts.columns,
      });

      let globalIndex = tilesetKeyToGlobalIndex.get(key);
      if (globalIndex == null) {
        const newTs: RawTilesetRef = {
          ...ts,
          firstgid: nextFirstGid,
        };
        globalIndex = globalTilesets.length;
        globalTilesets.push(newTs);
        tilesetKeyToGlobalIndex.set(key, globalIndex);
        nextFirstGid += ts.tilecount ?? 0;
      }

      const globalTs = globalTilesets[globalIndex];
      const oldFirstGid = ts.firstgid;
      const newFirstGid = globalTs.firstgid;
      const tileCount = ts.tilecount ?? 0;

      for (let local = 0; local < tileCount; local++) {
        const oldGid = oldFirstGid + local;
        const newGid = newFirstGid + local;
        gidRemaps[mapIndex][oldGid] = newGid;
      }
    }
  });

  return { globalTilesets, gidRemaps };
}

export function mergeTileLayers(
  chunks: MapChunk[],
  bounds: Bounds,
  gidRemaps: GidRemap[]
): RawTileLayer[] {
  const mergedLayers: RawTileLayer[] = [];
  let nextLayerId = 1;

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    const tmj = chunk.tmj;
    const remap = gidRemaps[idx];

    const offsetX = chunk.offsetX - bounds.minX;
    const offsetY = chunk.offsetY - bounds.minY;

    for (const layer of tmj.layers) {
      if (layer.type !== "tilelayer") continue;
      const src = layer as RawTileLayer;

      const { data, width, height, x, y, ...rest } = src;

      const dest: RawTileLayer = {
        ...rest,
        id: nextLayerId++,
        type: "tilelayer",
        x: 0,
        y: 0,
        width: bounds.width,
        height: bounds.height,
        data: new Array(bounds.width * bounds.height).fill(0),
      };

      for (let localY = 0; localY < src.height; localY++) {
        for (let localX = 0; localX < src.width; localX++) {
          const srcIndex = localY * src.width + localX;
          const oldGid = src.data[srcIndex] || 0;
          if (oldGid === 0) continue;

          const newGid = remap[oldGid] ?? oldGid;

          const globalX = offsetX + localX;
          const globalY = offsetY + localY;

          if (
            globalX < 0 ||
            globalY < 0 ||
            globalX >= bounds.width ||
            globalY >= bounds.height
          ) {
            continue;
          }

          const destIndex = globalY * bounds.width + globalX;
          dest.data[destIndex] = newGid;
        }
      }

      mergedLayers.push(dest);
    }
  }

  return mergedLayers;
}

export function mergeObjectGroups(
  chunks: MapChunk[],
  bounds: Bounds,
  gidRemaps: GidRemap[],
  tilewidth: number,
  tileheight: number
): RawObjectGroup[] {
  const mergedGroups: RawObjectGroup[] = [];
  let nextGroupId = 1;
  let nextObjectId = 1;

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    const tmj = chunk.tmj;
    const remap = gidRemaps[idx];

    const offsetTilesX = chunk.offsetX - bounds.minX;
    const offsetTilesY = chunk.offsetY - bounds.minY;
    const offsetPixelsX = offsetTilesX * tilewidth;
    const offsetPixelsY = offsetTilesY * tileheight;

    for (const layer of tmj.layers) {
      if (layer.type !== "objectgroup") continue;
      const src = layer as RawObjectGroup;

      const { objects, ...rest } = src;

      const dest: RawObjectGroup = {
        ...rest,
        id: nextGroupId++,
        type: "objectgroup",
        objects: [],
      };

      for (const obj of src.objects) {
        const newObj: RawObject = {
          ...obj,
          id: nextObjectId++,
          x: obj.x + offsetPixelsX,
          y: obj.y + offsetPixelsY,
        };

        if (obj.gid != null) {
          newObj.gid = remap[obj.gid] ?? obj.gid;
        }

        dest.objects.push(newObj);
      }

      mergedGroups.push(dest);
    }
  }

  return mergedGroups;
}

export function mergeTmjMaps(chunks: MapChunk[]): RawTmj {
  if (chunks.length === 0) {
    throw new Error("No maps to merge");
  }

  const tilewidth = chunks[0].tmj.tilewidth;
  const tileheight = chunks[0].tmj.tileheight;

  for (const c of chunks) {
    if (c.tmj.tilewidth !== tilewidth || c.tmj.tileheight !== tileheight) {
      throw new Error("All maps must use same tilewidth/tileheight");
    }
    if (c.tmj.infinite) {
      throw new Error("Infinite maps are not supported in this merger");
    }
  }

  const bounds = computeBounds(chunks);
  const { globalTilesets, gidRemaps } = mergeTilesets(chunks);

  const tileLayers = mergeTileLayers(chunks, bounds, gidRemaps);
  const objectGroups = mergeObjectGroups(
    chunks,
    bounds,
    gidRemaps,
    tilewidth,
    tileheight
  );

  const template = chunks[0].tmj;

  const merged: RawTmj = {
    ...template,
    width: bounds.width,
    height: bounds.height,
    layers: [...tileLayers, ...objectGroups],
    tilesets: globalTilesets,
  };

  return merged;
}