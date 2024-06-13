var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

require('dotenv').config()

const MTA_KEY     = process.env.MTA_KEY;
const PORT        = process.env.PORT || 3000;
const URL         = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l";
const UPDATE_INTERVAL = process.env.UPDATE_INTERVAL || 60*5; // retrieve from MTA every X seconds
const http = require("https"); // used to connect to mta

const http2 = require('http');
const server = http2.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

server.listen(PORT, () => {
  console.log(`MTA Light Board app listening on port ${PORT}`)
})

const DEBUG = 0; // debug level

// socket.io callback for new connections from browsers
io.on('connection', function(socket){
  console.log('a user connected');
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
  socket.emit('feed update', currentStops);
});

module.exports = app;

var p = function(str, debugLevel = 1){
  if (debugLevel <= DEBUG) console.log(str);
}

function dumpEnt(obj){
  if(obj){
    p('dumpEnt for obj with keys: ' + Object.getOwnPropertyNames(obj))
    for (const [key, value] of Object.entries(obj)) {
      console.log(`${key}: ${value}`);
    }
    p('end dumpEnt')}
  else {
    console.log('null or undefined obj')
  }
}

var ProtoBuf = require("protobufjs");
var decoder
ProtoBuf.load("proto-files/nyct-subway.proto", function(err, root) {
  if (err) throw err;
  decoder = root.lookupType("transit_realtime.FeedMessage");
});

var mtaFeed = 'init';
var currentStops = [];

// get data from mta
var updateFeed = function(){
  try {
    http.get(URL, {'headers' : {'x-api-key' : MTA_KEY}}, function(res) {
      var data;
      data = [];
      res.on("data", function(chunk) {
        return data.push(chunk);
      });
      res.on("end", function() {
        data = Buffer.concat(data);
        mtaFeed = decoder.decode(data);
        p('from mta data ' + Object.getOwnPropertyNames( mtaFeed ), 2);
      });
    });
  }catch (e) {
    // Intermittant network problems (DNS, Connection reset)
    // if (e === ENOTFOUND || e === ECONNRESET) {
    //   p('API connection problem for ' + URL);
      console.error(e.name);
      console.error(e.message);
    // } else {
    //   p('Error: ')
    //   console.error(e.name);
    //   console.error(e.message);
    // }
  } 
}

updateFeed();

// return the closest stop to each train in an array
trainPositions = function(fullFeed){
  var nowish = Date.now() / 1000; // turn milliseconds into seconds
  var shortFeed = [];
  p('full feed entity length: ' + fullFeed.entity.length, 3 )
  for (i = 0; i < fullFeed.entity.length; i+= 1){
    // each trip
    trip = fullFeed.entity[i].tripUpdate;
    if (typeof trip != 'undefined' && trip != null){
      if (trip.stopTimeUpdate != null){
        train = trip.trip['.nyctTripDescriptor'].trainId;
        // direction enum NORTH = 1 EAST = 2 SOUTH = 3 WEST = 4
        direction = trip.trip['.nyctTripDescriptor'].direction;
        p('Parsing Train: ' + train + ' Direction: ' + {1: 'NORTH', 2: 'EAST', 3: 'SOUTH', 4: 'WEST'}[direction], 1);

        var previousTimeDifference = nowish;
        var previousStation = null;
        // each stop
        for (j = 0; j < trip.stopTimeUpdate.length; j+=1){
          station = trip.stopTimeUpdate[j];
          if (station.arrival) {
            timeFromArrival = Math.abs(nowish - station.arrival.time);
          } else {
            timeFromArrival = nowish;
          }
          if (station.departure) {
            timeFromDeparture = Math.abs(nowish - station.departure.time);
          } else {
            timeFromDeparture = nowish;
          }

          time = Math.min(timeFromArrival, timeFromDeparture);
          if (previousTimeDifference > time){   // getting closer to train
            previousTimeDifference = time;
            previousStation = station.stopId;
          } else if (previousTimeDifference <= time) { // missed the train
            shortFeed.push(previousStation);
            p('Found Stop: ' + previousStation, 2);
            break;
          }
          // shortFeed.push(station.stop_id); // train is at last stop
        }
      }
    }
  }
  p('shortFeed: ' + shortFeed, 1);
  return shortFeed;
}

// socket.io callback for new connections from browsers
io.on('connection', function(socket){
  console.log('a user connected');
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
  socket.emit('feed update', currentStops);
});


// emit to all connected browsers
// parse a fresh gtfs-realtime from mta
// sleep UPDATE_INTERVAL seconds
setInterval(function(){
  updateFeed();
} , UPDATE_INTERVAL * 1000);

// I broke these up so we don't have to hit mta _every_ time we update
// current trains
setInterval(function(){
  currentStops = trainPositions(mtaFeed);
  p(currentStops)
  io.emit('feed update', currentStops);
} , 5 * 1000);

