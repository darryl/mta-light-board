var dotenv = require('dotenv');
dotenv.load();
var MTA_KEY     = process.env.MTA_KEY;
// var MTA_FEED_ID = 2; // L Train feed id
var PORT        = process.env.PORT || 3000;
var URL         = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l"

var UPDATE_INTERVAL = process.env.UPDATE_INTERVAL || 60*5;

var http = require("https");
var express = require('express');
var app = express();

server = app.listen(PORT, function() {
    console.log("Listening on port " + server.address().port + "...");
});

var io = require('socket.io')(server);

var ProtoBuf = require("protobufjs");
var builder = ProtoBuf.loadProtoFile("proto-files/nyct-subway.proto");
var decoder = builder.build("transit_realtime").FeedMessage;

var mtaFeed = 'init';
var currentStops = [];

// get data from mta
var updateFeed = function(){
    http.get(URL, {'headers' : {'x-api-key' : MTA_KEY}}, function(res) {
        var data;
        data = [];
        res.on("data", function(chunk) {
            return data.push(chunk);
        });
        res.on("end", function() {
            data = Buffer.concat(data);
            mtaFeed = decoder.decode(data);
        });
    });
}

updateFeed();

var p = function(str){ console.log(str) }

// return the closest stop to each train in an array
trainPositions = function(fullFeed){
    var nowish = Date.now() / 1000; // turn milliseconds into seconds
    var shortFeed = [];

    for (i = 0; i < fullFeed.entity.length; i+= 1){
        // each trip
        trip = fullFeed.entity[i].trip_update;
        if (typeof trip != 'undefined' && trip != null){
            if (trip.stop_time_update != null){
                
	        train = trip.trip.nyct_trip_descriptor.train_id;
                // direction enum NORTH = 1 EAST = 2 SOUTH = 3 WEST = 4
                direction = trip.trip.nyct_trip_descriptor.direction;
                
                p('Parsing Train: ' + train + ' Direction: ' + {1: 'NORTH', 2: 'EAST', 3: 'SOUTH', 4: 'WEST'}[direction]);

                var previousTimeDifference = nowish;
                var previousStation = null;
                // each stop
                for (j = 0; j < trip.stop_time_update.length; j+=1){
                    station = trip.stop_time_update[j];
                    
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
                        previousStation = station.stop_id;
                    } else if (previousTimeDifference <= time) { // missed the train
                        shortFeed.push(previousStation);
			p('Found Stop: ' + previousStation);
                        break;
                    }
                    // shortFeed.push(station.stop_id); // train is at last stop
                }
            }
        }
    }
    // p('shortFeed: ' + shortFeed) 
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

// shamelessly taken from mta2json
app.get('/current-L.json', function(req, out) {
    return http.get(URL, function(res) {
        var data;
        data = [];
        res.on("data", function(chunk) {
            return data.push(chunk);
        });
        return res.on("end", function() {
            var msg;
            data = Buffer.concat(data);
            msg = decoder.decode(data);
            console.log("proxying request for " + req.ip);
            return out.send(msg);
        });
    });
});

// static assets
app.get('/', function(req, res){
    res.sendFile(__dirname + '/static-www/index.html');
});

app.get('/:file', function(req, res) {
    var options = {
        root: __dirname + '/static-www/',
        dotfiles: 'deny',
        headers: {
            'x-timestamp': Date.now(),
            'x-sent': true
        }
    };
    return res.sendFile(req.params.file, options);
});

// emit to all connected browsers
// parse a fresh gtfs-realtime from mta
// sleep UPDATE_INTERVAL seconds
setInterval(function(){
    updateFeed();
} , UPDATE_INTERVAL * 1000);

// I broke these up so we don't have to hit mta /every/ time we update
// current trains
setInterval(function(){
    currentStops = trainPositions(mtaFeed);
    io.emit('feed update', currentStops);
} , 5 * 1000)

