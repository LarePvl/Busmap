
GMap = function($mdSidenav) {
    this.$mdSidenav = $mdSidenav;

    this.StopTarget = null;
    this.BusTarget = null;
    this.BusList = {};
    this.StopList = [];
    this.Stops = [];
    var that = this;
    // Load json file with a list of all bus stops
    $.get("js/stops.json").then(function(data) {
        that.StopList = data.map(function(d) {
            var s = d.split(",");
            that.Stops.push(s[1] + " - " + s[2]);
            return {code:s[1],name:s[2],zone:s[5]};
        });
    })

    // Create google map
    this.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 13,
        center: new google.maps.LatLng(61.4965058, 23.7543159),
        disableDefaultUI: true,
        mapTypeId: 'roadmap',
        clickableIcons: false
    });
    this.getBusses();
}

// Gets Bus routes from API and draws it on the map. Adds stops as well
GMap.prototype.getLine = function(bus) {
    var l = bus.LineRef + " " + bus.DirectionRef + "|" + bus.OriginName + " - " + bus.DestinationName;
    var that = this;
    $.get("https://cors-anywhere.herokuapp.com/http://api.publictransport.tampere.fi/prod/",{user:"Lare_",pass:"dDkVJbWrhBHUZahvj486",request:"lines",query:l,epsg_out:4326}).then(function(rdata) {
        var line = null;
        for(var i in rdata) {
            var cur = rdata[i];
            if(cur.code == bus.LineRef + " " + bus.DirectionRef && cur.line_end == bus.DestinationName && cur.line_start == bus.OriginName) {
                line = cur;
                break;
            }
        }
        if(line) {
            that.clearLine(bus); // Clears old route if switching from bus to another
            line.line_shape = line.line_shape.split("|").map(function(v) {
                var vals = v.split(",");
                return {lat: Number(vals[1]), lng:Number(vals[0])};
            });
            that.BusTarget.Stops = line.line_stops;
            that.BusTarget.Route = [];
            that.BusTarget.Route.push(new google.maps.Polyline({
                path:line.line_shape,
                geodesic: true,
                strokeColor: 'rgb(80, 198, 180)',
                strokeOpacity: 1.0,
                strokeWeight: 4,
                map:that.map
            }));
            for(var i in line.line_stops) {
                var cur = line.line_stops[i];
                var coords = cur.coords.split(",").map(Number);
                var stop = new google.maps.Marker({
                    map: that.map,
                    icon: "img/markers/StopMarker.png",
                    position: new google.maps.LatLng(coords[1],coords[0]),
                    Animation: google.maps.Animation.DROP,
                    list: cur
                });
                cur.Marker = stop;
                stop.addListener("click", function() {
                    that.setStopTarget(this.list);
                });
                bus.Route.push(stop);
            }
        }
    });
}

// Gets stop data from API
GMap.prototype.getStop = function(stop) {
    var that = this;
    var code = stop;
    if(typeof stop == "object") {
        code = stop.code;
    }
    $.get("https://cors-anywhere.herokuapp.com/http://api.publictransport.tampere.fi/prod/",{user:"Lare_",pass:"dDkVJbWrhBHUZahvj486",request:"stop",code:code,epsg_out:4326}).then(function(data) {
        if(!that.StopTarget) {
            that.StopTarget = {data:data[0]};
            var coords = data[0].wgs_coords.split(",").map(Number);
            that.StopTarget.Marker = new google.maps.Marker({
                map: that.map,
                icon: "img/markers/StopMarker.png",
                position: new google.maps.LatLng(coords[1],coords[0]),
                Animation: google.maps.Animation.DROP,
                list: that.StopTarget,
                lone: true
            });
            that.map.setCenter(new google.maps.LatLng(coords[1],coords[0]));
        } else {
            that.StopTarget.data = data[0];
        }
    });
}

// Remove all unmonitored busses
GMap.prototype.checkBusses = function() {
    for(var i in this.BusList) {
        var cur = this.BusList[i];
        if(this.BusTarget) {
            if(this.BusTarget.VehicleRef != cur.VehicleRef) {
                cur.Marker.setMap(null);
                delete this.BusList[i];
            }
        } else {
            if(--cur.Monitoring < 0) {
                cur.Marker.setMap(null);
                delete this.BusList[i];
            }
        }
    }
}

// Get all busses from API
GMap.prototype.getBusses = function() {
    var that = this;
    $.get("http://data.itsfactory.fi/siriaccess/vm/json").then(function(rdata) {
        var d = rdata.Siri.ServiceDelivery.VehicleMonitoringDelivery[0].VehicleActivity;
        for(var i in d) {
            var cur = d[i].MonitoredVehicleJourney;
            var data = {
                VehicleRef: cur.VehicleRef.value,
                LineRef: cur.LineRef.value,
                DirectionRef: cur.DirectionRef.value,
                OriginName: cur.OriginName.value,
                DestinationName: cur.DestinationName.value,
                VehicleLocation: cur.VehicleLocation,
                Monitoring: 10,
            };
            var pos = new google.maps.LatLng(data.VehicleLocation.Latitude, data.VehicleLocation.Longitude);
            var bus = that.BusList[data.VehicleRef];
            if(bus) {
                for(var i in data) {
                    bus[i] = data[i];
                }
                bus.Marker.setPosition(pos);
                if(bus.Marker.label != data.LineRef) bus.Marker.setLabel(data.LineRef);
            } else {
                data.Marker = new google.maps.Marker({
                    position: pos,
                    map: that.map,
                    icon: "img/markers/BusMarker.png",
                    label: data.LineRef,
                    Animation: google.maps.Animation.DROP,
                    list: data
                });
                data.Marker.addListener("click", function() {
                    that.setBusTarget(this.list);
                })
                that.BusList[data.VehicleRef] = data;
            }
        }
        that.checkBusses();
    });
}

// Clears the bus route that is shown in the map
GMap.prototype.clearLine = function(bus) {
    for(var i in bus.Route) {
        bus.Route[i].setMap(null);
    }
    bus.Route = [];
}

// Handles which bus is shown in the sidebar
GMap.prototype.setBusTarget = function(bus) {
    if(!bus && this.BusTarget) {
        this.clearLine(this.BusTarget);
        this.BusTarget = null;
    } else if(bus) {
        if(!this.BusTarget) {
            this.BusTarget = bus;
            this.getLine(bus);
            this.$mdSidenav("left").open();
        } else if(bus.VehicleRef == this.BusTarget.VehicleRef) {
            this.setBusTarget(null);
            if(!this.StopTarget && !this.BusTarget) {
                this.$mdSidenav("left").close();
            }
        }
    }
}

// Handles which stop is shown in the sidebar
GMap.prototype.setStopTarget = function(stop) {
    if(!stop && this.StopTarget) {
        this.StopTarget.Marker.setMap(null);
        this.StopTarget = null;
    } else if(stop) {
        if(typeof stop == "object") this.StopTarget = stop;
        this.getStop(stop);
        this.$mdSidenav("left").open();
    }
}

// Clears targets one at the time until finally disables the sidebar
GMap.prototype.clear = function() {
    if(this.StopTarget) {
        this.setStopTarget(null);
    } else if(this.BusTarget) {
        this.setBusTarget(null);
    }
    if(!this.StopTarget && !this.BusTarget) {
        this.$mdSidenav("left").close();
    }
}
