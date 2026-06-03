---
title: 学习 Git 的十个实用技巧
date: 2026-05-28
tags: [Git, 教程, 开发工具]
excerpt: Git 是每个开发者必备的技能。本文总结了十个实用的 Git 技巧，帮你提升工作效率。
---

## 前言

Git 是现代软件开发中不可或缺的版本控制工具。掌握一些实用技巧可以显著提升你的工作效率。

## 技巧一：交互式暂存

使用 `git add -p` 可以逐块选择要暂存的代码更改：

```bash
git add -p
# 然后选择 y (暂存), n (跳过), s (拆分) 等
```

## 技巧二：查看优雅的提交历史

```bash
git log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --all
```

## 技巧三：暂存当前工作

```bash
git stash push -m "WIP: 正在进行的功能开发"
git stash pop  # 恢复
git stash list # 查看列表
```

## 技巧四：修改最近的提交

```bash
# 修改提交信息
git commit --amend -m "新的提交信息"

# 往最近提交中添加遗漏的文件
git add forgotten-file.txt
git commit --amend --no-edit
```

## 技巧五：搜索代码历史

```bash
# 在所有提交历史中搜索某个字符串
git log -S "searchString" --source --all

# 搜索某行的最后修改者
git blame -L 10,20 filename.js
```

## 总结

这些 Git 技巧涵盖了日常开发中的常见场景。熟练使用它们可以让你的版本控制操作更加流畅高效。

> 提示：建议将这些常用的 Git 命令保存为 alias，进一步简化操作。
