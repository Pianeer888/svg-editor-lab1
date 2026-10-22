# svg-editor-lab1
Software Design Lab 1 - SVG Editor CLI

## 本地运行

需要 Node.js 和 npm。首次运行前在项目目录执行：

```bash
npm ci
npm run cli
```

目前只有 CLI 入口和 `svg>` 提示符。输入 `#` 开头的注释行会被忽略；具体 SVG 命令将在后续迭代实现。按 `Ctrl+D` 结束程序。

检查 TypeScript 类型或单独编译：

```bash
npm run check
npm run build
npm test
```

作业要求见 [phase_cli_1.md](phase_cli_1.md)，架构与过程记录见 [doc/README.md](doc/README.md)。
