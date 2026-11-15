// Converts the self-hosted fontsource WOFF (v1) files into TrueType for jsPDF, which needs TTF
// to embed fonts as vector text in the Shoot Pack. Run: node scripts/woff-to-ttf.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

function woffToSfnt(buf) {
  if (buf.readUInt32BE(0) !== 0x774f4646) throw new Error('Not a WOFF 1.0 file');
  const flavor = buf.readUInt32BE(4);
  const numTables = buf.readUInt16BE(12);
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const o = 44 + i * 20;
    tables.push({
      tag: buf.readUInt32BE(o),
      offset: buf.readUInt32BE(o + 4),
      compLength: buf.readUInt32BE(o + 8),
      origLength: buf.readUInt32BE(o + 12),
      checksum: buf.readUInt32BE(o + 16),
    });
  }
  let searchRange = 1;
  let entrySelector = 0;
  while (searchRange * 2 <= numTables) {
    searchRange *= 2;
    entrySelector++;
  }
  searchRange *= 16;
  const headerSize = 12 + numTables * 16;
  const datas = tables.map((t) => {
    const raw = buf.subarray(t.offset, t.offset + t.compLength);
    return t.compLength < t.origLength ? inflateSync(raw) : Buffer.from(raw);
  });
  const total = headerSize + datas.reduce((s, d) => s + ((d.length + 3) & ~3), 0);
  const out = Buffer.alloc(total);
  out.writeUInt32BE(flavor, 0);
  out.writeUInt16BE(numTables, 4);
  out.writeUInt16BE(searchRange, 6);
  out.writeUInt16BE(entrySelector, 8);
  out.writeUInt16BE(numTables * 16 - searchRange, 10);
  let offset = headerSize;
  tables.forEach((t, i) => {
    const d = datas[i];
    const rec = 12 + i * 16;
    out.writeUInt32BE(t.tag, rec);
    out.writeUInt32BE(t.checksum, rec + 4);
    out.writeUInt32BE(offset, rec + 8);
    out.writeUInt32BE(d.length, rec + 12);
    d.copy(out, offset);
    offset += (d.length + 3) & ~3;
  });
  return out;
}

const jobs = [
  ['@fontsource/inter-tight/files/inter-tight-latin-400-normal.woff', 'InterTight-Regular.ttf'],
  ['@fontsource/inter-tight/files/inter-tight-latin-500-normal.woff', 'InterTight-Medium.ttf'],
  ['@fontsource/inter-tight/files/inter-tight-latin-600-normal.woff', 'InterTight-SemiBold.ttf'],
  ['@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff', 'IBMPlexMono-Regular.ttf'],
  ['@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff', 'IBMPlexMono-Medium.ttf'],
];
mkdirSync('public/fonts', { recursive: true });
for (const [src, dst] of jobs) {
  const ttf = woffToSfnt(readFileSync(`node_modules/${src}`));
  writeFileSync(`public/fonts/${dst}`, ttf);
  console.log(`public/fonts/${dst}`, ttf.length, 'bytes');
}
