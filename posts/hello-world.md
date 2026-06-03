---
title: 我的第一篇博客文章
date: 2026-06-01
tags: [技术, 博客, 入门]
excerpt: 这是我的第一篇博客文章，介绍了我搭建这个博客的过程和一些技术思考。
---

## 欢迎来到我的博客

你好！这是我的第一篇博客文章。在这里，我将分享我的技术学习心得和项目经验。

## 为什么搭建这个博客

我一直想要一个属于自己的技术博客，用来记录我的学习和成长。这个博客的特点包括：

- **纯静态 SPA**：无需复杂的后端框架
- **Markdown 写作**：使用熟悉的 Markdown 格式撰写文章
- **代码高亮**：自动语法高亮，适合技术文章
- **GitHub 集成**：展示我的开源项目

## 一段示例代码

```javascript
// 这是一个简单的冒泡排序实现
function bubbleSort(arr) {
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
      }
    }
  }
  return arr;
}

const result = bubbleSort([64, 34, 25, 12, 22, 11, 90]);
console.log('排序结果:', result);
// 输出: [11, 12, 22, 25, 34, 64, 90]
```

```python
# Python 版本的快速排序
def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)

print(quick_sort([3, 6, 8, 10, 1, 2, 1]))
# 输出: [1, 1, 2, 3, 6, 8, 10]
```

## 总结

这只是个开始，我会持续更新更多技术文章。如果你对某个话题感兴趣，欢迎通过 GitHub 联系我！
