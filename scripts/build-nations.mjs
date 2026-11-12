import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { cp, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
await build({configFile:fileURLToPath(new URL('../games/age-of-nations/vite.config.ts',import.meta.url))});
const output=fileURLToPath(new URL('../games/age-of-nations/dist/',import.meta.url));
const html=await readFile(resolve(output,'index.html'),'utf8');
if(!html.includes('/age-of-nations/assets/'))throw new Error('Game assets must use their dedicated path');
if(process.argv.includes('--portal'))await cp(output,fileURLToPath(new URL('../dist/age-of-nations/',import.meta.url)),{recursive:true});
