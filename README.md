# svg-editor-lab1
Software Design Lab 1 · SVG Editor CLI and VS Code Extension

## 本地运行

需要 Node.js 22.18 或更新版本，以及 npm。测试和验收脚本使用 Node.js 直接运行 TypeScript。首次运行前在项目目录执行：

```bash
npm ci
npm run cli
```

默认装配在 Phase 1 命令和六种内置图形的基础上，启用 `box`、`stats`、`dir` 和两个树标签。输入 `help` 查看命令。输入 `#` 开头的注释行会被忽略，按 `Ctrl+D` 结束程序。

默认使用代码装配。使用配置装配时运行：

```bash
npm run cli -- --config plugins.config.json
```

例如输入 `init 400 200`、`create rect r1 10 20 100 50 red`、`save demo.svg`，随后可在浏览器打开 `demo.svg`。`read demo.svg` 会重新载入文件；若文件中的图形缺少 id，会打印 `warning:`。`save` 不带路径时使用上次成功读取或保存的路径；`init` 后第一次保存需要显式给出路径。

SVG 与图形模型之间的转换位于 `src/infrastructure/SvgCodec.ts`，文件访问由 `SvgFileStore` 实现。内置读入规则支持六种图形、可表示的几何与样式属性以及从 `(0,0)` 开始且与画布尺寸一致的 `viewBox`。启用 box 插件后，读入带 `data-kind="box"` 的组会恢复复合图形。

检查 TypeScript 类型或单独编译：

```bash
npm run check
npm run check:tools
npm run build
npm test
npm run verify:phase2
```

Phase 1 版本见 `final` 标签。架构对比和 Phase 2 验收见 [设计记录](doc/README.md)，扩展安装和运行见 [VS Code 扩展说明](vscode-extension/README.md)。
