/* Small deterministic ZIP writer for our bounded, trusted runtime file set.
   Stored entries avoid platform-specific tar behavior and require no dependencies. */
export function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function zipStore(files) {
  const local = [], central = [], names = new Set();
  let offset = 0;
  if (files.length > 65535) throw new Error('Too many ZIP entries');
  for (const file of files) {
    if (!file.name || file.name.startsWith('/') || file.name.includes('\\') || file.name.split('/').some(p => p === '..' || !p) || names.has(file.name)) throw new Error('Invalid ZIP path');
    names.add(file.name);
    const name = Buffer.from(file.name, 'utf8'), data = Buffer.from(file.data), crc = crc32(data);
    if (name.length > 65535 || data.length > 0xffffffff) throw new Error('ZIP entry too large');
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x800, 6);
    h.writeUInt16LE(33, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18);
    h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
    local.push(h, name, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x800, 8);
    c.writeUInt16LE(33, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, name); offset += h.length + name.length + data.length;
    if (offset > 0xffffffff) throw new Error('ZIP64 is not supported');
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
export function zipEntries(data) {
  const entries = [], end = data.length - 22;
  if (end < 0 || data.readUInt32LE(end) !== 0x06054b50) throw new Error('Not a ZIP archive');
  let at = data.readUInt32LE(end + 16);
  const count = data.readUInt16LE(end + 10);
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || data.readUInt32LE(at) !== 0x02014b50) throw new Error('Invalid ZIP directory');
    const size = data.readUInt16LE(at + 28), extra = data.readUInt16LE(at + 30), comment = data.readUInt16LE(at + 32);
    if (at + 46 + size + extra + comment > end) throw new Error('Truncated ZIP directory');
    entries.push(data.toString('utf8', at + 46, at + 46 + size)); at += 46 + size + extra + comment;
  }
  if (at !== end) throw new Error('Invalid ZIP directory size');
  return entries;
}
