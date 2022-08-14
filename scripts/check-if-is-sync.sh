if [[ `git status --porcelain` ]]; then
  echo "🔴 Commit you changes before publish 🔴\n"
  exit 1
else
  exit 0
fi
