#!/bin/bash

OUTPUT="$(nvidia-smi)"

if [ $? -eq 0 ]; then
    if echo "${OUTPUT}" | grep -qi "FAIL\|ERR"; then
        echo "GPU Health Check Failed: An error was found in the nvidia-smi output."
        echo "GPU Status:"
        echo "${OUTPUT}"
        exit 1
    else
        echo "GPU Health Check Passed."
        echo "GPU Status:"
        echo "${OUTPUT}"
        exit 0
    fi
else
    echo "GPU Health Check Failed: The nvidia-smi command did not run successfully."
    exit 1
fi