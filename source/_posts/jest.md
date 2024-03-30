---
title: 关于jest的TDD与BDD开发模式
date: 2022-08-10 13:20:55
tags:
cover: /images/jest/cover.png
---

# 在 react 项目中运用 jest 自动化测试框架的探索

### 1. 项目日益庞大后的痛点：

牵一发动全身，日常开发就像是在猴子掰包谷，顾此失彼。

### 2. 编写的代码无理可依

自己写的都不放心

。。。

因此引入自动化测试框架无疑可以给自己一剂“安心药”。

# 目前流行的自动化测试框架的对比

| 框架  | 优点                            | 缺点             |
| ----- | :------------------------------ | :--------------- |
| Mocha | 主要用于单元测试                | 集成测试方面较弱 |
| jest  | 单元、集成测试都 ok，丰富的 api | 暂未发现明显缺点 |

# 本文主要介绍 jest

### 1. 安装

```js
yarn add --dev jest 或 npm install --save-dev jest
```

注意：用 create-react-app myApp 或 npx create-react-app myApp 快速创建的 react 项目 自动集成 jest；

### 2. 如果是 react 项目建议集成 enzyme（airbnb 出品 与 react 项目配合天衣无缝）

```js
yarn add --dev enzyme enzyme-adapter-react-16
```

### 3. 项目配置

可在项目根目录新建 jest.config.js

```json
module.exports = {
  roots: ["<rootDir>/src"], // 源文件
  collectCoverageFrom: ["src/**/*.{js,jsx,ts,tsx}", "!src/**/*.d.ts"],  // 生成测试报告需要收集的文件
  setupFiles: ["react-app-polyfill/jsdom"],
  setupFilesAfterEnv: ["<rootDir>/enzyme.config.js"],  // 环境加载完后执行的文件，这里代表的意思是环境加载完后执行在根目录下的enzyme.config.js文件，如下：
  testMatch: [ // 测试的文件
    "<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}",
  ],
  testEnvironment: "jsdom", // 运行的环境
  testRunner:
    "/Users/huanglei/工作/test/react-demo/node_modules/jest-circus/runner.js",
  transform: { // 转换的文件
    "^.+\\.(js|jsx|mjs|cjs|ts|tsx)$": "<rootDir>/config/jest/babelTransform.js",
    "^.+\\.css$": "<rootDir>/config/jest/cssTransform.js",
    "^(?!.*\\.(js|jsx|mjs|cjs|ts|tsx|css|json)$)":
      "<rootDir>/config/jest/fileTransform.js",
  },
  transformIgnorePatterns: [ // 忽略文件
    "[/\\\\]node_modules[/\\\\].+\\.(js|jsx|mjs|cjs|ts|tsx)$",
    "^.+\\.module\\.(css|sass|scss)$",
  ],
  modulePaths: [],
  moduleNameMapper: {
    "^react-native$": "react-native-web",
    "^.+\\.module\\.(css|sass|scss)$": "identity-obj-proxy",
  },
  moduleFileExtensions: [ // 文件的扩展名
    "web.js",
    "js",
    "web.ts",
    "ts",
    "web.tsx",
    "tsx",
    "json",
    "web.jsx",
    "jsx",
    "node",
  ],
  watchPlugins: [ // watch相关的插件
    "jest-watch-typeahead/filename",
    "jest-watch-typeahead/testname",
  ],
  resetMocks: true,
};

```

```js
// 使 enzyme 适配 react16 版本
import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";

Enzyme.configure({ adapter: new Adapter() });
```

在 package.json 文件中配置测试命令

```json
  "scripts": {
    "start": "node scripts/start.js",
    "build": "node scripts/build.js",
    "test": "jest"  // 或 "jest --watch" 开启监听
  },
```

### 4. 项目目录设计

根据 TDD（单元测试）、BDD（集成测试）的相关模式，建议目录设计如下：

```text
├── components             组件
|   ├──__tests__           单元测试相关
├── src                    源码目录
|   ├── pages              页面文件目录
|   |   ├── index          index 页面目录
|   |   |   ├── __tests__  集成测试相关
└── package.json
```
