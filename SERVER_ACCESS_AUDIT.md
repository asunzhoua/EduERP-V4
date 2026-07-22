# 外贸网站服务器 SSH 入口审计报告

## 日期：2026-07-21
## Mission：EOS-CORE-INIT-2026-0721

## 1. 服务器入口信息
- IP 地址：154.9.226.175:22
- 域名：www.lintalltruckparts.com
- SSH 用户：root
- 认证方式：密码认证

## 2. SSH 连接状态
- 连接结果：PASS
- 错误信息（如有）：无

## 3. 服务器环境
- 操作系统：Ubuntu 22.04.5 LTS
- 内核版本：Linux ecslWGJq 5.15.0-30-generic #31-Ubuntu SMP Thu May 5 10:00:34 UTC 2022 x86_64 x86_64 x86_64 GNU/Linux
- 运行时间：21:30:51 up 7 days, 11:57,  0 users,  load average: 0.00, 0.00, 0.00
- CPU：4 核
- 内存：总量 3.8Gi / 可用 2.7Gi
- 磁盘：/dev/vda1        20G  6.2G   14G  32% /

## 4. Docker 运行状态
- Docker 是否安装：否
- 运行中容器：N/A
- 已停止容器：N/A
- 可用镜像：N/A

## 5. 已部署项目
- 网站根目录：/data/www/dhtruckparts-laravel/
- Nginx 配置：配置有效
- PHP 版本：PHP 8.3.32 (cli) (built: Jul  2 2026 18:09:42) (NTS)
- MySQL 版本：mysql  Ver 8.0.46-0ubuntu0.22.04.3 for Linux on x86_64 ((Ubuntu))
- 运行中服务：见下方端口列表

## 6. 网络安全
- 监听端口列表：
```
LISTEN 0      4096   127.0.0.53%lo:53         0.0.0.0:*    users:(("systemd-resolve",pid=14780,fd=14))
LISTEN 0      128          0.0.0.0:22         0.0.0.0:*    users:(("sshd",pid=77757,fd=3))
LISTEN 0      70         127.0.0.1:33060      0.0.0.0:*    users:(("mysqld",pid=51673,fd=21))
LISTEN 0      151        127.0.0.1:3306       0.0.0.0:*    users:(("mysqld",pid=51673,fd=23))
LISTEN 0      511        127.0.0.1:6379       0.0.0.0:*    users:(("redis-server",pid=52252,fd=6))
LISTEN 0      511          0.0.0.0:80         0.0.0.0:*    users:(("nginx",pid=74648,fd=6),("nginx",pid=74647,fd=6),("nginx",pid=74646,fd=6),("nginx",pid=74645,fd=6),("nginx",pid=50714,fd=6))
LISTEN 0      128             [::]:22            [::]:*    users:(("sshd",pid=77757,fd=4))
```
- SSH 配置：
```
port 22
addressfamily any
permitrootlogin yes
passwordauthentication yes
gatewayports no
```

## 7. 后续部署 AI Gateway 可行性评估
- 资源余量：参见磁盘和内存数据
- 风险提示：本报告仅为信息采集，未经人工审核前不构成部署依据
- 建议：根据资源使用情况和项目配置综合评估

## 8. 执行证据
- 连接方式：SSH over HTTP Proxy (connect.exe -H 127.0.0.1:7890)
- 执行的命令列表：共 21 条命令
- 原始输出摘要：见下方各命令输出

---

## 附录：各命令原始输出

### 1. 系统版本 (os-release)
```bash
# cat /etc/os-release 2>/dev/null || cat /etc/*release 2>/dev/null
PRETTY_NAME="Ubuntu 22.04.5 LTS"
NAME="Ubuntu"
VERSION_ID="22.04"
VERSION="22.04.5 LTS (Jammy Jellyfish)"
VERSION_CODENAME=jammy
ID=ubuntu
ID_LIKE=debian
HOME_URL="https://www.ubuntu.com/"
SUPPORT_URL="https://help.ubuntu.com/"
BUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/"
PRIVACY_POLICY_URL="https://www.ubuntu.com/legal/terms-and-policies/privacy-policy"
UBUNTU_CODENAME=jammy
```

### 2. 内核版本
```bash
# uname -a
Linux ecslWGJq 5.15.0-30-generic #31-Ubuntu SMP Thu May 5 10:00:34 UTC 2022 x86_64 x86_64 x86_64 GNU/Linux
```

### 3. 运行时间
```bash
# uptime
21:30:51 up 7 days, 11:57,  0 users,  load average: 0.00, 0.00, 0.00
```

### 4. SSH 配置
```bash
# sshd -T 2>/dev/null | grep -iE "port|addressfamily|permitrootlogin|passwordauthentication"
port 22
addressfamily any
permitrootlogin yes
passwordauthentication yes
gatewayports no
```

### 5. SSH 服务状态
```bash
# systemctl status sshd 2>/dev/null | head -20
● ssh.service - OpenBSD Secure Shell server
     Loaded: loaded (/lib/systemd/system/ssh.service; enabled; vendor preset: enabled)
     Active: active (running) since Tue 2026-07-14 06:04:52 UTC; 6 days ago
       Docs: man:sshd(8)
             man:sshd_config(5)
   Main PID: 77757 (sshd)
      Tasks: 5 (limit: 4664)
     Memory: 24.0M
        CPU: 5min 34.778s
     CGroup: /system.slice/ssh.service
             ├─ 77757 "sshd: /usr/sbin/sshd -D [listener] 2 of 10-100 startups"
             ├─165636 "sshd: root [priv]" "" "" ""
             ├─165637 "sshd: root [net]" "" "" "" ""
             ├─165719 "sshd: [accepted]" "" "" "" ""
             └─165720 "sshd: [net]" "" "" "" "" "" "" "" "" ""

Jul 20 21:29:59 ecslWGJq sshd[165532]: pam_unix(sshd:auth): authentication failure; logname= uid=0 euid=0 tty=ssh ruser= rhost=103.163.116.209
Jul 20 21:30:01 ecslWGJq sshd[165532]: Failed password for invalid user wes from 103.163.116.209 port 47182 ssh2
Jul 20 21:30:02 ecslWGJq sshd[165532]: Received disconnect from 103.163.116.209 port 47182:11: Bye Bye [preauth]
Jul 20 21:30:02 ecslWGJq sshd[165532]: Disconnected from invalid user wes 103.163.116.209 port 47182 [preauth]
```

### 6. Docker 信息
```bash
# docker info 2>/dev/null | head -20

```

### 7. Docker 容器
```bash
# docker ps -a 2>/dev/null

```

### 8. Docker 镜像
```bash
# docker images 2>/dev/null

```

### 9. 磁盘使用
```bash
# df -h 2>/dev/null
Filesystem      Size  Used Avail Use% Mounted on
tmpfs           393M  1.1M  392M   1% /run
/dev/vda1        20G  6.2G   14G  32% /
tmpfs           2.0G     0  2.0G   0% /dev/shm
tmpfs           5.0M     0  5.0M   0% /run/lock
/dev/vda15      105M  6.1M   99M   6% /boot/efi
/dev/vdb1        49G  248M   47G   1% /data
tmpfs           393M  4.0K  393M   1% /run/user/0
```

### 10. 内存使用
```bash
# free -h 2>/dev/null
total        used        free      shared  buff/cache   available
Mem:           3.8Gi       854Mi       210Mi        24Mi       2.8Gi       2.7Gi
Swap:          2.0Gi       1.0Mi       2.0Gi
```

### 11. CPU 核心数
```bash
# nproc 2>/dev/null
4
```

### 12. CPU 信息
```bash
# cat /proc/cpuinfo 2>/dev/null | head -20
processor	: 0
vendor_id	: AuthenticAMD
cpu family	: 23
model		: 49
model name	: AMD EPYC 7K62 48-Core Processor
stepping	: 0
microcode	: 0x830107b
cpu MHz		: 2595.124
cache size	: 512 KB
physical id	: 0
siblings	: 4
core id		: 0
cpu cores	: 4
apicid		: 0
initial apicid	: 0
fpu		: yes
fpu_exception	: yes
cpuid level	: 16
wp		: yes
flags		: fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush mmx fxsr sse sse2 ht syscall nx mmxext fxsr_opt pdpe1gb rdtscp lm rep_good nopl cpuid extd_apicid tsc_known_freq pni pclmulqdq ssse3 fma cx16 sse4_1 sse4_2 x2apic movbe popcnt tsc_deadline_timer aes xsave avx f16c rdrand hypervisor lahf_lm cmp_legacy svm cr8_legacy abm sse4a misalignsse 3dnowprefetch osvw perfctr_core ssbd ibrs ibpb stibp vmmcall fsgsbase tsc_adjust bmi1 avx2 smep bmi2 rdseed adx smap clflushopt clwb sha_ni xsaveopt xsavec xgetbv1 xsaves clzero xsaveerptr wbnoinvd arat npt lbrv nrip_save tsc_scale vmcb_clean pausefilter pfthreshold v_vmsave_vmload umip rdpid arch_capabilities
```

### 13. 网络接口
```bash
# ip addr show 2>/dev/null || ifconfig 2>/dev/null
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 brd 127.255.255.255 scope host lo
       valid_lft forever preferred_lft forever
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    link/ether 3e:22:43:00:00:82 brd ff:ff:ff:ff:ff:ff
    altname enp0s17
    altname ens17
    inet 154.9.226.175/25 brd 154.9.226.255 scope global eth0
       valid_lft forever preferred_lft forever
```

### 14. 监听端口
```bash
# ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null
State  Recv-Q Send-Q Local Address:Port  Peer Address:PortProcess                                                                                                                              
LISTEN 0      4096   127.0.0.53%lo:53         0.0.0.0:*    users:(("systemd-resolve",pid=14780,fd=14))                                                                                         
LISTEN 0      128          0.0.0.0:22         0.0.0.0:*    users:(("sshd",pid=77757,fd=3))                                                                                                     
LISTEN 0      70         127.0.0.1:33060      0.0.0.0:*    users:(("mysqld",pid=51673,fd=21))                                                                                                  
LISTEN 0      151        127.0.0.1:3306       0.0.0.0:*    users:(("mysqld",pid=51673,fd=23))                                                                                                  
LISTEN 0      511        127.0.0.1:6379       0.0.0.0:*    users:(("redis-server",pid=52252,fd=6))                                                                                             
LISTEN 0      511          0.0.0.0:80         0.0.0.0:*    users:(("nginx",pid=74648,fd=6),("nginx",pid=74647,fd=6),("nginx",pid=74646,fd=6),("nginx",pid=74645,fd=6),("nginx",pid=50714,fd=6))
LISTEN 0      128             [::]:22            [::]:*    users:(("sshd",pid=77757,fd=4))
```

### 15. Nginx 配置检查
```bash
# nginx -t 2>&1
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 16. Nginx 启用站点
```bash
# ls -la /etc/nginx/sites-enabled/ 2>/dev/null
total 8
drwxr-xr-x 2 root root 4096 Jul 13 10:50 .
drwxr-xr-x 8 root root 4096 Jul 13 20:47 ..
lrwxrwxrwx 1 root root   39 Jul 13 10:50 dhtruckparts -> /etc/nginx/sites-available/dhtruckparts
```

### 17. 网站目录列表
```bash
# ls -la /data/www/ 2>/dev/null
total 12
drwxr-xr-x  3 root root 4096 Jul 13 10:46 .
drwxr-xr-x  6 root root 4096 Jul 13 20:43 ..
drwxr-xr-x 15 root root 4096 Jul 13 12:15 dhtruckparts-laravel
```

### 18. 项目文件列表
```bash
# ls -la /data/www/dhtruckparts-laravel/ 2>/dev/null
total 508
drwxr-xr-x 15 root     root       4096 Jul 13 12:15 .
drwxr-xr-x  3 root     root       4096 Jul 13 10:46 ..
-rw-r--r--  1 root     root       1131 Jul 13 12:15 .env
-rw-r--r--  1 root     root       1054 Jul 13 10:46 .env.example
drwxr-xr-x  8 root     root       4096 Jul 13 13:54 .git
-rw-r--r--  1 root     root         40 Jul 13 10:46 .gitattributes
-rw-r--r--  1 root     root        490 Jul 13 10:46 .gitignore
-rw-r--r--  1 root     root      14299 Jul 13 10:46 BASELINE_REPORT.md
-rw-r--r--  1 root     root       2446 Jul 13 10:46 BASELINE_v1.md
-rw-r--r--  1 root     root       3229 Jul 13 10:46 COMPLETION_REPORT.md
-rw-r--r--  1 root     root       5079 Jul 13 10:46 DEPLOYMENT.md
-rw-r--r--  1 root     root       2983 Jul 13 10:46 DEPLOYMENT_GUIDE.md
-rw-r--r--  1 root     root       6473 Jul 13 10:46 DEPLOY_WINDOWS10.md
-rw-r--r--  1 root     root       3400 Jul 13 10:46 INSTALL.md
-rw-r--r--  1 root     root       9247 Jul 13 10:46 LICENSE
-rw-r--r--  1 root     root       2613 Jul 13 10:46 PRODUCTION_READY_REPORT.md
-rw-r--r--  1 root     root       4494 Jul 13 10:46 PROJECT_STATUS.md
-rw-r--r--  1 root     root       5150 Jul 13 10:46 README.md
-rw-r--r--  1 root     root       2432 Jul 13 10:46 RELEASE_NOTES.md
-rw-r--r--  1 root     root       3320 Jul 13 10:46 RISK_REGISTER.md
-rw-r--r--  1 root     root       4237 Jul 13 10:46 TASKS.md
drwxr-xr-x 13 root     root       4096 Jul 13 10:46 app
-rw-r--r--  1 root     root        987 Jul 13 10:46 artisan
drwxr-xr-x  3 root     root       4096 Jul 13 10:46 bootstrap
-rw-r--r--  1 root     root       1913 Jul 13 10:46 composer.json
-rw-r--r--  1 root     root     303492 Jul 13 10:46 composer.lock
drwxr-xr-x  2 root     root       4096 Jul 13 10:46 config
drwxr-xr-x  4 root     root       4096 Jul 13 10:46 database
drwxr-xr-x  3 root     root       4096 Jul 13 10:46 docs
-rw-r--r--  1 root     root       2004 Jul 13 10:46 install-packages.bat
drwxr-xr-x  4 root     root       4096 Jul 13 10:46 lang
drwxr-xr-x  5 root     root       4096 Jul 13 14:01 public
drwxr-xr-x  3 root     root       4096 Jul 13 10:46 resources
drwxr-xr-x  2 root     root       4096 Jul 13 10:46 routes
drwxrwxr-x  5 www-data www-data   4096 Jul 13 10:51 storage
-rw-r--r--  1 root     root       6616 Jul 13 10:46 test-mobile-dropdown-manual.html
-rw-r--r--  1 root     root       6464 Jul 13 10:46 test-mobile-dropdown.html
-rw-r--r--  1 root     root       5250 Jul 13 10:46 test-mobile-dropdown.js
drwxr-xr-x  4 root     root       4096 Jul 13 10:46 tests
drwxr-xr-x 39 root     root       4096 Jul 13 10:47 vendor
```

### 19. PHP 版本
```bash
# php -v 2>/dev/null
PHP 8.3.32 (cli) (built: Jul  2 2026 18:09:42) (NTS)
Copyright (c) The PHP Group
Zend Engine v4.3.32, Copyright (c) Zend Technologies
    with Zend OPcache v8.3.32, Copyright (c), by Zend Technologies
```

### 20. PHP 模块
```bash
# php -m 2>/dev/null | head -20
[PHP Modules]
bcmath
calendar
Core
ctype
curl
date
dom
exif
FFI
fileinfo
filter
ftp
gd
gettext
hash
iconv
igbinary
intl
json
```

### 21. MySQL 版本
```bash
# mysql --version 2>/dev/null
mysql  Ver 8.0.46-0ubuntu0.22.04.3 for Linux on x86_64 ((Ubuntu))
```

