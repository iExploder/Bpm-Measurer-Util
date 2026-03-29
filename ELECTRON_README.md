# BPM 测速助手 - Electron

这是一个使用 Electron 封装的 BPM 测速助手 GUI 应用程序。

## 功能特性

- 音频波形和频谱可视化
- 动态 BPM 测量和调整
- 节拍器功能
- 拖拽时间轴缩放和滚动
- JSON 配置导入/导出

## 开发环境设置

### 前置要求

- Node.js 20 或更高版本
- npm 或 yarn 包管理器

### 安装依赖

```bash
npm install
```

### 运行开发服务器

```bash
npm run electron:dev
```

这将启动 Vite 开发服务器和 Electron 应用。

### 构建应用程序

```bash
npm run electron:build
```

构建后的应用程序将在 `dist/` 目录中。

## GitHub Actions 自动构建

项目配置了 GitHub Actions 来自动构建和发布应用程序。

### 工作流

- 当推送到 `main` 或 `master` 分支时，会触发构建
- 当创建标签（如 `v1.0.0`）时，会创建发布版本
- 支持 Windows, macOS 和 Linux 平台

### 构建产物

- Windows: NSIS 安装程序 (.exe)
- macOS: DMG 安装包 (.dmg)
- Linux: AppImage (.AppImage)

## 打包说明

### Windows

需要安装 Windows SDK 来签名应用程序。

### macOS

需要配置代码签名证书。

### Linux

需要安装 AppImage 相关依赖。

## 文件结构

```
dist-electron/
├── main.js          # Electron 主进程
├── preload.js       # Electron 预加载脚本
└── tsconfig.json    # TypeScript 配置

src/
└── electron.d.ts    # TypeScript 声明文件
```

## 配置文件

### package.json

```json
{
  "build": {
    "appId": "com.bpmmeasurer.util",
    "productName": "BPM 测速助手",
    "directories": {
      "output": "dist"
    },
    "files": [
      "dist/**/*",
      "dist-electron/**/*",
      "package.json"
    ]
  }
}
```

## 许可证

MIT
