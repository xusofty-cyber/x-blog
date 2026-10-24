#!/usr/bin/env bash
# nginx-switch.sh — 把 blog.ulife.vip 这一个站点的根路径从静态占位页切换为反向代理到博客容器。
# 使用方式（服务器上，以 root/sudo 执行一次）：  sudo bash deploy/nginx-switch.sh
#
# 安全纪律：
# - 只编辑包含 server_name blog.ulife.vip 的那一个站点配置文件，listen/SSL 证书行一律不动
# - 修改前自动备份（/etc/nginx/backups/），nginx -t 不通过则自动还原、绝不 reload
# - 使用 reload（优雅重载，不断开既有连接、不停任何服务）
# - 幂等：已切换过则直接退出
set -euo pipefail

DOMAIN="blog.ulife.vip"
UPSTREAM="http://127.0.0.1:13100"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: please run with sudo/root" >&2
  exit 1
fi

# 定位 blog 站点配置（必须唯一命中）
mapfile -t CANDIDATES < <(grep -rl "server_name[[:space:]].*${DOMAIN}" /etc/nginx/sites-enabled/ /etc/nginx/sites-available/ /etc/nginx/conf.d/ 2>/dev/null | sort -u)
# sites-enabled 常为软链，与 sites-available 指向同一文件时按真实路径去重
REAL=()
for f in "${CANDIDATES[@]}"; do
  rp="$(readlink -f "$f")"
  skip=0
  for r in "${REAL[@]:-}"; do [ "$r" = "$rp" ] && skip=1; done
  [ "$skip" -eq 0 ] && REAL+=("$rp")
done
if [ "${#REAL[@]}" -ne 1 ]; then
  echo "ERROR: expected exactly 1 config file for ${DOMAIN}, found ${#REAL[@]}:" >&2
  printf '  %s\n' "${REAL[@]:-none}" >&2
  echo "Aborting without changes." >&2
  exit 1
fi
CONF="${REAL[0]}"
echo "Target config: $CONF"

if grep -q "proxy_pass ${UPSTREAM}" "$CONF"; then
  echo "Already proxied to ${UPSTREAM}; nothing to do."
  exit 0
fi

# 容器健康检查（切换前必须先确认博客在本机端口可用）
if ! curl -fsS -o /dev/null "http://127.0.0.1:13100/"; then
  echo "ERROR: blog web container not responding on 127.0.0.1:13100; deploy containers first." >&2
  exit 1
fi

mkdir -p /etc/nginx/backups
BACKUP="/etc/nginx/backups/blog-$(date +%Y%m%d-%H%M%S).conf"
cp -a "$CONF" "$BACKUP"
echo "Backup saved: $BACKUP"

# 在 blog 的 server 块内把 location / 的内容替换为反向代理（无 location / 时插入），其余配置不动
python3 - "$CONF" "$UPSTREAM" <<'PYEOF'
import re, sys
path, upstream = sys.argv[1], sys.argv[2]
src = open(path, encoding="utf-8").read()

proxy_block = (
    "location / {\n"
    f"        proxy_pass {upstream};\n"
    "        proxy_http_version 1.1;\n"
    "        proxy_set_header Host $host;\n"
    "        proxy_set_header X-Real-IP $remote_addr;\n"
    "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
    "        proxy_set_header X-Forwarded-Proto $scheme;\n"
    "        proxy_set_header Upgrade $http_upgrade;\n"
    '        proxy_set_header Connection "upgrade";\n'
    "    }"
)

def find_block(text, start):
    """return (block_start, block_end_exclusive) for the brace block whose '{' is at/after start"""
    i = text.index("{", start)
    depth = 0
    for j in range(i, len(text)):
        if text[j] == "{": depth += 1
        elif text[j] == "}":
            depth -= 1
            if depth == 0:
                return start, j + 1
    raise ValueError("unbalanced braces")

# 找到 blog 的 HTTPS server 块（必须同时含 server_name 与 listen 443，
# 避免误改同文件里的 80 端口 301 跳转块）
m = None
for cand in re.finditer(r"server\s*\{", src):
    s, e = find_block(src, cand.start())
    blk = src[s:e]
    if "blog.ulife.vip" in blk and "server_name" in blk and re.search(r"listen\s+443", blk):
        m = (s, e)
        break
if not m:
    sys.exit("ERROR: server block for blog.ulife.vip not found")
s, e = m
block = src[s:e]

loc = re.search(r"location\s+/\s*\{", block)
if loc:
    ls, le = find_block(block, loc.start())
    block = block[:ls] + proxy_block + block[le:]
else:
    # 在 server 块结束大括号前插入
    block = block[: block.rfind("}")] + "    " + proxy_block + "\n}"
if "client_max_body_size" not in block:
    block = block.replace("server_name", "client_max_body_size 20m;\n    server_name", 1)
open(path, "w", encoding="utf-8").write(src[:s] + block + src[e:])
print("config rewritten")
PYEOF

if ! nginx -t; then
  echo "ERROR: nginx -t failed; restoring backup" >&2
  cp -a "$BACKUP" "$CONF"
  nginx -t
  exit 1
fi

systemctl reload nginx
echo "nginx reloaded. Verifying https://${DOMAIN}/ ..."
sleep 1
curl -fsS -o /dev/null -w "blog https status: %{http_code}\n" "https://${DOMAIN}/" || {
  echo "WARN: verification curl failed; config kept (backup at $BACKUP)" >&2
  exit 1
}
echo "Done: ${DOMAIN} now proxies to ${UPSTREAM} (backup: $BACKUP)"
