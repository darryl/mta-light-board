# MTA Light Board

Getting to know the MTA's GTFS realtime schedule info

![screenshot](./screenshot.png)

## Setup

```
npm install
node server.js
```

hit localhost:3000 in a browser

## Configuration
Set the following in a .env file or as environment variables:

  * `MTA_KEY` your MTA API KEY (get your own api key at http://datamine.mta.info/user/register )
  * `PORT` Listen port (default 3000)
  * `UPDATE_INTERVAL` how frequently you want to hit the mta servers in seconds

.env file example:

    MTA_KEY=xXx_mY-sWEET-mta-kEY_xXx
    PORT=3000
    UPDATE_INTERVAL=5

borrowed heavily from https://github.com/mroth/mta2json
