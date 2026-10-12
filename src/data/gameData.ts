import { GAME_TABLES, NEGSIN_BEFORE } from "./gameTables.ts";

export type Version = "jp" | "kr";
export type TableName = keyof typeof GAME_TABLES;

export class GameData {
  constructor(readonly version: Version) {}

  i32(name: TableName): Int32Array {
    return Int32Array.from(GAME_TABLES[name]);
  }

  u16(name: TableName): Uint16Array {
    return Uint16Array.from(GAME_TABLES[name]);
  }

  i32Before(count: number): Int32Array {
    return Int32Array.from(NEGSIN_BEFORE[this.version].slice(-count));
  }
}
