#!/bin/bash

while true; do
	node server.js;
	echo Crashed again `date` >> crash.log;
	sleep 10;
done

