---
title: react17 合成事件
date: 2022-07-11 16:20:55
tags:
cover: http://cdn.pluto1811.com/goodsImage/1656148764863/pure-logo.png
---

事件绑定

事件触发

程序初始化进行了插件的注册

1. 收集事件

在生成 fiber 的时候就已经进行了事件插件的注册

ReactFiberCompleteWork.js ===> finalizeInitialChildren ===> setInitialProperties ===> trapEventForPluginEventSystem ===>

2. 触发

3. 合成事件对象

packages/legacy-events/SyntheticEvent.js

#### 写在前面

既然是讨论事件，那么不得不说事件发生的三个阶段：

1. 捕获；
2. 触达目标；
3. 冒泡；
   举个例子：
   体现在原生事件上就是：
   捕获 parent >>> child >>> target；
   冒泡 target >>> child >>> parent；
   如何打破这种执行机制呢？有两种方法：

```
e.stopPropagation()； // 阻止事件向上冒泡
e.stopImmediatePropagation()；// 阻止事件向上冒泡并同级事件也不会执行
```

下文会给出具体的例子

```
document.addEventListener('click',()=>{},true);
```

这里的 true 表示该事件发生在捕获阶段；

要想讨论 react 的合成事件，此处需要将 react16.x 与 react17.x 版本分开来看，因为在 react17.x 版本其事件系统发生了很大的变化；主要有如下两点区别：

1. react16 将事件代理到了 document 上了，而 react17 是代理在当前根节点上；
2. react17 更改了事件的执行时机；
3. react17 移除了事件池；

#### React16.x 版本合成事件实现逻辑

```jsx
/**
<div id="parent">
  <div id="child">
    点击
  </div>
</div>
 */
const parent = document.getElementById("parent");
const child = document.getElementById("child");

const dispatchEvent = (event) => {
  const que = [];
  let target = event.target;
  while (target) {
    que.push(target);
    target = target.parentNode;
  }
  // 模拟捕获和冒泡
  for (let i = que.length - 1; i >= 0; i--) {
    const handle = (que[i] || {}).onClickCapture;
    handle && handle();
  }
  for (let i = 0; i <= que.length; i++) {
    const handle = (que[i] || {}).onClick;
    handle && handle();
  }
};

document.addEventListener("click", dispatchEvent);

parent.addEventListener(
  "click",
  () => {
    console.log("parent原生事件捕获");
  },
  true
);
child.addEventListener("click", () => {
  console.log("child原生事件冒泡");
});
child.addEventListener(
  "click",
  () => {
    console.log("child原生事件捕获");
  },
  true
);
parent.addEventListener("click", () => {
  console.log("parent原生事件冒泡");
});
document.addEventListener(
  "click",
  () => {
    console.log("document原生事件捕获");
  },
  true
);
document.addEventListener("click", () => {
  console.log("document原生事件冒泡");
});

parent.onClickCapture = function () {
  console.log("parent react事件捕获");
};
parent.onClick = function () {
  console.log("parent react事件冒泡");
};
child.onClickCapture = function () {
  console.log("child react事件捕获");
};
child.onClick = function () {
  console.log("child react事件冒泡");
};

/**
 * document原生事件捕获
 * parent原生事件捕获
 * child原生事件捕获
 * child原生事件冒泡
 * parent原生事件冒泡
 * parent react事件捕获
 * parent react事件冒泡
 * child react事件捕获
 * child react事件冒泡
 * document原生事件冒泡
 */
```

#### React17.x 版本合成事件实现逻辑

```jsx
/**
<div id="root">
  <div id="parent">
    <div id="child">
      点击
    </div>
  </div>
</div>
 */
const root = document.getElementById("root");
const parent = document.getElementById("parent");
const child = document.getElementById("child");

const dispatchEvent = (event, useCapture) => {
  const que = [];
  let target = event.target;
  while (target) {
    que.push(target);
    target = target.parentNode;
  }
  // 模拟捕获和冒泡
  if (useCapture) {
    for (let i = que.length; i >= 0; i--) {
      const handle = (que[i] || {}).onClickCapture;
      handle && handle();
    }
  } else {
    for (let i = 0; i <= que.length; i++) {
      const handle = (que[i] || {}).onClick;
      handle && handle();
    }
  }
};

root.addEventListener("click", dispatchEvent);

parent.addEventListener(
  "click",
  () => {
    console.log("parent原生事件捕获");
  },
  true
);
child.addEventListener("click", () => {
  console.log("child原生事件冒泡");
});
child.addEventListener(
  "click",
  () => {
    console.log("child原生事件捕获");
  },
  true
);
parent.addEventListener("click", () => {
  console.log("parent原生事件冒泡");
});
root.addEventListener(
  "click",
  () => {
    console.log("root原生事件捕获");
  },
  true
);
root.addEventListener("click", () => {
  console.log("root原生事件冒泡");
});

root.addEventListener("click", (event) => dispatchEvent(event, true), true);

parent.onClickCapture = function () {
  console.log("parent react事件捕获");
};
parent.onClick = function () {
  console.log("parent react事件冒泡");
};
child.onClickCapture = function () {
  console.log("child react事件捕获");
};
child.onClick = function () {
  console.log("child react事件冒泡");
};

/**
 * root原生事件捕获
 * parent react事件捕获
 * child react事件捕获
 * parent原生事件捕获
 * child原生事件捕获
 * child原生事件冒泡
 * parent原生事件冒泡
 * child react事件冒泡
 * parent react事件冒泡
 * root原生事件冒泡
 */
```

#### react17 版本为什么需要将事件的代理对象改成当前根节点

要回答这个问题需要先给出在 react16 版本里出现的一个 bug

```jsx
state={
  visible:false
}
componentDidMount(){
  document.addEventListener('click',()=>{
    this.setState({
      visible:false
    })
  })
}
handleClick = ()=>{
  this.setState({visible:true})
}
render(){
  return(
    <>
      <div onClick={this.handleClick}>
        点击打开dialog
      </div>
      {
        this.state.visible && <Dialog/>
      }
    </>
  )
}
```

已上代码在 react16 版本会如何表现呢？

答案是：

Dialog 弹窗永远不会显示；

原因是当点击按钮时，visible 状态确实改为 true 了，按钮说此时弹窗应该显示，但事件会冒泡到 document 此时又触发 visible:false，因此弹窗又被隐藏了；

这是有人说按钮点击时加一个 e.stopPropagation()阻止向上冒泡不就可以了吗？

但 React16 版本将 document 作为事件的代理对象，按钮的点击事件实际是委托到 document 上了，e.stopPropagation()只会阻止向上冒泡，但无法阻止同级；因此在这里是无效的；

终极解决办法是：按钮点击时添加 e.stopImmediatePropagation();

当然这个问题放在 React17 版本就不会存在了，因为在 17 版本事件的委托对象变成了根节点，与 document 不在同级，因此使用 e.stopPropagation()是可以生效的。

以上。
