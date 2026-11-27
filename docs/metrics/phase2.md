# Phase 1 → Phase 2 源码度量

由 `scripts/history-metrics.ts` 生成。行数为非空物理行（含注释）。圈复杂度为 TypeScript AST 中有实现的函数入口与决策点之和，包含顶层决策。决策计入 if、循环、catch、三元、非 default 的 case 和短路运算。

CLI 范围为 src 下的 TypeScript。入口与 composition 单列，可选插件按 src/plugins 归类。内置图形和扩展契约计入内核。VS Code 扩展单列，依赖、测试、配置和构建产物排除。

| 范围 | Phase 1 文件 / 行 / 复杂度 | Phase 2 文件 / 行 / 复杂度 | 行数增量 | 复杂度增量 |
| --- | ---: | ---: | ---: | ---: |
| 内核 | 23 / 1005 / 449 | 31 / 1238 / 522 | 233 | 73 |
| 装配处 | 1 / 8 / 2 | 3 / 251 / 95 | 243 | 93 |
| 插件 | 0 / 0 / 0 | 18 / 281 / 85 | 281 | 85 |
| CLI 合计 | 24 / 1013 / 451 | 52 / 1770 / 702 | 757 | 251 |
| VS Code 扩展 | 0 / 0 / 0 | 4 / 94 / 27 | 94 | 27 |

## Phase 1 文件清单

| 文件 | 范围 | 职责 / 声明 | 行数 | 复杂度 |
| --- | --- | --- | ---: | ---: |
| `src/application/AddToCommand.ts` | 内核 | 编辑命令、历史或存储契约 · `AddToCommand` | 33 | 10 |
| `src/application/CommandHistory.ts` | 内核 | 编辑命令、历史或存储契约 · `CommandHistory` | 35 | 8 |
| `src/application/CreateCommand.ts` | 内核 | 编辑命令、历史或存储契约 · `CreateCommand` | 11 | 3 |
| `src/application/DeleteCommand.ts` | 内核 | 编辑命令、历史或存储契约 · `DeleteCommand` | 17 | 5 |
| `src/application/DocumentStore.ts` | 内核 | 编辑命令、历史或存储契约 · `DocumentStore` | 6 | 0 |
| `src/application/EditCommand.ts` | 内核 | 编辑命令、历史或存储契约 · `EditCommand` | 5 | 0 |
| `src/application/GroupCommand.ts` | 内核 | 编辑命令、历史或存储契约 · `Location`、`GroupCommand` | 43 | 18 |
| `src/application/ReorderCommand.ts` | 内核 | 编辑命令、历史或存储契约 · `ReorderCommand` | 26 | 7 |
| `src/application/ShapeEditCommand.ts` | 内核 | 编辑命令、历史或存储契约 · `ShapeEditCommand` | 19 | 10 |
| `src/application/UngroupCommand.ts` | 内核 | 编辑命令、历史或存储契约 · `UngroupCommand` | 38 | 13 |
| `src/cli/Cli.ts` | 内核 | 命令行交互 · `Cli` | 218 | 87 |
| `src/cli/Tokenizer.ts` | 内核 | 命令行交互 · `Tokenizer` | 18 | 9 |
| `src/infrastructure/SvgCodec.ts` | 内核 | SVG 编解码或文件存取 · `XmlNode`、`SvgCodec` | 129 | 65 |
| `src/infrastructure/SvgFileStore.ts` | 内核 | SVG 编解码或文件存取 · `SvgFileStore` | 17 | 4 |
| `src/main.ts` | 装配处 | 启动与依赖装配 | 8 | 2 |
| `src/model/Circle.ts` | 内核 | 文档与图形模型 · `Circle` | 18 | 10 |
| `src/model/Ellipse.ts` | 内核 | 文档与图形模型 · `Ellipse` | 19 | 12 |
| `src/model/Group.ts` | 内核 | 文档与图形模型 · `Group` | 42 | 24 |
| `src/model/Line.ts` | 内核 | 文档与图形模型 · `Line` | 20 | 11 |
| `src/model/Rect.ts` | 内核 | 文档与图形模型 · `Rect` | 20 | 14 |
| `src/model/Shape.ts` | 内核 | 文档与图形模型 · `ShapeState`、`Shape` | 69 | 34 |
| `src/model/ShapeFactory.ts` | 内核 | 文档与图形模型 · `ShapeFactory` | 66 | 29 |
| `src/model/SvgDocument.ts` | 内核 | 文档与图形模型 · `SvgDocument` | 117 | 66 |
| `src/model/Text.ts` | 内核 | 文档与图形模型 · `Text` | 19 | 10 |

## Phase 2 文件清单

| 文件 | 范围 | 职责 / 声明 | 行数 | 复杂度 |
| --- | --- | --- | ---: | ---: |
| `src/application/AddToCommand.ts` | 内核 | 编辑命令、历史或存储契约 · `AddToCommand` | 33 | 10 |
| `src/application/CommandHistory.ts` | 内核 | 编辑命令、历史或存储契约 · `CommandHistory` | 35 | 8 |
| `src/application/CreateCommand.ts` | 内核 | 编辑命令、历史或存储契约 · `CreateCommand` | 11 | 3 |
| `src/application/DeleteCommand.ts` | 内核 | 编辑命令、历史或存储契约 · `DeleteCommand` | 17 | 5 |
| `src/application/DocumentStore.ts` | 内核 | 编辑命令、历史或存储契约 · `DocumentStore` | 6 | 0 |
| `src/application/EditCommand.ts` | 内核 | 编辑命令、历史或存储契约 · `EditCommand` | 5 | 0 |
| `src/application/GroupCommand.ts` | 内核 | 编辑命令、历史或存储契约 · `Location`、`GroupCommand` | 43 | 18 |
| `src/application/ReorderCommand.ts` | 内核 | 编辑命令、历史或存储契约 · `ReorderCommand` | 26 | 7 |
| `src/application/ShapeEditCommand.ts` | 内核 | 编辑命令、历史或存储契约 · `ShapeEditCommand` | 19 | 10 |
| `src/application/UngroupCommand.ts` | 内核 | 编辑命令、历史或存储契约 · `UngroupCommand` | 38 | 13 |
| `src/cli/Cli.ts` | 内核 | 命令行交互 · `Cli` | 249 | 102 |
| `src/cli/Tokenizer.ts` | 内核 | 命令行交互 · `Tokenizer` | 18 | 9 |
| `src/composition/PluginLoader.ts` | 装配处 | 装载与暂存 · `PluginLoadResult`、`PluginConfigEntry`、`ContributionKind`、`PluginLoader` | 173 | 75 |
| `src/composition/StagedExtensions.ts` | 装配处 | 装载与暂存 · `StagedExtensions` | 40 | 9 |
| `src/extensions/AttributeHandler.ts` | 内核 | 扩展接口、内置能力或注册 · `AttributeHandler` | 6 | 0 |
| `src/extensions/BuiltInShapeProvider.ts` | 内核 | 扩展接口、内置能力或注册 · `ShapeConstructor`、`BuiltInShapeProvider`、`registerBuiltInShapes` | 89 | 47 |
| `src/extensions/Command.ts` | 内核 | 扩展接口、内置能力或注册 · `CommandContext`、`Command` | 13 | 0 |
| `src/extensions/DefaultExtensions.ts` | 内核 | 扩展接口、内置能力或注册 · `createDefaultExtensions` | 7 | 2 |
| `src/extensions/ExtensionRegistry.ts` | 内核 | 扩展接口、内置能力或注册 · `ExtensionRegistry` | 73 | 39 |
| `src/extensions/Plugin.ts` | 内核 | 扩展接口、内置能力或注册 · `PluginContributions`、`ExtensionContributions`、`PluginManifest`、`ExtensionRegistrar`、`Plugin`、`PluginFactory` | 33 | 0 |
| `src/extensions/ShapeProvider.ts` | 内核 | 扩展接口、内置能力或注册 · `SvgShapeInput`、`SvgShapeOutput`、`ShapeProvider` | 21 | 0 |
| `src/extensions/TreeDecorator.ts` | 内核 | 扩展接口、内置能力或注册 · `TreeDecorator` | 6 | 0 |
| `src/infrastructure/SvgCodec.ts` | 内核 | SVG 编解码或文件存取 · `XmlNode`、`SvgCodec` | 128 | 58 |
| `src/infrastructure/SvgFileStore.ts` | 内核 | SVG 编解码或文件存取 · `SvgFileStore` | 20 | 5 |
| `src/main.ts` | 装配处 | 启动与依赖装配 · `main` | 38 | 11 |
| `src/model/Circle.ts` | 内核 | 文档与图形模型 · `Circle` | 18 | 10 |
| `src/model/Ellipse.ts` | 内核 | 文档与图形模型 · `Ellipse` | 19 | 12 |
| `src/model/Group.ts` | 内核 | 文档与图形模型 · `Group` | 49 | 27 |
| `src/model/Line.ts` | 内核 | 文档与图形模型 · `Line` | 20 | 11 |
| `src/model/Rect.ts` | 内核 | 文档与图形模型 · `Rect` | 20 | 14 |
| `src/model/Shape.ts` | 内核 | 文档与图形模型 · `ShapeState`、`Shape` | 69 | 34 |
| `src/model/ShapeFactory.ts` | 内核 | 文档与图形模型 · `ShapeFactory` | 13 | 3 |
| `src/model/SvgDocument.ts` | 内核 | 文档与图形模型 · `SvgDocument` | 115 | 65 |
| `src/model/Text.ts` | 内核 | 文档与图形模型 · `Text` | 19 | 10 |
| `src/plugins/box-type-label/BoxTypeLabel.ts` | 插件 | 类型标签 · `BoxTypeLabel` | 8 | 2 |
| `src/plugins/box-type-label/index.ts` | 插件 | 类型标签 · `createBoxTypeLabelPlugin` | 12 | 2 |
| `src/plugins/box/Box.ts` | 插件 | 复合图形、编解码或属性行为 · `Box` | 18 | 7 |
| `src/plugins/box/BoxAttributes.ts` | 插件 | 复合图形、编解码或属性行为 · `BoxAttributes` | 16 | 7 |
| `src/plugins/box/BoxPlugin.ts` | 插件 | 复合图形、编解码或属性行为 · `BoxPlugin` | 14 | 1 |
| `src/plugins/box/BoxProvider.ts` | 插件 | 复合图形、编解码或属性行为 · `BoxProvider` | 55 | 23 |
| `src/plugins/box/index.ts` | 插件 | 复合图形、编解码或属性行为 · `createBoxPlugin` | 3 | 1 |
| `src/plugins/dir/DirCommand.ts` | 插件 | 目录命令或目录访问适配 · `DirCommand` | 26 | 10 |
| `src/plugins/dir/DirPlugin.ts` | 插件 | 目录命令或目录访问适配 · `DirPlugin` | 12 | 2 |
| `src/plugins/dir/DirectoryAccess.ts` | 插件 | 目录命令或目录访问适配 · `DirectoryEntry`、`DirectoryAccess` | 8 | 0 |
| `src/plugins/dir/NodeDirectoryAdapter.ts` | 插件 | 目录命令或目录访问适配 · `NodeDirectoryAdapter` | 12 | 6 |
| `src/plugins/dir/index.ts` | 插件 | 目录命令或目录访问适配 · `createDirPlugin`、`createConfiguredDirPlugin` | 7 | 2 |
| `src/plugins/modified-star/ModifiedStar.ts` | 插件 | 修改标签与保存点 · `ModifiedStar` | 22 | 7 |
| `src/plugins/modified-star/SavePointStore.ts` | 插件 | 修改标签与保存点 · `SavePointStore` | 17 | 3 |
| `src/plugins/modified-star/index.ts` | 插件 | 修改标签与保存点 · `createModifiedStarPlugin` | 12 | 2 |
| `src/plugins/stats/StatsCommand.ts` | 插件 | 图形统计 · `StatsCommand` | 23 | 7 |
| `src/plugins/stats/StatsPlugin.ts` | 插件 | 图形统计 · `StatsPlugin` | 10 | 1 |
| `src/plugins/stats/index.ts` | 插件 | 图形统计 · `createStatsPlugin`、`createConfiguredStatsPlugin` | 6 | 2 |
| `vscode-extension/src/SvgDocumentSymbolProvider.ts` | VS Code 扩展 | 扩展入口、解析或 VS Code 提供者 · `SvgDocumentSymbolProvider` | 18 | 6 |
| `vscode-extension/src/SvgFileDecorationProvider.ts` | VS Code 扩展 | 扩展入口、解析或 VS Code 提供者 · `SvgFileDecorationProvider` | 15 | 6 |
| `vscode-extension/src/SvgOutlineParser.ts` | VS Code 扩展 | 扩展入口、解析或 VS Code 提供者 · `OutlineNode`、`SvgOutlineParser` | 48 | 13 |
| `vscode-extension/src/extension.ts` | VS Code 扩展 | 扩展入口、解析或 VS Code 提供者 · `activate`、`deactivate` | 13 | 2 |
