import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Jimp = require('jimp-compact');
const sourcePath = path.resolve('assets', 'app-icon.png');
const outputPath = path.resolve('assets', 'app-icon.ico');
const source = await fs.readFile(sourcePath);
const image = await Jimp.read(source);
const png = await image.resize(256, 256).getBufferAsync('image/png');
const header = Buffer.alloc(22);

header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(0, 6);
header.writeUInt8(0, 7);
header.writeUInt8(0, 8);
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(header.length, 18);

await fs.writeFile(outputPath, Buffer.concat([header, png]));
console.log(`Generated ${path.relative(process.cwd(), outputPath)} from the View2Connect app icon.`);
