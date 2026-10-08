#!/bin/sh
# Explicit manual deployment. Only custom footer/assets change; no DB/config edits.
set -eu
umask 077
BASE=$1
CONTAINER=$2
ARCHIVE=$3
EXPECTED=$4
DOCKER=/usr/local/bin/docker
[ "$(readlink -f "$BASE")" = "$BASE" ]
[ -f "$BASE/conf/app.ini" ]
[ "$(sha256sum "$ARCHIVE" | cut -d ' ' -f 1)" = "$EXPECTED" ]
[ "$("$DOCKER" inspect --format '{{.State.Running}}' "$CONTAINER")" = true ]
"$DOCKER" exec -u git "$CONTAINER" gitea embedded view templates/base/head_script.tmpl | grep -q CspScriptNonce
"$DOCKER" exec -u git "$CONTAINER" gitea embedded view templates/base/head_navbar.tmpl | grep -q IsSigned
BACKUP="$(dirname "$BASE")/ui-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/stage"
tar -xzf "$ARCHIVE" -C "$BACKUP/stage"
[ -f "$BACKUP/stage/templates/custom/footer.tmpl" ]
[ -f "$BACKUP/stage/public/assets/last-comment/site.js" ]
FOOTER="$BASE/templates/custom/footer.tmpl"
ASSETS="$BASE/public/assets/last-comment"
if [ -e "$FOOTER" ]; then cp "$FOOTER" "$BACKUP/original-footer.tmpl"; fi
if [ -e "$ASSETS" ]; then cp -R "$ASSETS" "$BACKUP/original-assets"; fi
OWNER=$(stat -c '%u:%g' "$BASE")
changed=0
restore() {
    if [ -d "$ASSETS" ]; then mv "$ASSETS" "$BACKUP/failed-assets"; fi
    if [ -d "$BACKUP/original-assets" ]; then cp -R "$BACKUP/original-assets" "$ASSETS"; fi
    if [ -f "$BACKUP/original-footer.tmpl" ]; then cp "$BACKUP/original-footer.tmpl" "$FOOTER"; else rm -f "$FOOTER"; fi
    if [ -e "$FOOTER" ]; then chown "$OWNER" "$FOOTER"; chmod 644 "$FOOTER"; fi
    "$DOCKER" restart --time 10 "$CONTAINER"
}
trap 'result=$?; if [ "$result" != 0 ] && [ "$changed" = 1 ]; then echo UI_APPLY_FAILED_RESTORING; restore; fi' EXIT
mkdir -p "$BASE/templates/custom" "$BASE/public/assets"
chmod 755 "$BASE/templates" "$BASE/templates/custom" "$BASE/public" "$BASE/public/assets"
changed=1
if [ -e "$ASSETS" ]; then mv "$ASSETS" "$BACKUP/replaced-assets"; fi
cp -R "$BACKUP/stage/public/assets/last-comment" "$ASSETS"
find "$ASSETS" -type d -exec chmod 755 {} \;
find "$ASSETS" -type f -exec chmod 644 {} \;
chown -R "$OWNER" "$ASSETS"
if [ -e "$FOOTER" ] && grep -q '/assets/last-comment/site.js' "$FOOTER"; then
    [ "$(grep -c '/assets/last-comment/site.js' "$FOOTER")" = 1 ]
    # Replace only our generated one-line include. Refuse unfamiliar edits.
    awk '
        /\/assets\/last-comment\/site.js/ {
            if (index($0, "{{if .IsSigned}}<script nonce=\"{{ctx.CspScriptNonce}}\" src=\"{{AppSubUrl}}/assets/last-comment/site.js?v=") != 1 || $0 !~ /data-lc-base="{{AppSubUrl}}" defer><\/script>{{end}}$/) exit 1;
            next;
        }
        { print }
    ' "$FOOTER" > "$BACKUP/preserved-footer.tmpl"
    cp "$BACKUP/preserved-footer.tmpl" "$FOOTER"
fi
cat "$BACKUP/stage/templates/custom/footer.tmpl" >> "$FOOTER"
chown "$OWNER" "$FOOTER"
chmod 644 "$FOOTER"
cp "$FOOTER" "$BACKUP/installed-footer.tmpl"
printf 'backup=%s\n' "$BACKUP"
start=$(date +%s)
printf 'restart_start=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
"$DOCKER" restart --time 10 "$CONTAINER"
attempt=0
while ! "$DOCKER" exec -u git "$CONTAINER" wget -qO- -T 3 http://127.0.0.1:3000/ >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    [ "$attempt" -lt 30 ]
    sleep 1
done
printf 'restart_ready_seconds=%s\n' "$(($(date +%s) - start))"
"$DOCKER" inspect --format 'running={{.State.Running}} started={{.State.StartedAt}}' "$CONTAINER"
printf 'UI_APPLY_DONE\n'
changed=0
