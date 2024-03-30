---
title: 浅析 webpack5 重点是联邦模块实现微前端
date: 2022-10-08 17:26:58
tags:
cover: /images/webpack5/cover.png
---

### webpack5 新特性：

- 启动命令
  开发环境：webpack serve
  生产环境：webpack
- 持久化缓存
  会缓存生成的 webpack 模块合 chunk，来改善构建速度
  默认开启，默认缓存在内存中，但可以对 cache 进行设置
  webpack 追踪了每个模块的依赖，并创建了文件快照，与真实的文件系统进行对比，当发生差异时，触发对应的模块重新构建
  <!--more-->

- 资源模块，原生支持 json、png、jpeg、jpg、txt 等格式文件
  无需配置额外的 loader，raw-loader/file-loader/url-loader 等等
  ```js
  // 'javascript/auto' | 'javascript/dynamic' | 'javascript/esm' | 'json' | 'webassembly/sync' | 'webassembly/async' | 'asset' | 'asset/source' | 'asset/resource' | 'asset/inline'
    {
        test: /\.json$/, // 这里也可以配置png/jpg/txt 只是type选项的不同
        type: 'javascript/auto',
        loader: 'custom-json-loader',
    }
  ```
- moduleIds & chunkIds 的优化
  在 webpack5 之前，没有从 entry 打包的 chunk 文件，都会以 1、2、3。。。的文件命名方式输出，删除某些文件可能会导致缓存失效；
  在 webpack5 中，生产环境下默认使用了 deterministic 的方式生成短 hash 值来分配给 modules 和 chunks 来解决上述问题
  ```js
    optimization: {
      moduleIds: 'deterministic',
      chunkIds: 'deterministic',
    },
  ```
- 更智能的 tree shaking
  webpack4 tree-shaking 是通过扫描文件中未引用到的函数实现再将其剔除实现的，作用很小，如果使用场景有嵌套的方法引用，就不管用了；
  在 webpack5 中：

  ```js
  optimization: {
    usedExports: true,
  },
  ```

  另外还可以在 package.json 中配置 sideEffects:false 表示整个项目都没有副作用，webpack 在打包时会自动剔除具有副作用代码；
  当然也可以指定类型或文件保留副作用，比如配置 sideEffects: ['*.css'] 表示保留 import './index.css' 类似的代码

- 模块联邦

更多更新特性请看：<a href="https://github.com/webpack/webpack/releases/tag/v4.0.0">changelog</a>

#### 这里着重介绍 webpack5 史诗级更新：模块联邦

先初始化两个项目 provider、comsumer

```
pnpm install webpack webpack-cli webpack-dev-server html-webpack-plugin babel-loader @babel/preset-env @babel/preset-react @babel/core style-loader css-loader -D

pnpm install react react-dom
```

在熟悉这个功能之前，我们先理清两个重要的角色，webpack 官网上提出了两个概念：remotes 和 host，但个人更倾向于叫它们为 provider 和 comsumer，首先我们先构建一个简单的联邦模块结构。

#### 对于 provider

```js
// provider
const { ModuleFederationPlugin } = require("webpack").container;
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: "provider", // 必须唯一 模块的名称
      filename: "remoteEntry.js", // 必须 生成的模块名称
      exposes: {
        // 很明显，需要对外暴露的模块 注意该对象的key必须这么写
        "./Search": "./src/Search",
        "./utils": "./src/utils",
      },
    }),
  ],
};
```

#### 对于 comsumer

```js
// comsumer
const { ModuleFederationPlugin } = require("webpack").container;
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: "comsumer", // 必须唯一 模块的名称
      // 很明显，需要映射的远程provider
      remotes: {
        /**
         * 这个地方来拆解下这个对象的参数
         * key: 无所谓随意取，但在后续消费的时候有用
         * value: "provider@http://localhost:9000/remoteEntry.js"
         * 这里的provider：依然是上面provider的name
         * http://localhost:9000/： 这个表示provider的远程地址
         * remoteEntry.js：指的是上面provider中定义的filename
         */
        module1: "provider@http://localhost:9000/remoteEntry.js",
      },
    }),
  ],
};
```

#### provider 和 comsumer 配置定义好了，下面来看下在 comsumer 中怎么用吧

```js
import React, { lazy, Suspense, useEffect } from "react";

/**
 * import("module1/Search")
 * 这里的module1 指的是上面comsumer配置中定义remotes时设置的key
 * Search 指的是上面provider配置中定义exposes时设置的key
 */
const ProviderSearch = lazy(() => import("module1/Search"));

const App = () => {
  return (
    <div>
      <h1>这是comsumer项目</h1>
      <Suspense>
        <ProviderSearch />
      </Suspense>
    </div>
  );
};

export default App;
```

除此之外还有一种全局调用的方法：

在 provider 中加上

```js
// provider
const { ModuleFederationPlugin } = require("webpack").container;
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      ...
      library: { type: "var", name: "provider" },
    }),
  ],
};
```

在需要使用的地方，注意这里可以不用区别在 provider、comsumer 项目中

```js
function loadComponent(scope, module) {
  return async () => {
    // Initializes the shared scope. Fills it with known provided modules from this build and all remotes
    await __webpack_init_sharing__("default");
    const container = window[scope]; // or get the container somewhere else
    // Initialize the container, it may provide shared modules
    await container.init(__webpack_share_scopes__.default);
    const factory = await window[scope].get(module);
    const Module = factory();
    return Module;
  };
}
loadComponent("provider", "utils");
```

至此，一个完整的联邦模块配置就搭建完成了。
