'use strict';

/**
 * 文件类型判定 —— 纯数据 + 纯函数。
 *
 * 这是从 server.js 拆出来的第一块，挑它的原因：**零依赖**（只用 node:path）、
 * 不碰任何全局状态，谁都能引。原来它躺在 server.js 开头占 35 行，
 * 而改任何路由逻辑时都不需要看它。
 *
 * 从 server.js 原样搬过来，一行行为都没改。
 */

const path = require('path');

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.jfif', '.gif', '.webp', '.bmp', '.avif', '.svg', '.ico']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v', '.flv', '.wmv', '.mpg', '.mpeg', '.ts']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg', '.wma']);
const TEXT_EXT = new Set(['.txt', '.md', '.json', '.js', '.mjs', '.cjs', '.ts', '.css', '.html', '.htm', '.xml',
  '.yml', '.yaml', '.log', '.csv', '.ini', '.conf', '.bat', '.cmd', '.ps1', '.sh', '.py', '.java', '.c',
  '.cpp', '.h', '.hpp', '.go', '.rs', '.sql', '.vue', '.jsx', '.tsx', '.srt', '.ass', '.toml']);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
  '.m4v': 'video/mp4', '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.flac': 'audio/flac',
  '.ogg': 'audio/ogg', '.aac': 'audio/aac',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf', '.zip': 'application/zip',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function extOf(name) { return path.extname(name).toLowerCase(); }

function kindOf(name) {
  const ext = extOf(name);
  if (IMAGE_EXT.has(ext)) return 'image';
  if (VIDEO_EXT.has(ext)) return 'video';
  if (AUDIO_EXT.has(ext)) return 'audio';
  if (TEXT_EXT.has(ext)) return 'text';
  return 'other';
}

module.exports = { IMAGE_EXT, VIDEO_EXT, AUDIO_EXT, TEXT_EXT, MIME, extOf, kindOf };
