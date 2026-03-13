const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const imagesRoot = path.join(repoRoot, 'images');
const dataPath = path.join(repoRoot, 'data.js');

const mediaExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm']);
const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

function escapeJsString(str) {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function getLeadingNumberWeight(name) {
    const m = /^(\d+)/.exec(name);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
}

function sortByRules(entries) {
    const nonWeighted = [];
    const weighted = [];
    for (const e of entries) {
        const w = getLeadingNumberWeight(e.name);
        if (w === null) nonWeighted.push(e);
        else weighted.push({ ...e, weight: w });
    }

    nonWeighted.sort((a, b) => {
        if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
        return collator.compare(a.name, b.name);
    });

    weighted.sort((a, b) => {
        if (a.weight !== b.weight) return a.weight - b.weight;
        return collator.compare(a.name, b.name);
    });

    return nonWeighted.concat(weighted);
}

function sortWithKnown(entries, folderName, knownPathsSet) {
    if (!knownPathsSet || knownPathsSet.size === 0) return sortByRules(entries);

    const newEntries = [];
    const oldEntries = [];

    for (const e of entries) {
        const p = `images/${folderName}/${e.name}`;
        if (knownPathsSet.has(p)) oldEntries.push(e);
        else newEntries.push(e);
    }

    newEntries.sort((a, b) => {
        if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
        return collator.compare(a.name, b.name);
    });

    const oldWeighted = [];
    const oldOther = [];
    for (const e of oldEntries) {
        const w = getLeadingNumberWeight(e.name);
        if (w === null) oldOther.push(e);
        else oldWeighted.push({ ...e, weight: w });
    }

    oldWeighted.sort((a, b) => {
        if (a.weight !== b.weight) return a.weight - b.weight;
        return collator.compare(a.name, b.name);
    });

    oldOther.sort((a, b) => collator.compare(a.name, b.name));

    return newEntries.concat(oldWeighted, oldOther);
}

function readFolderMedia(folderName, knownPathsSet) {
    const dir = path.join(imagesRoot, folderName);
    const dirents = fs.readdirSync(dir, { withFileTypes: true });
    const files = dirents
        .filter((d) => d.isFile())
        .map((d) => d.name)
        .filter((name) => mediaExts.has(path.extname(name).toLowerCase()));

    const entries = files.map((name) => {
        const st = fs.statSync(path.join(dir, name));
        return { name, mtimeMs: st.mtimeMs };
    });

    if (folderName !== 'motion') {
        return sortWithKnown(entries, folderName, knownPathsSet).map((e) => `images/${folderName}/${e.name}`);
    }

    const videoBases = new Set(
        entries
            .filter((e) => ['.mp4', '.webm'].includes(path.extname(e.name).toLowerCase()))
            .map((e) => path.basename(e.name, path.extname(e.name).toLowerCase()))
    );

    const filtered = [];
    for (const e of entries) {
        const ext = path.extname(e.name).toLowerCase();
        if (ext === '.webp' && videoBases.has(path.basename(e.name, ext))) continue;
        filtered.push(e);
    }

    const sorted = sortWithKnown(filtered, folderName, knownPathsSet);
    const nonGifs = [];
    const gifs = [];
    for (const e of sorted) {
        const ext = path.extname(e.name).toLowerCase();
        if (ext === '.gif') gifs.push(e);
        else nonGifs.push(e);
    }

    return nonGifs.concat(gifs).map((e) => `images/${folderName}/${e.name}`);
}

function findProjectsIds(source) {
    const ids = [];
    const re = /\bid\s*:\s*(\d+)\s*,/g;
    let m;
    while ((m = re.exec(source))) {
        ids.push(Number(m[1]));
    }
    return Array.from(new Set(ids));
}

function inferFolderForId(source, id) {
    const defaultMap = {
        1: 'kv',
        2: 'detail',
        3: 'web',
        4: 'aigc',
        5: '3d',
        6: 'motion'
    };

    const idRe = new RegExp(`\\bid\\s*:\\s*${id}\\s*,`);
    const idMatch = idRe.exec(source);
    if (!idMatch) return defaultMap[id] || null;

    const slice = source.slice(idMatch.index, idMatch.index + 1500);
    const coverMatch = /\bcover\s*:\s*"([^"]*)"/.exec(slice);
    if (coverMatch && coverMatch[1].startsWith('images/')) {
        const parts = coverMatch[1].split('/');
        if (parts.length >= 2) return parts[1];
    }

    const imagesMatch = /\bimages\s*:\s*\[\s*([\s\S]*?)\s*\]/.exec(slice);
    if (imagesMatch) {
        const firstPathMatch = /"images\/([^/]+)\//.exec(imagesMatch[1]);
        if (firstPathMatch) return firstPathMatch[1];
    }

    return defaultMap[id] || null;
}

function extractImagesArrayForId(source, id) {
    const idRe = new RegExp(`\\bid\\s*:\\s*${id}\\s*,`);
    const idMatch = idRe.exec(source);
    if (!idMatch) return [];

    const imagesRe = /\bimages\s*:\s*\[/g;
    imagesRe.lastIndex = idMatch.index;
    const imagesMatch = imagesRe.exec(source);
    if (!imagesMatch) return [];

    const imagesIndex = imagesMatch.index;
    const bracketStart = source.indexOf('[', imagesIndex);
    if (bracketStart === -1) return [];

    let depth = 0;
    let inStr = null;
    let escaped = false;
    let bracketEnd = -1;

    for (let i = bracketStart; i < source.length; i++) {
        const ch = source[i];

        if (inStr) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\\\') {
                escaped = true;
                continue;
            }
            if (ch === inStr) {
                inStr = null;
            }
            continue;
        }

        if (ch === '"' || ch === "'" || ch === '`') {
            inStr = ch;
            continue;
        }

        if (ch === '[') {
            depth += 1;
            continue;
        }
        if (ch === ']') {
            depth -= 1;
            if (depth === 0) {
                bracketEnd = i;
                break;
            }
        }
    }

    if (bracketEnd === -1) return [];

    const inner = source.slice(bracketStart + 1, bracketEnd);
    const re = /"((?:\\.|[^"\\])*)"/g;
    const items = [];
    let m;
    while ((m = re.exec(inner))) {
        const raw = m[1];
        try {
            items.push(JSON.parse(`"${raw}"`));
        } catch {
            items.push(raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
        }
    }
    return items;
}

function replaceImagesArrayForId(source, id, newItems) {
    const idRe = new RegExp(`\\bid\\s*:\\s*${id}\\s*,`);
    const idMatch = idRe.exec(source);
    if (!idMatch) throw new Error(`找不到 id: ${id}`);

    const imagesRe = /\bimages\s*:\s*\[/g;
    imagesRe.lastIndex = idMatch.index;
    const imagesMatch = imagesRe.exec(source);
    if (!imagesMatch) throw new Error(`在 id: ${id} 之后找不到 images: [`);

    const imagesIndex = imagesMatch.index;
    const bracketStart = source.indexOf('[', imagesIndex);
    if (bracketStart === -1) throw new Error(`在 id: ${id} 的 images 处找不到 [`);

    let depth = 0;
    let inStr = null;
    let escaped = false;
    let bracketEnd = -1;

    for (let i = bracketStart; i < source.length; i++) {
        const ch = source[i];

        if (inStr) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\\\') {
                escaped = true;
                continue;
            }
            if (ch === inStr) {
                inStr = null;
            }
            continue;
        }

        if (ch === '"' || ch === "'" || ch === '`') {
            inStr = ch;
            continue;
        }

        if (ch === '[') {
            depth += 1;
            continue;
        }
        if (ch === ']') {
            depth -= 1;
            if (depth === 0) {
                bracketEnd = i;
                break;
            }
        }
    }

    if (bracketEnd === -1) throw new Error(`在 id: ${id} 的 images 数组找不到匹配的 ]`);

    const lineStart = source.lastIndexOf('\n', imagesIndex) + 1;
    const baseIndent = source.slice(lineStart, imagesIndex).match(/^\s*/)?.[0] || '';
    const itemIndent = `${baseIndent}    `;

    const inner =
        newItems.length === 0
            ? `\n${baseIndent}`
            : `\n${newItems
                  .map((p, idx) => `${itemIndent}"${escapeJsString(p)}"${idx < newItems.length - 1 ? ',' : ''}`)
                  .join('\n')}\n${baseIndent}`;

    return source.slice(0, bracketStart + 1) + inner + source.slice(bracketEnd);
}

function main() {
    if (!fs.existsSync(imagesRoot)) throw new Error(`找不到目录: ${imagesRoot}`);
    if (!fs.existsSync(dataPath)) throw new Error(`找不到文件: ${dataPath}`);

    const original = fs.readFileSync(dataPath, 'utf8');
    const ids = findProjectsIds(original);

    const folderMedia = {};
    const folderKnown = {};
    const perIdImages = {};
    let updated = original;

    for (const id of ids) {
        if (id === 999) continue;
        const folder = inferFolderForId(original, id);
        if (!folder) continue;
        if (!Object.prototype.hasOwnProperty.call(folderMedia, folder)) {
            const existing = extractImagesArrayForId(original, id);
            const known = new Set(existing.filter((p) => p.startsWith(`images/${folder}/`)));
            folderKnown[folder] = known;
            try {
                folderMedia[folder] = readFolderMedia(folder, known);
            } catch {
                folderMedia[folder] = [];
            }
        }

        perIdImages[id] = folderMedia[folder];
        updated = replaceImagesArrayForId(updated, id, perIdImages[id]);
    }

    if (ids.includes(999)) {
        const order = [1, 6, 4, 3, 2, 5];
        const all = [];
        for (const id of order) {
            if (perIdImages[id]) all.push(...perIdImages[id]);
        }
        updated = replaceImagesArrayForId(updated, 999, all);
    }

    if (updated !== original) {
        fs.writeFileSync(dataPath, updated, 'utf8');
    }

    process.stdout.write(
        `updated data.js images arrays for: ${Object.keys(perIdImages)
            .map((x) => `id:${x}`)
            .join(', ')}${ids.includes(999) ? ', id:999' : ''}\n`
    );
}

try {
    main();
} catch (err) {
    process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    process.exitCode = 1;
}
