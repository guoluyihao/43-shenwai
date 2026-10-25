# 远程服务器一键部署（Jar，前后端不分离）

本项目为 Spring Boot + Thymeleaf，前端页面（templates）与静态资源（static）会被打包进同一个可执行 Jar，服务器只需要安装 JDK 即可运行。

## 1. 本地打包 Jar

在项目根目录执行（推荐 clean，避免本地缓存导致的奇怪问题）：

### 方式 A：使用你本机的 Maven

```bash
mvn -f score-manager/pom.xml -DskipTests clean package
```

### 方式 B：使用仓库内置 Maven（Windows）

```powershell
$env:JAVA_HOME = "D:\project\1-zengzhipingjia\jdk\jdk17.0.18_9"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path
.\maven\apache-maven-3.9.6\bin\mvn.cmd -f .\score-manager\pom.xml -DskipTests clean package
```

产物路径：

- `score-manager/target/score-manager-0.0.1-SNAPSHOT.jar`

## 2. 准备生产环境配置（推荐用 .env）

在服务器上创建运行目录（示例 `/opt/score-manager`），把 Jar 和 `.env` 放在同一目录：

```
/opt/score-manager/
  score-manager.jar
  .env
  uploads/   （可选：用于上传文件持久化）
```

`.env` 参考模板见本仓库 `.env.example`。至少需要配置：

- `PORT`
- `MYSQL_URL`
- `MYSQL_USERNAME`
- `MYSQL_PASSWORD`

说明：

- 程序启动时会自动读取 Jar 同级目录（或其父目录）中的 `.env` 并注入为系统属性。
- 如果你想强制指定 `.env` 所在目录，可在启动时加：`-DENV_DIR=/opt/score-manager`

## 3. 上传到服务器

示例（从本地把 Jar 上传到服务器）：

```bash
scp score-manager/target/score-manager-0.0.1-SNAPSHOT.jar user@your-server:/opt/score-manager/score-manager.jar
scp .env.example user@your-server:/opt/score-manager/.env
```

## 4. 一键启动

在服务器运行目录执行：

```bash
cd /opt/score-manager
mkdir -p uploads
nohup java -DENV_DIR=/opt/score-manager -jar score-manager.jar > app.log 2>&1 &
```

访问：

- `http://<服务器IP>:<PORT>/login`

默认账号：

- 管理员：`admin / 123456`

## 5. 查看日志 / 停止

```bash
tail -f app.log
```

停止（找到进程并杀掉）：

```bash
ps -ef | grep score-manager.jar
kill <pid>
```

## 6. 升级发布

```bash
cd /opt/score-manager
kill <pid>
mv score-manager.jar score-manager.jar.bak
cp /path/to/new/score-manager.jar ./score-manager.jar
nohup java -DENV_DIR=/opt/score-manager -jar score-manager.jar > app.log 2>&1 &
```

