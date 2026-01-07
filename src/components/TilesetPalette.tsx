import React, { useEffect, useRef } from "react";
import type { TilesetState } from "../types/tileset";
import { colorToHex } from "../utils/colorTools";

interface TilesetPaletteProps {
  tileset: TilesetState;
  onChangeColor: (tilesetId: string, paletteIndex: number, newHex: string) => void;
}

const TilesetPalette: React.FC<TilesetPaletteProps> = ({
  tileset,
  onChangeColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!tileset.currentImageData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = tileset.currentImageData.width;
    canvas.height = tileset.currentImageData.height;
    ctx.putImageData(tileset.currentImageData, 0, 0);
  }, [tileset.currentImageData]);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-md p-3 flex flex-col gap-3 min-w-[260px]">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm truncate">{tileset.name}</div>
        <div className="text-xs text-slate-400 truncate">
          {tileset.imageFileName}
        </div>
      </div>

      <div className="flex gap-3">
        <canvas
          ref={canvasRef}
          className="border border-slate-700 bg-slate-900 w-32 h-32 object-contain"
        />
        <div className="flex flex-wrap gap-2">
          {tileset.paletteChanges.map((change, index) => (
            <label key={index} className="flex flex-col items-center gap-1">
              <span
                className="w-6 h-6 rounded border border-slate-600"
                style={{ backgroundColor: colorToHex(change.to) }}
              />
              <input
                type="color"
                className="w-10 h-6 p-0 border-none bg-transparent"
                value={colorToHex(change.to)}
                onChange={(e) =>
                  onChangeColor(tileset.id, index, e.target.value)
                }
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TilesetPalette;