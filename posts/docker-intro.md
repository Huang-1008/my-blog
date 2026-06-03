---
title: Docker 入门：从零到部署
date: 2026-05-20
tags: [Docker, 运维, 部署]
excerpt: Docker 简化了应用的打包、分发和部署流程。本文从零开始介绍 Docker 的核心概念和最佳实践。
---

## 什么是 Docker

Docker 是一个开源的容器化平台，它允许开发者将应用程序及其依赖打包到一个轻量级、可移植的容器中。

### 核心概念

- **镜像 (Image)**：应用程序的只读模板
- **容器 (Container)**：镜像的运行实例
- **Dockerfile**：定义镜像构建步骤的文本文件
- **Docker Compose**：多容器应用编排工具

## 第一个 Dockerfile

```dockerfile
# 使用 Node.js 官方镜像作为基础
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "server.js"]
```

## 常用命令速查

```bash
# 构建镜像
docker build -t my-app:v1.0 .

# 运行容器
docker run -d -p 3000:3000 --name my-app my-app:v1.0

# 查看日志
docker logs -f my-app

# 进入容器
docker exec -it my-app sh

# 停止并删除
docker stop my-app && docker rm my-app
```

## Docker Compose 示例

```yaml
version: '3.8'
services:
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: example
      MYSQL_DATABASE: myapp
    volumes:
      - db_data:/var/lib/mysql

  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - db
    environment:
      DB_HOST: db
      DB_PASSWORD: example

volumes:
  db_data:
```

## 最佳实践

1. **使用多阶段构建**减小镜像体积
2. **不要以 root 用户运行**容器
3. **使用 `.dockerignore`** 排除不必要的文件
4. **为镜像打上清晰的标签**
5. **定期清理无用镜像和容器**

## 总结

Docker 是现代应用部署的基础工具。掌握了这些核心概念和命令，你就可以开始将项目容器化了。
