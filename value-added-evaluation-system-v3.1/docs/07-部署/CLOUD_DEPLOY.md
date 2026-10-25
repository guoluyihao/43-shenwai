# 云端部署（Docker Compose）

## 1. 前置条件
- 一台云服务器（Ubuntu 22.04/24.04 或其他 Linux 均可）
- 已安装 Docker 与 Docker Compose
- 云服务器安全组/防火墙放行端口（示例用 3001）

## 2. 准备代码
在服务器上拉取代码到任意目录：
- 包含 `Dockerfile` 与 `docker-compose.yml`

## 3. 配置数据库密码
编辑 `docker-compose.yml` 的以下字段为你自己的强密码：
- `db.environment.MYSQL_PASSWORD`
- `db.environment.MYSQL_ROOT_PASSWORD`
- 同步修改 `app.environment.MYSQL_PASSWORD`

如果你希望修改数据库名或用户名：
- 修改 `db.environment.MYSQL_DATABASE`、`db.environment.MYSQL_USER`
- 同步修改 `app.environment.MYSQL_URL`、`app.environment.MYSQL_USERNAME`

## 4. 启动
在包含 `docker-compose.yml` 的目录执行：
- `docker compose up -d --build`

查看运行状态：
- `docker compose ps`

查看日志：
- `docker compose logs -f app`

## 5. 访问
- 直接访问：`http://<服务器公网IP>:3001/`
- 项目入口：`http://<服务器公网IP>:3001/projects`

## 6. 数据持久化说明
- MySQL 数据：`db_data` volume
- 上传文件：`uploads` volume（对应容器内 `/app/uploads`）

## 7. 升级发布
代码更新后：
- `docker compose up -d --build`

