# svg-editor-lab1
Software Design Lab 1 - SVG Editor CLI

## 本地运行

需要 Node.js 和 npm。首次运行前在项目目录执行：

```bash
npm ci
npm run cli
```

当前已支持 `init`、六种图形的 `create`（含 `in <容器 id>`）、`delete`、`move`、`scale`、`set`、`group`、`ungroup`、`addto`、`front`、`back`、`undo`、`redo`、`tree`、`show`、`help`。输入 `#` 开头的注释行会被忽略；文件和画布命令将在后续迭代实现。按 `Ctrl+D` 结束程序。

SVG 与图形模型之间的转换已在 `src/infrastructure/SvgCodec.ts` 实现并经过独立测试，但尚未接入 CLI 的 `read`/`save`。读入时只接受本阶段六种图形、可表示的几何与样式属性以及从 `(0,0)` 开始且与画布尺寸一致的 `viewBox`；其他内容会报错，避免静默丢失。

检查 TypeScript 类型或单独编译：

```bash
npm run check
npm run build
npm test
```

作业要求见 [phase_cli_1.md](phase_cli_1.md)，架构与过程记录见 [doc/README.md](doc/README.md)。
