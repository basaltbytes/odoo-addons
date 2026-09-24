#!/bin/sh
# Union merge driver for gettext PO/POT files, wired up by .gitattributes.
# Git invokes it as: git-merge-po.sh %O %A %B %P
#   %O = base ancestor, %A = ours (the result must be written here),
#   %B = theirs, %P = the real pathname being merged.
# Exit 0 => conflict resolved into %A; non-zero => leave it for a manual merge.
ours="$2"
theirs="$3"
path="$4"

if ! command -v msgcat >/dev/null 2>&1; then
  echo "git-merge-po: msgcat (gettext) not found; leaving '$path' for manual merge" >&2
  exit 1
fi

merged="$ours.po-merged"
# --use-first keeps the current branch's translation for shared msgids and folds in
# every entry unique to the incoming side, so no new translation is lost. po-pretty
# normalisation (oca-checks-po --fix / pnpm run i18n:format) runs afterwards.
if msgcat --use-first "$ours" "$theirs" -o "$merged" 2>/dev/null; then
  mv "$merged" "$ours"
  exit 0
fi

rm -f "$merged"
echo "git-merge-po: msgcat could not union '$path'; leaving it for manual merge" >&2
exit 1
