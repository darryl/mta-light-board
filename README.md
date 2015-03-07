# mta board

## setup

```
npm install
node server.js
```
hit localhost:3001 in a browser

## Configuration
Set the following as environment variables:

  * `MTA_KEY` your MTA API KEY
  * `PORT` if you wish to override the default port we listen on (3000)
  * `UPDATE_INTERVAL` how frequently you want to hammer the mta servers in seconds
`Dotenv.load()` is automatic so we'll source these from a standard `.env` file if it exists.

borrowed heavily from https://github.com/mroth/mta2json
