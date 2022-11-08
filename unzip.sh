#!/bin/sh

for z in 'data/*.zip'; do unzip "$z" -d unzip_data/ ; done
