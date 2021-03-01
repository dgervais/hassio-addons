#!/usr/bin/with-contenv bashio

CONFIG_PATH=/data/options.json
if [ ! -f $CONFIG_PATH ]; then
    # use local options.json for on-box testing
    CONFIG_PATH=./options.json
fi

export RING_REFRESH_TOKEN=$(jq --raw-output ".token" $CONFIG_PATH)

echo "starting application on `date`..."
if [ -f /data/options.json ]; then
    # run recorder from /data directory when deployed
    node /recorder.js
else
    # use local recorder.js for on-box testing
    node recorder.js
fi