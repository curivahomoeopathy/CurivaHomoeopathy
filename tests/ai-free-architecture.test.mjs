import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('..', import.meta.url);
const read = (relative) => readFileSync(new URL(relative, root), 'utf8');
function sourceFiles(directory) {
  const absolute = new URL(directory, root).pathname;
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = join(absolute, entry.name);
    return entry.isDirectory() ? sourceFiles(directory + '/' + entry.name) : /\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [path] : [];
  });
}
test('production source contains no generative AI provider, SDK or endpoint', () => {
  const files = [...sourceFiles('src'), new URL('../server.ts', import.meta.url).pathname];
  const forbidden = [/@google\/genai/, /GoogleGenAI/, /GEMINI_API_KEY/, /api\/gemini/, /generateContent\(/, /AiPrivacyNotice/, /AskHomoeopath/, /aiPrivacyGuard/];
  const matches = files.flatMap((path) => forbidden.filter((pattern) => pattern.test(readFileSync(path, 'utf8'))).map((pattern) => path + ' contains ' + pattern));
  assert.deepEqual(matches, []);
});
test('package manifest and lockfile do not install a generative AI SDK', () => {
  const manifest = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(manifest.dependencies?.['@google/genai'], undefined);
  assert.equal(lock.packages?.['']?.dependencies?.['@google/genai'], undefined);
  assert.equal(lock.packages?.['node_modules/@google/genai'], undefined);
});
test('AI chatbot and consent components have been removed from the application', () => {
  for (const path of ['src/pages/AskHomoeopath.tsx', 'src/components/AiPrivacyNotice.tsx', 'src/services/gemini.ts', 'src/server/aiPrivacyGuard.ts']) assert.equal(existsSync(new URL('../' + path, import.meta.url)), false, path + ' should not exist');
  assert.doesNotMatch(read('src/App.tsx'), /AskHomoeopath/);
  assert.match(read('src/App.tsx'), /path="\\/ask-Homoeopath" element=\\{<Navigate to="\\/subjects" replace \/>\\}/);
  assert.doesNotMatch(read('netlify.toml'), /api\/gemini/);
  assert.doesNotMatch(read('.env.example'), /GEMINI_API_KEY/);
});
