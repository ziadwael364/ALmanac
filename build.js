#!/usr/bin/env node
/* Bundles index.html + css + js into one self-contained file.
 *   node build.js                 -> dist/almanac.html (open it anywhere)
 *   node build.js --body out.html -> page content only, for hosts that add
 *                                    their own <html>/<head>/<body> wrapper */
'use strict';
const fs = require('fs');
const path = require('path');
const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const inlined = html
  .replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, f) => '<style>\n' + fs.readFileSync(path.join(root, f), 'utf8') + '</style>')
  .replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, f) => '<script>\n' + fs.readFileSync(path.join(root, f), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>');

const bodyIdx = process.argv.indexOf('--body');
if (bodyIdx > -1) {
  const head = /<head>([\s\S]*?)<\/head>/.exec(inlined)[1].replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
  const body = /<body>([\s\S]*?)<\/body>/.exec(inlined)[1];
  const out = process.argv[bodyIdx + 1];
  fs.writeFileSync(out, head.trim() + '\n' + body.trim() + '\n');
  console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
} else {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  const out = path.join(root, 'dist', 'almanac.html');
  fs.writeFileSync(out, inlined);
  console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
}
