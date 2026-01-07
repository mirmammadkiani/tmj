import React from "react";
import {
  Stage,
  Layer,
  Group,
  Rect,
  Text,
  Image as KonvaImage,
} from "react-konva";
import type { MapChunk } from "../types/tmj";

interface MapCanvasProps {
  chunks: MapChunk[];
  tilewidth: number;
  tileheight: number;
  stageWidth: number;
  stageHeight: number;
  previews: Record<string, HTMLCanvasElement>;
  onChangeChunkOffset: (id: string, offsetX: number, offsetY: number) => void;
}

const MapCanvas: React.FC<MapCanvasProps> = ({
  chunks,
  tilewidth,
  tileheight,
  stageWidth,
  stageHeight,
  previews,
  onChangeChunkOffset,
}) => {
  const padding = 50;

  return (
    <div className="w-full h-full bg-slate-800 rounded-md border border-slate-700 overflow-hidden">
      <Stage width={stageWidth} height={stageHeight}>
        <Layer>
          {chunks.map((chunk) => {
            const w = chunk.tmj.width * tilewidth;
            const h = chunk.tmj.height * tileheight;
            const x = chunk.offsetX * tilewidth;
            const y = chunk.offsetY * tileheight;
            const preview = previews[chunk.id];

            return (
              <Group
                key={chunk.id}
                x={x + padding}
                y={y + padding}
                draggable
                onDragEnd={(e) => {
                  const node = e.target;
                  const globalX = node.x() - padding;
                  const globalY = node.y() - padding;
                  const offsetX = Math.round(globalX / tilewidth);
                  const offsetY = Math.round(globalY / tileheight);
                  onChangeChunkOffset(chunk.id, offsetX, offsetY);
                }}
              >
                {preview ? (
                  <KonvaImage
                    image={preview}
                    width={w}
                    height={h}
                    listening={false}
                  />
                ) : (
                  <Rect
                    width={w}
                    height={h}
                    fill="#020617"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    cornerRadius={4}
                  />
                )}
                <Rect
                  width={w}
                  height={h}
                  stroke="#38bdf8"
                  strokeWidth={2}
                  cornerRadius={4}
                  listening={false}
                />
                <Text
                  text={chunk.tmj.layers.map((l) => l.name).join(", ")}
                  fill="#e5e7eb"
                  fontSize={14}
                  x={8}
                  y={8}
                  listening={false}
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
};

export default MapCanvas;