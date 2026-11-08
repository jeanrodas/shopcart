#!/usr/bin/env bash
# Verifica que NO haya menciones de IA en el proyecto:
#   - Texto: docs, codigo (TS/TSX/JS/MJS), SQL, JSON, YAML, CSS, Markdown.
#   - Binarios: metadatos C2PA/XMP/JUMBF ("Generative AI") en las imagenes de
#     web/public/img y api/uploads.
# Exit 0 si todo limpio; 1 si encuentra algo. Uso: bash scripts/verificar-menciones.sh
set -u
cd "$(dirname "$0")/.." || exit 2
fail=0
EXCL='node_modules|package-lock\.json|/dist/|web/public/img|api/uploads|scripts/verificar-menciones'

echo "== Texto: terminos de IA =="
# Palabras completas (insensible a mayusculas) + acronimos IA/AI (sensible a mayusculas).
T1=$(grep -rniE '\b(claude|anthropic|chatgpt|openai|copilot|gemini|llm|inteligencia artificial|generative ai|genai)\b|gener(ado|ada|ated) (con|por|with|by) ' \
  --include='*.md' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
  --include='*.sql' --include='*.json' --include='*.yml' --include='*.yaml' --include='*.css' \
  README.md docs web api db deploy scripts 2>/dev/null | grep -vE "$EXCL")
T2=$(grep -rnE '\b(IA|AI)\b' \
  --include='*.md' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
  --include='*.sql' --include='*.json' --include='*.yml' --include='*.yaml' --include='*.css' \
  README.md docs web api db deploy scripts 2>/dev/null | grep -vE "$EXCL")
TXT="$T1$T2"
if [ -n "$TXT" ]; then printf '%s\n' "$T1" "$T2" | grep -vE '^$'; fail=1; else echo "ok (0)"; fi

echo "== Binarios: metadatos de IA en imagenes =="
BIN=$(grep -railE 'c2pa|jumb|generative|genai|trainedalgorithmicmedia|xmp' web/public/img api/uploads 2>/dev/null)
if [ -n "$BIN" ]; then printf '%s\n' "$BIN"; fail=1; else echo "ok (0)"; fi

if [ "$fail" -eq 0 ]; then echo "RESULTADO: limpio"; else echo "RESULTADO: hay menciones"; fi
exit "$fail"
