#!/bin/sh
set -eu

DOMAIN="${QLTB_DOMAIN:-}"
EMAIL="${LETSENCRYPT_EMAIL:-}"
WEBROOT="/var/www/certbot"
SLEEP_SECONDS="${CERTBOT_RENEW_INTERVAL_SECONDS:-43200}"
NGINX_SELECT_SCRIPT="/opt/qltb/nginx-select-template.sh"

if [ -z "${DOMAIN}" ] || [ -z "${EMAIL}" ]; then
    echo "[certbot] QLTB_DOMAIN or LETSENCRYPT_EMAIL is missing. Sleeping..."
    tail -f /dev/null
fi

mkdir -p "${WEBROOT}"

while true; do
    STAGING_ARG=""
    if [ "${LETSENCRYPT_STAGING:-false}" = "true" ]; then
        STAGING_ARG="--staging"
    fi

    if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
        echo "[certbot] Requesting initial certificate for ${DOMAIN}"
        certbot certonly --webroot -w "${WEBROOT}" -d "${DOMAIN}" --email "${EMAIL}" --agree-tos --non-interactive ${STAGING_ARG}
        sh "${NGINX_SELECT_SCRIPT}" || true
        kill -HUP 1 || true
    else
        echo "[certbot] Renewing certificate for ${DOMAIN}"
        certbot renew --webroot -w "${WEBROOT}" --non-interactive --quiet --deploy-hook "sh ${NGINX_SELECT_SCRIPT}; kill -HUP 1"
    fi

    sleep "${SLEEP_SECONDS}"
done
