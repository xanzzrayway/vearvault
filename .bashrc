
start() {
  local SESSION="oxy"
  local DIR="$HOME/oxy-server"

  if tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux send-keys -t "$SESSION" "cd $DIR && ./start.sh" C-m
    tmux attach -t "$SESSION"
  else
    tmux new-session -d -s "$SESSION" -c "$DIR"
    tmux send-keys -t "$SESSION" "./start.sh" C-m
    tmux attach -t "$SESSION"
  fi
}

