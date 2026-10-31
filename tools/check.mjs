// 구글드라이브 안에서는 npm 설치가 실패하므로, 드라이브 밖 작업 폴더에 복사해 빌드와 테스트를 실행한다.
// 사용법: node tools/check.mjs          빌드와 테스트
//         node tools/check.mjs --sync   cv.yaml을 먼저 반영한 뒤 빌드와 테스트
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(fileURLToPath(new URL('..', import.meta.url)));
const work = join(process.env.LOCALAPPDATA ?? join(homedir(), '.cache'), 'hsjang545-site');
const EXCLUDED = new Set(['.git', 'node_modules', '_site', '_초안']);
const run = (cmd) => execSync(cmd, { cwd: work, stdio: 'inherit' });

mkdirSync(work, { recursive: true });
for (const entry of readdirSync(work)) {
  if (entry !== 'node_modules') rmSync(join(work, entry), { recursive: true, force: true });
}
cpSync(project, work, { recursive: true, filter: (src) => !EXCLUDED.has(basename(src)) });

if (!existsSync(join(work, 'node_modules'))) run('npm ci --no-audit --no-fund');

if (process.argv.includes('--sync')) {
  run('node tools/sync-cv.mjs');
  // 파일 하나에 cpSync를 쓰면 드라이브 경로에서 Node가 비정상 종료되어 직접 쓴다.
  writeFileSync(join(project, 'data', 'cv.yaml'), readFileSync(join(work, 'data', 'cv.yaml')));
}
run('npm test');
console.log(`검사 완료. 생성된 페이지: ${join(work, '_site')}`);
