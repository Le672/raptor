[English](./README.md) | 简体中文

# React + TypeScript + Vite

本模板提供了一个最小化的配置，让 React 能在 Vite 中运行，并支持 HMR（热模块替换）以及一些 ESLint 规则。

目前提供两个官方插件：

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) 使用 [Babel](https://babeljs.io/) 实现 Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) 使用 [SWC](https://swc.rs/) 实现 Fast Refresh

## 扩展 ESLint 配置

如果你正在开发生产环境的应用，我们建议更新配置以启用类型感知的 lint 规则：

```js
export default tseslint.config({
  extends: [
    // 移除 ...tseslint.configs.recommended，替换为以下配置
    ...tseslint.configs.recommendedTypeChecked,
    // 或者使用以下更严格的规则
    ...tseslint.configs.strictTypeChecked,
    // 可选：添加用于代码风格的规则
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // 其他选项...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

你还可以安装 [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) 和 [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) 以获取 React 专用的 lint 规则：

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  extends: [
    // 其他配置...
    // 启用 React 的 lint 规则
    reactX.configs['recommended-typescript'],
    // 启用 React DOM 的 lint 规则
    reactDom.configs.recommended,
  ],
  languageOptions: {
    // 其他选项...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```
