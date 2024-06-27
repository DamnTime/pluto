---
title: 前端性能优化-01
date: 2024-06-27 10:20:55
tags:
cover: https://cdn.JsDelivr.net/gh/DamnTime/pluto-img-bed@main/img/202406271124855.png
---

# 深入理解前端性能优化：代码分割、懒加载与监控

## 简介

前端性能优化是构建快速、高效 Web 应用的关键。本次分享将深入探讨代码分割、懒加载技术，以及如何使用现代浏览器 API 和工具进行性能监控。

## 代码分割(Code Splitting)

代码分割通过将代码拆分成多个包，实现按需加载，减少初始加载时间。

### Webpack 配置示例与关键注释

```javascript
// webpack.config.js
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: {
    main: "./src/index.js",
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/index.html",
    }),
  ],
  optimization: {
    splitChunks: {
      chunks: "all", // 所有chunks进行分割
      minSize: 20000, // 模块最小大小
      maxSize: 0, // 最大大小限制
      minChunks: 1, // 模块共享的最小chunks数
      maxAsyncRequests: 30, // 异步加载的最大请求数
      maxInitialRequests: 30, // 初始加载的最大请求数
      automaticNameDelimiter: "~", // 自动生成chunks名称分隔符
      cacheGroups: {
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/, // 匹配node_modules中的模块
          priority: -10,
          reuseExistingChunk: true,
        },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    },
  },
};
```

## 懒加载(Lazy Loading)

懒加载技术可以应用于路由和资源加载，减少应用的资源消耗。

### 图片懒加载：Intersection Observer API

使用`Intersection Observer API`实现图片懒加载，仅在图片进入可视区域时加载。

```html
<!-- index.html -->
<img class="lazyload" data-src="actual-image.jpg" alt="Description" />
```

```javascript
// lazyload.js
document.addEventListener("DOMContentLoaded", function () {
  const images = document.querySelectorAll("img.lazyload");
  const imageObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.getAttribute("data-src");
          img.src = src;
          observer.unobserve(img);
        }
      });
    },
    {
      rootMargin: "0px",
      threshold: 0.01,
    }
  );

  images.forEach((image) => {
    imageObserver.observe(image);
  });
});
```

## 性能监控

### 使用工具

1. **Lighthouse**: Chrome DevTools 的 Lighthouse，用于性能评估和优化建议。
2. **Webpack Bundle Analyzer**: 可视化分析 Webpack 输出的 bundle 内容。

### Lighthouse 使用示例

运行 Lighthouse 测试，评估页面性能。

### Webpack Bundle Analyzer 使用示例

配置 Webpack Bundle Analyzer，分析 bundle 内容。

```javascript
// webpack.config.js
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

module.exports = {
  // ...其他配置
  plugins: [
    // ...其他插件
    new BundleAnalyzerPlugin({
      openAnalyzer: true,
    }),
  ],
};
```

## 结论

通过代码分割和懒加载技术，结合现代浏览器 API 和性能监控工具，我们可以显著提升 Web 应用的性能。这些技术不仅减少了应用的资源消耗，还提高了用户体验。
