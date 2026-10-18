// Embedded-metadata check for the images and video in dist (WP-108). A camera, an editor or a C2PA signer can leave a person's name, a
// location, a device or a file path inside a file that looks harmless. This file reads the container, not the pixels, and reports what
// it finds: EXIF (and GPS inside it), XMP, IPTC, C2PA manifests, comments, copyright and author tags, and SVG <metadata>, dc:creator and
// absolute home paths. scripts/audit-images.mjs is the CLI. Node built-ins only, so the CI audit job runs it without npm ci.
//
// Containers: AVIF and MP4 (ISO base media boxes), PNG (chunks), JPEG (marker segments), WebM (EBML elements), SVG (text).
// A file that cannot be parsed is a finding too, because a gate that skips what it cannot read passes anything.
// A finding names the kind of metadata and where it sits. It never prints the value.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Extensions this check reads. Each maps to the parser for its container. */
export const METADATA_TYPES = { '.avif': 'isobmff', '.mp4': 'isobmff', '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webm': 'webm', '.svg': 'svg' };

const XMP_UUID = 'be7acfcb97a942e89c71999491e3afac';
const C2PA_UUID = 'd8fec3d61b0e483c92975828877ec481';
/** ISO box types that are metadata wherever they sit: EXIF, XMP, JUMBF (C2PA), 3GPP text and location boxes. Any "©" box is a QuickTime tag. */
const FLAGGED_BOXES = { Exif: 'EXIF', 'xml ': 'XML metadata', XMP_: 'XMP', jumb: 'C2PA', c2pa: 'C2PA', loci: 'GPS location', cprt: 'copyright', auth: 'author', perf: 'performer', titl: 'title', dscp: 'description' };
/** Boxes that hold other boxes this check needs to see. `meta` is handled apart (it may carry a 4-byte version header). */
const ISO_CONTAINERS = new Set(['moov', 'trak', 'udta']);
/** The one tag an encoder adds that names no person: the tool itself. */
const ISO_TOOL_TAG = '©too';
const PNG_PERSONAL_KEYWORD = /^(?:author|artist|creator|copyright|owner|location|gps\w*|email|contact|comment|description)$/i;
const PNG_PROFILE_KEYWORD = /^Raw profile type (?:exif|xmp|iptc|APP1)/i;
/** Tag names a muxer writes for the stream itself. Any other WebM tag may carry a person or a place. */
const WEBM_TECHNICAL_TAG = /^(?:ENCODER|DURATION|BPS|NUMBER_OF_FRAMES|NUMBER_OF_BYTES|_STATISTICS_\w+|HANDLER_NAME|VENDOR_ID|LANGUAGE)$/i;
const SVG_PATTERNS = [
  [/<metadata\b/i, 'SVG <metadata> element'],
  [/<rdf:RDF\b/i, 'SVG RDF block'],
  [/<dc:(?:creator|publisher|contributor|rights)\b|\bdc:creator\b/i, 'SVG dc:creator or rights'],
  [/(?:\/home\/|\/Users\/|\/root\/|\b[A-Za-z]:\\Users\\)[\w.-]+/, 'absolute home path in SVG'],
];

class Malformed extends Error {}

// ---- ISO base media (AVIF, MP4) ------------------------------------------------------------------------------------------------

function* boxes(buffer, start, end) {
  let position = start;
  while (position + 8 <= end) {
    let size = buffer.readUInt32BE(position);
    const type = buffer.toString('latin1', position + 4, position + 8);
    let header = 8;
    if (size === 1) {
      if (position + 16 > end) throw new Malformed(`box "${type}" is cut short at byte ${position}`);
      size = Number(buffer.readBigUInt64BE(position + 8));
      header = 16;
    } else if (size === 0) size = end - position;
    if (size < header || position + size > end) throw new Malformed(`box "${type}" at byte ${position} runs past its parent`);
    yield { type, start: position + header, end: position + size };
    position += size;
  }
}

/** Reads a NUL-terminated string at `at`, or '' when there is none before `end`. */
function cString(buffer, at, end) {
  const stop = buffer.indexOf(0, at);
  return stop === -1 || stop >= end ? '' : buffer.toString('latin1', at, stop);
}

/** An `infe` entry names what an item is. `Exif` is EXIF, and a `mime` item of RDF is XMP. */
function itemKind(buffer, box) {
  const version = buffer[box.start];
  if (version < 2) return null;
  const idSize = version === 3 ? 4 : 2;
  const typeAt = box.start + 4 + idSize + 2;
  if (typeAt + 4 > box.end) return null;
  const type = buffer.toString('latin1', typeAt, typeAt + 4);
  if (type === 'Exif') return 'EXIF item';
  if (type === 'jumb' || type === 'c2pa') return 'C2PA item';
  if (type !== 'mime') return null;
  const nameAt = typeAt + 4;
  const nameEnd = buffer.indexOf(0, nameAt);
  const contentType = nameEnd === -1 ? '' : cString(buffer, nameEnd + 1, box.end);
  return /rdf\+xml/i.test(contentType) ? 'XMP item' : 'embedded MIME item';
}

function isoWalk(buffer, start, end, found) {
  for (const box of boxes(buffer, start, end)) {
    const { type } = box;
    if (type === 'uuid') {
      const id = buffer.toString('hex', box.start, box.start + 16);
      found.push(id === XMP_UUID ? 'XMP (uuid box)' : id === C2PA_UUID ? 'C2PA (uuid box)' : 'uuid box with an unknown payload');
    } else if (type.charCodeAt(0) === 0xa9) {
      if (type !== ISO_TOOL_TAG) found.push(`QuickTime tag ${JSON.stringify(type)}`);
    } else if (FLAGGED_BOXES[type] !== undefined) {
      found.push(`${FLAGGED_BOXES[type]} (${type.trim()} box)`);
    } else if (type === 'meta') {
      // ISO meta is a full box (4 bytes of version and flags); the QuickTime one is not. The handler box follows either way.
      const full = buffer.toString('latin1', box.start + 8, box.start + 12) === 'hdlr';
      isoWalk(buffer, box.start + (full ? 4 : 0), box.end, found);
    } else if (type === 'iinf') {
      const countSize = buffer[box.start] === 0 ? 2 : 4;
      for (const entry of boxes(buffer, box.start + 4 + countSize, box.end)) {
        const kind = entry.type === 'infe' ? itemKind(buffer, entry) : null;
        if (kind !== null) found.push(kind);
      }
    } else if (type === 'ilst') {
      for (const tag of boxes(buffer, box.start, box.end)) if (tag.type !== ISO_TOOL_TAG) found.push(`iTunes tag ${JSON.stringify(tag.type)}`);
    } else if (ISO_CONTAINERS.has(type)) {
      isoWalk(buffer, box.start, box.end, found);
    }
  }
}

function isobmffMetadata(buffer) {
  if (buffer.length < 12 || buffer.toString('latin1', 4, 8) !== 'ftyp') throw new Malformed('no ftyp box at the start of the file');
  const found = [];
  isoWalk(buffer, 0, buffer.length, found);
  return found;
}

// ---- EXIF payloads -------------------------------------------------------------------------------------------------------------

/** Whether the first IFD of a TIFF/EXIF payload holds the GPSInfo pointer (tag 0x8825). Bounds are checked; a bad payload reads as no GPS. */
export function exifHasGps(payload) {
  if (payload.length < 14) return false;
  const little = payload.toString('latin1', 0, 2) === 'II';
  const u16 = (at) => (little ? payload.readUInt16LE(at) : payload.readUInt16BE(at));
  const u32 = (at) => (little ? payload.readUInt32LE(at) : payload.readUInt32BE(at));
  const ifd = u32(4);
  if (ifd + 2 > payload.length) return false;
  const count = u16(ifd);
  for (let i = 0; i < count; i += 1) {
    const at = ifd + 2 + i * 12;
    if (at + 12 > payload.length) return false;
    if (u16(at) === 0x8825) return true;
  }
  return false;
}

const exifLabel = (payload) => (exifHasGps(payload) ? 'EXIF with a GPS position' : 'EXIF');

// ---- PNG -----------------------------------------------------------------------------------------------------------------------

function pngMetadata(buffer) {
  if (buffer.length < 8 || buffer.toString('latin1', 1, 4) !== 'PNG') throw new Malformed('not a PNG file');
  const found = [];
  let position = 8;
  while (position + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(position);
    const type = buffer.toString('latin1', position + 4, position + 8);
    const data = position + 8;
    if (data + length + 4 > buffer.length) throw new Malformed(`chunk ${type} runs past the end of the file`);
    if (type === 'eXIf') found.push(`${exifLabel(buffer.subarray(data, data + length))} (eXIf chunk)`);
    else if (type === 'caBX') found.push('C2PA (caBX chunk)');
    else if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      const keyword = cString(buffer, data, data + length);
      if (keyword === 'XML:com.adobe.xmp') found.push(`XMP (${type} chunk)`);
      else if (PNG_PROFILE_KEYWORD.test(keyword) || PNG_PERSONAL_KEYWORD.test(keyword)) found.push(`text chunk "${keyword}"`);
    } else if (type === 'IEND') break;
    position = data + length + 4;
  }
  return found;
}

// ---- JPEG ----------------------------------------------------------------------------------------------------------------------

function jpegMetadata(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Malformed('not a JPEG file');
  const found = [];
  let position = 2;
  while (position + 4 <= buffer.length) {
    if (buffer[position] !== 0xff) throw new Malformed(`no marker at byte ${position}`);
    const marker = buffer[position + 1];
    if (marker === 0xff) {
      position += 1;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break;
    const length = buffer.readUInt16BE(position + 2);
    const data = position + 4;
    const end = position + 2 + length;
    if (length < 2 || end > buffer.length) throw new Malformed(`segment FF${marker.toString(16).toUpperCase()} runs past the end of the file`);
    const head = buffer.toString('latin1', data, Math.min(end, data + 32));
    if (marker === 0xe1 && head.startsWith('Exif\0\0')) found.push(`${exifLabel(buffer.subarray(data + 6, end))} (APP1)`);
    else if (marker === 0xe1 && head.startsWith('http://ns.adobe.com/xap/1.0/\0')) found.push('XMP (APP1)');
    else if (marker === 0xed && head.startsWith('Photoshop 3.0')) found.push('IPTC or Photoshop block (APP13)');
    else if (marker === 0xeb && head.startsWith('JP')) found.push('C2PA JUMBF (APP11)');
    else if (marker === 0xfe) found.push('JPEG comment');
    position = end;
  }
  return found;
}

// ---- WebM (EBML) ---------------------------------------------------------------------------------------------------------------

const EBML = { segment: 0x18538067, info: 0x1549a966, title: 0x7ba9, tags: 0x1254c367, tag: 0x7373, simpleTag: 0x67c8, tagName: 0x45a3, attachments: 0x1941a469, cluster: 0x1f43b675 };

/** Reads an element header at `at`: its id (marker bits kept), its data range, and where the next element starts. Unknown size runs to `limit`. */
function element(buffer, at, limit) {
  const first = buffer[at];
  const idLength = first >= 0x80 ? 1 : first >= 0x40 ? 2 : first >= 0x20 ? 3 : first >= 0x10 ? 4 : 0;
  if (idLength === 0 || at + idLength + 1 > limit) throw new Malformed(`bad element id at byte ${at}`);
  const id = buffer.readUIntBE(at, idLength);
  const sizeAt = at + idLength;
  const lead = buffer[sizeAt];
  let sizeLength = 1;
  while (sizeLength <= 8 && (lead & (0x100 >> sizeLength)) === 0) sizeLength += 1;
  if (sizeLength > 8 || sizeAt + sizeLength > limit) throw new Malformed(`bad element size at byte ${sizeAt}`);
  let size = lead & ((0x100 >> sizeLength) - 1);
  let unknown = size === (0x100 >> sizeLength) - 1;
  for (let i = 1; i < sizeLength; i += 1) {
    size = size * 256 + buffer[sizeAt + i];
    if (buffer[sizeAt + i] !== 0xff) unknown = false;
  }
  const start = sizeAt + sizeLength;
  const end = unknown ? limit : start + size;
  if (end > limit) throw new Malformed(`element at byte ${at} runs past its parent`);
  return { id, start, end, unknown };
}

function* elements(buffer, start, end) {
  let position = start;
  while (position < end) {
    const el = element(buffer, position, end);
    yield el;
    position = el.end;
  }
}

function tagNames(buffer, start, end, names) {
  for (const el of elements(buffer, start, end)) {
    if (el.id === EBML.tag || el.id === EBML.simpleTag) tagNames(buffer, el.start, el.end, names);
    else if (el.id === EBML.tagName) names.push(buffer.toString('utf8', el.start, el.end));
  }
}

function webmMetadata(buffer) {
  if (buffer.length < 4 || buffer.readUInt32BE(0) !== 0x1a45dfa3) throw new Malformed('no EBML header at the start of the file');
  const found = [];
  for (const top of elements(buffer, 0, buffer.length)) {
    if (top.id !== EBML.segment) continue;
    for (const el of elements(buffer, top.start, top.end)) {
      if (el.id === EBML.cluster && el.unknown) throw new Malformed('a cluster of unknown size cannot be skipped, so the rest of the file is unread');
      if (el.id === EBML.attachments) found.push('attachments (an embedded file)');
      else if (el.id === EBML.info) {
        for (const child of elements(buffer, el.start, el.end)) if (child.id === EBML.title && child.end > child.start) found.push('segment title');
      } else if (el.id === EBML.tags) {
        const names = [];
        tagNames(buffer, el.start, el.end, names);
        for (const name of names) if (!WEBM_TECHNICAL_TAG.test(name)) found.push(`tag "${name.slice(0, 40)}"`);
      }
    }
  }
  return found;
}

// ---- the entry point -----------------------------------------------------------------------------------------------------------

/**
 * The metadata kinds found in one file's bytes, as short labels ([] when clean). `ext` is the lower-case extension with its dot.
 * Throws a `Malformed` error when the container cannot be read to its end.
 */
export function findMetadata(buffer, ext) {
  switch (METADATA_TYPES[ext]) {
    case 'isobmff':
      return isobmffMetadata(buffer);
    case 'png':
      return pngMetadata(buffer);
    case 'jpeg':
      return jpegMetadata(buffer);
    case 'webm':
      return webmMetadata(buffer);
    case 'svg': {
      const text = buffer.toString('utf8');
      return SVG_PATTERNS.filter(([re]) => re.test(text)).map(([, label]) => label);
    }
    default:
      return [];
  }
}

/** Findings for one file. A container that cannot be read to its end is reported, not skipped. */
export function metadataFindings(where, buffer, ext) {
  try {
    return findMetadata(buffer, ext).map((label) => ({ level: 'error', where, message: `embedded metadata: ${label}` }));
  } catch (error) {
    if (!(error instanceof Malformed) && !(error instanceof RangeError)) throw error;
    return [{ level: 'error', where, message: `metadata could not be checked, the file is malformed: ${error.message}` }];
  }
}

// ---- the self-test -------------------------------------------------------------------------------------------------------------

const box = (type, ...parts) => {
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + body.length, 0);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, body]);
};
const full = (type, version, ...parts) => box(type, Buffer.from([version, 0, 0, 0]), ...parts);
const infe = (id, type, ...tail) => full('infe', 2, Buffer.from([id >> 8, id & 255, 0, 0]), Buffer.from(type, 'latin1'), ...tail);
const nul = (text) => Buffer.from(`${text}\0`, 'latin1');
const ftyp = (brand) => box('ftyp', Buffer.from(brand, 'latin1'), Buffer.alloc(4), Buffer.from(brand, 'latin1'));

/** A little-endian TIFF payload whose first IFD holds one entry: the GPSInfo pointer when `gps`, else the Make tag. */
function tiff(gps) {
  const out = Buffer.alloc(26);
  out.write('II', 0);
  out.writeUInt16LE(42, 2);
  out.writeUInt32LE(8, 4);
  out.writeUInt16LE(1, 8);
  out.writeUInt16LE(gps ? 0x8825 : 0x010f, 10);
  return out;
}

const mp4 = (...children) => Buffer.concat([ftyp('isom'), box('moov', box('mvhd', Buffer.alloc(8)), ...children)]);
const avif = (...items) => Buffer.concat([ftyp('avif'), box('meta', Buffer.alloc(4), box('hdlr', Buffer.alloc(24)), full('iinf', 0, Buffer.from([0, items.length]), ...items), box('mdat', Buffer.alloc(8)))]);
const png = (...chunks) => {
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'latin1');
    return Buffer.concat([head, data, Buffer.alloc(4)]);
  };
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', Buffer.alloc(13)), ...chunks.map(([type, data]) => chunk(type, data)), chunk('IEND', Buffer.alloc(0))]);
};
const jpeg = (...segments) => Buffer.concat([Buffer.from([0xff, 0xd8]), ...segments.map(([marker, data]) => Buffer.concat([Buffer.from([0xff, marker, (data.length + 2) >> 8, (data.length + 2) & 255]), data])), Buffer.from([0xff, 0xda, 0, 2, 0xff, 0xd9])]);
const ebml = (id, ...parts) => {
  const body = Buffer.concat(parts);
  const idBytes = Buffer.from(id.toString(16).padStart(id > 0xffffff ? 8 : id > 0xffff ? 6 : id > 0xff ? 4 : 2, '0'), 'hex');
  const size = Buffer.alloc(4);
  size.writeUInt32BE(body.length, 0);
  size[0] |= 0x10;
  return Buffer.concat([idBytes, size, body]);
};
const webmTag = (name) => ebml(EBML.tags, ebml(EBML.tag, ebml(EBML.simpleTag, ebml(EBML.tagName, Buffer.from(name)))));
const webm = (...children) => Buffer.concat([ebml(0x1a45dfa3, ebml(0x4282, Buffer.from('webm'))), ebml(EBML.segment, ...children)]);

/**
 * Proves the check can fail. Plants each kind of metadata in a synthetic file of its own container and expects a finding; a file without
 * metadata, with only an encoder tag, or with only the Lavf tool name must pass; a truncated file must fail; a finding must not carry the
 * planted value. Then writes one planted file into a temporary dist folder as `auditMetadata` would meet it. Returns [{ label, ok }].
 */
export function selfTest(auditMetadata) {
  const results = [];
  const check = (label, ok) => results.push({ label, ok: ok === true });
  const kinds = (buffer, ext) => findMetadata(buffer, ext);
  const clean = [
    ['AVIF', avif(infe(1, 'av01', nul('')), infe(2, 'av01', nul(''))), '.avif'],
    ['PNG', png(['pHYs', Buffer.alloc(9)], ['tEXt', Buffer.from('Software\0encoder')]), '.png'],
    ['JPEG', jpeg([0xe0, Buffer.from('JFIF\0')]), '.jpg'],
    ['MP4', mp4(box('udta', box('meta', Buffer.alloc(4), box('hdlr', Buffer.alloc(24)), box('ilst', box(ISO_TOOL_TAG, Buffer.from('Lavf')))))), '.mp4'],
    ['WebM', webm(webmTag('ENCODER'), ebml(EBML.info, ebml(0x4d80, Buffer.from('Lavf')))), '.webm'],
    ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10z"/></svg>'), '.svg'],
  ];
  for (const [name, buffer, ext] of clean) check(`a ${name} without metadata passes`, kinds(buffer, ext).length === 0);
  const planted = [
    ['EXIF in an AVIF item', avif(infe(1, 'av01', nul('')), infe(2, 'Exif', nul(''))), '.avif', /EXIF/],
    ['XMP in an AVIF item', avif(infe(1, 'mime', nul(''), nul('application/rdf+xml'))), '.avif', /XMP/],
    ['EXIF with GPS in a PNG', png(['eXIf', tiff(true)]), '.png', /GPS/],
    ['XMP in a PNG', png(['iTXt', Buffer.from('XML:com.adobe.xmp\0\0\0\0\0<x:xmpmeta/>')]), '.png', /XMP/],
    ['an author text chunk in a PNG', png(['tEXt', Buffer.from('Author\0sentinel-client')]), '.png', /Author/],
    ['a C2PA chunk in a PNG', png(['caBX', Buffer.alloc(8)]), '.png', /C2PA/],
    ['EXIF with GPS in a JPEG', jpeg([0xe1, Buffer.concat([Buffer.from('Exif\0\0'), tiff(true)])]), '.jpg', /GPS/],
    ['EXIF without GPS in a JPEG', jpeg([0xe1, Buffer.concat([Buffer.from('Exif\0\0'), tiff(false)])]), '.jpg', /EXIF/],
    ['XMP in a JPEG', jpeg([0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0<x/>')]), '.jpg', /XMP/],
    ['a C2PA manifest in a JPEG', jpeg([0xeb, Buffer.from('JP\0\0c2pa')]), '.jpg', /C2PA/],
    ['a GPS location in an MP4', Buffer.concat([ftyp('isom'), box('moov', box('udta', box('©xyz', Buffer.from('+00.0000+000.0000/'))))]), '.mp4', /QuickTime tag/],
    ['a C2PA uuid box in an MP4', Buffer.concat([ftyp('isom'), box('uuid', Buffer.from(C2PA_UUID, 'hex'), Buffer.alloc(4))]), '.mp4', /C2PA/],
    ['an artist tag in a WebM', webm(webmTag('ARTIST')), '.webm', /ARTIST/],
    ['an SVG <metadata> block', Buffer.from('<svg><metadata><rdf:RDF><dc:creator>sentinel-client</dc:creator></rdf:RDF></metadata></svg>'), '.svg', /metadata/],
    ['an absolute home path in an SVG', Buffer.from('<svg><desc>exported from /home/sentinel-client/art.svg</desc></svg>'), '.svg', /home path/],
  ];
  for (const [label, buffer, ext, pattern] of planted) check(`${label} is found`, kinds(buffer, ext).some((kind) => pattern.test(kind)));
  const cut = avif(infe(1, 'Exif', nul(''))).subarray(0, 40);
  check('a truncated file is reported, not skipped', metadataFindings('cut.avif', cut, '.avif').some((f) => /malformed/.test(f.message)));
  check('a finding never carries the planted value', metadataFindings('x.png', png(['tEXt', Buffer.from('Author\0sentinel-client')]), '.png').every((f) => !f.message.includes('sentinel-client')));
  const base = mkdtempSync(join(tmpdir(), 'image-metadata-'));
  try {
    mkdirSync(join(base, '_astro'), { recursive: true });
    writeFileSync(join(base, '_astro', 'planted.jpg'), jpeg([0xe1, Buffer.concat([Buffer.from('Exif\0\0'), tiff(true)])]));
    writeFileSync(join(base, '_astro', 'clean.avif'), clean[0][1]);
    const run = auditMetadata(base);
    check('the dist audit fails on the planted file and on nothing else', run.length === 1 && run[0].where === '_astro/planted.jpg');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
  return results;
}
