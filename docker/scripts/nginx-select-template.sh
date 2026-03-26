#!/bin/sh
set -eu

DOMAIN="${QLTB_DOMAIN:-}"
CONF_OUT="/etc/nginx/conf.d/default.conf"
TEMPLATE_DIR="/opt/qltb/templates"

if [ -z "${DOMAIN}" ]; then
    echo "[nginx-init] QLTB_DOMAIN is empty. Falling back to localhost template."
    DOMAIN="localhost"
fi

CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

if [ -f "${CERT_PATH}" ]; then
    TEMPLATE="${TEMPLATE_DIR}/qltb-https.conf.template"
    echo "[nginx-init] HTTPS template enabled for domain: ${DOMAIN}"
else
    TEMPLATE="${TEMPLATE_DIR}/qltb-http-only.conf.template"
    echo "[nginx-init] HTTP-only template enabled (certificate not found for ${DOMAIN})"
fi

sed "s|__QLTB_DOMAIN__|${DOMAIN}|g" "${TEMPLATE}" > "${CONF_OUT}"
