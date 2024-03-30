---
title: 浅析 valueOf & toString & toPrimitive
date: 2022-10-08 17:18:26
tags:
cover: /images/valueOf/cover.png
---

### 基本概念

valueOf: 返回对象的原始值表示
toString: 返回对象的字符串表示
toPrimitive: 一个内置的 Symbol 值，它是作为对象的函数值属性存在的，如果对象中存在个属性时，当一个对象转换为对应的原始值时，会优先调用此函数

<!--more-->

### 先说结论

对于对象类型的数据进行转换时

1. 如果期望是转换为字符串，则优先调用 toString()方法，如没有再调用 valueOf()方法;
2. 如果期望转换为数字则优先调用 valueOf()方法，如没有再调用 toString()方法;
3. 如果定义了 Symbol.toPrimitive 方法，则优先调用；

以上结论都是建立在该对象具有 toString()、valueOf()、Symbol.toPrimitive 三者方法任意一种存在。如果是 Object.create(null) 定义的对象，尝试转换，那么会直接抛错

### 细说规则

#### valueOf

对于基础类型的数据，直接返回改类型

boolean
null
undefined
string
number
symbol

对于非原始值的重写规则如下

| 对象     | valueOf 的返回值     |
| -------- | -------------------- |
| Array    | 数组本身             |
| Boolean  | 布尔值               |
| Date     | 返回毫秒形式的时间戳 |
| Function | 函数本身             |
| Number   | 数字值               |
| Object   | 对象本身             |
| String   | 字符串值             |

#### toString 转换规则

这里附带一个小知识点 toString 与 String 的异同？

相同点：都是将一个值转换成字符串

区别：toString 可以传参，表示以多少位的格式输出结果；String 方法传参无效

1. null 和 undefined 不能调用 toString，而 String 可以转换 null 和 undefined
2. | 对象     | toString 的返回值                                                      |
   | -------- | ---------------------------------------------------------------------- |
   | Array    | 以逗号分割的字符串，如[1,2]的 toString 返回值为"1,2"                   |
   | Boolean  | True                                                                   |
   | Date     | 可读的时间字符串，如"Tue Oct 15 2019 12:20:56 GMT+0800 (中国标准时间)" |
   | Function | 声明函数的 JS 源代码字符串                                             |
   | Number   | "数字值"                                                               |
   | Object   | "[object Object]"                                                      |
   | String   | "字符串"                                                               |

#### toPrimitive 转换规则

```js
[Symbol.toPrimitive](hint){
  console.log(hint);
}
```

hint 并不需要我们手动传入，而是 JS 根据上下文自动判断。hint 参数的只能 string，number，default 三者之一。

"string"

对象到字符串的转换，当我们对期望一个字符串的对象执行操作时，如 “alert”

"number"

```js
// 显式转换
let num = Number(obj);

// 数学运算（除了二元加法） let n = +obj;

// 一元加法
let delta = date1 - date2;

// 小于/大于的比较

let greater = user1 > user2;
```

"default"

在少数情况下发生，当运算符“不确定”期望值的类型时。
例如，二元加法 + 可用于字符串（连接），也可以用于数字（相加），所以字符串和数字这两种类型都可以。因此，当二元加法得到对象类型的参数时，它将依据 "default" hint 来对其进行转换。
此外，如果对象被用于与字符串、数字或 symbol 进行 == 比较，这时到底应该进行哪种转换也不是很明确，因此使用 "default" hint。

下面用几道面试题来巩固以上知识点

1. 函数柯里化，期望 curry(1, 2)(3, 4, 5)(6)(7, 8) 实现累加的效果

首先函数柯里化，这个比较简单 主要运用闭包就可以解决

```js
function curry(...agrs1) {
  let arr = [];
  const sum = function sum(...args2) {
    arr = [...agrs1, ...args2];
    return sum;
  };
  return sum;
}
const res = curry(1, 2)(3, 4, 5)(6)(7, 8);
```

关键是如果让 res 这个值具有累加效果呢，这里就要运用到我们上面讨论的知识了

```js
function curry(...agrs1) {
  let arr = [];
  const sum = function sum(...args2) {
    arr = [...agrs1, ...args2];
    return sum;
  };
  sum.__proto__[Symbol.toPrimitive] = function (hint) {
    return arr.reduce((t, c) => (t += c), 0);
  };
  return sum;
}
const res = curry(1, 2)(3, 4, 5)(6)(7, 8);
console.log(+res);
```

2.实现 a== 1&&a==2&&a==3 为 true 与 a===1&&a===2&&a===3 为 true

看到这个题目是不是脑瓜子嗡嗡的？其实如果理解到了上面说到的知识点，也不是没有思路

首先 对于 == 会进行隐式转换

```js
class A {
  constructor(v) {
    this.a = v;
  }
  valueOf() {
    return ++this.a;
  }
}
var a = new A(0);
(a == 1) & (a == 2) && a == 3;
```

=== 在严格模式下不会进行隐式转换，因此在这里我们需要进行一些特殊处理

```js
var value = 1;
Object.defineProperty(window, 'a', {
    get() {
        return value++
    }
})
console.log(a === 1 && a === 2 && a === 3))
```

以上。。。
