# svg-editor-lab1
Software Design Lab 1 - SVG Editor CLI

## 本地运行

需要 Node.js 和 npm。首次运行前在项目目录执行：

```bash
npm ci
npm run cli
```

当前已支持 `init`、`read`、`save`、`canvas`、六种图形的 `create`（含 `in <容器 id>`）、`delete`、`move`、`scale`、`set`、`group`、`ungroup`、`addto`、`front`、`back`、`undo`、`redo`、`tree`、`show`、`help`。输入 `#` 开头的注释行会被忽略；按 `Ctrl+D` 结束程序。

例如输入 `init 400 200`、`create rect r1 10 20 100 50 red`、`save demo.svg`，随后可在浏览器打开 `demo.svg`。`read demo.svg` 会重新载入文件；若文件中的图形缺少 id，会打印 `warning:`。`save` 不带路径时使用上次成功读取或保存的路径；`init` 后第一次保存需要显式给出路径。

SVG 与图形模型之间的转换位于 `src/infrastructure/SvgCodec.ts`，文件访问由 `SvgFileStore` 实现。读入时只接受本阶段六种图形、可表示的几何与样式属性以及从 `(0,0)` 开始且与画布尺寸一致的 `viewBox`；其他内容会报错，避免静默丢失。

检查 TypeScript 类型或单独编译：

```bash
npm run check
npm run build
npm test
```

作业要求见 [phase_cli_1.md](phase_cli_1.md)，架构与过程记录见 [doc/README.md](doc/README.md)。
