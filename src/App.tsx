import React, { useCallback, useEffect, useState } from "react";
import JSZip from "jszip";
import type { MapChunk, RawTilesetRef, RawTmj } from "./types/tmj";
import { mergeTmjMaps } from "./utils/tmjMerge";
import MapCanvas from "./components/MapCanvas";
import TilesetPalette from "./components/TilesetPalette";
import type { TilesetState } from "./types/tileset";
import {
  applyColorMappingsToImageData,
  extractDominantColors,
  hexToColor,
} from "./utils/colorTools";
import { renderMapChunkToCanvas } from "./utils/mapRender";
import { basename, resolveRelativePath } from "./utils/pathUtils";
import { imageDataToPngBlob } from "./utils/imageUtils";

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function findTmjTilesetForFile(
  fileName: string,
  chunks: MapChunk[]
): RawTilesetRef | undefined {
  const base = fileName.toLowerCase();
  for (const chunk of chunks) {
    for (const ts of chunk.tmj.tilesets) {
      if (!ts.image) continue;
      const tsBase = ts.image.split(/[/\\]/).pop()?.toLowerCase();
      if (tsBase === base) return ts;
    }
  }
  return undefined;
}

const App: React.FC = () => {
  const [mapChunks, setMapChunks] = useState<MapChunk[]>([]);
  const [tilesets, setTilesets] = useState<TilesetState[]>([]);
  const [workspaceWidth, setWorkspaceWidth] = useState(1200);
  const [workspaceHeight, setWorkspaceHeight] = useState(700);
  const [chunkPreviews, setChunkPreviews] = useState<
    Record<string, HTMLCanvasElement>
  >({});

  const handleTmjUpload = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      const fileArr = Array.from(files);
      const newChunks: MapChunk[] = [];

      for (const file of fileArr) {
        const content = await file.text();
        const parsed = JSON.parse(content) as RawTmj;

        newChunks.push({
          id: createId(file.name),
          tmj: parsed,
          offsetX: 0,
          offsetY: 0,
        });
      }

      setMapChunks((prev) => [...prev, ...newChunks]);
    },
    []
  );

  const handleTilesetImagesUpload = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      const fileArr = Array.from(files);
      const newStates: TilesetState[] = [];

      for (const file of fileArr) {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.src = url;

        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () =>
            reject(new Error(`Failed to load image ${file.name}`));
        });

        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          continue;
        }
        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const palette = extractDominantColors(imageData, 8);

        const tmjTilesetRef = findTmjTilesetForFile(file.name, mapChunks);

        const paletteChanges = palette.map((c) => ({
          from: c,
          to: c,
        }));

        newStates.push({
          id: createId(file.name),
          name: tmjTilesetRef?.name ?? file.name,
          tmjTilesetRef,
          imagePath: file.name,
          imageFileName: file.name,
          imageElement: image,
          baseImageData: imageData,
          currentImageData: imageData,
          palette,
          paletteChanges,
        });

        URL.revokeObjectURL(url);
      }

      setTilesets((prev) => [...prev, ...newStates]);
    },
    [mapChunks]
  );

  const handleZipUpload = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      const fileArr = Array.from(files);
      const newChunks: MapChunk[] = [];
      const newTilesets: TilesetState[] = [];

      for (const file of fileArr) {
        const zip = await JSZip.loadAsync(file);
        const tmjFiles = Object.values(zip.files).filter(
          (f) => !f.dir && f.name.toLowerCase().endsWith(".tmj")
        );

        for (const tmjFile of tmjFiles) {
          const tmjContent = await tmjFile.async("string");
          const tmj = JSON.parse(tmjContent) as RawTmj;

          newChunks.push({
            id: createId(tmjFile.name),
            tmj,
            offsetX: 0,
            offsetY: 0,
          });

          for (const tsRef of tmj.tilesets) {
            if (!tsRef.image) continue;

            const resolvedImagePath = resolveRelativePath(
              tmjFile.name,
              tsRef.image
            );
            const imageBase = basename(resolvedImagePath);

            const existsAlready =
              tilesets.some(
                (t) =>
                  t.imageFileName.toLowerCase() === imageBase.toLowerCase()
              ) ||
              newTilesets.some(
                (t) =>
                  t.imageFileName.toLowerCase() === imageBase.toLowerCase()
              );
            if (existsAlready) continue;

            let zipImageFile =
              zip.file(resolvedImagePath) ??
              Object.values(zip.files).find(
                (f) =>
                  !f.dir &&
                  basename(f.name).toLowerCase() === imageBase.toLowerCase()
              );

            if (!zipImageFile) continue;

            const imgBlob = await zipImageFile.async("blob");
            const imgUrl = URL.createObjectURL(imgBlob);
            const img = new Image();
            img.src = imgUrl;

            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () =>
                reject(
                  new Error(`Failed to load image ${zipImageFile.name}`)
                );
            });

            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              URL.revokeObjectURL(imgUrl);
              continue;
            }
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            );
            const palette = extractDominantColors(imageData, 8);
            const paletteChanges = palette.map((c) => ({ from: c, to: c }));

            newTilesets.push({
              id: createId(zipImageFile.name),
              name: tsRef.name ?? imageBase,
              tmjTilesetRef: tsRef,
              imagePath: resolvedImagePath,
              imageFileName: imageBase,
              imageElement: img,
              baseImageData: imageData,
              currentImageData: imageData,
              palette,
              paletteChanges,
            });

            URL.revokeObjectURL(imgUrl);
          }
        }
      }

      if (newChunks.length) {
        setMapChunks((prev) => [...prev, ...newChunks]);
      }
      if (newTilesets.length) {
        setTilesets((prev) => [...prev, ...newTilesets]);
      }
    },
    [tilesets]
  );

  const handleChunkOffsetChange = useCallback(
    (id: string, offsetX: number, offsetY: number) => {
      setMapChunks((prev) =>
        prev.map((chunk) =>
          chunk.id === id ? { ...chunk, offsetX, offsetY } : chunk
        )
      );
    },
    []
  );

  const handlePaletteChange = useCallback(
    (tilesetId: string, paletteIndex: number, newHex: string) => {
      setTilesets((prev) =>
        prev.map((ts) => {
          if (ts.id !== tilesetId) return ts;
          if (!ts.baseImageData) return ts;

          const changes = [...ts.paletteChanges];
          const change = { ...changes[paletteIndex] };
          change.to = hexToColor(newHex, change.to.a);
          changes[paletteIndex] = change;

          const imageData = applyColorMappingsToImageData(
            ts.baseImageData,
            changes,
            false
          );

          return {
            ...ts,
            paletteChanges: changes,
            currentImageData: imageData,
          };
        })
      );
    },
    []
  );

  useEffect(() => {
    const previews: Record<string, HTMLCanvasElement> = {};
    for (const chunk of mapChunks) {
      const canvas = renderMapChunkToCanvas(chunk, tilesets);
      if (canvas) previews[chunk.id] = canvas;
    }
    setChunkPreviews(previews);
  }, [mapChunks, tilesets]);

  const handleExportTmj = useCallback(() => {
    if (mapChunks.length === 0) return;
    try {
      const merged = mergeTmjMaps(mapChunks);
      const blob = new Blob([JSON.stringify(merged, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "merged.tmj";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to merge TMJ maps", error);
      alert("Failed to merge TMJ maps. See console for details.");
    }
  }, [mapChunks]);

  const handleExportTilesets = useCallback(() => {
    tilesets.forEach((ts) => {
      if (!ts.currentImageData) return;
      const canvas = document.createElement("canvas");
      canvas.width = ts.currentImageData.width;
      canvas.height = ts.currentImageData.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.putImageData(ts.currentImageData, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${ts.name || ts.id}-recolored.png`;
          a.click();
          URL.revokeObjectURL(url);
        },
        "image/png",
        1
      );
    });
  }, [tilesets]);

  const handleExportZip = useCallback(async () => {
    if (mapChunks.length === 0) return;
    try {
      const merged = mergeTmjMaps(mapChunks);
      const zip = new JSZip();

      for (let i = 0; i < merged.tilesets.length; i++) {
        const tsRef = merged.tilesets[i];
        const imgBaseRaw =
          basename(tsRef.image ?? "") || tsRef.name || `tileset_${i}`;
        const baseNoExt = imgBaseRaw.replace(/\.[^.]+$/, "");
        const fileName = `${baseNoExt}.png`;
        const imagePath = `tilesets/${fileName}`;

        const tsState =
          tilesets.find(
            (t) =>
              t.imageFileName.toLowerCase() === imgBaseRaw.toLowerCase() ||
              (tsRef.name && t.name === tsRef.name)
          ) ?? tilesets[i];

        if (tsState && tsState.currentImageData) {
          const blob = await imageDataToPngBlob(tsState.currentImageData);
          zip.file(imagePath, blob);
          tsRef.image = imagePath;
        }
      }

      zip.file("maps/merged.tmj", JSON.stringify(merged, null, 2));

      const archiveBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(archiveBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "merged-map.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export zip", error);
      alert("Failed to export zip. See console for details.");
    }
  }, [mapChunks, tilesets]);

  const tilewidth = mapChunks[0]?.tmj.tilewidth ?? 32;
  const tileheight = mapChunks[0]?.tmj.tileheight ?? 32;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
        <div>
          <h1 className="text-xl font-semibold">
            WorkAdventure Map &amp; Tileset Editor
          </h1>
          <p className="text-xs text-slate-400">
            Upload TMJ or ZIP bundles, stitch maps, recolor tilesets, and export
            a merged WorkAdventure-compatible map.
          </p>
        </div>
        <div className="space-x-2">
          <button
            type="button"
            onClick={handleExportTmj}
            className="px-3 py-1.5 text-sm rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-medium"
          >
            Export merged TMJ
          </button>
          <button
            type="button"
            onClick={handleExportTilesets}
            className="px-3 py-1.5 text-sm rounded-md bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium"
          >
            Export tilesets
          </button>
          <button
            type="button"
            onClick={handleExportZip}
            className="px-3 py-1.5 text-sm rounded-md bg-indigo-500 hover:bg-indigo-400 text-slate-50 font-medium"
          >
            Export merged ZIP
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <section className="w-80 border-r border-slate-800 p-4 space-y-6 bg-slate-900">
          <div>
            <h2 className="font-medium text-sm mb-2">Maps (.tmj)</h2>
            <input
              type="file"
              accept=".tmj,application/json"
              multiple
              onChange={(e) => handleTmjUpload(e.target.files)}
              className="block w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-700 file:text-slate-100 hover:file:bg-slate-600"
            />
          </div>

          <div>
            <h2 className="font-medium text-sm mb-2">Tileset images</h2>
            <input
              type="file"
              accept="image/png,image/jpeg"
              multiple
              onChange={(e) => handleTilesetImagesUpload(e.target.files)}
              className="block w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-700 file:text-slate-100 hover:file:bg-slate-600"
            />
          </div>

          <div>
            <h2 className="font-medium text-sm mb-2">Map bundles (.zip)</h2>
            <input
              type="file"
              accept=".zip,application/zip"
              multiple
              onChange={(e) => handleZipUpload(e.target.files)}
              className="block w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-700 file:text-slate-100 hover:file:bg-slate-600"
            />
          </div>

          <div>
            <h2 className="font-medium text-sm mb-2">Loaded maps</h2>
            <div className="space-y-2 max-h-[40vh] overflow-auto text-xs">
              {mapChunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="border border-slate-800 rounded-md p-2 bg-slate-950"
                >
                  <div className="font-medium truncate">
                    {chunk.tmj.properties?.find((p) => p.name === "name")
                      ?.value || (chunk.tmj as any)["name"] || chunk.id}
                  </div>
                  <div className="text-slate-400">
                    {chunk.tmj.width} × {chunk.tmj.height} tiles
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <span className="text-slate-400">Offset:</span>
                    <input
                      type="number"
                      className="w-14 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs"
                      value={chunk.offsetX}
                      onChange={(e) =>
                        handleChunkOffsetChange(
                          chunk.id,
                          Number(e.target.value) || 0,
                          chunk.offsetY
                        )
                      }
                    />
                    <span className="text-slate-500">x</span>
                    <input
                      type="number"
                      className="w-14 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs"
                      value={chunk.offsetY}
                      onChange={(e) =>
                        handleChunkOffsetChange(
                          chunk.id,
                          chunk.offsetX,
                          Number(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                </div>
              ))}
              {mapChunks.length === 0 && (
                <div className="text-slate-500">
                  No maps loaded yet. Upload TMJ or ZIP bundles.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="flex-1 flex flex-col bg-slate-950">
          <div className="flex-1 p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium text-sm">
                Map stitching (drag maps like puzzle pieces)
              </h2>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-400">Workspace (px):</span>
                <input
                  type="number"
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-1 py-0.5"
                  value={workspaceWidth}
                  min={400}
                  max={4000}
                  onChange={(e) =>
                    setWorkspaceWidth(Number(e.target.value) || 800)
                  }
                />
                <span className="text-slate-500">×</span>
                <input
                  type="number"
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-1 py-0.5"
                  value={workspaceHeight}
                  min={300}
                  max={3000}
                  onChange={(e) =>
                    setWorkspaceHeight(Number(e.target.value) || 600)
                  }
                />
              </div>
            </div>
            <div className="h-[60vh]">
              <MapCanvas
                chunks={mapChunks}
                tilewidth={tilewidth}
                tileheight={tileheight}
                stageWidth={workspaceWidth}
                stageHeight={workspaceHeight}
                previews={chunkPreviews}
                onChangeChunkOffset={handleChunkOffsetChange}
              />
            </div>
          </div>

          <div className="border-t border-slate-800 p-4">
            <h2 className="font-medium text-sm mb-3">
              Tileset color palettes
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {tilesets.map((ts) => (
                <TilesetPalette
                  key={ts.id}
                  tileset={ts}
                  onChangeColor={handlePaletteChange}
                />
              ))}
              {tilesets.length === 0 && (
                <div className="text-xs text-slate-500">
                  Upload tileset images or ZIP bundles to extract palettes and
                  recolor.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;