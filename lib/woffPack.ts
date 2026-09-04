// Minimal WOFF 1.0 packager: wraps an existing sfnt (TTF/OTF) binary into the
// WOFF container format by zlib-deflating each table, per the WOFF1 spec
// (https://www.w3.org/TR/WOFF/). Uses the browser's native CompressionStream,
// so no extra runtime dependency is needed.

interface SfntTable {
  tag: string;
  checksum: number;
  offset: number;
  length: number;
  data: Uint8Array;
}

interface ParsedSfnt {
  flavor: number;
  tables: SfntTable[];
}

function parseSfnt(buffer: ArrayBuffer): ParsedSfnt {
  const view = new DataView(buffer);
  const flavor = view.getUint32(0);
  const numTables = view.getUint16(4);
  const tables: SfntTable[] = [];
  let recordOffset = 12;
  for (let i = 0; i < numTables; i++) {
    const tag = String.fromCharCode(
      view.getUint8(recordOffset),
      view.getUint8(recordOffset + 1),
      view.getUint8(recordOffset + 2),
      view.getUint8(recordOffset + 3)
    );
    const checksum = view.getUint32(recordOffset + 4);
    const offset = view.getUint32(recordOffset + 8);
    const length = view.getUint32(recordOffset + 12);
    const data = new Uint8Array(buffer, offset, length);
    tables.push({ tag, checksum, offset, length, data });
    recordOffset += 16;
  }
  return { flavor, tables };
}

async function zlibDeflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  writer.write(data as BufferSource);
  writer.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(buf);
}

function pad4(n: number): number {
  return (4 - (n % 4)) % 4;
}

export function isWoffCompressionSupported(): boolean {
  return typeof CompressionStream !== "undefined";
}

/** Convert a raw sfnt (TTF/OTF) ArrayBuffer into a WOFF 1.0 ArrayBuffer. */
export async function sfntToWoff(sfntBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  if (!isWoffCompressionSupported()) {
    throw new Error("This browser does not support CompressionStream, required for WOFF export.");
  }
  const { flavor, tables } = parseSfnt(sfntBuffer);

  const packedTables = await Promise.all(
    tables.map(async (t) => {
      const compressed = await zlibDeflate(t.data);
      const useCompressed = compressed.length < t.length;
      return {
        tag: t.tag,
        checksum: t.checksum,
        origLength: t.length,
        compLength: useCompressed ? compressed.length : t.length,
        bytes: useCompressed ? compressed : t.data,
      };
    })
  );

  const numTables = packedTables.length;
  const HEADER_SIZE = 44;
  const DIR_ENTRY_SIZE = 20;
  const directorySize = numTables * DIR_ENTRY_SIZE;

  let totalSfntSize = 12 + 16 * numTables;
  for (const t of tables) totalSfntSize += t.length + pad4(t.length);

  let bodySize = 0;
  const tableOffsets: number[] = [];
  for (const t of packedTables) {
    tableOffsets.push(HEADER_SIZE + directorySize + bodySize);
    bodySize += t.compLength + pad4(t.compLength);
  }

  const totalSize = HEADER_SIZE + directorySize + bodySize;
  const out = new ArrayBuffer(totalSize);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);

  // WOFF Header
  view.setUint32(0, 0x774f4646); // 'wOFF'
  view.setUint32(4, flavor);
  view.setUint32(8, totalSize);
  view.setUint16(12, numTables);
  view.setUint16(14, 0); // reserved
  view.setUint32(16, totalSfntSize);
  view.setUint16(20, 1); // majorVersion
  view.setUint16(22, 0); // minorVersion
  view.setUint32(24, 0); // metaOffset
  view.setUint32(28, 0); // metaLength
  view.setUint32(32, 0); // metaOrigLength
  view.setUint32(36, 0); // privOffset
  view.setUint32(40, 0); // privLength

  // Table directory
  let dirOffset = HEADER_SIZE;
  packedTables.forEach((t, i) => {
    for (let c = 0; c < 4; c++) view.setUint8(dirOffset + c, t.tag.charCodeAt(c));
    view.setUint32(dirOffset + 4, tableOffsets[i]);
    view.setUint32(dirOffset + 8, t.compLength);
    view.setUint32(dirOffset + 12, t.origLength);
    view.setUint32(dirOffset + 16, t.checksum);
    dirOffset += DIR_ENTRY_SIZE;
  });

  // Table data
  packedTables.forEach((t, i) => {
    bytes.set(t.bytes, tableOffsets[i]);
  });

  return out;
}
