export interface RawProperty {
  name: string;
  type: string;
  value: any;
}

interface RawLayerBase {
  id: number;
  name: string;
  type: string;
  opacity?: number;
  visible?: boolean;
  x?: number;
  y?: number;
  properties?: RawProperty[];
}

export interface RawTileLayer extends RawLayerBase {
  type: "tilelayer";
  width: number;
  height: number;
  data: number[];
}

export interface RawObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  properties?: RawProperty[];
  gid?: number;
}

export interface RawObjectGroup extends RawLayerBase {
  type: "objectgroup";
  objects: RawObject[];
}

export interface RawImageLayer extends RawLayerBase {
  type: "imagelayer";
  image?: string;
}

export interface RawGroupLayer extends RawLayerBase {
  type: "group";
  layers: RawLayer[];
}

export type RawLayer =
  | RawTileLayer
  | RawObjectGroup
  | RawImageLayer
  | RawGroupLayer;

export interface RawTilesetRef {
  firstgid: number;
  source?: string;
  name?: string;
  tilewidth?: number;
  tileheight?: number;
  tilecount?: number;
  columns?: number;
  image?: string;
  tiles?: any[];
  [key: string]: any;
}

export interface RawTmj {
  height: number;
  width: number;
  tileheight: number;
  tilewidth: number;
  layers: RawLayer[];
  tilesets: RawTilesetRef[];
  orientation: string;
  renderorder: string;
  infinite?: boolean;
  properties?: RawProperty[];
  [key: string]: any;
}

export interface MapChunk {
  id: string;
  tmj: RawTmj;
  offsetX: number;
  offsetY: number;
}

export type GidRemap = Record<number, number>;