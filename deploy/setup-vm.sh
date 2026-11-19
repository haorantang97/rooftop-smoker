#!/usr/bin/env bash
# 在云主机（Debian 12/13）上安装 / 更新「抽根烟」服务器。脚本本身也在发布包里：
#   tar -xzf smoke-break.tgz deploy/setup-vm.sh && sudo bash deploy/setup-vm.sh smoke-break.tgz [cloudflare 隧道 token]
# 做的事：
#   1. 装 Node 22（第一次）
#   2. 把发布包解到 /opt/smoke-break，装依赖（只装 ws 和 three，不装开发工具），运行数据 data/ 保留
#   3. 用 systemd 跑 node server.js（端口 8790，只听本机），挂了自动重启，开机自启
#   4. 装 cloudflared；给了隧道 token 就把隧道装成服务（也可以之后自己跑 sudo cloudflared service install <token>）。
#      Cloudflare 隧道把 https://域名 转到本机 8790，服务器不用开任何对外端口
set -euo pipefail
PKG="${1:?用法：sudo bash setup-vm.sh smoke-break.tgz [隧道token]}"
TOKEN="${2:-}"
APP=/opt/smoke-break

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  apt-get update -y && apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

id smoke >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin smoke
mkdir -p "$APP"
# 换代码不碰 data/（每天抽烟数统计）
find "$APP" -mindepth 1 -maxdepth 1 ! -name data -exec rm -rf {} +
tar -xzf "$PKG" -C "$APP"
cd "$APP" && npm ci --omit=dev --no-audit --no-fund
mkdir -p "$APP/data" && chown -R smoke:smoke "$APP"

cat >/etc/systemd/system/smoke-break.service <<'EOF'
[Unit]
Description=smoke-break game server
After=network-online.target

[Service]
User=smoke
WorkingDirectory=/opt/smoke-break
Environment=NODE_ENV=production PORT=8790 HOST=127.0.0.1
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable smoke-break >/dev/null
systemctl restart smoke-break

if ! command -v cloudflared >/dev/null; then
  mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' >/etc/apt/sources.list.d/cloudflared.list
  apt-get update -y && apt-get install -y cloudflared
fi
if [ -n "$TOKEN" ]; then
  cloudflared service uninstall >/dev/null 2>&1 || true
  cloudflared service install "$TOKEN"
fi

sleep 2
curl -fsS -o /dev/null -w "本机检查：HTTP %{http_code}\n" http://127.0.0.1:8790/ || { journalctl -u smoke-break -n 30 --no-pager; exit 1; }
echo "装好了：systemctl status smoke-break 看状态，journalctl -u smoke-break -f 看日志"
