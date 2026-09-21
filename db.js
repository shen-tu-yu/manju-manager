'use strict';

/**
 * 数据层 —— 用 Node 内置的 node:sqlite（零依赖，不装任何包）
 * 数据库文件固定放在程序目录，不占 C 盘。
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');
const LEGACY_CONFIG = path.join(__dirname, 'config.json');
const LEGACY_VGROUPS = path.join(__dirname, 'vgroups.json');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS roots (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    path       TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS vgroups (
    id         TEXT PRIMARY KEY,
    root_path  TEXT NOT NULL,
    name       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS vgroup_files (
    group_id  TEXT NOT NULL,
    file_name TEXT NOT NULL,
    PRIMARY KEY (group_id, file_name)
  );
  CREATE INDEX IF NOT EXISTS idx_vg_root  ON vgroups(root_path);
  CREATE INDEX IF NOT EXISTS idx_vgf_group ON vgroup_files(group_id);
`);

function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { try { db.exec('ROLLBACK'); } catch { } throw e; }
}

/* ---------------- settings ---------------- */

function getSettings() {
  const out = {};
  for (const r of db.prepare('SELECT key, value FROM settings').all()) {
    try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; }
  }
  return out;
}

function setSettings(obj) {
  const st = db.prepare(
    'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  tx(() => { for (const [k, v] of Object.entries(obj)) st.run(k, JSON.stringify(v)); });
}

/* ---------------- roots ---------------- */

function getRoots() {
  return db.prepare('SELECT id, name, path FROM roots ORDER BY rowid').all();
}

function replaceRoots(list) {
  const ins = db.prepare('INSERT INTO roots(id,name,path,created_at) VALUES(?,?,?,?)');
  const now = Date.now();
  tx(() => {
    db.exec('DELETE FROM roots');
    for (const r of list) ins.run(r.id, r.name, r.path, now);
  });
}

/* ---------------- vgroups ---------------- */

function getVGroups() {
  const out = {};
  const gf = db.prepare('SELECT file_name FROM vgroup_files WHERE group_id = ? ORDER BY rowid');
  for (const g of db.prepare('SELECT id, root_path, name FROM vgroups ORDER BY rowid').all()) {
    if (!out[g.root_path]) out[g.root_path] = { groups: [] };
    out[g.root_path].groups.push({ id: g.id, name: g.name, files: gf.all(g.id).map((r) => r.file_name) });
  }
  return out;
}

function replaceVGroups(map) {
  const gi = db.prepare('INSERT INTO vgroups(id,root_path,name,created_at) VALUES(?,?,?,?)');
  const fi = db.prepare('INSERT OR IGNORE INTO vgroup_files(group_id,file_name) VALUES(?,?)');
  const now = Date.now();
  tx(() => {
    db.exec('DELETE FROM vgroup_files');
    db.exec('DELETE FROM vgroups');
    for (const [rootPath, entry] of Object.entries(map || {})) {
      for (const g of ((entry && entry.groups) || [])) {
        gi.run(g.id, rootPath, g.name, now);
        for (const f of (g.files || [])) fi.run(g.id, f);
      }
    }
  });
}

/* ---------------- 首次迁移：把旧 JSON 导进库 ---------------- */

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); }
  catch { return null; }
}

const SETTING_KEYS = ['port', 'host', 'title', 'autoPolicy', 'showHidden', 'projectTemplate', 'smartRules'];

function migrate() {
  const done = { config: false, vgroups: false };
  const hasRoots = db.prepare('SELECT COUNT(*) n FROM roots').get().n > 0;
  const hasSettings = db.prepare('SELECT COUNT(*) n FROM settings').get().n > 0;
  const hasGroups = db.prepare('SELECT COUNT(*) n FROM vgroups').get().n > 0;

  if (!hasRoots && !hasSettings) {
    const cfg = readJSON(LEGACY_CONFIG);
    if (cfg) {
      replaceRoots((cfg.roots || []).map((r) => ({
        id: r.id, name: r.name, path: path.resolve(r.path),
      })));
      const s = {};
      for (const k of SETTING_KEYS) if (cfg[k] !== undefined) s[k] = cfg[k];
      setSettings(s);
      try { fs.renameSync(LEGACY_CONFIG, LEGACY_CONFIG + '.bak'); } catch { }
      done.config = true;
    }
  }

  if (!hasGroups) {
    const vg = readJSON(LEGACY_VGROUPS);
    if (vg) {
      replaceVGroups(vg);
      try { fs.renameSync(LEGACY_VGROUPS, LEGACY_VGROUPS + '.bak'); } catch { }
      done.vgroups = true;
    }
  }
  return done;
}

module.exports = {
  db, DB_PATH, migrate,
  getSettings, setSettings,
  getRoots, replaceRoots,
  getVGroups, replaceVGroups,
};
