import type { RawTilesetRef } from "./tmj";
import type { Color, PaletteChange } from "../utils/colorTools";

export interface TilesetState {
  id: string;
  name: string;
  tmjTilesetRef?: RawTilesetRef;
  imageFileName: string;
  imageElement?: HTMLImageElement;
  baseImageData?: ImageData;
  currentImageData?: ImageData;
  palette: Color[];
  paletteChanges: PaletteChange[];
}