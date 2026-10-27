import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZipArchive } from 'archiver';

const sourceExcludes = [
  '**/.git/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.env',
  '**/.env.*',
  '**/*.log',
  '**/.DS_Store',
  '**/*.zip',
];

function sourceZipFilename() {
  return 'lucm-material-source.zip';
}

function defaultSaveLocation() {
  return {
    directory: path.join(os.homedir(), 'Downloads'),
    filename: sourceZipFilename(),
  };
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('저장 위치 형식이 올바르지 않습니다.'));
      }
    });
    request.on('error', reject);
  });
}

function resolveSavePath(directory, filename) {
  const fallback = defaultSaveLocation();
  const rawDirectory = String(directory || '').trim() || fallback.directory;
  const rawFilename = String(filename || '').trim() || fallback.filename;
  if (rawFilename !== path.basename(rawFilename) || rawFilename.includes('..')) {
    throw new Error('파일 이름이 올바르지 않습니다.');
  }
  if (!rawFilename.toLowerCase().endsWith('.zip')) {
    throw new Error('zip 파일로 저장해 주세요.');
  }

  let directoryPath = rawDirectory;
  if (directoryPath === '~' || directoryPath.startsWith('~/')) {
    directoryPath = path.join(os.homedir(), directoryPath.slice(2));
  }
  const resolvedDirectory = path.resolve(directoryPath);
  const filePath = path.resolve(resolvedDirectory, rawFilename);
  if (path.dirname(filePath) !== resolvedDirectory) {
    throw new Error('저장 위치가 올바르지 않습니다.');
  }
  return { filePath, filename: rawFilename };
}

export function saveSourceArchive(sourceRoot, saveTarget = defaultSaveLocation()) {
  const { filePath, filename } = resolveSavePath(saveTarget.directory, saveTarget.filename);

  return new Promise((resolve, reject) => {
    fs.mkdir(path.dirname(filePath), { recursive: true }, (mkdirError) => {
      if (mkdirError) {
        reject(mkdirError);
        return;
      }

      const output = fs.createWriteStream(filePath);
      const archive = new ZipArchive({ zlib: { level: 9 } });
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        archive.abort();
        output.destroy();
        fs.rm(filePath, { force: true }, () => reject(error));
      };

      output.on('error', fail);
      archive.on('error', fail);
      output.on('close', () => {
        if (settled) return;
        settled = true;
        const bytes = archive.pointer();
        if (!bytes) {
          fs.rm(filePath, { force: true }, () => reject(new Error('받은 파일이 비어 있습니다.')));
          return;
        }
        resolve({ filePath, filename, bytes });
      });

      archive.pipe(output);
      archive.glob('**/*', { cwd: sourceRoot, dot: true, ignore: sourceExcludes });
      archive.finalize();
    });
  });
}

function findRecentlyChosenZip(filename) {
  const safeName = path.basename(String(filename || ''));
  if (!safeName || safeName !== filename || !safeName.toLowerCase().endsWith('.zip')) {
    return Promise.reject(new Error('파일 이름이 올바르지 않습니다.'));
  }

  const queryName = safeName.replace(/"/g, '');
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const look = () => {
      execFile(
        'mdfind',
        ['-onlyin', os.homedir(), `kMDItemFSName == "${queryName}"`],
        { timeout: 8000 },
        (error, stdout) => {
          if (error) {
            reject(error);
            return;
          }
          const home = os.homedir();
          const matches = stdout
            .split('\n')
            .map((line) => line.trim())
            .filter((candidate) => candidate.startsWith(home) && path.basename(candidate) === safeName)
            .flatMap((candidate) => {
              try {
                const stat = fs.statSync(candidate);
                if (!stat.isFile() || Date.now() - stat.mtimeMs > 20000) return [];
                return [{ filePath: candidate, mtimeMs: stat.mtimeMs }];
              } catch {
                return [];
              }
            })
            .sort((left, right) => right.mtimeMs - left.mtimeMs);

          if (matches.length > 0) {
            resolve(matches[0].filePath);
            return;
          }
          if (Date.now() - started > 4000) {
            resolve(null);
            return;
          }
          setTimeout(look, 300);
        },
      );
    };
    look();
  });
}

function requestPath(request) {
  return (request.url || '/').split('?')[0];
}

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

export async function handleSourceDownload(request, response, next, sourceRoot) {
  const pathname = requestPath(request);
  if (request.method === 'GET' && pathname === '/location') {
    sendJson(response, 200, defaultSaveLocation());
    return;
  }

  if (request.method === 'POST') {
    try {
      const body = await readJsonBody(request);
      if (body.action === 'overwrite-recent') {
        const filePath = await findRecentlyChosenZip(body.filename);
        if (!filePath) {
          sendJson(response, 404, { ok: false, message: '선택한 저장 위치를 찾지 못했습니다.' });
          return;
        }
        const saved = await saveSourceArchive(sourceRoot, {
          directory: path.dirname(filePath),
          filename: path.basename(filePath),
        });
        sendJson(response, 200, { ok: true, filename: saved.filename, bytes: saved.bytes, filePath: saved.filePath });
        return;
      }
      const saved = await saveSourceArchive(sourceRoot, body);
      sendJson(response, 200, { ok: true, filename: saved.filename, bytes: saved.bytes, filePath: saved.filePath });
    } catch (error) {
      const message = error instanceof Error ? error.message : '저장 실패';
      sendJson(response, 500, { ok: false, message });
    }
    return;
  }

  downloadSourceArchive(request, response, next, sourceRoot);
}

export function downloadSourceArchive(request, response, next, sourceRoot) {
  response.setHeader('Content-Type', 'application/zip');
  response.setHeader('Content-Disposition', `attachment; filename="${sourceZipFilename()}"`);
  response.setHeader('Cache-Control', 'no-store');

  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on('error', next);
  response.on('close', () => {
    if (!response.writableEnded) archive.abort();
  });

  archive.pipe(response);
  archive.glob('**/*', { cwd: sourceRoot, dot: true, ignore: sourceExcludes });
  archive.finalize();
}
