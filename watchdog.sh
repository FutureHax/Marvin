PID_FILE="/var/www/bluetooth_server/pid/app.pid"

pid_file_exists() {
    [ -f "$PID_FILE" ]
}

get_pid() {
    echo "$(cat "$PID_FILE")"
}

is_running() {
    PID=$(get_pid)
    ! [ -z "$(ps aux | awk '{print $2}' | grep "^$PID$")" ]
}

if pid_file_exists
    then
        if is_running
        then
            PID=$(get_pid)
            echo "Node app running with pid $PID"
        else
            echo "Node app stopped, but pid file exists"
            pushd /var/www/bluetooth_server/ ; ./startup.sh start --force ; popd
        fi
    else
        echo "Node app stopped"
        pushd /var/www/bluetooth_server/ ; ./startup.sh start ; popd
    fi
