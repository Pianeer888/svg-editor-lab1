import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' });
const args = process.argv.slice(2);
const [before = 'final', after = 'p2'] = args.filter(arg => arg !== '--write');
const output: string[] = [];
const print = (line: string) => output.push(line);
const scopes = ['内核', '装配处', '插件', 'VS Code 扩展'];
const responsibilities: Readonly<Record<string, string | undefined>> = {
  application: '编辑命令、历史或存储契约',
  cli: '命令行交互',
  composition: '装载与暂存',
  extensions: '扩展接口、内置能力或注册',
  infrastructure: 'SVG 编解码或文件存取',
  model: '文档与图形模型',
  'main.ts': '启动与依赖装配',
  stats: '图形统计',
  dir: '目录命令或目录访问适配',
  box: '复合图形、编解码或属性行为',
  'box-type-label': '类型标签',
  'modified-star': '修改标签与保存点',
};

function measure(path: string, content: string) {
  const parts = path.split('/');
  const scope = path.startsWith('vscode-extension/') ? scopes[3]
    : parts[1] === 'plugins' ? scopes[2]
    : parts[1] === 'main.ts' || parts[1] === 'composition' ? scopes[1] : scopes[0];
  const tree = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
  const names = tree.statements.flatMap(node =>
    'name' in node && node.name && ts.isIdentifier(node.name as ts.Node) ? [(node.name as ts.Identifier).text] : []);
  const responsibility = responsibilities[parts[1] === 'plugins' ? parts[2] : parts[1]]
    ?? '扩展入口、解析或 VS Code 提供者';
  let complexity = 0;
  function visit(node: ts.Node) {
    if (ts.isFunctionLike(node) && 'body' in node && node.body) complexity += 1;
    if (ts.isIfStatement(node) || ts.isIterationStatement(node, false) ||
        ts.isCatchClause(node) || ts.isConditionalExpression(node) || ts.isCaseClause(node)) complexity += 1;
    if (ts.isBinaryExpression(node) &&
        [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken]
          .includes(node.operatorToken.kind)) complexity += 1;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  const lines = content.replace(/\r?\n$/, '').split(/\r?\n/).filter(line => line.trim()).length;
  return { path, scope, lines, complexity, responsibility, names };
}

type FileMetrics = ReturnType<typeof measure>;

function snapshot(ref: string) {
  const index = ref === '--index';
  const paths = (index ? git('ls-files', '-z', '--', 'src', 'vscode-extension/src')
    : git('ls-tree', '-r', '-z', '--name-only', ref, '--', 'src', 'vscode-extension/src'))
    .split('\0').filter(path => path.endsWith('.ts')).sort();
  return paths.map(path => measure(path, git('show', `${index ? '' : ref}:${path}`)));
}

function totals(rows: FileMetrics[]) {
  return [rows.length, ...(['lines', 'complexity'] as const).map(key =>
    rows.reduce((sum, row) => sum + row[key], 0))];
}

const [oldRows, newRows] = [snapshot(before), snapshot(after)];
print('# Phase 1 → Phase 2 源码度量\n');
print('由 `scripts/history-metrics.ts` 生成。行数为非空物理行（含注释）。圈复杂度为 TypeScript AST 中有实现的函数入口与决策点之和，包含顶层决策。决策计入 if、循环、catch、三元、非 default 的 case 和短路运算。');
print('\nCLI 范围为 src 下的 TypeScript。入口与 composition 单列，可选插件按 src/plugins 归类。内置图形和扩展契约计入内核。VS Code 扩展单列，依赖、测试、配置和构建产物排除。\n');
print('| 范围 | Phase 1 文件 / 行 / 复杂度 | Phase 2 文件 / 行 / 复杂度 | 行数增量 | 复杂度增量 |');
print('| --- | ---: | ---: | ---: | ---: |');
for (const scope of [...scopes.slice(0, 3), 'CLI 合计', scopes[3]]) {
  const includes = (row: FileMetrics) => scope === 'CLI 合计' ? row.scope !== scopes[3] : row.scope === scope;
  const a = totals(oldRows.filter(includes));
  const b = totals(newRows.filter(includes));
  print(`| ${scope} | ${a.join(' / ')} | ${b.join(' / ')} | ${b[1] - a[1]} | ${b[2] - a[2]} |`);
}
for (const [title, rows] of [['Phase 1', oldRows], ['Phase 2', newRows]] as const) {
  print(`\n## ${title} 文件清单\n`);
  print('| 文件 | 范围 | 职责 / 声明 | 行数 | 复杂度 |');
  print('| --- | --- | --- | ---: | ---: |');
  for (const { path, scope, lines, complexity, responsibility, names } of rows) {
    const role = [responsibility, names.map(name => '\x60' + name + '\x60').join('、')].filter(Boolean).join(' · ');
    print(`| \`${path}\` | ${scope} | ${role} | ${lines} | ${complexity} |`);
  }
}
const report = output.join('\n') + '\n';
if (args.includes('--write')) {
  mkdirSync(new URL('../docs/metrics/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../docs/metrics/phase2.md', import.meta.url), report);
} else process.stdout.write(report);
