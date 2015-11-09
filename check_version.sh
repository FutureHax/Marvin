base="/tmp/monitor.base"
dir_to_monitor="/Library/Server/Web/Data/Sites/marvin.boldlygoingnowhere.org/marvin_android/"
check="/tmp/status_now"
if [ ! -e $base ] ;then
    find "$dir_to_monitor" |sort > $base
fi
# check 
find $dir_to_monitor | sort > $check
#if there's difference, then there's change.
DIFF=$(diff $base $check)
if [ "$DIFF" != "" ] 
then
    echo "The directory was modified"
    find "$dir_to_monitor" |sort > $base
fi 

