import type { RawTilesetRef } from "./tmj";
import type { Color, PaletteChange } from "../utils/colorTools";

export interface TilesetState {
  id: string;
  name: string;
  tmjTilesetRef?: RawTilesetRef;
  /**
   * Original path of the image inside a zip or on disk (relative).
   */
  imagePath?: string;
  /**
   * Base file name (used for display and matching).
   */
  imageFileName: string;
  imageElement?: HTMLImageElement;
  baseImageData?: ImageData;
  currentImageData?: ImageData;
  palette: Color[];
  paletteChanges: PaletteChange[];
}