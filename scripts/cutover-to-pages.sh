#!/bin/sh
# One-time switch of huttese.benrichardson.dev from the old Cloudflare Worker to GitHub Pages.
# Run only after the "Deploy to GitHub Pages" workflow has succeeded in ben-gy/huttese.
# Needs: wrangler logged in (it is, via OAuth) and a Cloudflare API token with Zone → DNS → Edit on benrichardson.dev,
# which you paste at the prompt (it is not stored or echoed).
set -eu
export PATH="/Users/benrichardson/.nvm/versions/node/v24.21.0/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")/.."

echo "Checking the Pages deploy exists…"
code=$(curl -s -o /dev/null -w '%{http_code}' https://ben-gy.github.io/huttese/)
case "$code" in 200|301|302) echo "  Pages is serving ($code)";; *) echo "  Pages isn't serving yet ($code) – wait for the workflow, then re-run."; exit 1;; esac

printf 'Paste a Cloudflare API token with DNS:Edit on benrichardson.dev: '
stty -echo; read -r CF_TOKEN; stty echo; echo
ZONE=bf71cf2904d22db3443bb471e5dbdde2
api() { curl -s -H "Authorization: Bearer $CF_TOKEN" -H 'Content-Type: application/json' "$@"; }
api "https://api.cloudflare.com/client/v4/zones/$ZONE" | grep -q '"success":true' || { echo "Token can't read the zone – check its permissions."; exit 1; }

echo "Removing the old Worker (this also removes its custom-domain DNS record)…"
npx wrangler delete --name huttese --force

echo "Creating CNAME huttese → ben-gy.github.io (DNS only)…"
api -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records" \
  --data '{"type":"CNAME","name":"huttese","content":"ben-gy.github.io","proxied":false,"ttl":1}' | grep -q '"success":true' \
  && echo "  done" || { echo "  CNAME creation failed – add it by hand in the Cloudflare dashboard."; exit 1; }

echo "Re-registering the custom domain on GitHub so it issues a certificate…"
gh api -X PUT repos/ben-gy/huttese/pages -F cname=null --silent
gh api -X PUT repos/ben-gy/huttese/pages -f cname=huttese.benrichardson.dev --silent
echo "All set. The certificate takes a few minutes; then tell Claude to turn on 'Enforce HTTPS' and verify."
