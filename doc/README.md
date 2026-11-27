# SVG 编辑器：设计与过程记录

Phase 2 的实施计划见 [phase2-plan.md](./phase2-plan.md)；VS Code 扩展的启动与设计分析见 [vscode-extension/README.md](../vscode-extension/README.md)。

> 本文保留第一轮的设计假设，并记录每轮实现与最终核查。初版架构图用于对照演化过程；实际依赖见文末“一致性自查”。

## Phase 2：扩展框架基线

Commit 3 将变化点从条件分派改为显式注册，四个契约及调用位置如下。

| 扩展点 | 契约与注册位置 | 实际调用位置 | 缺省行为与错误 |
| --- | --- | --- | --- |
| 图形 | `ShapeProvider`、`ExtensionRegistry.registerShape` | `ShapeFactory.create/fromSvg`、`SvgCodec.writeShape` | 注册六种内置图形；未知类型、重复提供者或写出冲突会报错。 |
| 命令 | `Command`、`ExtensionRegistry.registerCommand` | `Cli.execute` | 全部内置命令经注册表分发；重复名称会报错，扩展命令的帮助文本进入 `help`。 |
| 树标签 | `TreeDecorator`、`ExtensionRegistry.registerTreeDecorator` | `Cli.suffix` | 按注册顺序组合；没有标签时不增加空格，原 `tree` 输出保持不变。 |
| 属性 | `AttributeHandler`、`ExtensionRegistry.registerAttributeHandler` | `Cli.set` | 无匹配时调用 `Shape.set`；一个匹配时作为单个 undo 单元执行；多个匹配时拒绝修改。 |

`src/extensions/DefaultExtensions.ts` 是当前组合入口，`main.ts` 把同一个注册表实例交给 CLI 与文件存储。内置图形由 `BuiltInShapeProvider` 注册；SVG 编解码不再包含图形类型分支。读回时先为 XML 子树分配 id，再由提供者构造完整图形子树，最后交给文档一次检查全部 id。属性处理器失败时由 `ShapeEditCommand` 恢复修改前状态，失败操作不进入历史。带 `data-kind` 的 `<g>` 在没有专用提供者时按普通组读入，保留可表达的子图形。

`test/extensions.test.ts` 覆盖四个扩展点、属性冲突与失败回滚、标记组的缺省读回，以及 Phase 1 会话逐字节回归。首次脚本化度量保存在 [metrics/commit-3.txt](./metrics/commit-3.txt)，可通过 `npm run metrics` 重现。

### Commit 4：事务式插件装载

`src/composition/PluginLoader.ts` 支持两种装配入口：`loadCode` 接收代码中选择的插件对象，`loadConfig` 按 JSON 文件中的路径顺序动态导入插件模块。两种入口最终都调用同一个 `loadOne` 流程，不存在两套注册规则。配置格式如下：

```json
{
  "plugins": [
    { "module": "./dist/plugins/example.js", "options": {}, "enabled": true }
  ]
}
```

每个插件通过内核侧的 `PluginManifest` 声明 id、API 版本及 `shapes`、`commands`、`decorators`、`attributes` 四类贡献名称，并在 `activate` 中只访问临时 `ExtensionRegistrar`。组合层的 `StagedExtensions` 暂存实际贡献；加载器核对 manifest 后，`ExtensionRegistry.commit` 先检查全部名称，再一次提交。`enabled: false` 的条目直接跳过；若模块默认导出工厂函数，`options` 原样传给该工厂。激活异常、manifest 不一致、重复名称、配置或模块读取失败都会产生失败结果，不会留下部分注册；加载列表中的后续插件仍继续处理。`test/plugin-loader.test.ts` 覆盖代码装配、配置装配和上述失败回滚路径。

### Commit 5：`stats` 与 `dir` 命令插件

`src/plugins/stats` 和 `src/plugins/dir` 是两个独立插件包，只通过 `Command` 与 `ExtensionRegistrar` 接入。各自的 `package.json` 用 `contributes.commands` 声明命令，测试会核对它与运行时 manifest 一致。默认代码装配在 `main.ts` 选择两个插件；使用 `--config plugins.config.json` 时，配置加载器导入相同的默认工厂，命令实现不变。禁用对应插件后，注册表中没有该命令，执行时返回 `unknown command`。

`StatsCommand` 深度优先读取当前图形树。`Group` 子类只计入 containers，其他节点按首次出现的类型顺序计数；命令不调用 `executeEdit`，不会进入撤销历史。

`dir` 的 Adapter 角色对应如下：

| Adapter 角色 | 实现 | 职责 |
| --- | --- | --- |
| Target | `DirectoryAccess` | 提供当前目录路径和直接子项，不暴露 Node `Dirent`。 |
| Adapter | `NodeDirectoryAdapter` | 把 `process.cwd()` 与 `readdirSync` 转换成稳定的 `DirectoryEntry`。 |
| Adaptee | Node `fs` 与进程工作目录 | 提供真实目录信息。 |
| Client | `DirCommand` | 只依赖 Target，负责分组、排序和输出。 |

目录、普通文件和其他类型分别显示为 `[DIR]`、`[FILE]`、`[OTHER]`；符号链接不遍历目标，归入 `[OTHER]` 并排在普通文件之后。隐藏项照常显示。`test/command-plugins.test.ts` 使用测试替身覆盖混合目录、空目录、读取失败和历史不变，并用临时目录验证真实 Adapter；同一固定目录下的代码装配与配置装配输出逐字节一致。会话输入保存在 [transcript/cli-plugins.txt](./transcript/cli-plugins.txt)。

### Commit 6：代码装配接入 box

`Box` 复用 `Group` 的子树行为，通过保护钩子拒绝摘除必要的矩形与文字。`BoxProvider` 负责生成派生 id、默认蓝色框体和标题位置，并读写 `data-kind="box"`。`BoxAttributes` 将 `fill` 和 `label` 转发给对应子部件，每次设置仍由原有编辑命令负责撤销和重做。

安装插件时，缺少必要子部件或类型错误会拒绝整次读取。未安装时，标记组按普通 `g` 读取并保留子图形。嵌套 box 的解组会被必要子部件保护拦截，根级容器沿用原有解组限制。当前使用通用 CLI 回显，结构树显示 `box#id`，末尾标签留到树标签提交。

代码装配在 `main.ts` 选择插件。版本 B 的命令输入保存在 [cli-box.txt](./transcript/cli-box.txt)。

### Commit 8：组合树标签

`BoxTypeLabel` 和 `ModifiedStar` 分别注册到 `TreeDecorator`。组合根通过 `SavePointStore` 将成功读写通知交给启用的星号标签。相同的配置项可在 `plugins.config.json` 中独立启用，标签按注册顺序追加。保存点语义及传播规则见 [ADR](./adr/dirty-tree-label.md)。

### Commit 9：架构对比与验收

Phase 1 在 `Cli.execute` 和图形工厂集中选择内置行为。Phase 2 将命令、图形、树标签及属性行为交给注册表，组合根选择插件，SVG 读写通过提供者完成。编辑命令和 Composite 图形树仍负责原有的撤销与结构约束。

| 架构阶段 | PlantUML 成品 |
| --- | --- |
| Phase 1 交付时的实际依赖 | [Phase 1 依赖图](./最终代码的实际依赖.svg)，源代码见本文“一致性自查” |
| Phase 2 的装配、内核与扩展关系 | [Phase 2 依赖图](./architecture-phase2.svg) · [PlantUML 源码](./architecture-phase2.puml) |

ADR 记录了 [属性处理](./adr/attribute-handlers.md)、[box 读回](./adr/box-readback.md)、[树标签的保存点语义](./adr/dirty-tree-label.md) 和 [事务注册](./adr/plugin-loading.md)。[度量报告](../docs/metrics/phase2.md) 包含分层文件清单、行数和圈复杂度增量。打完标签后执行 `npm run metrics:history -- final p2` 可从两个 Git 快照重新生成。

#### 装配差异

- `68b3ca0` 在 `main.ts` 选择 box。差异由新增插件、组合根、测试、命令会话和设计说明组成。
- `ce12e07` 在 `demo/box-config` 通过配置选择同一个插件。差异由新增插件、配置、测试、命令会话和说明组成。两次接入共用 `8e3646c`，box 源码相同。

```bash
git diff --name-status 8e3646c 68b3ca0
git diff --name-status 8e3646c ce12e07
git diff --exit-code 8e3646c 68b3ca0 -- src ':(exclude)src/main.ts' ':(exclude)src/plugins/box'
git diff --exit-code 8e3646c ce12e07 -- src ':(exclude)src/plugins/box'
git diff --exit-code 68b3ca0 ce12e07 -- src/plugins/box
```

#### 自动验收

`npm test` 覆盖图形、文件 IO、属性冲突和回滚、插件装载失败与重复注册、真实目录和目录替身、标签状态、VS Code 大纲和文件装饰。`npm run verify:phase2` 回放基础、box、stats/dir 三个命令会话，比较代码和配置装配的标准输出及生成的 SVG。每组使用相同的运行目录和初始文件，目录输出不会包含验收日志。脚本还从 Git 的 `final` 构建旧版，逐字节比较禁用可选插件时的基础会话。输入位于 `doc/transcript/`，输出及 SVG 预期值独立保存在 [验收快照](./transcript/phase2.expected.json)。

## Phase 1 架构方案

### 模块划分

| 目录 | 职责 |
| --- | --- |
| `src/model/` | SVG 文档、图形类与容器树；维护唯一 id、父子关系及图形自身的移动、缩放、属性修改行为。 |
| `src/application/` | 编辑命令、执行与 undo/redo 历史；协调模型操作，并定义 SVG 存取所需的接口。 |
| `src/cli/` | REPL、带引号的参数解析、命令名分发和文字反馈；不直接修改图形内部状态。 |
| `src/infrastructure/` | SVG/XML 与模型的双向转换、文件读写；实现应用层定义的存取接口。 |
| `src/main.ts` | 创建并连接上述对象，启动 CLI。 |

下面是初版**设计目标**的组件图：框内标出每层的关键职责和接口，箭头表示预期依赖方向。**这不是最终实现图**；实际依赖图见“一致性自查”。题目要求组件图或包图，因此这里按职责成组表达，不逐个罗列全部具体图形类和命令类。

![初版设计目标的 PlantUML 组件图](./初版设计目标.svg)

对应的 PlantUML 源码：

```plantuml
@startuml
title 初版设计目标（用于与实现对照）
left to right direction
skinparam componentStyle rectangle

component "main.ts\n装配入口" as MAIN
package "src/cli" {
  component "输入解析与文字反馈\nCli / Tokenizer" as CLI
}
package "src/application" {
  component "编辑命令与历史\nEditCommand / CommandHistory" as APP
  interface "DocumentStore\n存取接口" as STORE
}
package "src/model" {
  component "图形树与行为\nSvgDocument / Shape / Group / ShapeFactory" as MODEL
}
package "src/infrastructure" {
  component "SvgFileStore" as FILE
  component "SvgCodec\nSVG 与模型转换" as CODEC
}

MAIN --> CLI : 启动
MAIN --> APP : 装配
MAIN --> FILE : 注入实现
CLI --> APP : 提交编辑请求
APP --> MODEL : 执行图形行为
APP --> STORE : 读写文档
FILE ..> STORE : 实现
FILE --> CODEC : 使用
CODEC --> MODEL : 转换
@enduml
```

### 设计模式的选择

- **Command（题目要求）**：每个成功的图形编辑操作是一个命令对象，负责执行并保存撤销所需的信息；执行器维护 undo/redo 栈。一条命令对应一个撤销单元，失败命令不入栈。删除、分组和层级调整需要保存原父容器与原位置，不能只保存图形 id。
- 其中 `Cli` 把输入转换为命令请求，`CommandHistory` 是执行与历史管理者，各个 `EditCommand` 是命令对象，`Shape` / `SvgDocument` 是实际执行业务行为的接收者。`move`、`scale`、`set` 共用 `ShapeEditCommand`：回调选择接收者的方法，命令对象统一保存编辑前状态并负责撤销。这样保留了 Command 的执行与撤销边界，同时避免为三个相同生命周期的动作重复建类。
- **Composite 语义**：叶子图形与 `<g>` 容器共享图形抽象。容器把移动、缩放等操作应用到子孙；调用方不按图形类型重复写分支。模型的公开行为由对象自身负责，避免公共数据袋。
- 本阶段暂不建立通用插件框架。题目中的 `box` 是后续阶段目标，Phase 1 的内置类型只有 `rect`、`circle`、`ellipse`、`line`、`text`、`g`。

### 依赖方向规则

1. `model` 不依赖 CLI、文件系统或应用层；图形行为可以脱离终端测试。
2. `application` 依赖 `model`，通过自己定义的存取接口访问 SVG 文件；不直接依赖具体 XML 库或 Node 文件 API。
3. `cli` 依赖 `application`；`infrastructure` 实现应用层接口并依赖 `model`；只有 `main.ts` 负责装配具体实现。
4. 按名称选择实现只出现在命令分发和图形工厂两处。这两处先集中管理并标为后续重构点，不让 `switch(tag)` 扩散到编辑操作中。

### 变化点假设

| 可能的变化 | 本阶段的处理 |
| --- | --- |
| 新增图形类型 | 图形行为由类封装，类型名到构造器的选择集中在图形工厂；等后续阶段明确插件要求再改为注册机制。 |
| 新增命令或入口 | 编辑动作与 CLI 输入分离；新入口可复用应用层。命令名分发集中在 CLI。 |
| 图形组织方式变化 | 以容器树表达层级，按 id 定位由文档统一负责；不把层级路径写进命令参数。 |
| SVG 读写细节变化 | 限制在 `infrastructure`，模型不直接处理 XML 或文件路径。 |

## 过程记录

### 迭代 1：先明确边界

- 根据题目和课程课件，先将 CLI、命令执行、图形模型、SVG 读写分开，并确定 Command 与 Composite 的落点。
- 选择保存每条命令需要的旧值、原父容器和原位置，以支持精确撤销；暂不为后续 `box` 实现插件框架，避免在需求明确前增加复杂度。
- 此时尚未编写功能代码，以上为待验证的设计假设。后续提交会记录发现的问题和修订。

### 迭代 2：建立可运行的 CLI 骨架

- 建立 TypeScript 编译配置、项目脚本和 CLI 入口。CLI 目前只负责逐行读取、显示提示符、忽略空行与注释；图形模型和命令执行尚未开始实现。
- 输入输出通过构造参数传给 `Cli`，后续可以在不启动真实终端的情况下检查命令行为。此时不提前加入 XML 或插件依赖。
- 已运行 `npm run check`、`npm run build`，并用多行输入验证入口可启动、注释可忽略。尚未实现的命令会明确报错，不将骨架当作完成功能。

### 迭代 3：建立图形模型

- 新增六种内置图形、共同的 `Shape` 抽象、容器 `Group` 和 `SvgDocument`。图形各自负责自己的几何属性，容器递归执行移动与缩放。
- 当前文档按树遍历查找 id，不预先维护第二份索引。这样先保证唯一性和父子关系正确；若后续规模或需求需要，再将查找换成索引。
- 加入模型测试，覆盖六种图形的统一操作、嵌套容器、重复 id 拒绝和祖先循环防护。本轮 `npm test` 的四项测试均通过。

### 迭代 4：接通 CLI 与图形模型

- 在 CLI 增加带双引号参数的分词、`init/create/tree/show/help` 命令，并让 `create` 通过集中图形工厂构造六种内置图形。`in <容器 id>` 在创建时确定归属。
- 显示命令读取模型并输出结构与属性；创建失败时先验证参数和目标容器，不改变当前文档。命令名分发与图形类型分发仍集中在架构方案标出的两处。
- 管道输入测试发现读取结束后再次显示提示符会报错；增加关闭状态检查后修复。`npm test` 现有八项测试均通过。

### 迭代 5：基本编辑与撤销重做

- 引入 `CommandHistory` 管理 undo/redo 栈，成功执行的编辑命令才进入历史；undo 后的新编辑清空 redo。`init` 清空旧历史并禁止撤销，直到下一次成功编辑。
- `create`、`delete` 作为命令；`move`、`scale`、`set` 通过可撤销的图形编辑命令调用模型行为。删除保存子树、原父容器和原位置；几何与属性编辑保存变更前状态，避免用反向浮点计算恢复。
- 增加针对删除位置、容器子孙恢复、失败命令不入栈及 redo 清空的测试。此轮仍未实现分组和 SVG 文件读写。

### 迭代 6：容器结构与绘制顺序

- 增加 `group`、`ungroup`、`addto`、`front`、`back`。结构命令记录受影响节点的原父容器和同级位置；分组按文档中的相对顺序收编图形，一条命令对应一个撤销单元。
- 执行前拒绝重复选择、祖先与子孙同时入组、把容器移入自身后代，以及解散根级容器。解组时子节点占据原组的位置；撤销时恢复原容器、子节点和顺序。
- 增加跨容器分组、解组、同级顺序及非法操作的测试。本轮完成后运行 `npm test`，17 项通过。SVG 读写和画布命令仍未实现。

### 迭代 7：SVG 文本与模型的双向转换

- 在 `src/infrastructure/SvgCodec.ts` 实现 SVG/XML 序列化与解析；用标准 XML 解析库 `saxes` 处理标签、命名空间、文本和实体，避免以字符串切割方式误读 XML。
- 序列化按图形树输出六种内置元素、画布尺寸、层级、几何与样式，并转义特殊字符。解析时先收集显式 id，再给无 id 元素分配不冲突的 `标签名+序号`，返回待显示的警告。
- 只接收当前模型能无损表达的 SVG 子集；不支持的元素、属性、变换或不匹配的 `viewBox` 会明确报错。增加往返、缺 id、非法与不支持输入测试。本轮 `npm test` 为 20 项通过。
- 本轮只验证纯转换逻辑，尚未接入 CLI 文件命令；应用层文件存取接口与真实依赖方向将在下一轮连接和最终一致性自查中记录。

### 迭代 8：文件命令与画布尺寸

- 先为 `read/save/canvas` 写 CLI 行为测试，首次运行时三组测试因 `unknown command` 失败。随后新增应用层的 `DocumentStore` 接口、基础设施 `SvgFileStore`，在 `main.ts` 注入 CLI，使文件系统与 XML 细节不进入 CLI。
- `read` 完成解析后才替换当前文档，输出缺 id 警告；`save` 成功后记住路径，可用于下次无参数保存。`canvas` 查询不改变历史，尺寸修改先验证参数再更新文档。
- 失败的读、写、改尺寸保持当前文档和撤销历史；成功的 `read/save/canvas` 修改按题目阻断旧 undo/redo。补充文件往返、失败不变、路径复用和画布历史边界测试；本轮 `npm test` 为 24 项通过。
- 这轮采用了测试先行、确认失败、最小实现、复跑测试的顺序。前几轮已有自动化测试，但不宣称整个项目从第一步起都严格遵循 TDD。

### 迭代 9：最终命令验收与设计复核

- 对照第 3 节命令表检查 `init/read/save/canvas`、六种图形的 `create`、全部编辑与结构命令、`tree/show/help` 和 `undo/redo`。用真实 CLI 依次执行嵌套建图、移动与撤销重做、缩放、属性修改、前后顺序调整、分组与解组、删除与恢复、画布修改、保存和读回；所有命令均得到预期反馈，最终读回 9 个元素。
- 将真实生成的 SVG 交给独立工具 `xmllint --noout` 检查，确认 XML 格式有效；文件包含嵌套 `<g>`、六种内置图形中的五种叶子、样式与已转义的中文文本。自动化测试继续覆盖第六种叶子和读写往返。
- 复核架构后发现初版图遗漏了 `cli → model` 直接依赖，且“应用层经存取接口访问文件”的描述比实际实现更宽。下方按真实导入关系修订，不把计划描述成已完成的隔离。

### 迭代 10：结构编辑失败恢复

- 严格复核指出分组与解组虽然先验证参数，但多次移除、插入期间若抛错，可能留下半完成的图形树。先增加两个故障注入测试：分别在分组接入第二个图形、解组提升第一个子图形之后抛错；测试首次运行均失败，证明风险可以复现。另测试了分组撤销中途失败时，原树与撤销历史仍可重试。
- 在 `SvgDocument.changeStructureAtomically` 中只保存节点引用、父子关系和顺序，不复制图形几何或整份 SVG。发生异常时恢复原树，再原样抛出错误。`group`、`ungroup`、`addto`、`front/back` 的多步骤执行与撤销均通过此边界；失败命令仍不会进入历史。
- 补充 Command 参与者的实际映射，以及为何三种基本几何编辑共用 `ShapeEditCommand`。这次没有重写 CLI 或扩展 SVG 的 `transform` 支持；已知的 `CLI → MODEL` 依赖仍在下方如实记录。

### 与 AI 协作中的关键判断和纠正

1. 初版讨论先区分了 CLI 与 VS Code 插件。依据本阶段命令表，选择只做终端入口；题目中描述的 `box` 插件留到后续阶段，没有提前引入注册框架。
2. **撤销到底保存什么状态？** 曾比较“每次编辑复制整个文档”和“由命令保存恢复自身所需的信息”。最终让几何编辑保存目标及子孙的旧状态，让删除、分组和改层级的命令保存节点引用、原父容器与同级位置。这样一条命令仍对应一次完整撤销，也避免普通编辑反复复制整份 SVG。跨容器分组、删除后恢复位置以及 redo 清空的测试检验了这一选择。
3. **创建时归属与事后调整如何共存？** 题目同时提供 `create ... in <gid>`、`group` 和 `addto`。最终由 `SvgDocument` 统一维护一棵图形树和唯一 id：`in` 在创建时确定父容器，`group` 按文档顺序收编已有节点，`addto` 改变已有节点的父容器。它们对应不同操作时机，但共用同一套父子关系约束；跨容器分组及撤销测试检查了原顺序能否恢复。
4. **参数预检能否保证失败不改状态？** 初版结构命令先检查 id、祖先关系和目标类型，但 `group`、`ungroup` 的执行仍包含多次移除和插入。审查后先把异常注入到已发生一次修改的位置，测试确实观察到半完成的树。随后只对结构关系做临时快照，失败时恢复原树并保留原异常；新的测试还检查撤销中途失败后可以重试。正常编辑仍由各命令记录精确撤销信息，结构快照只服务于多步骤操作的失败恢复。
5. **`read` 应接受多大范围的 SVG？** 任意 SVG 还可能包含 `path`、`transform`、CSS 等当前模型无法表达的内容。最终用 XML 解析器处理格式和转义，只把六种内置元素及其可表示的属性转换为模型；遇到不支持的内容明确报错。`read` 在解析成功后才替换当前文档，避免失败时丢失正在编辑的内容。六种图形的写出读回、缺 id 补全和不支持输入测试检验了这个边界。
6. **初版依赖规则是否真的落地？** 初版设想 CLI 只依赖应用层；实现核查发现 `Cli` 直接构造 `SvgDocument`、调用 `ShapeFactory`，并读取模型生成 `tree/show`。最终没有把这条依赖包装成“完全隔离”：一致性自查画出实际箭头，说明这是当前版本的简化和后续增加其他入口时的重构点。文件解析仍留在基础设施层，模型没有反向依赖 CLI 或文件系统。
7. **测试证据如何表述？** 早期模型和命令测试主要伴随实现增加，不能据此称整个项目严格遵循 TDD。迭代 8 的文件命令和迭代 10 的失败恢复先写测试、观察失败，再实现并复跑；文档分别记录了这个顺序。质量结论限定在已有自动化测试、真实 CLI 会话及生成 SVG 的 XML 检查覆盖的行为内。

## 一致性自查

### 1. 模块划分与原方案是否一致？

五个计划目录均已落地：`model` 保存图形树与行为，`application` 保存编辑命令、历史和 `DocumentStore` 接口，`cli` 处理命令行协议，`infrastructure` 用 `SvgCodec` 与 `SvgFileStore` 处理 SVG 和文件，`main.ts` 装配入口。该划分与初版表格一致。

实际职责有一处比初版更直接：CLI 不只是调用应用层命令，还直接创建 `SvgDocument`、调用 `ShapeFactory`、读取图形以输出 `tree/show`，并调用文档的 `resize`。这些操作仍由模型对象维护自身约束，但 CLI 知道了模型类型。此处是架构边界上的简化，不应被初版图隐藏。

### 2. 依赖方向规则是否被违反？

按 `src/` 中的 `import` 检查，实际编译时依赖如下。图中只展开能解释职责和依赖的代表性类型；同类的六种图形、各个具体编辑命令仍归在各自包内。实线箭头表示使用或导入，虚线标出接口实现：

![最终代码的实际依赖 PlantUML 组件图](./最终代码的实际依赖.svg)

对应的 PlantUML 源码：

```plantuml
@startuml
left to right direction
skinparam componentStyle rectangle

component "main.ts\n装配入口" as MAIN
package "src/cli" {
  component "Cli\n命令分发、会话与输出" as CLI
  component "Tokenizer" as TOKENIZER
}
package "src/application" {
  component "CommandHistory\nEditCommand 及具体命令" as COMMANDS
  interface "DocumentStore" as STORE
}
package "src/model" {
  component "SvgDocument\n唯一 id、父子关系、结构恢复" as DOC
  component "Shape / Group\n图形行为与容器递归" as SHAPES
  component "ShapeFactory\n内置类型构造" as FACTORY
}
package "src/infrastructure" {
  component "SvgFileStore" as FILE
  component "SvgCodec\nXML 解析与序列化" as CODEC
}

MAIN --> CLI : 启动
MAIN --> FILE : 注入存取实现
CLI --> TOKENIZER : 解析参数
CLI --> COMMANDS : 执行、撤销与重做
CLI --> STORE : read / save
CLI --> DOC : init / canvas / tree
CLI --> FACTORY : create
COMMANDS --> DOC : 修改图形树
COMMANDS --> SHAPES : 调用图形行为
DOC --> SHAPES : 保存层级
FACTORY --> SHAPES : 构造
FILE ..> STORE : 实现
FILE --> CODEC : 读写转换
CODEC --> DOC : 解析与生成
CODEC --> FACTORY : 构造图形
@enduml
```

- **符合**：`model` 只导入模型内的类；`application` 只依赖模型和自身接口；`infrastructure` 实现应用层 `DocumentStore`，并依赖模型、`saxes` 与 Node 文件 API；`main.ts` 装配具体实现。模型未导入 CLI 或文件系统。
- **与初版不一致**：初版规则 3 写“`cli` 依赖 `application`”，图中没有 `CLI → MODEL`；实际 `src/cli/Cli.ts` 导入 `SvgDocument`、`ShapeFactory`、`Group`、`Shape`。这是明确的依赖规则违反项。原因是 Phase 1 的 CLI 需要构造当前文档并展示树；为保持阶段实现简洁，未再增加一层包装全部读写操作的应用服务。后续若增加 GUI 或第二种入口，应把建图、查询与画布操作移入应用服务，再删除这条直接依赖。
- **表述修正**：`DocumentStore` 接口定义在应用层，但当前调用它的是 CLI；“应用层通过接口访问文件”是最初计划，不是当前运行路径。文件格式与文件系统仍被限制在 `infrastructure`，CLI 只依赖接口类型。
- **集中分派**：命令名选择仍集中在 `Cli.execute`，图形类型选择集中在 `ShapeFactory`。各图形类内部按属性名判断允许的属性，不是图形类型分派。

## 质量保证手段

### 已执行的验证

| 范围 | 证据 | 结论 |
| --- | --- | --- |
| 六种图形与嵌套容器 | `test/model.test.ts` | 创建、统一几何操作、父子关系、唯一 id 与循环拒绝均有测试。 |
| Command 与 undo/redo | `test/model.test.ts`、`test/cli.test.ts` | 删除位置、组的跨容器收编、解组、移入容器、前后顺序、失败命令不入历史及 redo 清空均有测试；结构编辑与撤销中途抛错后恢复原树的故障注入测试通过。 |
| SVG 格式 | `test/codec.test.ts` | 六种图形、画布、样式、顺序及转义文本写出后读回；缺 id 补全且避开已有 id；非法或不支持的输入报错。 |
| 文件与 CLI | `test/cli.io.test.ts` | 实际临时文件的 `read/save`、路径复用、失败不改文档和历史、画布查询及修改后的历史阻断均有测试。 |
| 完整入口 | `npm run cli` 输入一段真实命令序列 | 9 个元素保存后读回，`tree/show` 的层级、尺寸和属性符合预期；`xmllint --noout` 验证生成文件是合法 XML。 |
| 构建与检查 | `npm run check`、`npm test`、`git diff --check` | TypeScript 检查通过；自动化测试 27 项通过；改动无空白错误。 |

### 范围与限制

- 当前读取的是题目六种内置元素及模型能表达的 SVG 子集；`path`、`transform`、CSS、`tspan` 等没有实现。遇到这类内容会报错，不会假装完整读入。`box` 是后续阶段目标，本阶段 `create box` 返回未知类型。
- 自动化测试与真实 CLI 验收能支持对已覆盖行为的判断，但不能证明任意外部 SVG 都可无损读入。浏览器中的最终视觉效果仍建议在提交前由使用者打开生成的 `.svg` 再确认一次。
- 文档中列出的直接 `CLI → MODEL` 依赖是已知架构偏差；如下一阶段增加其他入口，应优先处理该边界。
