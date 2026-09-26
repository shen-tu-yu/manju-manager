'use strict';

/**
 * 技能目录（提示词模板）—— 挂载任意磁盘目录，列出/读取可投放的模板文件。
 *
 * 和素材根目录**分开存**（独立表 / 独立接口），否则会连带三个问题：
 *   ① 左侧素材树里冒出 skills 目录，和素材混在一起
 *   ② 收件箱会去 fs.watch 它，改个模板就被当成"新文件"
 *   ③ 回收站/虚拟分类按根目录工作，会在里面建 .recycle
 * 路径安全仍然走 resolveSafe（注入进来，不在这里自己拼）。
 *
 * 依赖全部显式注入，模块自身不持有全局状态：
 *   DB / sendJSON / readJson / HttpError / LOG / resolveSafe / toRel
 *   getConfig()  取当前配置（config 是可被重新赋值的全局，必须用取值函数而不是快照）
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const SKILL_EXT = new Set(['.md', '.txt', '.markdown']);   // 只认这些；yaml/json 不列也不投
const SKILL_FILE_MAX = 300;
const SKILL_DEPTH_MAX = 3;

module.exports = function createSkills({ DB, sendJSON, readJson, HttpError, LOG, resolveSafe, toRel, getConfig }) {

  function getSkillDir(id) {
    const d = DB.getSkillDirs().find((x) => x.id === String(id || ''));
    if (!d) throw new HttpError(404, '技能目录不存在，可能已被移除');
    return d;
  }

  /** 递归收模板文件（限深限数，只留白名单扩展名） */
  async function collectSkillFiles(absDir, relDir, depth, out) {
    if (depth > SKILL_DEPTH_MAX || out.length >= SKILL_FILE_MAX) return;
    let ds = [];
    try { ds = await fsp.readdir(absDir, { withFileTypes: true }); } catch { return; }
    ds.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true }));
    for (const d of ds) {
      if (out.length >= SKILL_FILE_MAX) return;
      if (d.name.startsWith('.')) continue;
      const rel = relDir ? relDir + '/' + d.name : d.name;
      if (d.isDirectory()) { await collectSkillFiles(path.join(absDir, d.name), rel, depth + 1, out); continue; }
      if (!d.isFile()) continue;
      if (!SKILL_EXT.has(path.extname(d.name).toLowerCase())) continue;
      let size = 0;
      try { size = (await fsp.stat(path.join(absDir, d.name))).size; } catch { /* 读不到就当 0 */ }
      out.push({ name: d.name, rel, size });
    }
  }

  return {
    // 挂载的目录列表 + 每个目录里可投放的模板文件（顺带带上"目录还在不在"）
    async list(req, res) {
      const out = [];
      for (const d of DB.getSkillDirs()) {
        const exists = fs.existsSync(d.path);
        let files = [];
        if (exists) {
          files = [];
          await collectSkillFiles(d.path, '', 0, files);
        }
        out.push({ id: d.id, name: d.name, path: d.path, exists, files });
      }
      return sendJSON(res, 200, { dirs: out, exts: Array.from(SKILL_EXT), maxFiles: SKILL_FILE_MAX });
    },

    // 挂载一个目录（已经在列表里就直接返回原来的 id）
    async add(req, res) {
      const b = await readJson(req);
      const raw = String(b.path || '').trim();
      if (!raw) throw new HttpError(400, '请选择技能目录');
      const abs = path.resolve(raw);
      const st = await fsp.stat(abs).catch(() => null);
      if (!st || !st.isDirectory()) throw new HttpError(400, '目录不存在或不是文件夹：' + abs);
      const dup = DB.getSkillDirs().find((x) => x.path.toLowerCase() === abs.toLowerCase());
      if (dup) return sendJSON(res, 200, { ok: true, id: dup.id, existed: true });
      const id = 'sk' + Date.now().toString(36);
      DB.addSkillDir(id, String(b.name || path.basename(abs) || abs), abs);
      LOG(`[技能] 挂载目录 ${abs}`);
      return sendJSON(res, 200, { ok: true, id });
    },

    // 移除挂载（只删记录，不动磁盘上的文件）
    remove(req, res, pathname) {
      const id = decodeURIComponent(pathname.slice('/api/skills/'.length));
      const d = getSkillDir(id);
      DB.removeSkillDir(id);
      LOG(`[技能] 移除目录 ${d.path}`);
      return sendJSON(res, 200, { ok: true });
    },

    // 读一份模板（预览用；以后投放给 AI 也用这个接口取内容）
    async read(req, res, q) {
      const d = getSkillDir(q.get('id'));
      const abs = resolveSafe(d.path, q.get('rel') || '');
      const st = await fsp.stat(abs).catch(() => null);
      if (!st || !st.isFile()) throw new HttpError(404, '文件不存在');
      const ext = path.extname(abs).toLowerCase();
      if (!SKILL_EXT.has(ext)) throw new HttpError(415, `这个类型不投放（只支持 ${Array.from(SKILL_EXT).join(' / ')}）`);
      const limitBytes = getConfig().limits.textPreviewBytes;
      if (st.size > limitBytes) {
        throw new HttpError(413, `文件太大（超过 ${Math.round(limitBytes / 1048576)}MB）`);
      }
      const content = await fsp.readFile(abs, 'utf8');
      return sendJSON(res, 200, {
        dirId: d.id, dirName: d.name, name: path.basename(abs), rel: toRel(d.path, abs),
        size: st.size, mtime: st.mtimeMs, content,
      });
    },
  };
};
